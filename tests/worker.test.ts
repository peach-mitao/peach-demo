import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { fixtureHash, fixtureKey } from '../src/key.ts';
import worker from '../src/worker.ts';
import { discoveryPage } from '../src/discovery.ts';
import { videoKey } from './media.ts';
const origin = 'https://example.test';
const portraitHash = await fixtureHash('GET /entity-image?id=102&kind=performer');
const followHash = await fixtureHash('GET /api/follow?limit=100&offset=0');
const feedDiscoveryHash = await fixtureHash('GET /api/feeds/discoveries?limit=12');
const topsHash = await fixtureHash('GET /api/tops?n=60');
const downloadsHash = await fixtureHash('GET /api/downloads?limit=50');
const files = new Map<string,string|Uint8Array<ArrayBuffer>>([
    ['/_fixtures/entry-pages.json', JSON.stringify({ userscript_bridge: { html: '<meta name="peach-userscript-bridge" content="1">', headers: { 'content-type': 'text/html', 'x-frame-options': 'SAMEORIGIN', 'content-security-policy': "default-src 'none'; frame-ancestors 'self'; base-uri 'none'" } } })],
    ['/_fixtures/manifest.json', JSON.stringify({ fixtures: { [portraitHash]: 'png', [followHash]: 'json', [feedDiscoveryHash]: 'json', [topsHash]: 'json', [downloadsHash]: 'json' }, paths: [], alias: {} })],
    [`/_fixtures/${downloadsHash}.json`, JSON.stringify({ available: true, providers: [], tasks: [{ id: 3 }, { id: 2 }, { id: 1 }] })],
    [`/_fixtures/${topsHash}.json`, JSON.stringify({ performers: [], studios: [{ id: 10, k: '示例厂牌', n: 1, rep: 1, has_logo: false }] })],
    [`/_fixtures/${followHash}.json`, JSON.stringify({ sources: [{ author_key: 'entity:152', avatar_url: '/follow-avatar?provider=kemono&ref=demo' }], groups: [{ primary: { id: 1 } }], has_more: false })],
    [`/_fixtures/${feedDiscoveryHash}.json`, JSON.stringify({ ok: true, more: true, items: Array.from({ length: 12 }, (_, i) => ({ code: 'DEMO-' + i })) })],
    [`/_fixtures/${portraitHash}.png`, new Uint8Array([8, 9, 10])],
    ['/_fixtures/indexes.json', JSON.stringify({ creators: { kind: 'creators', items: [], has_more: false, categories: {} },
            onlineAuthors: { kind: 'performers', scope: 'online', items: [{ k: 'Billyhhyb', entity_id: 152, key: 'entity:152', n: 20 }], has_more: false },
            onlineTags: { kind: 'tags', scope: 'online', items: [{ k: '肖像', cat: 'general', n: 2 }, { k: '作品角色', cat: 'character', n: 1 }], has_more: false, categories: {} },
            onlineGeneralTags: { kind: 'tags', scope: 'online', items: [{ k: '肖像', cat: 'general', n: 2 }], has_more: false, categories: {} },
            studios: { kind: 'studios', items: [{ entity_id: 2, k: '片商' }], has_more: false },
            studioSearch: { kind: 'studios', items: [{ entity_id: 2, k: '片商' }, { entity_id: 3, k: '旗下厂牌' }], has_more: false },
            performers: { kind: 'performers', items: [{ entity_id: 102, k: '桥本有菜', identity_categories: ['japanese_av'] }], has_more: false, categories: { japanese_av: 1 } } })],
    ['/_fixtures/catalog.json', JSON.stringify({ tag_categories: { '4K': 'meta', '剧情': 'story' }, entity_filters: { studio: { '父片商': [1] }, agency: { '事务所': [1] }, series: { '演示系列': [2] } }, items: [
                { id: 1, name: '示例一', code: 'DEMO-001', is_jav: true, studio: '示例厂牌', tags: ['剧情'], filter_tags: ['剧情', '4K'], performers: [], o_count: 2, duration: 120, size: 100, location: 'local' },
                { id: 2, name: '示例二', code: 'DEMO-002', is_jav: true, tags: [], performers: [], o_count: 5, duration: 240, size: 200, location: 'local' }
            ] })],
    ['/_media/index.json', JSON.stringify({ version: 1, videos: { '1': { key: videoKey, size: 8 } } })],
    ['/favicon.ico', new Uint8Array([1, 2, 3])]
]);
const env = { ASSETS: { async fetch(input: string|URL) {
            const name = new URL(input instanceof Request ? input.url : input).pathname;
            if (name === '/_demo/replay-files.json')
                return Response.json(Object.fromEntries([...files.keys()].map(name => [name, name])));
            if (!files.has(name))
                return new Response('not found', { status: 404 });
            const body = files.get(name), video = name.endsWith('.mp4');
        return new Response(input instanceof Request && input.method === 'HEAD' ? null : body, { headers: video ? { 'content-type': 'video/mp4', 'content-length': String(typeof body==='string'?new TextEncoder().encode(body).byteLength:body!.byteLength) } : {} });
        } } };
