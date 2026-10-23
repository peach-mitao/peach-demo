import { createReplay } from './replay.ts';
import type {Assets} from './types.ts';
// 文件映射由构建器生成；只读取批准公开且带内容指纹的快照。
export function browserReplay(files: Readonly<Record<string,string>>, networkFetch: (url: URL) => Promise<Response> | Response, origin: string) {
    const replay = createReplay(), pending = new Map<string,Promise<{body:ArrayBuffer;type:string|null}>>();
    const assets: Assets = { async fetch(input) {
                const name = new URL(input instanceof Request ? input.url : input, origin).pathname;
                const target = files[name];
                if (!target)
                    return new Response('not found', { status: 404 });
                if (!pending.has(target))
                    pending.set(target, (async () => {
                        const response = await networkFetch(new URL(target, origin));
                        if (!response.ok)
                            throw Error('演示快照读取失败，请刷新重试');
                        return { body: await response.arrayBuffer(), type: response.headers.get('content-type') };
                    })().catch(error => { pending.delete(target); throw error; }));
                const value = await pending.get(target)!;
                return new Response(value.body.slice(0), { headers: { 'content-type': value.type || 'application/json' } });
            } };
    return async (request: Request) => {
        try {
            return await replay.fetch(request, {ASSETS:assets});
        }
        catch {
            return Response.json({ error: 'unavailable', message: '演示数据读取失败，请刷新重试' }, { status: 503 });
        }
    };
}
