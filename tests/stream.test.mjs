import test from 'node:test';
import assert from 'node:assert/strict';
import {stream} from '../src/stream.ts';

const url = new URL('https://demo.example/stream?id=1');
function assets({native = false, head = false} = {}) {
  const stats = {reads: 0, cancels: 0, request: null};
  const env = {ASSETS: {async fetch(request) {
    stats.request = request;
    const body = new ReadableStream({
      pull(controller) {
        stats.reads++;
        const offset = (stats.reads - 1) * 2;
        controller.enqueue(new Uint8Array([offset, offset + 1]));
        if (native || stats.reads === 4) controller.close();
      },
      cancel() {stats.cancels++},
    }, {highWaterMark: 0});
    const response = new Response(head ? null : body, {status: native ? 206 : 200, headers: {
      'content-type': 'video/mp4', 'content-length': native ? '2' : '8', etag: '"video"',
      ...(native ? {'content-range': 'bytes 0-1/8'} : {}),
    }});
    response.arrayBuffer = () => {throw Error('禁止整段缓冲')};
    return response;
  }}};
  return {env, stats};
}

test('Range 向上游传递，范围结束立即取消且不读取余段', async () => {
  const {env, stats} = assets();
  const response = await stream(new Request(url, {headers: {range: 'bytes=0-1'}}), env, url);
  assert.equal(stats.request.headers.get('range'), 'bytes=0-1');
  assert.equal(response.status, 206);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0, 1]);
  assert.equal(stats.reads, 1);
  assert.equal(stats.cancels, 1);
});

test('原生分段直接回传，上游 HEAD 不读取视频正文', async () => {
  const native = assets({native: true});
  const partial = await stream(new Request(url, {headers: {range: 'bytes=0-1'}}), native.env, url);
  assert.equal(partial.status, 206);
  assert.equal(native.stats.reads, 0);
  assert.deepEqual([...new Uint8Array(await partial.arrayBuffer())], [0, 1]);
  const head = assets({head: true});
  const response = await stream(new Request(url, {method: 'HEAD'}), head.env, url);
  assert.equal(head.stats.request.method, 'HEAD');
  assert.equal(head.stats.reads, 0);
  assert.equal(await response.text(), '');
});

test('中段、末段、超长后缀与范围条件保留字节语义', async () => {
  for (const [range, bytes] of [['bytes=2-4', [2, 3, 4]], ['bytes=6-', [6, 7]], ['bytes=-2', [6, 7]], ['bytes=-100', [0, 1, 2, 3, 4, 5, 6, 7]]]) {
    const {env} = assets();
    const response = await stream(new Request(url, {headers: {range}}), env, url);
    assert.equal(response.status, 206);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], bytes);
  }
  for (const range of ['bytes=99-', 'bytes=4-2', 'bytes=-0', 'bytes=9007199254740992-']) {
    const {env, stats} = assets();
    assert.equal((await stream(new Request(url, {headers: {range}}), env, url)).status, 416);
    assert.equal(stats.reads, 0);
    assert.equal(stats.cancels, 1);
  }
  const {env} = assets();
  const whole = await stream(new Request(url, {headers: {range: 'bytes=0-1', 'if-range': '"different"'}}), env, url);
  assert.equal(whole.status, 200);
  assert.equal((await whole.arrayBuffer()).byteLength, 8);
});

test('下游取消传递到视频源，单页兜底不伪装为视频', async () => {
  const {env, stats} = assets();
  const response = await stream(new Request(url, {headers: {range: 'bytes=0-3'}}), env, url);
  await response.body.cancel();
  assert.equal(stats.reads, 0);
  assert.equal(stats.cancels, 1);
  const missing = {ASSETS: {fetch: async () => new Response('<html>SPA</html>', {headers: {'content-type': 'text/html'}})}};
  assert.equal((await stream(new Request(url), missing, url)).status, 404);
});

test('Assets 缺少长度头时复用私有长度清单，HEAD 不取视频正文', async () => {
  let indexes = 0, heads = 0;
  const env = {ASSETS: {async fetch(request) {
    if (new URL(request.url).pathname.endsWith('index.json')) {indexes++; return Response.json({'1': 8})}
    if (request.method === 'HEAD') {heads++; return new Response(null, {headers: {'content-type': 'video/mp4'}})}
    return new Response(new Uint8Array([0,1,2,3,4,5,6,7]), {headers: {'content-type': 'video/mp4'}});
  }}};
  for (const range of ['bytes=0-1', 'bytes=-2']) {
    const response = await stream(new Request(url, {headers: {range}}), env, url);
    assert.equal(response.status, 206);
    assert.equal((await response.arrayBuffer()).byteLength, 2);
  }
  const head = await stream(new Request(url, {method: 'HEAD'}), env, url);
  assert.equal(head.headers.get('content-length'), '8');
  assert.equal(await head.text(), '');
  assert.equal(indexes, 1);
  assert.equal(heads, 1);
});
