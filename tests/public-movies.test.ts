import test from 'node:test';
import assert from 'node:assert/strict';
import { publicMovies, FILMS, PEOPLE, responseShape } from '../src/public-movies.ts';
import { preparePublicMovies, verifyPublicMovies } from '../scripts/prepare_public_movies.ts';
import { prepareShowcase } from '../scripts/prepare_showcase.ts';
import { fixtureHash, fixtureKey } from '../src/key.ts';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

test('普通电影数据集只使用可核实的影片身份并标明演示行为', () => {
  const data = publicMovies();
  assert.equal(data.catalog.items.length, FILMS.length);
  assert.ok(data.catalog.items.every(item => item.is_jav && item.demo && item.demo_notice.includes('演示数据')));
  assert.ok(data.catalog.items.every(item => ['local', '115'].includes(item.location)), '全部影片属于应用默认可浏览来源');
  assert.deepEqual(data.catalog.items.map(item => item.catalog_title), FILMS.map(film => film.title));
  const cast = data.indexes.performers.items.map(row => row.k);
  assert.ok(cast.includes('Derek de Lint') && cast.includes('Sergio Hasselbaink'));
  assert.ok(cast.includes(PEOPLE[0]!.name));
  for (const row of data.indexes.performers.items) {
    const person = PEOPLE.find(person => person.name === row.k || person.original_name === row.k);
    assert.equal(row.has_image, !!person);
    if (person) assert.equal(data.imageRoutes.get(`/entity-image?kind=performer&id=${row.entity_id}`), person.id);
  }
  for (const row of data.catalog.items) {
    assert.ok(data.routes.has(`/api/item?id=${row.id}`));
    assert.ok(data.routes.has(`/api/jav/detail?code=${row.code}`));
    assert.ok(data.imageRoutes.has(`/cover?code=${row.code}`));
    assert.ok(data.imageRoutes.has(`/cover?code=${row.code}&thumb=1`));
    assert.ok(data.imageRoutes.has(`/poster?id=${row.id}&c=4`));
    assert.equal(data.routes.get(`/api/playback-plan?id=${row.id}`).available, false);
  }
});

test('名册、搜索、推荐、关注和业务状态共享普通电影身份', () => {
  const data = publicMovies(), ids = new Set(data.catalog.items.map(row => row.id));
  assert.equal(data.suggestion.assets.length, ids.size);
  for (const rows of Object.values(data.indexes)) for (const row of rows.items) {
    if (!('entity_id' in row)) continue;
    assert.ok(data.routes.has(`/api/entity?kind=${row.entity_kind}&id=${row.entity_id}`));
  }
  const follow = data.routes.get('/api/follow?limit=100&offset=0');
  assert.equal(follow.groups.length, Math.min(FILMS.length, 36));
  assert.ok(follow.groups.every((group: any) => ids.has(group.primary.asset_id) && group.primary.playable === false));
  assert.deepEqual(data.recorded['/api/downloads'].tasks.map(row => row.state), ['remote_running', 'ingested', 'failed']);
  assert.equal(data.routes.get('/api/stats').attribution.videos, FILMS.length);
  assert.equal(data.routes.get('/api/stats').attribution.studio, FILMS.filter(film => film.studio).length);
  assert.equal(data.routes.get('/api/stats').by_loc.reduce((sum: number, row: { n: number }) => sum + row.n, 0), FILMS.length);
  assert.equal(data.routes.get('/api/stats').by_length.reduce((sum: number, row: { n: number }) => sum + row.n, 0), FILMS.length);
  assert.ok(data.routes.get('/api/sources').sources.some((row: { location: string }) => row.location === 'local'));
  assert.equal(data.routes.get('/api/libraries').libraries.length, 1);
  assert.equal(data.routes.get('/api/library-processing').status, 'complete');
  assert.equal(data.routes.get('/api/library-processing').total, ids.size);
  assert.deepEqual(data.routes.get('/api/network-status'), { state: 'online', checked_at: null, demo: true });
  assert.deepEqual(data.routes.get('/api/background-issues').issues, []);
  assert.equal(data.routes.get('/api/feeds/schedule').enabled, false);
  assert.deepEqual(data.routes.get('/api/review').sections, {});
  assert.ok(data.routes.get('/api/taste').analysis.headline.includes('演示'));
});

test('公开头像候选为空时仍提供完整身份与图库状态', () => {
  const data=publicMovies();
  for(const row of data.indexes.performers.items){
    const choices=data.routes.get(`/api/avatar-choices?kind=performer&id=${row.entity_id}`);
    assert.equal(choices.entity_id,row.entity_id);
    assert.deepEqual(choices.names,[row.k]);
    assert.deepEqual(choices.matched_names,[]);
    assert.deepEqual(choices.choices,[]);
    assert.equal(choices.index_stale,false);
  }
});

