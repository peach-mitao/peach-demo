import type { JSONValue } from './types.ts';

export type CatalogNames = Readonly<Record<string, string>>;

export function catalogName(names: CatalogNames, value: string): string {
    return Object.hasOwn(names, value) ? names[value]! : value;
}

export function projectCatalog(value: JSONValue, names: CatalogNames, field = ''): JSONValue {
    if (typeof value === 'string') {
        if (field === 'zh_cn') return value;
        if (field === 'performers' || field === 'director') {
            return value.split('、').map(name => catalogName(names, name)).join(', ');
        }
        if (field === 'title' && value.endsWith(' 海报')) {
            return catalogName(names, value.slice(0, -3)) + ' poster';
        }
        if ((field === 'headline' || field === 'message') && value.startsWith('演示偏好：')) {
            const tags = value.slice('演示偏好：'.length, -1).split('、').map(tag => catalogName(names, tag));
            return 'Sample preferences: ' + tags.join(', ') + '.';
        }
        if (field === 'message' && /^\d+ 部演示电影$/.test(value)) {
            return value.replace(' 部演示电影', ' demo films');
        }
        if (value.endsWith('.mp4')) {
            return catalogName(names, value.slice(0, -4)) + '.mp4';
        }
        return catalogName(names, value);
    }
    if (Array.isArray(value)) return value.map(item => projectCatalog(item, names, field));
    if (!value || typeof value !== 'object') return value;
    const projected = Object.fromEntries(Object.entries(value).map(([key, child]) => [
        ['tag_categories', 'entity_filter', 'tag_types'].includes(field) ? catalogName(names, key) : key,
        projectCatalog(child, names, field === 'entity_filters' ? 'entity_filter' : key),
    ]));
    if (typeof projected.canonical_name === 'string' && typeof projected.kind === 'string') {
        const name = projected.canonical_name;
        if (Array.isArray(projected.aliases)) projected.aliases = projected.aliases.filter(alias => alias !== name);
        // 资料顶栏显示别名。英语投影的规范名不再作为自己的别名重复出现。
        if (projected.kind === 'performer' || projected.kind === 'creator') {
            projected.name_groups = { reading: '', shown: [], total: 0, groups: [] };
        }
    }
    return projected;
}

export function originalCatalogURL(url: URL, names: CatalogNames): URL {
    const field = url.pathname === '/logo' ? 'studio' :
        ['/api/entity', '/api/photos', '/api/avatar-choices', '/avatar'].includes(url.pathname) ? 'name' : '';
    if (!field) return url;
    const name = url.searchParams.get(field);
    if (!name) return url;
    const original = catalogName(names, name);
    if (original === name) return url;
    const target = new URL(url);
    target.searchParams.set(field, original);
    return target;
}
