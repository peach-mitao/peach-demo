import { createReplay } from './replay.ts';
import type {Assets} from './types.ts';
import { catalogName, projectCatalog, type CatalogNames } from './catalog-language.ts';
// 文件映射由构建器生成；只读取批准公开且带内容指纹的快照。
export function browserReplay(files: Readonly<Record<string,string>>, networkFetch: (url: URL) => Promise<Response> | Response, origin: string,
    options: {sharePending?: boolean; names?: CatalogNames; originalNames?: CatalogNames} = {}) {
    type Snapshot = {body:ArrayBuffer;type:string|null};
    const replay = createReplay(options), completed = new Map<string,Snapshot>(), pending = new Map<string,Promise<Snapshot>>();
    const assets: Assets = { async fetch(input) {
                const name = new URL(input instanceof Request ? input.url : input, origin).pathname;
                const target = files[name];
                if (!target)
                    return new Response('not found', { status: 404 });
                const cached = completed.get(target);
                const load = () => (async () => {
                        const response = await networkFetch(new URL(target, origin));
                        if (!response.ok)
                            throw Error('演示快照读取失败，请刷新重试');
                        const type = response.headers.get('content-type');
                        const body = options.names && name.endsWith('.json') && !name.endsWith('/manifest.json') && !name.endsWith('/entry-pages.json')
                            ? new TextEncoder().encode(JSON.stringify(projectCatalog(await response.json(), options.names))).buffer
                            : await response.arrayBuffer();
                        const value = { body, type };
                        completed.set(target, value);
                        return value;
                    })();
                let value = cached;
                if (!value) {
                    if (options.sharePending === false) value = await load();
                    else {
                        let task = pending.get(target);
                        if (!task) {task = load().finally(() => pending.delete(target)); pending.set(target, task);}
                        value = await task;
                    }
                }
                return new Response(value.body.slice(0), { headers: { 'content-type': value.type || 'application/json' } });
            } };
    return async (request: Request) => {
        try {
            return await replay.fetch(request, {ASSETS:assets});
        }
        catch {
            return Response.json({ error: 'unavailable', message: catalogName(options.names ?? {}, '演示数据读取失败，请刷新重试') }, { status: 503 });
        }
    };
}
