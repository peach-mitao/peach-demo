"""用 Peach 应用自己的入库流程建一个断网临时实例，导出各接口的字段结构，作为演示数据的后端参照。

演示站的数据由 `src/public-movies.ts` 等生成器按应用契约产出，并保留后端表达不了的演示特化（导演、
厂牌标识、未入库新作）。这里不录任何内容值，只导出「字段路径 → 类型」：`tests/backend-contract.test.ts`
据此检查生成器有没有落后于后端新增或改型的字段，前端同步后漂移会先在单测里暴露。

建库沿用应用的浏览器验收（tests/test_web_e2e.py 的 `_build_library`）：`demo_dataset` 的条目与 NFO 写法
生成媒体目录，迁移模板建空账本，配置只把 `local` 指向这个媒体目录，`process_library` 以断网来源工厂入库，
NFO 候选经复核接口批准。读取在进程内经真实路由完成，不起 HTTP 服务。

番号形状一律路由到成人资料站，所以断网是硬约束，三层同时生效：只请求纯账本读取的白名单接口；代理环境变量
（含 libcurl 认的小写）指向不可达端口；进程内拒绝连向非回环地址的套接字。

用法：python scripts/backend_reference.py <Peach 检出目录> <已认证图片目录> [--work <临时目录>]
"""
from __future__ import annotations

import argparse
import ipaddress
import json
import os
import re
import shutil
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "reference" / "backend-shapes.json"
DEFAULTS = ROOT / "reference" / "backend-defaults.json"
#: 与片目无关的默认值与空闲状态（口味分析会读本机浏览器来源，不在其列）：演示数据以后端的实际取值打底，演示特化覆盖在上面，后端新增字段自动带上默认值。
DEFAULT_ROUTES = (
    "/api/settings", "/api/media-processing", "/api/client-updates", "/api/sources", "/api/tasks",
    "/api/review", "/api/review?counts=1", "/api/duplicates?limit=120", "/api/quality-goals?limit=200", "/api/organize",
    "/api/media-repair", "/api/entity/shapes", "/api/configuration", "/api/configuration/storage", "/api/downloads", "/api/ads?limit=1",
)
#: 默认值里出现的本机路径换成演示站使用的占位路径。
DEMO_MEDIA, DEMO_DATA = "R:\\Media", "C:\\Users\\peach\\peach-data"
#: 参照库取片目前几部：覆盖 Blender 开放电影、带演员与多厂牌的经典片。
FILMS = 12
#: 只读账本、不触发抓取的接口。作品详情、发现、刮削、诊断与追更都会按番号或网址联网，不在其列。
ROUTES = (
    "/api/items?limit=60", "/api/item?id=1", "/api/item?id=6", "/api/related?id=1&limit=20", "/api/facets", "/api/libraries",
    "/api/sources", "/api/settings", "/api/stats", "/api/taste?window=all", "/api/tasks", "/api/downloads", "/api/wants",
    "/api/playlists", "/api/review", "/api/review?counts=1", "/api/duplicates?limit=120", "/api/quality-goals?limit=200",
    "/api/orphan-records", "/api/organize", "/api/library-processing", "/api/media-processing", "/api/media-repair",
    "/api/tag-management", "/api/tag-management?limit=20&offset=0&category=all&view=cloud&state=active&scope=local",
    "/api/index?kind=tags", "/api/index?kind=performers", "/api/index?kind=studios", "/api/entity/shapes",
    "/api/configuration", "/api/configuration/storage", "/api/client-updates", "/api/tutorial-progress",
    "/api/player/memory?video=item%3A1", "/api/search-history?limit=10", "/api/ads?limit=1",
)
DEAD_PROXY = "http://127.0.0.1:9"


def isolate_network() -> None:
    """代理指向不可达端口，进程内只放行回环地址的连接。"""
    for name in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        os.environ[name] = DEAD_PROXY
    for name in ("NO_PROXY", "no_proxy"):
        os.environ[name] = "127.0.0.1,localhost,testserver"
    original = socket.socket.connect

    def connect(self, address):
        host = address[0] if isinstance(address, tuple) else address
        try:
            loopback = ipaddress.ip_address(host).is_loopback
        except ValueError:
            loopback = host in ("localhost", "testserver")
        if not loopback:
            raise ConnectionRefusedError(f"后端参照禁止外发连接：{host}")
        return original(self, address)
    socket.socket.connect = connect


