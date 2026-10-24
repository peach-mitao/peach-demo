import { mkdir, readFile, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fixtureKey, fixtureHash } from '../src/key.ts';
import { PUBLIC_CATALOG, MOVIE_READS, DEMO_DATA_NOTICE, publicMovies, responseShape } from '../src/public-movies.ts';
import type { PublicCatalog, PublicImage } from '../src/public-movies.ts';
import type { FixtureManifest } from '../src/types.ts';
import { configuration, downloads, downloadCheck, cloudProxies, providers } from '../src/showcase.ts';
import { tagInventory } from '../src/tag-management.ts';

const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const routeHash = (route: string) => fixtureHash(fixtureKey('GET', new URL(route, 'https://demo.example')));

// 发布门槛接受生成器原件与 prepareShowcase 的确定性派生，拒绝混入旧录制包。
export async function verifyPublicMovies(site: string, dataset: PublicCatalog = PUBLIC_CATALOG) {
  const fixtures = path.join(site, '_fixtures');
  const read = async (name: string) => JSON.parse(await readFile(path.join(fixtures, name), 'utf8'));
  const certificate = await read('public-movie-sources.json');
  const { films, people } = dataset, expected = publicMovies(films, people);
  if (certificate.schema !== 1 || JSON.stringify(certificate.films) !== JSON.stringify(films) || JSON.stringify(certificate.people) !== JSON.stringify(people)) throw Error('普通电影来源证明无效');
  for (const [key, image] of imageSources(dataset)) if (certificate.images[key] !== image.sha256) throw Error(`普通电影图片来源证明无效：${key}`);
  for (const [file, data] of Object.entries({ 'catalog.json': expected.catalog, 'indexes.json': expected.indexes, 'suggest.json': expected.suggestion, 'recorded-state.json': expected.recorded }))
    if (JSON.stringify(await read(file)) !== JSON.stringify(data)) throw Error(`普通电影数据不匹配：${file}`);
  const allowed: Record<string, string> = { ...certificate.hashes };
  const derived = new Map<string, unknown>();
  try {
    const info = JSON.parse(await readFile(path.join(site, '_demo/frontend-source.json'), 'utf8'));
    const release = JSON.parse(await readFile(path.join(site, 'integrations/jav-userscript-release.json'), 'utf8'));
    const sites = JSON.parse(await readFile(path.join(site, 'integrations/jav-sites.json'), 'utf8')).sites;
    const config = configuration(certificate.configuration, info.version);
    derived.set('/api/configuration', config);
    derived.set('/healthz', { ...certificate.health, version: info.version, build_commit: info.commit });
    derived.set('/api/configuration/downloads', downloads());
    derived.set('/api/configuration/downloads/check', downloadCheck());
    derived.set('/api/configuration/downloads/pikpak/browser-login', downloads());
    derived.set('/api/configuration/cloud-proxies', cloudProxies());
    derived.set('/api/configuration/jav-browser', { enabled: true, provider: '115', active_provider: '115', available: true, problems: [], providers, sites,
      userscript: { version: release.version, minimum_version: release.bridge_min_version, install_url: release.install_url } });
    derived.set('/api/configuration/indexers', { indexers: [{ key: 'demo-torznab', name: '演示索引器', url: 'https://indexer.example.com/api', enabled: true, api_key_set: true }], max_indexers: 4 });
    derived.set('/api/tag-management', tagInventory(expected.indexes));
    derived.set('/api/tag-management?scope=online', tagInventory(expected.indexes, 'online'));
    const snapshot = { ...expected.recorded['/api/downloads'], providers };
    derived.set('/api/downloads', snapshot); derived.set('/api/downloads?limit=50', snapshot);
    for (const key of ['automatic_updates', 'remote_reporting', 'library_sharing']) derived.set('/api/configuration/' + key.replaceAll('_', '-'), config[key]);
    derived.set('/api/configuration/library-sharing/preview', { data: { library: expected.catalog.items.slice(0, 3).map(item => ({ code: item.code, rating: item.rating, tags: item.tags })), preferences: { tags: ['剧情', '旅行'] }, coverage: { uncoded_items: 0 } }, bytes: 1024, token: 'demo-preview', schema: 1 });
    for (const [route, value] of derived) allowed[await routeHash(route) + '.json'] = digest(JSON.stringify(value));
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error;
  }
  const manifest: Required<FixtureManifest> = await read('manifest.json');
  if (JSON.stringify(manifest.alias) !== JSON.stringify(certificate.aliases)) throw Error('普通电影图片别名不匹配');
  for (const [key, ext] of Object.entries(manifest.fixtures)) {
    if (!/^[a-f0-9]{20}$/.test(key) || !['json', 'webp'].includes(ext)) throw Error('普通电影素材类型无效');
    const file = `${key}.${ext}`, actual = digest(await readFile(path.join(fixtures, file)));
    // 派生配置允许在 prepareShowcase 前或后检查。
    if (actual !== allowed[file] && actual !== certificate.hashes[file]) throw Error(`普通电影素材校验失败：${file}`);
  }
  for (const file of Object.keys(certificate.hashes)) {
    const key = file.slice(0, 20);
    if (!manifest.fixtures[key]) throw Error(`普通电影素材缺失：${file}`);
  }
  const follow = path.join(site, '_demo/follow');
  const followFiles = await readdir(follow);
  if (followFiles.sort().join('|') !== films.map(film => `${film.slug}.webp`).sort().join('|')) throw Error('关注图片包含未批准素材');
  for (const film of films)
    if (digest(await readFile(path.join(follow, `${film.slug}.webp`))) !== certificate.images[film.slug]) throw Error(`关注图片来源不匹配：${film.slug}`);
  const media = JSON.parse(await readFile(path.join(site, '_media/index.json'), 'utf8'));
  if (Object.keys(media.videos ?? {}).length || (await readdir(path.join(site, '_media'))).some(name => name !== 'index.json')) throw Error('普通电影演示包不得包含视频');
  return { films: films.length, people: people.length, fixtures: Object.keys(manifest.fixtures).length, videos: 0 };
}

