// 从 Wikidata 与 Commons 补齐片目中人物照片和厂牌标识；只收自由许可且无争议模板的图片，逐图记录许可依据。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import type { PublicCatalog, PublicImage, PublicPerson, PublicStudio } from '../src/public-movies.ts';

const AGENT = 'PeachDemoCredits/1.0 (https://github.com/peach-mitao/peach-demo)';
const LANGUAGES = ['zh-hans', 'zh-cn', 'zh', 'zh-hant', 'zh-tw', 'zh-hk', 'en'];
const PORTRAIT_WIDTH = 240, LOGO_WIDTH = 480;
type Claims = Record<string, { mainsnak: { datavalue?: { value: any } } }[]>;
interface Entity { id: string; labels: Record<string, { value: string }>; claims: Claims }
export interface CommonsFile { title: string; url: string; thumb: string; revision: number; templates: string[]; meta: Record<string, string> }

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function json(url: string): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': AGENT } });
      if (response.status === 429 || response.status >= 500) throw Error(`HTTP ${response.status}`);
      if (!response.ok) throw Error(`HTTP ${response.status}：${url}`);
      return await response.json();
    } catch (error) {
      if (attempt >= 4) throw error;
      await sleep(attempt * 2000);
    }
  }
}
async function bytes(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': AGENT } });
      if (!response.ok) throw Error(`HTTP ${response.status}：${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= 4) throw error;
      await sleep(attempt * 2000);
    }
  }
}
const chunks = <T>(rows: T[], size: number) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, index * size + size));
const values = (entity: Entity | undefined, property: string): any[] => (entity?.claims[property] || []).map(row => row.mainsnak.datavalue?.value).filter(Boolean);
const ids = (entity: Entity | undefined, property: string): string[] => values(entity, property).map(value => value.id).filter(Boolean);
const labels = (entity: Entity) => LANGUAGES.map(language => entity.labels[language]?.value).filter(Boolean) as string[];
const shownName = (entity: Entity) => labels(entity)[0]!;
const portraitOf = (entity: Entity): string => REVIEWED_PORTRAITS[entity.id] || values(entity, 'P18')[0];
const englishName = (entity: Entity) => entity.labels.en?.value || shownName(entity);

async function entities(list: string[], props: string): Promise<Map<string, Entity>> {
  const found = new Map<string, Entity>();
  for (const batch of chunks([...new Set(list)], 50)) {
    const data = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=${props}&languages=${LANGUAGES.join('|')}&ids=${batch.join('|')}`);
    for (const [id, entity] of Object.entries(data.entities || {})) if (!(entity as { missing?: string }).missing) found.set(id, entity as Entity);
  }
  return found;
}

const text = (html = '') => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
async function commons(names: string[], width: number): Promise<Map<string, CommonsFile>> {
  const found = new Map<string, CommonsFile>();
  for (const batch of chunks([...new Set(names)], 20)) {
    const titles = batch.map(name => 'File:' + name).join('|');
    const pages = new Map<string, any>(), normalized = new Map<string, string>();
    // 模板列表跨页共享上限，必须跟随 continue 取完，否则许可模板会被截断。
    let next: Record<string, string> = {};
    do {
      const data = await json('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', titles,
        prop: 'imageinfo|revisions|templates', iiprop: 'url|extmetadata', iiurlwidth: String(width), rvprop: 'ids', tlnamespace: '10', tllimit: 'max', ...next }));
      for (const row of data.query?.normalized || []) normalized.set(row.to, row.from.slice(5));
      for (const page of data.query?.pages || []) {
        const seen = pages.get(page.title) || { title: page.title, missing: page.missing, templates: [] };
        seen.imageinfo ||= page.imageinfo; seen.revisions ||= page.revisions;
        seen.templates.push(...(page.templates || []).map((row: { title: string }) => row.title.slice(9)));
        pages.set(page.title, seen);
      }
      next = data.continue || {};
    } while (Object.keys(next).length);
    for (const page of pages.values()) {
      const info = page.imageinfo?.[0];
      if (!info || page.missing) continue;
      const meta = Object.fromEntries(Object.entries(info.extmetadata || {}).map(([key, value]) => [key, String((value as { value: unknown }).value ?? '')]));
      const file = { title: page.title, url: info.url, thumb: info.thumburl || info.url, revision: page.revisions?.[0]?.revid, templates: [...new Set<string>(page.templates)], meta };
      found.set(normalized.get(page.title) ?? page.title.slice(5), file);
      found.set(page.title.slice(5), file);
    }
  }
  return found;
}