test('缺失导演和厂牌不产生虚构身份或人物封面替身', () => {
  const film = { ...FILMS[0]!, slug: 'unknown-credit', studio: '', directors: [], cast: [], credit: 'https://www.wikidata.org/wiki/Q1', tags: ['剧情片'] };
  const data = publicMovies([film], []);
  assert.deepEqual(data.indexes.creators.items, []);
  assert.deepEqual(data.indexes.studios.items, []);
  assert.equal(data.catalog.items[0]!.creator, '');
  assert.equal(data.catalog.items[0]!.series, '');
  assert.deepEqual(data.catalog.items[0]!.tags, ['剧情片']);
  assert.ok(![...data.imageRoutes.keys()].some(route => route.startsWith('/entity-image')));
  assert.equal(data.routes.get('/api/wants').items[0].code, 'FILM-001');
});

test('结构模板不复制来源文字、记录数组或动态字段', () => {
  const shape = responseShape({ title: 'private title', source_url: 'https://private.example', total: 123, items: [{ name: 'private actor' }], 'private.example': 'secret', nested: { label: 'secret' } });
  assert.deepEqual(shape, { title: '', source_url: '', total: 0, items: [], nested: { label: '' } });
});

test('普通电影发布门槛验证派生配置并拒绝混入旧响应和图片', async () => {
  const directory = path.resolve(await mkdtemp(path.join(tmpdir(), 'peach-public-films-')));
  try {
    const template = path.join(directory, 'template'), pictures = path.join(directory, 'pictures'), site = path.join(directory, 'site');
    for (const folder of [template, pictures, path.join(site, '_demo'), path.join(site, '_fixtures'), path.join(site, 'integrations')]) await mkdir(folder, { recursive: true });
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#648395' } }).webp().toBuffer();
    const fixtureData = { films: FILMS.slice(0, 5).map(film => ({ ...film, poster: { ...film.poster, sha256: createHash('sha256').update(image).digest('hex'), bytes: image.length } })), people: [] };
    for (const film of fixtureData.films) await writeFile(path.join(pictures, film.poster.file), image);
    const hash = (route: string) => fixtureHash(fixtureKey('GET', new URL(route, 'https://demo.example')));
    const manifest = { fixtures: {} as Record<string, string>, alias: {}, paths: [] };
    for (const [route, data] of Object.entries({ '/api/configuration': { updates: {}, facts: [], tunnel: {}, push_discovery: {}, title: 'private film' }, '/healthz': { ok: true } })) {
      const key = await hash(route); manifest.fixtures[key] = 'json'; await writeFile(path.join(template, `${key}.json`), JSON.stringify(data));
    }
    await writeFile(path.join(template, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(path.join(site, '_demo/frontend-source.json'), JSON.stringify({ commit: 'test-commit', version: '1.0.0' }));
    await writeFile(path.join(site, '_fixtures/entry-pages.json'), JSON.stringify({ commit: 'test-commit' }));
    await writeFile(path.join(site, 'integrations/jav-userscript-release.json'), JSON.stringify({ version: '0.4.0', bridge_min_version: '0.4.0', install_url: '/integrations/peach-jav.user.js' }));
    await writeFile(path.join(site, 'integrations/jav-sites.json'), JSON.stringify({ sites: [] }));
    await preparePublicMovies(template, pictures, site, fixtureData);
    assert.equal((await verifyPublicMovies(site, fixtureData)).films, fixtureData.films.length);
    await prepareShowcase(site);
    assert.equal((await verifyPublicMovies(site, fixtureData)).videos, 0);
    const statsFile = path.join(site, '_fixtures', await hash('/api/stats') + '.json');
    const stats = await readFile(statsFile);
    await writeFile(statsFile, JSON.stringify({ title: 'private film', items: [] }));
    await assert.rejects(verifyPublicMovies(site, fixtureData), /素材校验失败/);
    await writeFile(statsFile, stats);
    const saved = path.join(site, '_fixtures/manifest.json'), live = JSON.parse(await readFile(saved, 'utf8'));
    live.fixtures['0'.repeat(20)] = 'json';
    await writeFile(path.join(site, '_fixtures', '0'.repeat(20) + '.json'), JSON.stringify({ secret: 'unapproved content' }));
    await writeFile(saved, JSON.stringify(live));
    await assert.rejects(verifyPublicMovies(site, fixtureData), /素材校验失败/);
    delete live.fixtures['0'.repeat(20)]; await writeFile(saved, JSON.stringify(live));
    await writeFile(path.join(site, '_demo/follow/unapproved.webp'), image);
    await assert.rejects(verifyPublicMovies(site, fixtureData), /关注图片包含未批准素材/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
