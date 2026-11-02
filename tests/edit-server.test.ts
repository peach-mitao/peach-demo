import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { editServer, mergeEdits, readEdits } from '../scripts/edit_server.ts';
test('改字草稿按原文合并，拒绝非字符串和数组', () => {
    assert.deepEqual(mergeEdits({ 首页: '主页' }, { 关注: '订阅', 首页: '' }), { 首页: '', 关注: '订阅' });
    assert.throws(() => mergeEdits({}, ['首页']));
    assert.throws(() => mergeEdits({}, { 首页: 1 }));
});
test('本机服务把草稿落盘，并只允许回环来源跨域读写', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'peach-edits-')), file = path.join(directory, 'copy-edits.json');
    const server = editServer(file).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/copy-edits`;
    try {
        const saved = await fetch(base, { method: 'PUT', headers: { origin: 'http://127.0.0.1:8791', 'content-type': 'application/json' }, body: JSON.stringify({ 首页: '主页' }) });
        assert.equal(saved.headers.get('access-control-allow-origin'), 'http://127.0.0.1:8791');
        await fetch(base, { method: 'PUT', body: JSON.stringify({ 关注: '订阅' }) });
        assert.deepEqual(await readEdits(file), { 首页: '主页', 关注: '订阅' });
        assert.equal((await fetch(base, { method: 'PUT', headers: { origin: 'https://demo.peach.video' }, body: '{}' })).status, 403);
        assert.equal((await fetch(base, { method: 'PUT', body: '[1]' })).status, 400);
    }
    finally {
        server.close();
        await rm(directory, { recursive: true, force: true });
    }
});
