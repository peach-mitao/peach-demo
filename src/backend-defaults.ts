// 与片目无关的接口以后端的实际取值打底（reference/backend-defaults.json，由 scripts/backend_reference.py
// 在断网临时实例上导出并脱敏），演示特化覆盖在上面：后端新增字段随参照更新自动带上默认值。
import defaults from '../reference/backend-defaults.json' with { type: 'json' };

type Value = unknown;
const isObject = (value: Value): value is Record<string, Value> => !!value && typeof value === 'object' && !Array.isArray(value);

/** 对象逐层合并、演示值优先；数组与标量整体取演示值。 */
export function mergeBackend(base: Value, demo: Value): Value {
    if (!isObject(base) || !isObject(demo))
        return demo === undefined ? structuredClone(base) : demo;
    const out: Record<string, Value> = structuredClone(base);
    for (const [key, value] of Object.entries(demo))
        out[key] = key in out ? mergeBackend(out[key], value) : value;
    return out;
}

/** `keys` 限定只从后端取哪些顶层字段；其余顶层字段属于演示数据本身，不从参照实例带入。 */
const pathOf = (route: string) => new URL(route, 'https://demo.example').pathname;
/** 同一路径的其他查询变体共用参照里那份默认值。 */
export function backendDefault(route: string): Value {
    const routes = defaults.routes as Record<string, Value>;
    return routes[route] ?? Object.entries(routes).find(([key]) => pathOf(key) === pathOf(route))?.[1];
}
export function withBackend<T>(route: string, demo: T, keys?: readonly string[]): T {
    const base = backendDefault(route);
    if (!isObject(base))
        return demo;
    const picked = keys ? Object.fromEntries(Object.entries(base).filter(([key]) => keys.includes(key))) : base;
    return mergeBackend(picked, demo) as T;
}
