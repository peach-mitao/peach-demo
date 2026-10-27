import type {FixtureManifest,ImageMap,JSONValue} from '../src/types.ts';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fixtureHash, fixtureKey } from '../src/key.ts';
// 公开范围按已支持的读取契约列举，不遍历发布录制目录。
const READS = `ads avatar-choices configuration configuration/automatic-updates configuration/cloud-proxies configuration/downloads configuration/downloads/check configuration/downloads/pikpak/browser-login configuration/entry-links configuration/indexers configuration/jav-browser configuration/library-sharing configuration/library-sharing/preview configuration/peach-proxy configuration/push-discovery configuration/remote-reporting configuration/startup configuration/tunnel configuration/update-status configuration/updates diagnostics downloads duplicates entity/shapes feeds follow follow/activity follow/check follow/credentials follow/image-dims follow/status follow/suggest items facets index jav/discoveries libraries library-processing library-shortcuts links media-processing media-repair organize orphan-records playlists post-setup-tutorial quality-goals resource-sync scraping scraping/amane-bridge scraping/amane-bridge/job scraping/cache scraping/sources settings sources stats subscriptions taste tasks timeline trash wants`.split(' ');
export function publicValue(value: unknown, key = ''): unknown {
    if (/^(password|current_password|confirmation|token|secret|api_key|cookie|cookies|cookies_text|authorization|source_uri|magnet)$/i.test(key))
        return '';
    if (typeof value === 'string') {
        if (/magnet:\?|(?:https?:\/\/)[^/\s]+:[^/@\s]+@/i.test(value))
            return '';
        if (/^(?:[A-Z]:[\\/]|\/Users\/|\/home\/)/i.test(value))
            return 'R:\\Media\\演示';
        return value;
    }
    if (Array.isArray(value))
        return value.map(item => publicValue(item));
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, publicValue(v, k)]));
    return value;
}
export async function buildReplay(site: string, images: ImageMap) {
    const fixtures = path.join(site, '_fixtures'), load = async (name:string) => JSON.parse(await readFile(path.join(fixtures, name), 'utf8'));
    const manifest = await load('manifest.json'), catalog = await load('catalog.json'), indexes = await load('indexes.json');
    const routes = new Set(['/healthz', '/api/network-status', '/api/background-issues', '/api/feeds/schedule', ...READS.map(name => '/api/' + name)]);
    for (const name of ['custom-metadata', 'follow/resolve', 'follow/schedule', 'links/prune', 'review', 'scraping/cover', 'taste/refresh', 'thumbnail-jobs', 'resource-sync/apply'] as const)
        routes.add('/api/' + name);
    const add = (name: string, query: object) => routes.add(name + '?' + new URLSearchParams(query as Record<string,string>));
    for (const item of catalog.items) {
        for (const name of ['/api/item', '/api/timeline', '/api/playback-plan', '/api/stream-plan'] as const)
            add(name, { id: String(item.id) });
        add('/api/subtitles/memory', { video: `item:${item.id}` });
        routes.add(`/api/assets/${item.id}/subtitles`);
        for (const limit of ['20', '28'] as const)
            add('/api/related', { id: String(item.id), limit });
        if (item.code)
            for (const name of ['/api/work', '/api/jav/work', '/api/jav/detail', '/api/jav/reviews', '/api/jav/resources'] as const)
                add(name, { code: item.code });
    }
    for (const [group, kind] of Object.entries({ performers: 'performer', creators: 'creator', studios: 'studio', studioSearch: 'studio', agencies: 'agency', tags: 'tag', onlineAuthors: 'creator', onlineTags: 'tag' }))
        for (const row of indexes[group]?.items || []) {
            for (const id of [row.entity_id].filter(Boolean))
                for (const endpoint of ['/api/entity', '/api/photos', '/api/avatar-choices'] as const)
                    add(endpoint, { kind: row.entity_kind || kind, id: String(id) });
            for (const endpoint of ['/api/entity', '/api/photos', '/api/avatar-choices'] as const)
                add(endpoint, { kind: row.entity_kind || kind, name: row.k });
            if (row.entity_id)
                add('/api/feeds/discoveries', { limit: '12', entity: String(row.entity_id) });
        }
    for (const name of Object.keys(catalog.entity_filters?.series || {}))
        for (const endpoint of ['/api/entity', '/api/photos', '/api/avatar-choices'] as const)
            add(endpoint, { kind: 'series', name });
    for (const status of ['new', 'seen', 'saved', 'all'] as const)
        for (const sort of ['rand', 'new'] as const)
            for (const author of ['', ...(indexes.onlineAuthors?.items || []).map((row: { key: any; entity_id: any; }) => row.key || `entity:${row.entity_id}`)] as const)
                add('/api/follow', { limit: '100', offset: '0', status, ...(author ? { author } : {}), sort });
    for (const scope of ['library', 'external'] as const)
        add('/api/jav/discoveries', { scope, limit: '100', sort: 'taste', direction: 'desc' });
    for (const query of [{ window: 'all' }, { window: '30d' }, { window: '90d' }, { window: '7d' }] as const)
        add('/api/taste', query);
    for (const [name, query] of [['/api/follow', { limit: '100', offset: '0' }], ['/api/feeds/discoveries', { limit: '12' }], ['/api/tops', { n: '60' }], ['/api/downloads', { limit: '50' }], ['/api/tag-management', {}], ['/api/tag-management', { scope: 'online' }]] as const)
        add(name, query);
    for (const [name, query] of [['/api/ads', { limit: '1' }], ['/api/ads', { limit: '200', status: 'pending' }], ['/api/duplicates', { limit: '120' }], ['/api/quality-goals', { limit: '200' }], ['/api/follow', { summary: '1' }], ['/api/review', { counts: '1' }]] as const)
        add(name, query);
    routes.add('/api/tag-management');
    const files: Record<string,string> = {}, selected: Required<FixtureManifest> = { fixtures: {}, alias: {}, paths: manifest.paths };
    const save = async (name: string, value: unknown) => {
        const body = JSON.stringify(publicValue(value));
        const hash = createHash('sha256').update(body).digest('hex'), target = `/_demo/data/${hash}.json`;
        await writeFile(path.join(site, target), body);
        files['/_fixtures/' + name] = target;
    };
    await mkdir(path.join(site, '_demo/data'), { recursive: true });
    for (const route of [...routes] as const) {
        const own = await fixtureHash(fixtureKey('GET', new URL(route, 'https://demo.example'))), key = manifest.alias?.[own] || own;
        if (manifest.fixtures[key] !== 'json')
            continue;
        const value = await load(key + '.json');
        await save(key + '.json', value);
        selected.fixtures[key] = 'json';
        if (own !== key)
            selected.alias[own] = key;
        if (route.startsWith('/api/entity?') && value.id) {
            const params = new URL(route, 'https://demo.example').searchParams, kind = params.get('kind');
            add('/api/entity', { kind, id: String(value.id) });
            add('/api/feeds/discoveries', { limit: '12', entity: String(value.id) });
        }
        if (route === '/api/playlists')
            for (const item of value.items || [])
                add('/api/playlist', { id: String(item.id) });
        if (route.startsWith('/api/follow?'))
            for (const group of value.groups || [])
                add('/api/follow', { item: String(group.primary.id) });
    }
    // 补齐从公开实体与列表响应中取得的规范详情键。
    for (const route of routes) {
        const own = await fixtureHash(fixtureKey('GET', new URL(route, 'https://demo.example'))), key = manifest.alias?.[own] || own;
        if (selected.fixtures[key] || manifest.fixtures[key] !== 'json')
            continue;
        await save(key + '.json', await load(key + '.json'));
        selected.fixtures[key] = 'json';
        if (own !== key)
            selected.alias[own] = key;
    }
    for (const [key, url] of Object.entries(images)) {
        if (!/^[a-f0-9]{20}$/.test(key))
            continue;
        selected.fixtures[key] = url.split('.').at(-1)!;
        files['/_fixtures/' + key + '.' + selected.fixtures[key]] = url;
    }
    await save('catalog.json', { items: catalog.items, tag_categories: catalog.tag_categories, entity_filters: catalog.entity_filters });
    await save('indexes.json', Object.fromEntries(Object.entries(indexes).filter(([key]) => ['performers', 'creators', 'studios', 'studioSearch', 'agencies', 'tags', 'onlineAuthors', 'onlineTags', 'onlineGeneralTags'].includes(key))));
    try {
        const suggest = await load('suggest.json');
        await save('suggest.json', { entities: suggest.entities, assets: suggest.assets });
    }
    catch (error) {
        if ((error as {code?:string}).code !== 'ENOENT')
            throw error;
    }
    try {
        await save('entry-pages.json', { questions: (await load('entry-pages.json')).questions });
    }
    catch (error) {
        if ((error as {code?:string}).code !== 'ENOENT')
            throw error;
    }
    await save('manifest.json', selected);
    const media = JSON.parse(await readFile(path.join(site, '_media/index.json'), 'utf8'));
    const body = JSON.stringify(media), hash = createHash('sha256').update(body).digest('hex');
    const mediaTarget = `/_demo/data/${hash}.json`;
    await writeFile(path.join(site, mediaTarget), body);
    files['/_media/index.json'] = mediaTarget;
    await writeFile(path.join(site, '_demo/replay-files.json'), JSON.stringify(files));
    return { files, fixtures: Object.keys(selected.fixtures).length };
}