const call = (path: string, init?: RequestInit) => worker.fetch(new Request(origin + path, init), env);
test('用户脚本桥接页使用静态内容及同源限制', async () => {
    const response = await worker.fetch(new Request(origin + '/integrations/peach-userscript-bridge'), { ASSETS: { fetch: () => new Response('peach-userscript-bridge', { headers: { 'x-frame-options': 'SAMEORIGIN', 'content-security-policy': "frame-ancestors 'self'" } }) } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /peach-userscript-bridge/);
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(response.headers.get('content-security-policy')!, /frame-ancestors 'self'/);
});
test('未启用的资源搜索保留空状态且不生成磁链候选', async () => {
    for (const route of ['/api/jav/resources?code=DEMO-001', '/api/resources/search?code=DEMO-001', '/api/jav/resources?code=UNKNOWN'] as const) {
        const response = await call(route);
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(data.state, 'unavailable');
        assert.deepEqual(data.items, []);
        assert.equal(data.error, '资源搜索未启用');
    }
});
test('字幕搜索和加载使用演示文本', async () => {
    const data = await (await call('/api/subtitles/search?q=DEMO')).json();
    assert.equal(data.results[0].id, 'demo');
    const files = await (await call('/api/subtitles/subtitlecat/demo')).json();
    assert.equal(files.files[0].playable, true);
    const response = await call('/api/subtitles/subtitlecat/demo/0');
    assert.match(response.headers.get('content-type')!, /text\/vtt/);
    assert.match(await response.text(), /^WEBVTT/);
});
test('新版任务页按较小批次分页读取已录制的云下载任务', async () => {
    const first = await (await call('/api/downloads?limit=2')).json();
    assert.deepEqual(first.tasks.map((row: { id: any; }) => row.id), [3, 2]);
    assert.equal(first.has_more, true);
    assert.equal(first.next_before_id, 2);
    const next = await (await call('/api/downloads?limit=2&before_id=2')).json();
    assert.deepEqual(next.tasks.map((row: { id: any; }) => row.id), [1]);
    assert.equal(next.has_more, false);
    assert.equal(next.next_before_id, null);
});
test('未录制的网站图标使用通用标识，不请求外部站点', async () => {
    const response = await call('/site-mark?domain=example.com');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/svg+xml');
    assert.match(await response.text(), /<svg/);
    assert.equal((await call('/link-mark?id=12')).headers.get('content-type'), 'image/svg+xml');
});
test('文件夹接口、馆藏筛选和统计共享模拟目录', async () => {
    const response = await call('/api/folders?loc=local');
    assert.equal(response.status, 200);
    const page = await response.json(), root = page.roots[0];
    assert.equal(root.files, 2);
    const query = new URLSearchParams({ folder: root.id });
    assert.equal((await (await call('/api/items?' + query)).json()).total, 2);
    assert.equal((await (await call('/api/facets?' + query)).json()).stats.total, 2);
    assert.deepEqual((await (await call('/api/tops?n=60&' + query)).json()).studios.map((row: { k: any; n: any; }) => [row.k, row.n]), [['示例厂牌', 1]]);
    query.set('folder_recursive', '0');
    assert.equal((await (await call('/api/items?' + query)).json()).total, 0);
    assert.deepEqual((await (await call('/api/tops?n=60&' + query)).json()), { performers: [], studios: [] });
    assert.equal((await call('/api/folders?folder=missing')).status, 404);
});
test('未录制的资料查询明确返回未取得', async () => {
    const response = await call('/api/entity?kind=creator&id=999999');
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-peach-demo-missing'), '1');
    assert.equal((await response.json()).error, 'unavailable');
});
test('卖家与在线作者共享当前身份目录但各用自己的名册', async () => {
    const sellers = await (await call('/api/index?kind=creators&limit=120&offset=0')).json();
    const online = await (await call('/api/follow/authors?limit=120&offset=0')).json();
    assert.deepEqual(sellers.items, []);
    assert.equal(online.items[0].entity_id, 152);
    assert.equal(online.items[0].key, 'entity:152');
    const filtered = await (await call('/api/follow/authors?q=Billy&limit=1&offset=0')).json();
    assert.equal(filtered.total, 1);
    assert.equal(filtered.items[0].k, 'Billyhhyb');
    assert.equal(filtered.has_more, false);
    assert.equal((await (await call('/api/follow/authors?q=absent')).json()).total, 0);
});
test('搜索推荐关注请求与作者目录共享头像来源', async () => {
    const response = await call('/api/follow?limit=20&sort=rand&seed=123');
    assert.equal(response.status, 200);
    const follow = await response.json(), authors = await (await call('/api/follow/authors?limit=3')).json();
    const source = follow.sources.find((row: { author_key: any; }) => row.author_key === authors.items[0].key);
    assert.equal(source.avatar_url, '/follow-avatar?provider=kemono&ref=demo');
    assert.equal(follow.groups.length, 1);
    assert.equal((await call('/api/follow?author=unknown&sort=rand')).status, 404);
});
test('订阅新作推荐返回已录制的首批作品', async () => {
    const response = await call('/api/feeds/discoveries?limit=5');
    assert.equal(response.status, 200);
    const page = await response.json();
    assert.equal(page.items.length, 5);
    assert.equal(page.more, true);
    assert.equal(page.items[0].code, 'DEMO-0');
    assert.equal((await call('/api/feeds/discoveries?limit=20')).status, 404);
    assert.equal((await call('/api/feeds/discoveries?limit=5&provider=unknown')).status, 404);
});
test('身份分类筛选与分页保留稳定 ID', async () => {
    const performer = await (await call('/api/index?kind=performers&category=japanese_av')).json();
    assert.equal(performer.items[0].entity_id, 102);
    assert.deepEqual((await (await call('/api/index?kind=performers&category=seller')).json()).items, []);
    assert.deepEqual((await (await call('/api/index?kind=performers&offset=1')).json()).items, []);
});
test('在线标签按来源类型筛选，通用词表只返回 general', async () => {
    const general = await (await call('/api/follow/tags')).json();
    assert.deepEqual(general.items.map((row: { cat: any; }) => row.cat), ['general']);
    const character = await (await call('/api/follow/tags?types=all&type=character&q=角色')).json();
    assert.deepEqual(character.items.map((row: { k: any; }) => row.k), ['作品角色']);
    assert.deepEqual(character.categories, { general: 1, character: 1 });
});
test('厂牌搜索包含旗下厂牌，默认名册按片商展示', async () => {
    assert.equal((await (await call('/api/index?kind=studios')).json()).items.length, 1);
    const label = await (await call('/api/index?kind=studios&q=旗下')).json();
    assert.equal(label.items.length, 1);
    assert.equal(label.items[0].entity_id, 3);
});
test('资料图片的版本参数复用已审核的演示图片', async () => {
    const response = await call('/entity-image?kind=performer&id=102&v=updated');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [8, 9, 10]);
});
test('请求键按查询参数顺序规范化', async () => {
    assert.equal(fixtureKey('GET', new URL(origin + '/api/items?b=2&a=1')), fixtureKey('GET', new URL(origin + '/api/items?a=1&b=2')));
    assert.equal((await fixtureHash('GET /x')).length, 20);
});
test('私有录制文件不通过公开路径返回', async () => {
    for (const path of ['/_fixtures/manifest.json', '/_media/1.mp4'] as const)
        assert.equal((await call(path)).status, 404);
});
test('编号视频入口交给公开媒体域名处理范围请求', async () => {
    const range = await call('/stream?id=1', { headers: { Range: 'bytes=2-4' } });
    assert.equal(range.status, 308);
    assert.equal(range.headers.get('location'),'https://media.peach.video/'+videoKey);
    assert.equal(await range.text(),'');
    assert.equal((await call('/stream?id=invalid')).status, 404);
});
test('排序升降序均保留馆藏数据', async () => {
    const desc = await (await call('/api/items?sort=o&dir=desc')).json();
    const asc = await (await call('/api/items?sort=o&dir=asc')).json();
    assert.deepEqual(desc.items.map((item: { id: any; }) => item.id), [2, 1]);
    assert.deepEqual(asc.items.map((item: { id: any; }) => item.id), [1, 2]);
    assert.equal(desc.total, 2);
    assert.equal(asc.total, 2);
});
test('技术标签参与筛选和技术分类，卡片保留内容标签', async () => {
    const items = await (await call('/api/items?tag=4K')).json();
    assert.deepEqual(items.items.map((row: { id: any; }) => row.id), [1]);
    assert.deepEqual(items.items[0].tags, ['剧情']);
    const all = await (await call('/api/items?tag=4K,剧情')).json();
    assert.equal(all.total, 1);
    const facets = await (await call('/api/facets')).json();
    assert.deepEqual(facets.tech, [{ k: '4K', n: 1 }]);
    assert.deepEqual(facets.tags, [{ k: '剧情', n: 1, cat: 'story' }]);
});
test('发现排序保留图片和标签，缺失来源读数排在末尾', () => {
    const snapshot = { scope: 'external', items: [{ id: 1, code: 'DEMO-001', tags: ['剧情'], has_cover: true, release_date: '2026-01-01', source_score: 4.8, taste_score: .8 },
            { id: 2, code: 'DEMO-002', tags: ['制服'], has_cover: true, release_date: '2026-02-01', source_score: null, taste_score: .9 }] };
    const recent = discoveryPage(snapshot, new URLSearchParams('sort=release_date&direction=desc'));
    assert.deepEqual(recent.items.map(row => row.id), [2, 1]);
    assert.deepEqual(recent.items[1].tags, ['剧情']);
    assert.equal(recent.items[1].has_cover, true);
    assert.deepEqual(discoveryPage(snapshot, new URLSearchParams('sort=source_score&direction=asc')).items.map(row => row.id), [1, 2]);
    assert.deepEqual(discoveryPage(snapshot, new URLSearchParams('sort=taste&direction=asc&limit=1')).items.map(row => row.id), [1]);
    assert.deepEqual(snapshot.items.map(row => row.id), [1, 2]);
});
test('片商、事务所与系列查询复用录制的身份作品范围', async () => {
    for (const [query, ids] of [['studio=父片商', [1]], ['agency=事务所', [1]], ['series=演示系列', [2]]] as const) {
        const data = await (await call('/api/items?' + query)).json();
        assert.deepEqual(data.items.map((row: { id: any; }) => row.id), ids);
    }
    assert.equal((await (await call('/api/items?agency=事务所&tag=4K')).json()).total, 1);
});
test('文档请求由静态资源层处理内容校验器', async () => {
    const headersSeen: [string,string][][] = [];
    const htmlEnv = { ASSETS: { async fetch(input: RequestInfo|URL) {
                const request = input instanceof Request ? input : new Request(input);
                if (new URL(request.url).pathname !== '/jav')
                    return env.ASSETS.fetch(request.url);
                headersSeen.push([...request.headers]);
                const headers = { 'content-type': 'text/html; charset=utf-8', 'etag': 'static-index', 'last-modified': 'Wed, 14 Oct 2026 01:00:00 GMT', 'cache-control': 'public, max-age=3600' };
                return request.headers.has('if-none-match') ? new Response(null, { status: 304, headers }) : new Response('<!doctype html><html><body>当前页面</body></html>', { headers });
            } } };
    try {
        const response = await worker.fetch(new Request(origin + '/jav?tab=discover', { headers: { accept: 'text/html', 'if-none-match': 'static-index', 'if-modified-since': 'Wed, 14 Oct 2026 01:00:00 GMT' } }), htmlEnv);
        assert.equal(response.status, 304);
        assert.equal(response.headers.get('etag'), 'static-index');
        assert.equal(headersSeen.length, 1);
        assert.ok(headersSeen[0].some(([key]) => key === 'if-none-match'));
    }
    finally { }
});
test('演示写操作不改变录制馆藏', async () => {
    assert.deepEqual(await (await call('/api/feedback', { method: 'POST', body: '{}' })).json(), { ok: true });
    assert.equal((await (await call('/api/items')).json()).total, 2);
});
