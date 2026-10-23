import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { configuration, cloudProxies, providers } from '../src/showcase.ts';
import { downloadTasks } from './showcase-fixtures.ts';
import * as tagManagement from '../src/tag-management.ts';
const source = await readFile(new URL('../site/_demo/interactions.js', import.meta.url), 'utf8');
function page(respond: (url:URL)=>unknown = () => ({ status: 'complete', id: 1, items: [] })) {
    let now = Date.now();
    const calls: { path: string; search: string; method: any; }[] = [], context: Record<string,any> = { Request, Response, Headers, URL, URLSearchParams, crypto, Blob, Date: class extends Date {
            static now() { return now; }
        },
        location: { href: 'https://demo.example/', origin: 'https://demo.example', search: '' },
        document: { readyState: 'loading', addEventListener() { } },
        fetch: async (input: RequestInfo|URL, init?: RequestInit) => { const url = input instanceof Request ? new URL(input.url) : new URL(input, 'https://demo.example'); calls.push({ path: url.pathname, search: url.search, method: input instanceof Request?input.method:init?.method || 'GET' }); return new Response(JSON.stringify(respond(url)), { headers: { 'content-type': 'application/json' } }); } };
    context.window = context;
    context.peachDemoMedia = (value: any) => value;
    context.peachDemoMediaJSON = (value: any) => value;
    context.peachDemoTags = tagManagement;
    vm.runInNewContext(source, context);
    return { fetch: context.fetch, calls, advance: (ms: number) => { now += ms; } };
}
test('固定处理状态合并并发读取，重复轮询不产生网络请求', async () => {
    const p = page();
    await Promise.all([p.fetch('/api/library-processing'), p.fetch('/api/library-processing')]);
    assert.equal((await (await p.fetch('/api/library-processing')).json()).status, 'complete');
    assert.equal(p.calls.length, 1);
    const write = await p.fetch('/api/library-processing', { method: 'POST', body: '{}' });
    assert.equal((await write.json()).status, 'running');
    assert.match((await (await p.fetch('/api/library-processing')).json()).job_id, /^demo-/);
    assert.equal(p.calls.length, 1);
});
test('配置与代理草稿可读取保存结果，凭据只保留已保存标记', async () => {
    const p = page((url) => url.pathname.endsWith('cloud-proxies') ? cloudProxies() : configuration({ updates: {}, facts: [], tunnel: {}, push_discovery: {} }, '1.2.3'));
    const payload = { id: 'demo-cloud-1', revision: 'demo-1', api: { mode: 'http', host: 'proxy.example.com', port: 8080, password: 'temporary-secret' } };
    const saved = await (await p.fetch('/api/configuration/cloud-proxies', { method: 'POST', body: JSON.stringify(payload) })).json();
    assert.equal(saved.api.password_set, true);
    assert.equal(saved.api.password, undefined);
    const reread = await (await p.fetch('/api/configuration/cloud-proxies')).json();
    assert.equal(reread.accounts[0].api.host, 'proxy.example.com');
    assert.equal(JSON.stringify(reread).includes('temporary-secret'), false);
    assert.ok(p.calls.every(call => call.method === 'GET'));
});
test('下载任务取消与重新提交只改变当前页面草稿', async () => {
    const initial = () => ({ available: true, providers, tasks: downloadTasks([{ id: 1, name: '示例一' }, { id: 2, name: '示例二' }, { id: 3, name: '示例三' }]) });
    const p = page(initial);
    await p.fetch('/api/downloads/cancel', { method: 'POST', body: JSON.stringify({ id: 30 }) });
    let state = await (await p.fetch('/api/downloads?limit=20')).json();
    assert.equal(state.tasks[0].state, 'cancelled');
    await p.fetch('/api/downloads', { method: 'POST', body: JSON.stringify({ magnet: state.tasks[2].source_uri }) });
    state = await (await p.fetch('/api/downloads?limit=20')).json();
    assert.equal(state.tasks[2].state, 'remote_running');
    assert.equal((await (await page(initial).fetch('/api/downloads')).json()).tasks[0].state, 'remote_running');
    assert.equal(p.calls.filter(call => call.method !== 'GET').length, 0);
});
test('想要清单移除与重新寻找同步阶段计数', async () => {
    const p = page(() => ({ items: [{ id: 1, phase: 'given_up' }, { id: 2, phase: 'searching' }], counts: {}, scraping: false }));
    await p.fetch('/api/wants', { method: 'POST', body: JSON.stringify({ action: 'reset', ids: [1] }) });
    assert.equal((await (await p.fetch('/api/wants')).json()).counts.searching, 2);
    await p.fetch('/api/wants', { method: 'POST', body: JSON.stringify({ action: 'remove', ids: [2] }) });
    const state = await (await p.fetch('/api/wants')).json();
    assert.equal(state.counts.searching, 1);
    assert.deepEqual(state.items.map((row: { id: any; }) => row.id), [1]);
});
test('接回文件记录后列表移除已接回条目', async () => {
    const p = page(() => ({ total: 1, items: [{ id: 900001 }] }));
    const result = await (await p.fetch('/api/orphan-records/attach', { method: 'POST', body: JSON.stringify({ id: 900001, target: 1 }) })).json();
    assert.equal(result.batch, 'demo-attach');
    assert.equal((await (await p.fetch('/api/orphan-records')).json()).total, 0);
    assert.ok(p.calls.every(call => call.method === 'GET'));
});
test('首次设置与字幕文件停留在浏览器，不发送输入内容', async () => {
    const p = page();
    const done = await (await p.fetch('/api/setup', { method: 'POST', body: JSON.stringify({ access_password: 'temporary-secret', data_root: 'private-folder' }) })).json();
    assert.equal(done.url, '/');
    assert.equal(JSON.stringify(done).includes('temporary-secret'), false);
    const caption = 'WEBVTT\n\n00:00.000 --> 00:02.000\n演示字幕\n';
    const response = await p.fetch('/api/subtitles/convert?name=demo.vtt', { method: 'POST', body: caption });
    assert.equal(await response.text(), caption);
    assert.equal(p.calls.length, 0);
});
test('标签管理预览和写入保存在页面，浏览词表同步更新', async () => {
    const original = { revision: 0, duplicate_groups: [], items: [{ entity_id: 1, k: '旅行', aliases: [], originals: ['旅行'], hidden: false, n: 1 }] };
    const p = page((url) => url.pathname === '/api/items' ? { items: [{ tags: ['旅行'] }] } : structuredClone(original));
    const command = { operation: 'rename', ids: [1], name: '远行' };
    const plan = await (await p.fetch('/api/tag-management/preview', { method: 'POST', body: JSON.stringify(command) })).json();
    assert.equal(plan.assets, 1);
    assert.equal((await p.fetch('/api/tag-management', { method: 'POST', body: JSON.stringify({ ...command, token: plan.token }) })).status, 200);
    assert.equal((await (await p.fetch('/api/index?kind=tags')).json()).items[0].k, '远行');
    assert.ok(p.calls.every(call => call.method === 'GET'));
    assert.equal(original.items[0].k, '旅行');
});
test('新版确认弹窗取得零成本的演示预估，不读取真实任务', async () => {
    const p = page();
    const estimate = await (await p.fetch('/api/library-processing?estimate=1&stage=all')).json();
    assert.equal(estimate.traffic.estimated_max_bytes, 0);
    assert.deepEqual(estimate.traffic.sources, []);
    assert.equal(p.calls.length, 0);
    assert.deepEqual({ ...estimate.traffic.disk }, { estimated_bytes: 0, temporary_bytes: 0, volumes: [], cache_unknown: false, can_fit: null });
});
test('视频预览设置只保存在页面草稿，扫描任务与设置使用同一策略', async () => {
    const p = page();
    assert.equal((await (await p.fetch('/api/media-processing')).json()).metadata_only, false);
    const result = await p.fetch('/api/media-processing', { method: 'POST', body: JSON.stringify({ metadata_only: true }) });
    assert.equal((await result.json()).metadata_only, true);
    assert.equal((await (await p.fetch('/api/library-processing')).json()).metadata_only, true);
    assert.equal((await (await page().fetch('/api/media-processing')).json()).metadata_only, false);
    assert.equal((await p.fetch('/api/media-processing', { method: 'POST', body: '{}' })).status, 400);
    assert.equal(p.calls.filter(call => call.path === '/api/media-processing').length, 0);
});
test('整理示例支持新旧番号键、可选分组和目录，并返回明确的模板错误', async () => {
    const p = page(), example = async (file: string, dir = '') => (await p.fetch('/api/organize/example?' + new URLSearchParams({ file_template: file, dir_template: dir }))).json();
    assert.equal((await example('')).example, 'ABC-123 标题.mp4');
    assert.equal((await example('{code}[ {title}][ CD{cd}]', '{studio}/{year}')).example, '厂牌/2024/ABC-123 标题 CD2.mp4');
    assert.equal((await example('{number}')).example, 'ABC-123.mp4');
    assert.equal((await example('{absent}')).ok, false);
    assert.equal((await example('{code}', '../escape')).field, 'dir');
    assert.equal(p.calls.length, 0);
});
test('扫描任务可调速、暂停、继续并完成，刷新恢复录制值', async () => {
    const p = page(), post = async (body: { action?: string; speed_mode?: string; job_id?: any; }) => p.fetch('/api/library-processing', { method: 'POST', body: JSON.stringify(body) });
    assert.equal((await (await post({ action: 'set_speed', speed_mode: 'low' })).json()).speed_mode, 'low');
    const task = await (await post({})).json();
    assert.equal(task.status, 'running');
    assert.equal(task.speed_mode, 'low');
    p.advance(5000);
    const paused = await (await post({ action: 'pause', job_id: task.job_id })).json();
    assert.equal(paused.status, 'paused');
    assert.ok(paused.checked > 0);
    p.advance(40000);
    assert.equal((await (await p.fetch('/api/library-processing')).json()).checked, paused.checked);
    assert.equal((await (await post({ action: 'set_speed', speed_mode: 'high', job_id: task.job_id })).json()).speed_mode, 'high');
    assert.equal((await (await post({ action: 'resume', job_id: task.job_id })).json()).status, 'running');
    p.advance(30000);
    const done = await (await p.fetch('/api/library-processing')).json();
    assert.equal(done.status, 'complete');
    assert.equal(done.checked, done.total);
    assert.equal(p.calls.length, 1);
    assert.equal((await (await page().fetch('/api/library-processing')).json()).job_id, undefined);
});
test('任务控制拒绝无效速度与不匹配的任务号', async () => {
    const p = page(), post = (body: { action?: string; speed_mode?: string; job_id?: string; }) => p.fetch('/api/library-processing', { method: 'POST', body: JSON.stringify(body) });
    assert.equal((await post({ action: 'set_speed', speed_mode: 'invalid' })).status, 400);
    await post({});
    assert.equal((await post({ action: 'pause', job_id: 'another-job' })).status, 409);
});
test('演示行为上报在浏览器确认，馆藏查询仍携带完整参数', async () => {
    const p = page();
    for (const path of ['/api/activity', '/api/play'] as const)
        assert.equal((await (await p.fetch(path, { method: 'POST', body: '{}' })).json()).ok, true);
    assert.equal(p.calls.length, 0);
    await p.fetch('/api/items?q=one&seed=123');
    await p.fetch('/api/items?q=two&seed=456');
    assert.deepEqual(p.calls.map(call => call.search), ['?q=one&seed=123', '?q=two&seed=456']);
});
test('搜索记录在当前页面读写，刷新恢复空记录', async () => {
    const p = page(), post = (body: { query: string; operation?: string; }) => p.fetch('/api/search-history', { method: 'POST', body: JSON.stringify(body) });
    await post({ query: 'Billyhhyb' });
    await post({ query: 'Billyhhyb' });
    await post({ query: 'DEMO' });
    assert.deepEqual((await (await p.fetch('/api/search-history?limit=1')).json()).items, ['DEMO']);
    await post({ operation: 'remove', query: 'DEMO' });
    assert.deepEqual((await (await p.fetch('/api/search-history')).json()).items, ['Billyhhyb']);
    assert.deepEqual((await (await page().fetch('/api/search-history')).json()).items, []);
    assert.equal(p.calls.length, 0);
});
test('目录用途可预览、保存和移除，刷新恢复录制状态且不外发写入', async () => {
    const folder = { id: 'demo-root', location: 'local', path: 'R:\\演示', name: '演示' };
    const respond = (url: { pathname: string; }) => url.pathname === '/api/folders' ? { selected: folder, rules: [], rule: null, rules_revision: 0 } :
        { total: 1, items: [{ id: 1, name: '示例影片.mp4' }] };
    const p = page(respond), post = (path: string, body: { folder: string; purpose?: string; recursive?: boolean; future?: boolean; expected_revision?: number; plan_version?: any; action?: string; }) => p.fetch(path, { method: 'POST', body: JSON.stringify(body) });
    const body = { folder: folder.id, purpose: 'category', recursive: true, future: true };
    const preview = await (await post('/api/folders/preview', body)).json();
    assert.equal(preview.total, 1);
    assert.equal(preview.sample[0].id, 1);
    assert.equal((await post('/api/folders/rule', { ...body, expected_revision: 0, plan_version: 'stale' })).status, 409);
    assert.equal((await post('/api/folders/rule', { ...body, expected_revision: 0, plan_version: preview.plan_version })).status, 200);
    const saved = await (await p.fetch('/api/folders?folder=demo-root')).json();
    assert.equal(saved.rule.purpose, 'category');
    assert.equal(saved.rules_revision, 1);
    assert.equal((await post('/api/folders/rule', { folder: folder.id, action: 'remove', expected_revision: 0 })).status, 409);
    await post('/api/folders/rule', { folder: folder.id, action: 'remove', expected_revision: 1 });
    assert.equal((await (await p.fetch('/api/folders?folder=demo-root')).json()).rule, null);
    assert.equal((await (await page(respond).fetch('/api/folders?folder=demo-root')).json()).rules_revision, 0);
    assert.ok(p.calls.every(call => call.method === 'GET'));
});
