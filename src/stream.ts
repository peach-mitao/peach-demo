interface Assets {
  fetch(request: Request): Promise<Response>;
}

const mediaIndexes = new WeakMap<Assets, Promise<Record<string, number> | null>>();
async function mediaSize(assets: Assets, url: URL, id: string): Promise<number | undefined> {
  let index = mediaIndexes.get(assets);
  if (!index) {
    index = (async () => {
      const response = await assets.fetch(new Request(new URL('/_media/index.json', url)));
      if (!response.ok) {await response.body?.cancel(); return null}
      try {
        const value: unknown = await response.json();
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        if (Object.entries(value).some(([key, size]) => !/^\d+$/.test(key) || !Number.isSafeInteger(size) || Number(size) < 0)) return null;
        return value as Record<string, number>;
      } catch {return null}
    })();
    mediaIndexes.set(assets, index);
  }
  return (await index)?.[id];
}

// Assets 绑定可能忽略 Range；此时按背压读取并在范围结束时取消，不将整段装入内存。
function sliceBody(body: ReadableStream<Uint8Array>, start: number, end: number): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const {done, value} = await reader.read();
          if (done) {controller.close(); return}
          const next = offset + value.byteLength;
          if (next > start) controller.enqueue(value.subarray(Math.max(0, start - offset), Math.min(value.byteLength, end + 1 - offset)));
          offset = next;
          if (offset > end) {controller.close(); await reader.cancel(); return}
          if (offset > start) return;
        }
      } catch (error) {controller.error(error)}
    },
    cancel(reason) {return reader.cancel(reason)},
  }, {highWaterMark: 0});
}

function ifRangeMatches(request: Request, asset: Response): boolean {
  const value = request.headers.get('if-range');
  if (!value) return true;
  if (value.startsWith('"')) return value === asset.headers.get('etag');
  const modified = Date.parse(asset.headers.get('last-modified') ?? '');
  const date = Date.parse(value);
  return Number.isFinite(modified) && Number.isFinite(date) && modified <= date;
}

export async function stream(request: Request, env: {ASSETS: Assets}, url: URL): Promise<Response> {
  const unavailable = () => Response.json({error: 'unavailable'}, {status: 404});
  const id = url.searchParams.get('id') ?? '';
  if (!/^\d+$/.test(id)) return unavailable();
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status: 405, headers: {allow: 'GET, HEAD'}});
  const forwarded = new Headers();
  for (const name of ['range', 'if-range']) {
    const value = request.headers.get(name);
    if (value && request.method === 'GET') forwarded.set(name, value);
  }
  const asset = await env.ASSETS.fetch(new Request(new URL(`/_media/${id}.mp4`, url), {method: request.method, headers: forwarded}));
  const headers = new Headers(asset.headers);
  headers.set('content-type', 'video/mp4');
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'public, max-age=86400');
  if (asset.status === 416) return new Response(asset.body, {status: 416, headers});
  if (!asset.ok || !(asset.headers.get('content-type') ?? '').startsWith('video/mp4')) {
    await asset.body?.cancel();
    return unavailable();
  }
  if (request.method === 'HEAD') {
    await asset.body?.cancel();
    if (!headers.has('content-length')) {
      const size = await mediaSize(env.ASSETS, url, id);
      if (size !== undefined) headers.set('content-length', String(size));
    }
    return new Response(null, {headers});
  }
  if (asset.status === 206) return new Response(asset.body, {status: 206, headers});
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (!match || (!match[1] && !match[2]) || !ifRangeMatches(request, asset)) {
    return new Response(asset.body, {headers});
  }
  const size = asset.headers.has('content-length') ? Number(asset.headers.get('content-length')) : await mediaSize(env.ASSETS, url, id);
  if (size === undefined || !Number.isSafeInteger(size)) {
    await asset.body?.cancel();
    return Response.json({error: 'unavailable', message: '视频长度清单未取得，请重新构建演示站'}, {status: 503});
  }
  const first = Number(match[1]), last = Number(match[2]);
  const start = match[1] ? first : Math.max(0, size - last);
  const end = match[1] && match[2] ? Math.min(last, size - 1) : size - 1;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || start >= size || start > end) {
    await asset.body?.cancel();
    headers.set('content-range', `bytes */${size}`);
    headers.delete('content-length');
    return new Response(null, {status: 416, headers});
  }
  headers.set('content-range', `bytes ${start}-${end}/${size}`);
  headers.set('content-length', String(end - start + 1));
  return new Response(asset.body ? sliceBody(asset.body, start, end) : null, {status: 206, headers});
}
