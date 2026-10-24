import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fixtureHash, fixtureKey } from '../src/key.ts';
import { createHash } from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifySupport} from './verify_support.ts';
import {verifyPublicMovies} from './prepare_public_movies.ts';
const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
await verifySupport(process.argv.includes('--assets'));
assert.equal(config.repository.url, 'https://github.com/peach-mitao/peach-demo.git');
for (const file of ['src/worker.ts', 'src/key.ts', 'src/directory.ts', 'src/discovery.ts', 'src/follow.ts', 'site/_demo/interactions.js', 'site/_demo/tour.js', 'site/_demo/copy-editor.js'] as const)
    assert.ok((await stat(new URL(file, root))).size > 0, file);
if (process.argv.includes('--assets')) {
    await verifyPublicMovies(fileURLToPath(new URL('site/', root)));
    const info = JSON.parse(await readFile(new URL('site/_demo/frontend-source.json', root), 'utf8'));
    const entry = JSON.parse(await readFile(new URL('site/_fixtures/entry-pages.json', root), 'utf8'));
    assert.match(info.commit, /^[a-f0-9]{40}$/);
    assert.equal(entry.commit, info.commit, '入口页与前端必须来自同一应用提交');
    for (const [file, sha256] of Object.entries(info.files)) {
        assert.ok(!file.includes('..') && !file.startsWith('/'), '前端来源路径必须在 site 内');
        const body = await readFile(new URL('site/' + file, root));
        assert.equal(createHash('sha256').update(body).digest('hex'), sha256, `前端产物漂移：${file}`);
    }
    for (const file of ['site/index.html', 'site/app.css', 'site/dist/peach-app.js', 'site/dist/peach-app.css', 'site/_fixtures/manifest.json', 'site/_fixtures/catalog.json', 'site/_fixtures/indexes.json'] as const)
        assert.ok((await stat(new URL(file, root))).size > 0, `发布文件未取得：${file}`);
    const manifest = JSON.parse(await readFile(new URL('site/_fixtures/manifest.json', root), 'utf8'));
    assert.ok(manifest.fixtures && Array.isArray(manifest.paths));
    const indexes = JSON.parse(await readFile(new URL('site/_fixtures/indexes.json', root), 'utf8'));
    const catalog = JSON.parse(await readFile(new URL('site/_fixtures/catalog.json', root), 'utf8'));
    async function recorded(path: string) {
        const own = await fixtureHash(fixtureKey('GET', new URL(path, 'https://demo.example'))), hash = manifest.alias?.[own] ?? own;
        assert.equal(manifest.fixtures[hash], 'json', `资料回放未取得：${path}`);
        assert.ok((await stat(new URL(`site/_fixtures/${hash}.json`, root))).size > 0, path);
        return JSON.parse(await readFile(new URL(`site/_fixtures/${hash}.json`, root), 'utf8'));
    }
    for (const scope of ['local', 'online'] as const) {
        const inventory = await recorded('/api/tag-management' + (scope === 'online' ? '?scope=online' : ''));
        assert.ok(inventory.items.length > 0, `标签管理库存未取得：${scope}`);
        assert.equal(inventory.items.length, indexes[scope === 'online' ? 'onlineTags' : 'tags'].items.length, `标签管理库存不完整：${scope}`);
    }
    for (const [key, kind] of Object.entries({ performers: 'performer', creators: 'creator', studios: 'studio', studioSearch: 'studio', agencies: 'agency', tags: 'tag', onlineAuthors: 'creator', onlineTags: 'tag', onlineGeneralTags: 'tag' })) {
        const page = indexes[key];
        assert.ok(page && Array.isArray(page.items) && !page.has_more, `名册未取齐：${key}`);
        for (const row of page.items) {
            const id = row.entity_id;
            if (key === 'onlineTags' || key === 'onlineGeneralTags')
                continue;
            assert.ok(Number.isInteger(id) && id > 0, `身份 ID 未取得：${key}/${row.k}`);
            await recorded(`/api/entity?kind=${row.entity_kind || kind}&id=${id}`);
        }
    }
    assert.ok(catalog.tag_categories && catalog.entity_filters, '筛选目录未取得');
    for (const row of catalog.items) {
        assert.ok(Array.isArray(row.filter_tags), `完整标签未取得：${row.id}`);
        await recorded(`/api/item?id=${row.id}`);
    }
    for (const name of Object.keys(catalog.entity_filters.series || {})) {
        const entity = await recorded('/api/entity?' + new URLSearchParams({ kind: 'series', name }));
        assert.ok(Number.isInteger(entity.id) && entity.id > 0, '系列规范身份未取得');
        await recorded(`/api/entity?kind=series&id=${entity.id}`);
    }
}
console.log('PASS: 演示工程与发布入口');
