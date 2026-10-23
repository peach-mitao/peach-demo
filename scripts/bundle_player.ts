import {walk} from './ast.ts';
import type {AnyNode,Literal} from 'acorn';
import { parse } from 'acorn';
import { build } from 'esbuild';
import path from 'node:path';
// 只识别应用已声明的 Video.js 按需导入组；不修改 vendored 文件。
export function playerImports(source: string) {
    const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }), prefixes: Map<string,string> = new Map(), arrays: string[][] = [];
    walk(tree, (node) => {
        if (node.type !== 'VariableDeclarator' || node.id.type !== 'Identifier')
            return;
        if (node.init?.type === 'Literal' && typeof node.init.value==='string'&&/^\/vendor\/videojs\/[^/]+\/$/.test(node.init.value))
            prefixes.set(node.id.name, node.init.value);
        if (node.init?.type === 'ArrayExpression') {
            const entries=node.init.elements;
            if(entries.every((item):item is Literal=>item?.type==='Literal'&&typeof item.value==='string')&&entries.some(item=>item.value==='video-player.js'))arrays.push(entries.map(item=>String(item.value)));
        }
    });
    const ranges: [number,number][] = [];
    walk(tree, (node) => { if (node.type === 'ImportExpression' && node.source.type === 'TemplateLiteral' && node.source.expressions[0]?.type==='Identifier'&&prefixes.has(node.source.expressions[0].name))
        ranges.push([node.start, node.end]); });
    return { prefix: [...prefixes.values()][0], files: arrays[0], ranges };
}
export async function bundlePlayer(source: string, site: string, out: string) {
    const info = playerImports(source);
    if (!info.prefix || !info.files || info.ranges.length !== 1)
        throw Error('播放器按需导入契约未取得');
    const result = await build({ stdin: { contents: info.files.map((name) => 'import ' + JSON.stringify(path.join(site, info.prefix, name)) + ';').join('\n'), resolveDir: site }, bundle: true, outdir: path.join(out, 'dist'), entryNames: 'demo-video-[hash]', format: 'esm', platform: 'browser', target: 'es2022', minify: true, metafile: true });
    const output = Object.keys(result.metafile.outputs).find(name => name.endsWith('.js'));
    if (!output)
        throw Error('播放器构建未取得');
    const url = '/' + path.relative(out, path.resolve(output)).split(path.sep).join('/');
    const rewrite = (source: string) => { const found = playerImports(source); for (const [start, end] of found.ranges.sort((a, b) => b[0] - a[0]))
        source = source.slice(0, start) + `import(${JSON.stringify(url)})` + source.slice(end); return source; };
    return { url, rewrite };
}
