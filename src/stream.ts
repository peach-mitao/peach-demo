import type {Assets} from './types.ts';
import {videoURL,VIDEO_CACHE} from './video.ts';
interface Video {
  key: string;
  size: number;
}
const indexes = new WeakMap<Assets, Promise<Record<string, Video> | null>>();

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

// 已缓存页面中的视频入口按当前清单跳转；媒体正文由 R2 自定义域名提供。
export async function stream(request: Request, env: {ASSETS: Assets}, url: URL): Promise<Response> {
  const unavailable = () => Response.json({error: 'unavailable'}, {status: 404,headers:{'cache-control':'no-store'}});
  const id = url.searchParams.get('id') ?? '';
  if (!/^\d+$/.test(id)) return unavailable();
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status: 405, headers: {allow: 'GET, HEAD','cache-control':'no-store'}});
  const index = await videoIndex(env.ASSETS, url);
  if (!index) return Response.json({error: 'unavailable', message: '视频清单未取得'}, {status: 503,headers:{'cache-control':'no-store'}});
  const video = index[id];
  if (!video) return unavailable();
  const version=video.key.split('/').at(-1)!.replace('.mp4','');
  if(url.searchParams.has('v')&&url.searchParams.get('v')!==version)return unavailable();
  return new Response(null,{status:308,headers:{location:videoURL(video.key)!,'cache-control':url.searchParams.get('v')===version?VIDEO_CACHE:'no-cache'}});
}
