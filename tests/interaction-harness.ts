// 交互层在测试里的运行夹具：在隔离上下文里装载构建后的 interactions.js，底层请求交给 `respond` 回答。
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as tagManagement from '../src/tag-management.ts';
const source = await readFile(new URL('../site/_demo/interactions.js', import.meta.url), 'utf8');
export function page(respond: (url: URL) => unknown = () => ({ status: 'complete', id: 1, items: [] })) {
    let now = Date.now();
    const calls: { path: string; search: string; method: any; }[] = [], context: Record<string, any> = { Request, Response, Headers, URL, URLSearchParams, crypto, Blob, Date: class extends Date {
            static now() { return now; }
        },
        location: { href: 'https://demo.example/', origin: 'https://demo.example', search: '' },
        document: { readyState: 'loading', addEventListener() { } },
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => { const url = input instanceof Request ? new URL(input.url) : new URL(input, 'https://demo.example'); calls.push({ path: url.pathname, search: url.search, method: input instanceof Request ? input.method : init?.method || 'GET' }); return new Response(JSON.stringify(respond(url)), { headers: { 'content-type': 'application/json' } }); } };
    context.window = context;
    context.peachDemoMedia = (value: any) => value;
    context.peachDemoMediaJSON = (value: any) => value;
    context.peachDemoTags = tagManagement;
    vm.runInNewContext(source, context);
    return { fetch: context.fetch, calls, advance: (ms: number) => { now += ms; } };
}