def refuse_network(*args, **kwargs):
    raise AssertionError("后端参照的 process 不应向任何外部来源发请求")


def load_app(app: Path) -> None:
    for path in (app / "src", app / "scripts", app / "tests", app):
        if str(path) not in sys.path:
            sys.path.insert(0, str(path))


def nfo_for(item, directors: list[str]) -> str:
    """应用的 NFO 写法去掉演示库自带的虚构简介，补上片目里的导演。"""
    from demo_dataset import render_nfo
    from xml.sax.saxutils import escape
    text = re.sub(r"\n  <plot>.*?</plot>", "", render_nfo(item))
    return text.replace("</movie>", "".join(f"  <director>{escape(name)}</director>\n" for name in directors) + "</movie>")


def write_media(catalog: dict, images: Path, media: Path, ffmpeg: str) -> None:
    """每部占位短片是官方海报循环两秒，抽帧与九宫格都派生自已认证图片。"""
    from demo_dataset import DemoItem
    from PIL import Image
    for index, film in enumerate(catalog["films"][:FILMS], 1):
        code, blender = f"FILM-{index:03d}", "blender.org" in film["credit"]
        item = DemoItem(kind="coded", path=f"{code}/{code}.mp4", code=code, title=film["title"],
                        original_title=film.get("original_title") or film["title"], orientation="横屏", duration=max(2, film["seconds"]),
                        visual_source="poster", studio=film["studio"], series="Blender Open Movies" if blender else "",
                        release_date=f"{film['year']}-01-01", performers=list(film["cast"]),
                        tags=[*film["tags"], *(["开放电影"] if blender else [])], nfo=f"{code}/{code}.nfo", poster=f"{code}/{code}-poster.jpg")
        (media / code).mkdir(parents=True, exist_ok=True)
        with Image.open(images / film["poster"]["file"]) as picture:
            picture.convert("RGB").save(media / item.poster, quality=92)
        (media / item.nfo).write_text(nfo_for(item, film["directors"]), encoding="utf-8")
        result = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", str(media / item.poster), "-t", "2",
                                 "-vf", "scale=640:-2,format=yuv420p", "-r", "12", "-c:v", "libx264", "-preset", "ultrafast", str(media / item.path)],
                                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
        if result.returncode:
            raise RuntimeError(f"海报短片生成失败：{code}：{result.stderr.strip()[:300]}")


def shape(value, at: str = "", out: dict | None = None) -> dict:
    """字段路径到类型；数组取前二十个元素的并集，不保留任何值。"""
    out = {} if out is None else out
    kind = "array" if isinstance(value, list) else "null" if value is None else "boolean" if isinstance(value, bool) \
        else "number" if isinstance(value, (int, float)) else "string" if isinstance(value, str) else "object"
    if at and (at not in out or out[at] == "null"):
        out[at] = kind
    if isinstance(value, list):
        for child in value[:20]:
            shape(child, at + "[]", out)
    elif isinstance(value, dict):
        for key, child in value.items():
            if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
                shape(child, f"{at}.{key}" if at else key, out)
    return out


def scrub(value, media: Path, data: Path, route: str = ""):
    """临时实例的路径换成演示占位路径；之后不允许再出现任何本机目录。"""
    text = json.dumps(value, ensure_ascii=False)
    for real, demo in ((media, DEMO_MEDIA), (data, DEMO_DATA)):
        for form in (str(real), str(real).replace("\\", "/")):
            text = text.replace(json.dumps(form)[1:-1], json.dumps(demo)[1:-1])
    forms = {json.dumps(str(path))[1:-1].casefold() for path in (Path.home(), ROOT)} | {str(path).replace("\\", "/").casefold() for path in (Path.home(), ROOT)}
    for form in forms:
        at = text.casefold().find(form)
        if at >= 0:
            raise RuntimeError(f"后端默认值仍含本机路径，拒绝写出：{route}：…{text[max(0, at - 80):at]}…")
    return json.loads(text)


