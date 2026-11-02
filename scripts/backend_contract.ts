// 演示数据对照应用后端的字段契约。参照由 scripts/backend_reference.py 在断网临时实例上导出，只含字段路径与类型。
export type Shape = Record<string, string>;

/** 字段路径到类型；数组取前二十个元素的并集，与参照导出的算法一致。 */
export function shapeOf(value: unknown, at = '', out: Shape = {}): Shape {
    const kind = Array.isArray(value) ? 'array' : value === null || value === undefined ? 'null' : typeof value === 'boolean' ? 'boolean'
        : typeof value === 'number' ? 'number' : typeof value === 'string' ? 'string' : 'object';
    if (at && (!(at in out) || out[at] === 'null'))
        out[at] = kind;
    if (Array.isArray(value))
        for (const child of value.slice(0, 20)) shapeOf(child, at + '[]', out);
    else if (value && typeof value === 'object')
        for (const [key, child] of Object.entries(value))
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) shapeOf(child, at ? `${at}.${key}` : key, out);
    return out;
}

const parent = (path: string) => path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : '';

/** 参照有、演示缺的字段与类型不一致的字段。演示里本来为空的数组不比较元素，参照里为 null 的不定类型。 */
export function contractGaps(reference: Shape, actual: Shape) {
    const missing = Object.keys(reference).filter(path => !(path in actual) && reference[path] !== 'null'
        && (!parent(path) || actual[parent(path)] === 'object') && !(path.endsWith('[]') && actual[path.slice(0, -2)] === 'array'));
    const mistyped = Object.keys(reference).filter(path => path in actual && reference[path] !== actual[path]
        && reference[path] !== 'null' && actual[path] !== 'null');
    return { missing, mistyped };
}

/**
 * 演示站特化：后端有、演示有意不给的字段，逐条写明原因。新增条目前先确认不是漏同步。
 * 键是接口路径（不含查询），值是字段路径前缀到原因。
 */
export const DEMO_EXCEPTIONS: Record<string, Record<string, string>> = {
    '/api/library-processing': { '*': '参照实例刚跑完一轮入库，返回的是处理结束快照；演示固定为空闲状态，进度与问题字段只在任务进行中出现。' },
    '/api/items': { 'items[].cover_frame': '演示海报固定居中取景，不带应用的封面版式检测结果。' },
    '/api/related': { 'items[].cover_frame': '演示海报固定居中取景，不带应用的封面版式检测结果。' },
    '/api/index': { 'categories': '演示保留片目原有的类型名，不套用应用按 JAV 标签词表做的归类与改名，类别统一为 general。' },
    '/api/tag-management': { 'categories': '演示保留片目原有的类型名，不套用应用按 JAV 标签词表做的归类与改名，类别统一为 general。' },
    '/api/entity': Object.fromEntries(['candidate_key', 'content_id', 'provider', 'provider_id', 'raw_snapshot', 'review_item'].map(key => [`metadata.${key}`,
        '参照人物由 NFO 采集候选经复核批准，带候选出处；演示人物取自公开片目署名，只有来源与来源地址。'])),
};

export function unexplainedGaps(route: string, reference: Shape, actual: Shape) {
    const exceptions = DEMO_EXCEPTIONS[new URL(route, 'https://demo.example').pathname] || {};
    const explained = (path: string) => '*' in exceptions || Object.keys(exceptions).some(prefix => path === prefix || path.startsWith(prefix + '.') || path.startsWith(prefix + '[]'));
    const { missing, mistyped } = contractGaps(reference, actual);
    return { missing: missing.filter(path => !explained(path)), mistyped: mistyped.filter(path => !explained(path)) };
}
