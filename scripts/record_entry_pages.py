"""从指定应用检出录制入口页；只使用占位配置，不访问账本或服务。"""
import argparse
import json
import sys
import subprocess
from pathlib import Path
from types import SimpleNamespace


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    source = args.source.resolve()
    sys.path.insert(0, str(source / "src"))
    from peach import onboarding
    from peach.routes_auth import login_html
    from peach.routes_jav_browser import userscript_bridge
    from peach.routes_pages import setup_shell, _question_view, _CLOUD_HELP, _CLOUD_HELP_URL, _CLOUD_HELP_LABEL
    from peach.media_configuration import SOURCE_OPTIONS

    target = Path(__file__).resolve().parents[1] / "site" / "_fixtures"
    config = SimpleNamespace(data_root=Path("C:/Users/peach/peach-data"), server=SimpleNamespace(port=8900, mdns_name="peach"))
    asked = onboarding.questions(config, windows=True, home=Path("C:/Users/peach"))
    defaults = {"media_dir": "R:\\Media", "data_root": "C:\\Users\\peach\\peach-data"}
    questions = []
    for question in asked:
        view = _question_view(question)
        item = dict(view, key=question.key, help=[view["help"]] if view["help"] else [],
                    default=defaults.get(question.key, question.default), required=question.key != "host",
                    advanced=question.key != "media_dir")
        if question.key == "host":
            item["options"] = [{"value": value, "label": label} for value, label in reversed(onboarding.HOST_OPTIONS)]
        if question.key == "mdns_name":
            item["visible_when"] = {"host": "2"}
        questions.append(item)
    payload = dict(windows=True, standalone=False, questions=questions,
                   media_sources=[{"value": value, "label": label} for value, label in SOURCE_OPTIONS],
                   media_source_default="local", media_root=None, access_enabled=False, scan_now=True, history_guide=False,
                   cloud={"help": _CLOUD_HELP, "link": {"url": _CLOUD_HELP_URL, "label": _CLOUD_HELP_LABEL}, "dependencies": []})
    payload["remote_reporting"] = {"usage": False, "errors": False, "available": True,
                                   "fields": {"usage": "版本与系统信息", "errors": "故障类型与代码位置"}, "notice": ""}
    commit = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
    bridge = userscript_bridge()
    pages = {"commit": commit, "login": login_html("/"), "setup": setup_shell(), "questions": payload,
             "userscript_bridge": {"html": bytes(bridge.body).decode('utf-8'), "headers": dict(bridge.headers)}}
    target.mkdir(parents=True, exist_ok=True)
    (target / "entry-pages.json").write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
    print("已录制应用登录页、首次设置页与题目；未读取真实配置。")


if __name__ == "__main__":
    main()
