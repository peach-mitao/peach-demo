import test from 'node:test';
import assert from 'node:assert/strict';
import {stream} from '../src/stream.ts';
import {media} from './media.mjs';

const url = new URL('https://demo.example/stream?id=1');
const call = (env, init) => stream(new Request(url, init), env, url);

test('大对象尾段仅向 R2 读取目标字节，HEAD 只读元数据', async () => {
  const {env, stats} = media(1024 ** 3);
  const response = await call(env, {headers: {range: 'bytes=-2'}});
  assert.equal(response.status, 206);
  assert.deepEqual(stats.gets[0].range, {offset: 1024 ** 3 - 2, length: 2});
  assert.deepEqual(stats.gets[0].onlyIf, {etagMatches: 'video'});
  assert.equal(stats.bytes, 0);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [254, 255]);
  assert.equal(stats.bytes, 2);
  const head = await call(env, {method: 'HEAD', headers: {range: 'bytes=0-1'}});
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), String(1024 ** 3));
  assert.equal(await head.text(), '');
  assert.equal(stats.gets.length, 1);
  assert.equal(stats.indexes, 1);
});

test('单范围、后缀、越界和 If-Range 保持 HTTP 字节语义', async () => {
  for (const [range, expected] of [['bytes=0-1', [0,1]], ['bytes=2-4', [2,3,4]], ['bytes=6-', [6,7]], ['bytes=-2', [6,7]], ['bytes=-100', [0,1,2,3,4,5,6,7]]]) {
    const {env} = media();
    const response = await call(env, {headers: {range}});
    assert.equal(response.status, 206);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], expected);
  }
  for (const range of ['bytes=99-', 'bytes=4-2', 'bytes=-0', 'bytes=9007199254740992-']) {
    const {env, stats} = media();
    const response = await call(env, {headers: {range}});
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('content-range'), 'bytes */8');
    assert.equal(stats.gets.length, 0);
  }
  for (const [condition, status] of [['"different"', 200], ['W/"video"', 200], ['"video"', 206], ['Mon, 19 Oct 2026 00:00:00 GMT', 206], ['Sun, 18 Oct 2026 00:00:00 GMT', 200]]) {
    const {env} = media();
    const response = await call(env, {headers: {range: 'bytes=0-1', 'if-range': condition}});
    assert.equal(response.status, status);
    assert.equal((await response.arrayBuffer()).byteLength, status === 206 ? 2 : 8);
  }
});

test('取消直接传递 R2 正文，缺失或不一致的素材明确拒绝', async () => {
  const {env, stats, metadata} = media();
  const response = await call(env, {headers: {range: 'bytes=0-3'}});
  await response.body.cancel();
  assert.equal(stats.bytes, 0);
  assert.equal(stats.cancels, 1);
  metadata.size = 9;
  assert.equal((await call(env)).status, 503);
  env.MEDIA.head = async () => null;
  assert.equal((await call(env)).status, 404);
  const missing = media().env;
  missing.ASSETS.fetch = async () => new Response('<html>SPA</html>');
  assert.equal((await call(missing)).status, 503);
});

test('对象变更条件失败不回传无正文的成功响应', async () => {
  const {env, metadata} = media();
  env.MEDIA.get = async () => metadata;
  assert.equal((await call(env)).status, 503);
});
