import { parse } from 'acorn';
import type { AnyNode } from 'acorn';
import { walk } from './ast.ts';
// 只投影可见字串，协议键、路由和应用同步产物保持来源指纹。
export function movieText(text: string): string {
    if (text === 'sperm') return 'star';
    if (text === '番') return '影';
    return text.replaceAll('女优', '演员').replaceAll('番号', '编号').replaceAll('记一次高潮', '标记精彩片段').replaceAll('已记录一次高潮', '已标记精彩片段').replaceAll('高潮', '精彩片段').replace(/\bJAV\b/g, '影片')
        // 输入提示里的示例番号换成演示片目的编号。
        .replaceAll('SSIS-950', 'FILM-001').replaceAll('ABF-087、SYKH-145', 'FILM-001、FILM-002');
}
function propertyName(node: AnyNode): string | undefined {
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
}
function englishResources(tree: AnyNode) {
    const names = new Set<string>();
    const ranges: [number, number][] = [];
    // 生产包把两个语言的命名空间分别绑定，再以 zh-CN / en 对象登记。
    walk(tree, node => {
        if (node.type !== 'ObjectExpression') return;
        const locales = node.properties.filter(property => property.type === 'Property');
        if (!locales.some(property => propertyName(property.key) === 'zh-CN' && property.value.type === 'ObjectExpression')) return;
        const english = locales.find(property => propertyName(property.key) === 'en')?.value;
        if (english?.type !== 'ObjectExpression') return;
        for (const property of english.properties) {
            if (property.type === 'Property' && property.value.type === 'Identifier') names.add(property.value.name);
        }
        ranges.push([english.start, english.end]);
    });
    walk(tree, node => {
        if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && names.has(node.id.name) && node.init)
            ranges.push([node.init.start, node.init.end]);
    });
    return ranges;
}
const englishMovieText = (text: string) => text === 'JAV' ? 'Films' : text.replace(/\bJAV\b/g, 'Film')
    .replace(/\bactresses\b/g, 'performers').replace(/\bactress\b/g, 'performer')
    .replaceAll('Orgasm recorded', 'Highlight marked').replaceAll('Record an orgasm', 'Mark a highlight')
    .replaceAll('SSIS-950', 'FILM-001').replaceAll('ABF-087', 'FILM-001').replaceAll('SYKH-145', 'FILM-002');
export function movieScript(source: string): string {
    const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const english = englishResources(tree);
    const ranges: [number, number, string][] = [];
    walk(tree, node => {
        if (node.type !== 'Literal' && node.type !== 'TemplateElement') return;
        const project = english.some(([from, to]) => node.start >= from && node.end <= to) ? englishMovieText : movieText;
        if (node.type === 'Literal' && typeof node.value === 'string' && project(node.value) !== node.value)
            ranges.push([node.start, node.end, JSON.stringify(project(node.value))]);
        if (node.type === 'TemplateElement' && project(node.value.raw) !== node.value.raw)
            ranges.push([node.start, node.end, project(node.value.raw)]);
    });
    for (const [start, end, text] of ranges.sort((a, b) => b[0] - a[0])) source = source.slice(0, start) + text + source.slice(end);
    return source;
}
export function movieHTML(source: string): string {
    return source.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[^]*?-->|>[^<]+<|\b(?:alt|title|aria-label|placeholder)="[^"]*"/gi,
        part => /^<(?:script|style|!--)/i.test(part) ? part : movieText(part));
}
