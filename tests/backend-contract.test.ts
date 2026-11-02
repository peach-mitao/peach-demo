import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import worker from '../src/worker.ts';
import { FILMS, PEOPLE, STUDIOS } from '../src/public-movies.ts';
import { fixtureHash, fixtureKey } from '../src/key.ts';
import { preparePublicMovies } from '../scripts/prepare_public_movies.ts';
import { prepareShowcase } from '../scripts/prepare_showcase.ts';
import { shapeOf, contractGaps, unexplainedGaps } from '../scripts/backend_contract.ts';
import { page } from './interaction-harness.ts';
import reference from '../reference/backend-shapes.json' with { type: 'json' };

// 交互层自己回答时会先读的底层快照。
const BASES = ['/api/configuration', '/api/configuration/jav-browser', '/healthz', '/api/tag-management', '/api/tag-management?scope=online', '/api/items?limit=1000'];

async function demoSite(directory: string) {
    const template = path.join(directory, 'template'), pictures = path.join(directory, 'pictures'), site = path.join(directory, 'site');
    for (const folder of [template, pictures, path.join(site, '_demo'), path.join(site, '_fixtures'), path.join(site, 'integrations')]) await mkdir(folder, { recursive: true });
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#648395' } }).webp().toBuffer();
    const digest = createHash('sha256').update(image).digest('hex');
    // 前十二部片里各取一家带标识的厂牌和一位带照片的人物，覆盖标识与头像字段。
    const films = FILMS.slice(0, 12), credited = new Set(films.flatMap(film => [...film.directors, ...film.cast]));
    const person = PEOPLE.find(row => [row.name, row.original_name, ...(row.credited_as || [])].some(name => credited.has(name)))!;
    const studio = STUDIOS.find(row => films.some(film => film.studio === row.name))!;
    const signed = (picture: typeof person.portrait) => ({ ...picture, sha256: digest, bytes: image.length });
    const dataset = { films: films.map(film => ({ ...film, poster: signed(film.poster) })), people: [{ ...person, portrait: signed(person.portrait) }], studios: [{ ...studio, logo: signed(studio.logo) }] };
    for (const picture of [...dataset.films.map(film => film.poster), dataset.people[0]!.portrait, dataset.studios[0]!.logo]) await writeFile(path.join(pictures, picture.file), image);
    const hash = (route: string) => fixtureHash(fixtureKey('GET', new URL(route, 'https://demo.example')));
    const manifest = { fixtures: {} as Record<string, string>, alias: {}, paths: [] };
    for (const [route, data] of Object.entries({ '/api/configuration': { updates: {}, facts: [], tunnel: {}, push_discovery: {} }, '/healthz': { ok: true } })) {
        const key = await hash(route); manifest.fixtures[key] = 'json'; await writeFile(path.join(template, `${key}.json`), JSON.stringify(data));
    }
    await writeFile(path.join(template, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(path.join(site, '_demo/frontend-source.json'), JSON.stringify({ commit: 'contract', version: reference.app_version }));
    await writeFile(path.join(site, '_fixtures/entry-pages.json'), JSON.stringify({ commit: 'contract', constants: {
        storage_categories: [{ key: 'database', label: '数据库', description: '资料', note: '', cleanable: false }, { key: 'playback', label: '播放缓存', description: '转码', note: '', cleanable: true }],
        task_labels: { 'library-processing': '扫描与采集' } } }));
    await writeFile(path.join(site, 'integrations/jav-userscript-release.json'), JSON.stringify({ version: '0.4.0', bridge_min_version: '0.4.0', install_url: '/integrations/peach-jav.user.js' }));
    await writeFile(path.join(site, 'integrations/jav-sites.json'), JSON.stringify({ sites: [] }));
    await preparePublicMovies(template, pictures, site, dataset);
    await prepareShowcase(site);
    return site;
}

test('演示数据覆盖后端参照里的字段，演示特化逐条写明原因', async () => {
    const directory = path.resolve(await mkdtemp(path.join(tmpdir(), 'peach-contract-')));
    try {
        const site = await demoSite(directory);
        const names = [...(await readdir(path.join(site, '_fixtures'))).map(name => '/_fixtures/' + name), '/_media/index.json'];
        const env = { ASSETS: { async fetch(input: string | URL | Request) {
            const name = new URL(input instanceof Request ? input.url : input).pathname;
            if (name === '/_demo/replay-files.json') return Response.json(Object.fromEntries(names.map(file => [file, file])));
            try { return new Response(await readFile(path.join(site, name))); } catch { return new Response('not found', { status: 404 }); }
        } } };
        // 先经 Worker 取回各接口的回放快照，再交给交互层，与浏览器里的链路一致。
        const served = new Map<string, unknown>();
        for (const route of [...Object.keys(reference.routes), ...BASES]) {
            const response = await worker.fetch(new Request('https://demo.example' + route), env);
            if (response.ok && (response.headers.get('content-type') || '').includes('json')) served.set(route, await response.json());
        }
        const browser = page(url => served.get(url.pathname + url.search) ?? served.get(url.pathname) ?? {});
        const report: string[] = [];
        for (const [route, shape] of Object.entries(reference.routes as Record<string, Record<string, string>>)) {
            const response = await browser.fetch(route);
            const actual = response.ok ? shapeOf(await response.json()) : {};
            const { missing, mistyped } = unexplainedGaps(route, shape, actual);
            if (missing.length || mistyped.length)
                report.push(`${route}\n  缺：${missing.join(', ') || '无'}\n  类型不符：${mistyped.map(key => `${key} ${shape[key]}→${actual[key]}`).join(', ') || '无'}`);
        }
        assert.equal(report.join('\n'), '', `演示数据落后于应用 ${reference.app_version}（${reference.app_commit.slice(0, 9)}）的后端字段：补进生成器，或在 DEMO_EXCEPTIONS 写明演示特化的原因`);
    }
    finally {
        await rm(directory, { recursive: true, force: true });
    }
});
test('门槛抓得到后端新增字段与改型，空数组与演示特化不误报', () => {
    const reference = { total: 'number', items: 'array', 'items[]': 'object', 'items[].id': 'number', 'items[].why': 'string', fresh: 'boolean', note: 'null' };
    assert.deepEqual(contractGaps(reference, { total: 'number', items: 'array', 'items[]': 'object', 'items[].id': 'string', fresh: 'boolean' }),
        { missing: ['items[].why'], mistyped: ['items[].id'] });
    assert.deepEqual(contractGaps(reference, { total: 'number', items: 'array', fresh: 'boolean' }), { missing: [], mistyped: [] });
    assert.deepEqual(unexplainedGaps('/api/library-processing', { scanned: 'number' }, {}), { missing: [], mistyped: [] });
    assert.deepEqual(unexplainedGaps('/api/stats', { scanned: 'number' }, {}).missing, ['scanned']);
});