// 只接受公有领域、CC0、CC BY 与 CC BY-SA；命中删除、侵权或缺来源模板一律跳过。
const CONCERN = /copyvio|delete|speedy|no permission|no source|no license|nsd|npd|nld|disputed|dw no source|fair use/i;
const LICENCE = /^(PD-|PD$|Cc-|CC-|Cc0|CC0|Cc-zero|Trademarked|Public domain|Copyrighted free use)/i;
export function licence(file: CommonsFile) {
  const short = text(file.meta.LicenseShortName), concerns = file.templates.filter(name => CONCERN.test(name));
  const free = /public domain|^pd\b|^pd-|cc0|cc ?by(-sa)? ?\d|cc-by(-sa)?-\d|copyrighted free use/i.test(short) && !/-nc|-nd|\bnc\b|\bnd\b|fair/i.test(short);
  if (!free || concerns.length || file.meta.NonFree === 'true' || !file.revision) return null;
  const licences = file.templates.filter(name => LICENCE.test(name) && !name.includes('/')).map(name => ({ name, parameters: '' }));
  if (!licences.length) return null;
  const publicDomain = /public domain|^pd/i.test(short) || /cc0|zero/i.test(short);
  return { short: publicDomain && !/cc0|zero/i.test(short) ? 'Public domain' : short, url: publicDomain && !/cc0|zero/i.test(short) ? 'https://commons.wikimedia.org/wiki/Help:Public_domain' : (file.meta.LicenseUrl || 'https://commons.wikimedia.org/wiki/Help:Public_domain'), licences, concerns };
}

// 人工复核排除的图片：合影、片场或字幕剧照无法确定本人位置，建筑与邮票不是公司标识。
export const REVIEWED_OUT: Record<string, string> = {
  Q2271997: '画面不止一人', Q3565478: '合影',
  Q141336: '邮票图案而非标识', Q1544011: '建筑照片而非标识', Q4288857: '建筑照片而非标识', Q3739165: '厂区插图而非标识',
};
// Wikidata 主图是合影或剧照时，改用同一人物 Commons 分类里经复核的单人照。
export const REVIEWED_PORTRAITS: Record<string, string> = { Q2011506: 'Albert Parker Jan 1926.jpg', Q447847: 'Dorothy Arzner 1929.jpg' };
// 没有 Wikidata 影片条目的开放电影，按署名直接对应人物条目。
export const CREDITED: Record<string, string> = { 'Derek de Lint': 'Q1200141', 'Sergio Hasselbaink': 'Q15881854' };
// 开放电影的出品方：Blender Institute 与 Blender Studio 隶属基金会、没有独立标识条目，沿用基金会标识。
export const CREDITED_STUDIOS: Record<string, string> = { 'Blender Foundation': 'Q883799', 'Blender Institute': 'Q883799', 'Blender Studio': 'Q883799' };

// 厂牌标识复用应用入库时的 `peach.images.bake_square`：裁透明边、按内容明暗选底色、烤成不透明方图，
// 与生产馆藏的厂牌图标同一套规则。需要应用检出及其 Python 环境（同 record_entry_pages.py）。
const BAKE = 'import os,sys;sys.path.insert(0,os.path.join(os.environ["PEACH_APP"],"src"));from peach.images import bake_square;'
  + 'out=bake_square(sys.stdin.buffer.read());sys.stdout.buffer.write(out or b"")';
