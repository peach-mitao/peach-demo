import test from 'node:test';
import assert from 'node:assert/strict';
import { browserReplay } from '../src/browser-replay.ts';
import { fixtureHash } from '../src/key.ts';
import { publicValue } from '../scripts/build_replay.ts';
import { mediaURL, mediaJSON } from '../src/media.ts';
import { playerImports } from '../scripts/bundle_player.ts';
test('播放器按需导入组保留模块次序和唯一加载入口', () => {
    const source = 'const prefix="/vendor/videojs/1.0.0/",files=["video-player.js","ui/container.js"];Promise.all(files.map(name=>import(`${prefix}${name}`)))';
    const found = playerImports(source);
    assert.equal(found.prefix, '/vendor/videojs/1.0.0/');
    assert.deepEqual(found.files, ['video-player.js', 'ui/container.js']);
    assert.equal(found.ranges.length, 1);
    assert.equal(playerImports('import("/other.js")').ranges.length, 0);
});
test('浏览器固定回放和筛选分页共用数据且合并并发读取', async () => {
    const tasks = await fixtureHash('GET /api/tasks');
    const payloads:Record<string,unknown> = { manifest: { fixtures: { [tasks]: 'json' }, paths: [] }, catalog: { items: [{ id: 1, name: '第一部', tags: [], duration: 20, size: 10 }, { id: 2, name: '第二部', tags: [], duration: 10, size: 20 }] }, tasks: { running: [], finished: [] } };
    const files = { '/_fixtures/manifest.json': '/manifest', '/_fixtures/catalog.json': '/catalog', ['/_fixtures/' + tasks + '.json']: '/tasks' };
    const requests: string[] = [];
    const replay = browserReplay(files, async (url) => { const name = new URL(url).pathname.slice(1); requests.push(name); return Response.json(payloads[name]); }, 'https://demo.example');
    const call = (path: string) => replay(new Request('https://demo.example' + path));
    await Promise.all([call('/api/tasks'), call('/api/tasks')]);
    for (let i = 0; i < 5; i++)
        assert.equal((await call('/api/tasks')).status, 200);
    assert.equal(requests.filter(name => name === 'tasks').length, 1);
    const page = await (await call('/api/items?sort=dur&dir=asc&limit=1')).json();
    assert.equal(page.items[0].id, 2);
    assert.equal(page.has_more, true);
    assert.equal((await (await call('/api/items?q=第一')).json()).total, 1);
    assert.equal(requests.filter(name => name === 'catalog').length, 1);
    assert.equal((await call('/api/unknown')).status, 404);
});
test('快照读取失败明确报错且允许重试', async () => {
    let calls = 0;
    const replay = browserReplay({ '/_fixtures/manifest.json': '/manifest' }, async () => { calls++; return calls === 1 ? new Response('', { status: 503 }) : Response.json({ fixtures: {}, paths: [] }); }, 'https://demo.example');
    assert.equal((await replay(new Request('https://demo.example/api/unknown'))).status, 503);
    assert.equal((await replay(new Request('https://demo.example/api/unknown'))).status, 404);
    assert.equal(calls, 2);
});

test('Worker 回放不等待其他请求未完成的快照且复用已完成的正文', {timeout:1000}, async () => {
    let calls=0;
    const replay=browserReplay({'/_fixtures/manifest.json':'/manifest'},async()=>{
        calls++;
        if(calls===1)return await new Promise<never>(()=>{});
        return Response.json({fixtures:{},paths:[]});
    },'https://demo.example',{sharePending:false});
    void replay(new Request('https://demo.example/api/unknown'));
    assert.equal((await replay(new Request('https://demo.example/api/unknown'))).status,404);
    assert.equal((await replay(new Request('https://demo.example/api/unknown'))).status,404);
    assert.equal(calls,2);
});
test('公开快照删除凭据与私人路径并保留已保存标记', () => {
    assert.deepEqual(publicValue({ password: 'private', cookie: 'secret', token: 'secret', password_set: true, path: 'C:\\Users\\private\\media', image: '/cover?id=1' }), { password: '', cookie: '', token: '', password_set: true, path: 'R:\\Media\\演示', image: '/cover?id=1' });
});
test('图片按用途选择缩略图并保留版本帮助函数的查询分隔符', async () => {
    const hash = await fixtureHash('GET /cover?code=one&thumb=1');
    const images = { [hash]: '/full.webp' }, variants = { '/full.webp': { '384': '/small.webp', '960': '/large.webp' } };
    assert.equal(mediaURL('/cover?thumb=1&code=one&v=now', images, 'https://demo.example', variants), '/small.webp?');
    const later = mediaURL('/cover?thumb=1&code=one', images, 'https://demo.example', variants) + '&v=now';
    assert.equal(new URL(later, 'https://demo.example').pathname, '/small.webp');
    assert.equal(mediaURL('/_demo/follow/one.jpg', { '/_demo/follow/one.jpg': '/_demo/images/one.webp' }), '/_demo/images/one.webp?');
});
test('批准的视频地址使用媒体域名与内容指纹，省略播放会话', () => {
    const videos = { '1': { key: 'demo/videos/' + 'a'.repeat(64) + '.mp4' } };
    assert.equal(mediaURL('/stream?id=1', {}, 'http://127.0.0.1:8791', {}, videos), 'https://media.peach.video/demo/videos/' + 'a'.repeat(64)+'.mp4');
    assert.equal(mediaURL('/stream?id=999', {}, 'https://demo.example', {}, videos), '/stream?id=999');
    assert.deepEqual(mediaJSON({ src: '/stream?id=1&session=changing' }, {}, 'https://demo.example', {}, videos), {src:'https://media.peach.video/demo/videos/' + 'a'.repeat(64)+'.mp4'});
});
