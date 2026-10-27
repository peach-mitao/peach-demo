import assert from 'node:assert/strict';
const base = process.env.BASE || 'http://127.0.0.1:8791';
for (const id of ['1', '999999']) {
    for (const method of ['GET', 'HEAD']) {
        const response = await fetch(base + '/stream?id=' + id, { method, headers: { Range: 'bytes=0-99' }, redirect: 'manual' });
        assert.equal(response.status, 403);
        assert.equal(response.headers.get('location'), null);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        if (method === 'GET') assert.deepEqual(await response.json(), { demo: true, message: '仅提供演示' });
        else assert.equal((await response.arrayBuffer()).byteLength, 0);
    }
}
console.log('PASS：播放与 Range 入口只返回演示提示，不提供或跳转视频');
await import('./check_public_movies_browser.ts');