export function bakeSquare(payload: Buffer, app = process.env.PEACH_APP): Buffer {
  if (!app) throw Error('厂牌标识需要应用检出：设置 PEACH_APP=<Peach 检出目录>');
  const python = path.join(app, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
  const baked = execFileSync(python, ['-c', BAKE], { input: payload, env: { ...process.env, PEACH_APP: app }, maxBuffer: 64 << 20 });
  if (!baked.length) throw Error('应用未能把标识烤成方图');
  return baked;
}

// 竖幅人像从顶部取正方形，圆形头像才会落在脸上而不是躯干。
async function image(file: CommonsFile, name: string, width: number, changes: string, directory: string, shape: 'portrait' | 'logo'): Promise<PublicImage & Record<string, unknown> | null> {
  const granted = licence(file);
  if (!granted) return null;
  const raw = await bytes(file.thumb);
  let picture = sharp(shape === 'logo' ? bakeSquare(raw) : raw);
  const { width: w = 0, height: h = 0 } = await picture.metadata();
  if (shape === 'portrait' && h > w * 1.15) {
    picture = sharp(await picture.extract({ left: 0, top: Math.round(Math.min(h - w, h * 0.02)), width: w, height: w }).toBuffer());
    changes = changes.replace('缩放至', '从顶部裁成正方形后缩放至');
  }
  const body = await sharp(await picture.png().toBuffer()).resize({ width, withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toBuffer();
  await writeFile(path.join(directory, name), body);
  const source = 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(file.title.replaceAll(' ', '_')).replace(/%3A/g, ':');
  const evidence = `https://commons.wikimedia.org/w/index.php?title=${encodeURIComponent(file.title)}&oldid=${file.revision}`;
  return { url: file.url, source, title: file.title, artist: text(file.meta.Artist) || '未署名', credit: text(file.meta.Credit), license: granted.short, license_url: granted.url,
    sha256: createHash('sha256').update(body).digest('hex'), bytes: body.length, changes, file: name,
    license_evidence: { title: file.title, revision: file.revision, source: evidence, licences: granted.licences, concerns: granted.concerns }, license_source: evidence };
}

export async function fetchPublicCredits(catalogFile: string, directory: string) {
  const catalog: PublicCatalog & { schema: number; description: string } = JSON.parse(await readFile(catalogFile, 'utf8'));
  await mkdir(directory, { recursive: true });
  const known = new Set(catalog.people.flatMap(person => [person.name, person.original_name]));
  const films = await entities(catalog.films.flatMap(film => film.wikidata ? [film.wikidata] : []), 'claims');
  const related = [...films.values()].flatMap(film => [...ids(film, 'P57'), ...ids(film, 'P161'), ...ids(film, 'P272')]);
  const linked = await entities([...related, ...Object.values(CREDITED), ...Object.values(CREDITED_STUDIOS)], 'labels|claims');
  const wanted = new Map<string, { entity: Entity; films: Set<string>; names: Set<string> }>(), studios = new Map<string, Entity>();
  for (const film of catalog.films) {
    const source = film.wikidata ? films.get(film.wikidata) : undefined;
    for (const name of [...film.directors, ...film.cast]) {
      if (known.has(name)) continue;
      const match = CREDITED[name] ? linked.get(CREDITED[name]!)
        : [...ids(source, 'P57'), ...ids(source, 'P161')].map(id => linked.get(id)).find(entity => entity && labels(entity).includes(name));
      if (!match) continue;
      const row = wanted.get(match.id) || wanted.set(match.id, { entity: match, films: new Set(), names: new Set() }).get(match.id)!;
      row.films.add(film.wikidata || film.slug); row.names.add(name);
    }
    const first = film.studio.split('、')[0];
    const company = CREDITED_STUDIOS[first!] ? linked.get(CREDITED_STUDIOS[first!]!)
      : first && ids(source, 'P272').map(id => linked.get(id)).find(entity => entity && labels(entity).includes(first));
    if (company && !studios.has(film.studio)) studios.set(film.studio, company);
  }
  const portraits = await commons([...wanted.values()].flatMap(row => [portraitOf(row.entity)].filter(Boolean)), PORTRAIT_WIDTH);
  const logos = await commons([...studios.values()].flatMap(entity => values(entity, 'P154').slice(0, 1)), LOGO_WIDTH);
  const people: PublicPerson[] = [], skipped: string[] = [];
  for (const { entity, films: credited, names } of wanted.values()) {
    const name = shownName(entity), original = englishName(entity), credited_as = [...names].filter(value => value !== name && value !== original);
    const existing = catalog.people.find(row => row.id === entity.id);
    if (existing) {
      // 已收录人物只补署名写法，照片沿用原记录。
      existing.credited_as = [...new Set([...(existing.credited_as || []), ...credited_as])];
      continue;
    }
    if (REVIEWED_OUT[entity.id]) { skipped.push(`${original}（${REVIEWED_OUT[entity.id]}）`); continue; }
    const file = portraits.get(portraitOf(entity));
    const portrait = file && await image(file, `person-${entity.id.toLowerCase()}.webp`, PORTRAIT_WIDTH, `缩放至${PORTRAIT_WIDTH}像素宽并转换为WebP；头像按圆形容器裁切。`, directory, 'portrait');
    if (!portrait) { skipped.push(original); continue; }
    people.push({ id: entity.id, name, original_name: original, source: `https://www.wikidata.org/wiki/${entity.id}`, films: [...credited],
      ...(credited_as.length ? { credited_as } : {}), portrait });
  }
  const marks: PublicStudio[] = [];
  for (const [name, entity] of studios) {
    if (REVIEWED_OUT[entity.id]) { skipped.push(`${name}（${REVIEWED_OUT[entity.id]}）`); continue; }
    const file = logos.get(values(entity, 'P154')[0]);
    const logo = file && await image(file, `studio-${entity.id.toLowerCase()}.webp`, LOGO_WIDTH, `按 Peach 应用的厂牌图标规则烤成不透明方图，缩放至${LOGO_WIDTH}像素宽并转换为WebP；按容器缩放显示。`, directory, 'logo');
    if (logo) marks.push({ id: entity.id, name, original_name: englishName(entity), source: `https://www.wikidata.org/wiki/${entity.id}`, logo });
    else skipped.push(name);
  }
  catalog.people = [...catalog.people, ...people.filter(person => !catalog.people.some(row => row.id === person.id))];
  catalog.studios = marks;
  await writeFile(catalogFile, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`人物照片新增 ${people.length} 位（候选 ${wanted.size}），厂牌标识 ${marks.length} 家（候选 ${studios.size}）。未取得：${skipped.join('、') || '无'}`);
  return { people: people.length, studios: marks.length, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [directory, catalogFile = fileURLToPath(new URL('../src/public-film-catalog.json', import.meta.url))] = process.argv.slice(2);
  if (!directory) throw Error('用法：PEACH_APP=<Peach 检出目录> NODE_USE_ENV_PROXY=1 node scripts/fetch_public_credits.ts <图片输出目录> [片目文件]');
  await fetchPublicCredits(catalogFile, path.resolve(directory));
}
