import type {Assets} from './types.ts';
import type {R2Bucket,R2Object} from '@cloudflare/workers-types';
interface Video {
  key: string;
  size: number;
}
const indexes = new WeakMap<Assets, Promise<Record<string, Video> | null>>();
const metadata=new WeakMap<object,Map<string,Promise<R2Object|null>>>();
async function videoMetadata(store:Pick<R2Bucket,'head'>,key:string):Promise<R2Object|null>{
  let cache=metadata.get(store);if(!cache){cache=new Map();metadata.set(store,cache)}
  let pending=cache.get(key);
  if(!pending){pending=store.head(key).then(object=>{if(!object)cache!.delete(key);return object}).catch(error=>{cache!.delete(key);throw error});cache.set(key,pending)}
  return pending;
}

async function videoIndex(assets: Assets, url: URL): Promise<Record<string, Video> | null> {
  let index = indexes.get(assets);
  if (!index) {
    index = (async () => {
      const response = await assets.fetch(new Request(new URL('/_media/index.json', url)));
      if (!response.ok) {await response.body?.cancel(); return null}
      try {
        const value = await response.json() as {version?: unknown; videos?: Record<string, Video>};
        if (value.version !== 1 || !value.videos || typeof value.videos !== 'object' || Array.isArray(value.videos)) return null;
        if (Object.entries(value.videos).some(([id, video]) => !/^\d+$/.test(id) || !video || !/^demo\/videos\/[a-f0-9]{64}\.mp4$/.test(video.key) || !Number.isSafeInteger(video.size) || video.size <= 0)) return null;
        return value.videos;
      } catch {return null}
    })();
    indexes.set(assets, index);
  }
  return index;
}

function ifRangeMatches(value: string | null, object: R2Object): boolean {
  if (!value) return true;
  if (value.startsWith('"') || value.startsWith('W/')) return value === object.httpEtag;
  const date = Date.parse(value);
  return Number.isFinite(date) && Math.floor(object.uploaded.getTime() / 1000) <= Math.floor(date / 1000);
}

export async function stream(request: Request, env: {ASSETS: Assets; MEDIA: Pick<R2Bucket, 'head' | 'get'>}, url: URL): Promise<Response> {
  const unavailable = () => Response.json({error: 'unavailable'}, {status: 404});
  const id = url.searchParams.get('id') ?? '';
  if (!/^\d+$/.test(id)) return unavailable();
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status: 405, headers: {allow: 'GET, HEAD'}});
  const index = await videoIndex(env.ASSETS, url);
  if (!index) return Response.json({error: 'unavailable', message: '视频清单未取得'}, {status: 503});
  const video = index[id];
  if (!video) return unavailable();
  const version=video.key.split('/').at(-1)!.replace('.mp4','');
  if(url.searchParams.has('v')&&url.searchParams.get('v')!==version)return unavailable();
  const object = await videoMetadata(env.MEDIA,video.key);
  if (!object) return unavailable();
  if (object.size !== video.size){metadata.get(env.MEDIA)?.delete(video.key);return Response.json({error: 'unavailable', message: '视频素材与清单不一致'}, {status: 503})}
  const headers = new Headers({
    'content-type': 'video/mp4', 'accept-ranges': 'bytes',
    'cache-control': url.searchParams.get('v')===version?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate', 'content-length': String(object.size),
    etag: object.httpEtag, 'last-modified': object.uploaded.toUTCString(),
  });
  if(request.headers.get('if-none-match')===object.httpEtag)return new Response(null,{status:304,headers:{etag:object.httpEtag,'cache-control':headers.get('cache-control')!}});
  if (request.method === 'HEAD') return new Response(null, {headers});
  let range: {offset: number; length: number} | undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (match && (match[1] || match[2]) && ifRangeMatches(request.headers.get('if-range'), object)) {
    const first = Number(match[1]), last = Number(match[2]);
    const start = match[1] ? first : Math.max(0, object.size - last);
    const end = match[1] && match[2] ? Math.min(last, object.size - 1) : object.size - 1;
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || start >= object.size || start > end) {
      headers.set('content-range', `bytes */${object.size}`);
      headers.set('content-length', '0');
      return new Response(null, {status: 416, headers});
    }
    range = {offset: start, length: end - start + 1};
    headers.set('content-range', `bytes ${start}-${end}/${object.size}`);
    headers.set('content-length', String(range.length));
  }
  // R2 原生只读取目标范围；ETag 条件防止元数据和正文来自不同对象。
  const body = await env.MEDIA.get(video.key, {onlyIf: {etagMatches: object.etag}, ...(range ? {range} : {})});
  if (!body){metadata.get(env.MEDIA)?.delete(video.key);return unavailable()}
  if (!('body' in body)){metadata.get(env.MEDIA)?.delete(video.key);return Response.json({error: 'unavailable'}, {status: 503})}
  return new Response(body.body as unknown as ReadableStream, {status: range ? 206 : 200, headers});
}