def approve_candidates(client) -> int:
    """NFO 候选逐条批准；同一部片每批准一个字段版本号都会变，所以每次重读队列。"""
    approved = 0
    while True:
        rows = client.get("/api/review").json()["sections"]["metadata_fields"]
        if not rows:
            return approved
        row = rows[0]
        candidate = next((c for c in row.get("candidates", []) if c.get("source") == "local_nfo"), None)
        if candidate is None:
            raise RuntimeError(f"复核条目没有 NFO 候选：{row['item_key']}")
        pinned = row.get("asset_path") and row.get("asset_mutation_revision") is not None
        body = {"category": "metadata_fields", "item_key": row["item_key"], "status": "approved", "candidate_key": candidate["candidate_key"],
                "creator": row.get("creator"), "tags": row.get("tags"), "studio": row.get("studio"), "entity_id": row.get("entity_id"),
                "avatar_url": row.get("avatar_url"), "selected_ids": [row["asset_id"]] if row.get("asset_id") else [],
                **({"expected_revision": row["asset_mutation_revision"]} if pinned else {})}
        response = client.post("/api/review/decision", json=body)
        if response.status_code >= 400:
            raise RuntimeError(f"复核批准失败：{row['item_key']}：{response.status_code} {response.text[:200]}")
        approved += 1


def build(app: Path, images: Path, work: Path) -> dict:
    if work.exists():
        shutil.rmtree(work)
    media, data = work / "media", work / "peach-data"
    (data / "database").mkdir(parents=True)
    media.mkdir(parents=True)
    # 应用在导入时按数据根定下全部目录，环境变量必须先于任何 `peach` 导入。
    os.environ["PEACH_DATA_ROOT"] = str(data)
    isolate_network()
    load_app(app)
    from fastapi.testclient import TestClient
    from peach import settings_file
    from peach.api import create_app
    from peach.config import FFMPEG_DIR, PeachSettings
    from peach.ffmpeg import FFmpegResolver
    from peach.library_processing import process_library
    from support.demo import seed_metadata_cache
    from support.ledger import fresh_ledger

    catalog = json.loads((ROOT / "src" / "public-film-catalog.json").read_text(encoding="utf-8"))
    choice = FFmpegResolver(FFMPEG_DIR).ffmpeg()
    if choice is None:
        raise RuntimeError("应用未取得 ffmpeg")
    write_media(catalog, images, media, str(choice.path))
    db = fresh_ledger(data / "database")
    config = settings_file.PeachConfig(data, data / settings_file.SETTINGS_FILENAME, present=True, data_root_found=True,
                                       locations={"local": (str(media),)}, server=settings_file.ServerSettings(port=8795))
    settings_file.write(config)
    generated = config.directory("generated")
    seed_metadata_cache(media, config.directory("sources"))
    process_library(config, db, generated, generated / "covers", provider_factory=refuse_network)
    client = TestClient(create_app(PeachSettings(db_path=db, configured=True, token="")), base_url="http://127.0.0.1", client=("127.0.0.1", 50000))
    try:
        approved = approve_candidates(client)
        routes, defaults = {}, {}
        for route in ROUTES:
            response = client.get(route)
            if response.status_code == 404:
                print(f"跳过：应用没有这个接口：{route}")
                continue
            if response.status_code != 200 or "json" not in response.headers.get("content-type", ""):
                raise RuntimeError(f"参照接口不可读：{route}：{response.status_code}")
            routes[route] = dict(sorted(shape(response.json()).items()))
            if route in DEFAULT_ROUTES:
                defaults[route] = scrub(response.json(), media, data, route)
    finally:
        client.close()
    commit = subprocess.check_output(["git", "-C", str(app), "rev-parse", "HEAD"], text=True).strip()
    from peach import __version__
    head = {"schema": 1, "app_commit": commit, "app_version": __version__}
    return {**head, "films": FILMS, "approved": approved, "routes": routes}, {**head, "routes": defaults}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("app", type=Path)
    parser.add_argument("images", type=Path)
    parser.add_argument("--work", type=Path, default=ROOT / "evidence" / "backend-reference")
    args = parser.parse_args()
    reference, defaults = build(args.app.resolve(), args.images.resolve(), args.work.resolve())
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(reference, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    DEFAULTS.write_text(json.dumps(defaults, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"后端参照：{reference['app_version']} / {reference['app_commit'][:9]}，{len(reference['routes'])} 个接口，批准 {reference['approved']} 条候选。")


if __name__ == "__main__":
    main()
