import { browserReplay } from './browser-replay.ts';
import { stream } from './stream.ts';
import type {Assets,ReplayEnv} from './types.ts';
type ReplayContext={assets: Assets;replay:ReturnType<typeof browserReplay>};
const contexts = new WeakMap<Assets,Promise<ReplayContext>>();
async function context(env: ReplayEnv, origin: string) {
    let pending = contexts.get(env.ASSETS);
    if (!pending) {
        pending = (async () => {
            const response = await env.ASSETS.fetch(new URL('/_demo/replay-files.json', origin));
            if (!response.ok)
                throw Error('公开回放清单未取得');
            const files = await response.json() as Record<string,string>;
            const assets:Assets = { fetch: (input) => { const url = files[new URL(input instanceof Request ? input.url : input, origin).pathname]; return url ? env.ASSETS.fetch(new URL(url, origin)) : new Response('not found', { status: 404 }); } };
            return { assets, replay: browserReplay(files, url => env.ASSETS.fetch(url), origin) };
        })().catch(error => { contexts.delete(env.ASSETS); throw error; });
        contexts.set(env.ASSETS, pending);
    }
    return pending;
}
export default {
    async fetch(request: Request, env: ReplayEnv): Promise<Response> {
        const url = new URL(request.url);
        if (/^\/(?:_fixtures|_media)(?:\/|$)/.test(url.pathname))
            return Response.json({ error: 'not found' }, { status: 404 });
        if (url.pathname === '/stream') {
            return stream(request, { ASSETS: (await context(env, url.origin)).assets }, url);
        }
        if (['/login', '/setup'].includes(url.pathname) && request.method === 'POST')
            return Response.redirect(new URL('/', url), 303);
        if (url.pathname.startsWith('/api/') || url.pathname === '/healthz' || ['/thumb', '/poster', '/cover', '/timeline', '/avatar', '/entity-image', '/logo', '/link-mark', '/site-mark', '/source-icon', '/work-icon', '/follow-avatar', '/follow-stream', '/follow-cover', '/follow-qualities', '/photo', '/photo-thumb', '/sample-thumb', '/sample-image', '/endcard-frame', '/avatar-choice'].includes(url.pathname))
            return (await context(env, url.origin)).replay(request);
        const response = await env.ASSETS.fetch(request);
        if (response.status === 404) {
            const headers = new Headers(response.headers);
            headers.set('cache-control', 'no-store');
            return new Response(response.body, { status: 404, headers });
        }
        return response;
    },
};
