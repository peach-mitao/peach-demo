import { parse } from 'acorn';
import { walk } from './ast.ts';
// 只投影可见字串，协议键、路由和应用同步产物保持来源指纹。
export function movieText(text: string): string {
    if (text === 'sperm') return 'star';
    if (text === '番') return '影';
    return text.replaceAll('女优', '演员').replaceAll('番号', '编号').replaceAll('记一次高潮', '标记精彩片段').replaceAll('已记录一次高潮', '已标记精彩片段').replaceAll('高潮', '精彩片段').replace(/\bJAV\b/g, '影片');
}
export function movieScript(source: string): string {
    const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const ranges: [number, number, string][] = [];
    walk(tree, node => {
        if (node.type === 'Literal' && typeof node.value === 'string' && movieText(node.value) !== node.value)
            ranges.push([node.start, node.end, JSON.stringify(movieText(node.value))]);
        if (node.type === 'TemplateElement' && movieText(node.value.raw) !== node.value.raw)
            ranges.push([node.start, node.end, movieText(node.value.raw)]);
    });
    for (const [start, end, text] of ranges.sort((a, b) => b[0] - a[0])) source = source.slice(0, start) + text + source.slice(end);
    return source;
}
export function movieHTML(source: string): string {
    return source.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[^]*?-->|>[^<]+<|\b(?:alt|title|aria-label|placeholder)="[^"]*"/gi,
        part => /^<(?:script|style|!--)/i.test(part) ? part : movieText(part));
}
