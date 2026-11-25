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
function localeResources(tree: AnyNode, locale: 'en' | 'zh-CN') {
    const names = new Set<string>();
    const ranges: [number, number][] = [];
    // 生产包把两个语言的命名空间分别绑定，再以 zh-CN / en 对象登记。
    walk(tree, node => {
        if (node.type !== 'ObjectExpression') return;
        const locales = node.properties.filter(property => property.type === 'Property');
        if (!locales.some(property => propertyName(property.key) === 'zh-CN' && property.value.type === 'ObjectExpression')) return;
        const resource = locales.find(property => propertyName(property.key) === locale)?.value;
        if (resource?.type !== 'ObjectExpression') return;
        for (const property of resource.properties) {
            if (property.type === 'Property' && property.value.type === 'Identifier') names.add(property.value.name);
        }
        ranges.push([resource.start, resource.end]);
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
const englishStorageNames = new Map([
    ['本地磁盘', 'Local disk'],
    ['光鸭云盘', 'Guangya Cloud'],
    ['其他已挂载网盘', 'Other mounted cloud storage'],
]);

export function movieScript(source: string): string {
    const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const english = localeResources(tree, 'en');
    const chinese = localeResources(tree, 'zh-CN');
    const ranges: [number, number, string][] = [];
    walk(tree, node => {
        // 存储来源注册表独立于应用的语言资源，按页面语言投影显示名。
        if (node.type === 'ObjectExpression' && node.properties.some(property =>
            property.type === 'Property' && propertyName(property.key) === 'default_cost')) {
            for (const property of node.properties) {
                if (property.type !== 'Property' || !['name', 'label'].includes(propertyName(property.key) || '')) continue;
                const value = property.value;
                if (value.type !== 'Literal' || typeof value.value !== 'string') continue;
                const label = englishStorageNames.get(value.value);
                if (label) ranges.push([value.start, value.end,
                    `(document.documentElement.lang === 'en' ? ${JSON.stringify(label)} : ${JSON.stringify(value.value)})`]);
            }
        }
        if (node.type !== 'Literal' && node.type !== 'TemplateElement') return;
        const project = english.some(([from, to]) => node.start >= from && node.end <= to) ? englishMovieText : movieText;
        if (node.type === 'Literal' && typeof node.value === 'string' && project(node.value) !== node.value) {
            const translated = project === movieText && node.value === 'JAV'
                && !chinese.some(([from, to]) => node.start >= from && node.end <= to)
                ? languageChoice('影片', 'Films')
                : JSON.stringify(project(node.value));
            ranges.push([node.start, node.end, translated]);
        }
        if (node.type === 'TemplateElement') {
            const translated = project(node.value.raw)
                .replace(/(<h2\b[^>]*\bdata-page-title\b[^>]*>)影片(?=<\/h2>)/g,
                    (_, heading) => heading + '${' + languageChoice('影片', 'Films') + '}');
            if (translated !== node.value.raw) ranges.push([node.start, node.end, translated]);
        }
    });
    for (const [start, end, text] of ranges.sort((a, b) => b[0] - a[0])) source = source.slice(0, start) + text + source.slice(end);
    return source;
}
function languageChoice(chinese: string, english: string): string {
    return `(document.documentElement.lang === 'en' ? ${JSON.stringify(english)} : ${JSON.stringify(chinese)})`;
}

export function localizeDemoScript(source: string, copy: Readonly<Record<string, string>>): string {
    const ranges: [number, number, string][] = [];
    walk(parse(source, { ecmaVersion: 'latest', sourceType: 'script' }), node => {
        if (node.type === 'Literal' && typeof node.value === 'string' && Object.hasOwn(copy, node.value)) {
            ranges.push([node.start, node.end, languageChoice(node.value, copy[node.value]!)]);
        }
        if (node.type === 'TemplateElement' && node.value.cooked && Object.hasOwn(copy, node.value.cooked)) {
            ranges.push([node.start, node.end, '${' + languageChoice(node.value.cooked, copy[node.value.cooked]!) + '}']);
        }
    });
    for (const [start, end, text] of ranges.sort((a, b) => b[0] - a[0])) source = source.slice(0, start) + text + source.slice(end);
    return source;
}

export const englishEditorCopy = {
    文案编辑: 'Copy editor',
    改字模式: 'Editing',
    帮助: 'Help',
    编辑使用说明: 'Editing help',
    '点击文字修改；切换、菜单和开关照常操作。\nAlt + 点击可修改控件文字。\nEnter 保存，Esc 取消。\n暂停编辑后可正常选择、复制文字。':
        'Click text to edit. Controls keep working as usual.\nAlt + click to edit a control label.\nEnter to save, Esc to cancel.\nPause editing to select or copy text.',
    '拖动工具栏空白处移动，方向键微调，双击空白处或 Esc 复位':
        'Drag an empty part of the toolbar to move it. Use arrow keys to adjust. Double-click or press Esc to reset.',
    '点击文字修改，回车或点别处保存，Esc 取消；暂停编辑后可操作页面。':
        'Click text to edit. Press Enter or click elsewhere to save. Press Esc to cancel. Pause to interact with the page.',
    暂停编辑: 'Pause',
    继续编辑: 'Resume',
    导出修改: 'Export edits',
    退出: 'Exit',
    退出编辑: 'Exit editor',
    选项: 'Options',
    请选择: 'Select an option',
    修改文字: 'Edit text',
    编辑已暂停: 'Paused',
    正在编辑: 'Editing',
    处理中: 'Working',
    保存失败: 'Save failed',
    已保存: 'Saved',
    已删除: 'Deleted',
    已取消: 'Canceled',
    'Enter 保存': 'Enter to save',
    'Enter 保存 · Esc 取消': 'Enter to save · Esc to cancel',
    '保留 {占位符}，只改文字 · Enter 保存 · Esc 取消': 'Keep the {placeholders} when editing · Enter to save · Esc to cancel',
    '保存中…': 'Saving…',
    已保存修改: 'Saved edits',
    已删除文字: 'Deleted text',
    '已保存，界面更新未完成：': 'Saved, but the page did not update: ',
    '未确认保存：': 'Could not confirm the save: ',
    '没保存：': 'Could not save: ',
    '未取得保存结果（HTTP ': 'Could not confirm the save (HTTP ',
    '），请刷新页面核对；服务未返回 JSON': '). Refresh to check the result. The server did not return JSON.',
    '请求失败（HTTP ': 'Request failed (HTTP ',
    '），请刷新页面核对': '). Refresh to check the result.',
    已保存到本机工作目录: 'Saved to the local workspace',
    '已删除文字，已保存到本机工作目录': 'Deleted text and saved to the local workspace',
    '本机改字服务未启动，仅保存到本浏览器': 'Saved in this browser. The local edit server is offline.',
    已保存到本浏览器: 'Saved in this browser',
    '已删除文字，刷新后仍保留': 'Deleted text. The change survives a refresh.',
    '已把本浏览器的 ': 'Synced ',
    ' 处改字同步到本机工作目录': ' browser edits to the local workspace',
};

export function movieHTML(source: string): string {
    if (source.includes('id="i-film"')) {
        source = source.replace(/<symbol id="i-jav"[^>]*>[\s\S]*?<\/symbol>/,
            '<symbol id="i-jav" viewBox="0 0 24 24"><use href="#i-film" /></symbol>');
    }
    // Peach 0.59 的「系列」标签引用 i-list，复用同一份雪碧图里的无序列表字形。
    if (!source.includes('id="i-list"')) {
        source = source.replace(/<symbol id="ri-list-unordered"[^>]*>[\s\S]*?<\/symbol>/, (symbol) => symbol
            + '<symbol id="i-list" viewBox="0 0 24 24"><use href="#ri-list-unordered" fill="currentColor" stroke="none" /></symbol>');
    }
    return source.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[^]*?-->|>[^<]+<|\b(?:alt|title|aria-label|placeholder)="[^"]*"/gi,
        part => /^<(?:script|style|!--)/i.test(part) ? part : movieText(part));
}