function imageSources(dataset: PublicCatalog): Map<string, PublicImage> {
  return new Map([...dataset.films.map(film => [film.slug, film.poster] as const), ...dataset.people.map(person => [person.id, person.portrait] as const)]);
}

export async function preparePublicMovies(templateDirectory: string, imageDirectory: string, site: string, dataset: PublicCatalog = PUBLIC_CATALOG) {
  const { films, people } = dataset;
  const fixtures = path.join(site, '_fixtures');
  if (path.resolve(templateDirectory) === path.resolve(fixtures)) throw Error('结构模板必须与输出目录分开');
  const original: FixtureManifest = JSON.parse(await readFile(path.join(templateDirectory, 'manifest.json'), 'utf8'));
  // 先验证图片齐备，再修改输出，避免残缺数据集。
  for (const [key, source] of imageSources(dataset)) {
    if (!/^[a-z0-9-]+\.webp$/i.test(source.file) || !/^[a-f0-9]{64}$/.test(source.sha256)) throw Error(`图片来源字段无效：${key}`);
    const body = await readFile(path.join(imageDirectory, source.file));
    if (digest(body) !== source.sha256 || body.length !== source.bytes) throw Error(`图片内容与来源清单不符：${source.file}`);
  }
  const target = path.resolve(fixtures);
  if (path.dirname(target) !== path.resolve(site) || path.basename(target) !== '_fixtures') throw Error('夹具输出目录无效');
  await mkdir(fixtures, { recursive: true });
  // 输出仅含本脚本新建的素材；入口页由同源前端同步流程单独维护。
  for (const name of await readdir(fixtures)) if (name !== 'entry-pages.json') await rm(path.join(fixtures, name), { recursive: false, force: true });
  const follow = path.join(site, '_demo/follow');
  await mkdir(follow, { recursive: true });
  for (const name of await readdir(follow)) await rm(path.join(follow, name), { recursive: false, force: true });
  const media = path.join(site, '_media');
  await mkdir(media, { recursive: true });
  for (const name of await readdir(media)) await rm(path.join(media, name), { recursive: false, force: true });
  const manifest: Required<FixtureManifest> = { fixtures: {}, alias: {}, paths: ['/healthz', '/thumb', '/poster', '/cover', '/avatar', '/entity-image', '/logo', '/follow-cover', '/follow-stream'] };
  const hash = routeHash;
  const hashes: Record<string, string> = {}, routeNames: Record<string, string> = {};
  const images: Record<string, string> = {};
  let configurationSeed: any, healthSeed: any;
  const write = async (route: string, data: unknown) => {
    const key = await hash(route); manifest.fixtures[key] = 'json';
    const body = JSON.stringify(data);
    await writeFile(path.join(fixtures, `${key}.json`), body);
    hashes[`${key}.json`] = digest(body); routeNames[key] = route;
  };
  for (const route of ['/healthz', ...MOVIE_READS.map(name => '/api/' + name)]) {
    const own = await hash(route), key = original.alias?.[own] ?? own;
    let skeleton: any = { ok: true, items: [], total: 0 };
    if (original.fixtures[key] === 'json') skeleton = responseShape(JSON.parse(await readFile(path.join(templateDirectory, `${key}.json`), 'utf8')));
    if (route === '/api/configuration') configurationSeed = skeleton;
    if (route === '/healthz') healthSeed = skeleton;
    await write(route, skeleton);
  }
  const data = publicMovies(films, people);
  for (const [route, value] of data.routes) await write(route, value);
  const imageKeys = new Map<string, string>();
  for (const [identifier, source] of imageSources(dataset)) {
    const index = films.findIndex(film => film.slug === identifier);
    const route = index >= 0 ? `/cover?code=FILM-${String(index + 1).padStart(3, '0')}` : `/entity-image?person=${encodeURIComponent(identifier)}`;
    const key = await hash(route); manifest.fixtures[key] = 'webp'; imageKeys.set(identifier, key);
    images[identifier] = source.sha256;
    hashes[`${key}.webp`] = source.sha256;
    await copyFile(path.join(imageDirectory, source.file), path.join(fixtures, `${key}.webp`));
    if (index >= 0) await copyFile(path.join(imageDirectory, source.file), path.join(follow, `${identifier}.webp`));
  }
  for (const [route, slug] of data.imageRoutes) {
    const own = await hash(route), key = imageKeys.get(slug)!;
    if (own !== key) manifest.alias[own] = key;
  }
  for (const [name, value] of Object.entries({ 'catalog.json': data.catalog, 'indexes.json': data.indexes, 'suggest.json': data.suggestion,
    'recorded-state.json': data.recorded, 'manifest.json': manifest, 'public-movie-sources.json': { schema: 1, notice: DEMO_DATA_NOTICE, films, people, hashes, images, aliases: manifest.alias, routes: routeNames, configuration: configurationSeed, health: healthSeed } }))
    await writeFile(path.join(fixtures, name), JSON.stringify(value));
  await writeFile(path.join(media, 'index.json'), JSON.stringify({ version: 1, videos: {} }));
  console.log(`普通电影演示数据：${films.length} 部影片、${people.length} 位人物、${data.routes.size} 个响应、${data.imageRoutes.size} 个图片地址；无视频。`);
  return { films: films.length, responses: data.routes.size, images: data.imageRoutes.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [template, images, target = fileURLToPath(new URL('../site/', import.meta.url))] = process.argv.slice(2);
  if (!template || !images) throw Error('用法：node scripts/prepare_public_movies.ts <旧夹具结构目录> <官方影片图片目录> [site目录]');
  await preparePublicMovies(path.resolve(template), path.resolve(images), path.resolve(target));
}
