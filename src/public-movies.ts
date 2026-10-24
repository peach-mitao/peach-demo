import catalog from './public-film-catalog.json' with { type: 'json' };
// 影片事实与逐图许可来自公开片目；行为与任务记录均为演示数据。
export const DEMO_DATA_NOTICE = '影片资料与图片来源见页脚；编号、文件参数、评分、观看、关注和任务状态均为演示数据。未取得人物照片时显示姓名字母。';
export interface PublicImage {
  file: string; url: string; source: string; artist?: string; attribution?: string; license: string; license_url: string;
  license_source?: string; sha256: string; bytes: number; changes: string;
}
export interface PublicMovie {
  slug: string; title: string; year: number; studio: string; directors: string[]; cast: string[];
  seconds: number; tags: string[]; credit: string; original_title?: string; wikidata?: string; poster: PublicImage;
}
export interface PublicPerson { id: string; name: string; original_name: string; source: string; films: string[]; portrait: PublicImage }
export const FILMS: PublicMovie[] = catalog.films;
export const PEOPLE: PublicPerson[] = catalog.people;
export interface PublicCatalog { films: PublicMovie[]; people: PublicPerson[] }
export const PUBLIC_CATALOG: PublicCatalog = { films: FILMS, people: PEOPLE };
export const MOVIE_READS = `ads avatar-choices configuration configuration/automatic-updates configuration/cloud-proxies configuration/downloads configuration/downloads/check configuration/downloads/pikpak/browser-login configuration/entry-links configuration/indexers configuration/jav-browser configuration/library-sharing configuration/library-sharing/preview configuration/peach-proxy configuration/push-discovery configuration/remote-reporting configuration/startup configuration/tunnel configuration/update-status configuration/updates diagnostics downloads duplicates entity/shapes feeds follow follow/activity follow/check follow/credentials follow/image-dims follow/status follow/suggest items facets index jav/discoveries libraries library-processing library-shortcuts links media-processing media-repair organize orphan-records playlists post-setup-tutorial quality-goals resource-sync scraping scraping/amane-bridge scraping/amane-bridge/job scraping/cache scraping/sources settings sources stats subscriptions taste tasks timeline trash wants custom-metadata follow/resolve follow/schedule links/prune review scraping/cover taste/refresh thumbnail-jobs resource-sync/apply`.split(' ');

// 旧快照只贡献固定字段结构；数组及全部字符串均不进入新数据。
export function responseShape(value: unknown): any {
  if (Array.isArray(value)) return [];
  if (value === null) return null;
  if (typeof value === 'string') return '';
  if (typeof value === 'number') return 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value as object)
    .filter(([key]) => /^[a-z][a-z0-9_]*$/i.test(key))
    .map(([key, child]) => [key, responseShape(child)]));
  return null;
}

type Row = Record<string, any>;
export function publicMovies(films: readonly PublicMovie[] = FILMS, people: readonly PublicPerson[] = PEOPLE) {
  if (!films.length) throw Error('普通电影片目不能为空');
  const routes = new Map<string, any>();
  const imageRoutes = new Map<string, string>();
  const put = (route: string, value: unknown) => routes.set(route, value);
  put('/api/network-status', { state: 'online', checked_at: null, demo: true });
  put('/api/background-issues', { issues: [], demo: true });
  put('/api/feeds/schedule', { available: true, enabled: false, interval_minutes: 360, running: false, last_error: null, next_run_at: null, demo: true });
  const query = (route: string, value: Record<string, string | number>) => route + '?' + new URLSearchParams(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)])));
  const image = (route: string, slug: string) => imageRoutes.set(route, slug);
  const now = '2026-10-01T12:00:00Z';
  const wantedIndex = Math.min(4, films.length - 1);
  const isBlender = (film: PublicMovie) => new URL(film.credit).hostname.endsWith('blender.org');
  let nextEntity = 101;
  const entities: Row[] = [];
  const entity = (kind: string, name: string, film: PublicMovie) => {
    const person = ['creator', 'performer'].includes(kind) ? people.find(row => row.name === name || row.original_name === name) : undefined;
    name = person?.name || name;
    const existing = entities.find(row => row.kind === kind && row.canonical_name === name);
    if (existing) return existing;
    const row: Row = { id: nextEntity++, kind, canonical_name: name, normalized_name: name, name,
      metadata: { source: new URL(film.credit).hostname, source_url: person?.source || film.credit },
      aliases: person?.original_name ? [person.original_name] : [], display_aliases: [], user_aliases: [], related_identities: [], external_refs: [], entry_links: [], search_terms: [],
      identity_categories: [kind === 'performer' ? 'actor' : kind], identity_labels: [kind === 'performer' ? '演员 / 配音' : kind === 'creator' ? '导演' : '开放电影'],
      favorite: false, feed: { following: true }, follow: null, profile: {},
      links: [{ link_id: nextEntity + 1000, link_kind: 'official', label: '官方资料', url: film.credit, hostname: new URL(film.credit).hostname, metadata: {}, gone: false, clickable: true }],
      name_groups: { reading: '', shown: [name], total: 1, groups: [{ label: '名称', names: [{ name, reading: '' }] }] },
      related_performers: [], tags: [], member_count: 0, agency: null, maker: null, labels: [],
      has_image: !!person, has_avatar: !!person, has_logo: false, image_version: person?.portrait.sha256 || '', avatar_focus: null,
      created_at: now, updated_at: now, demo: true };
    entities.push(row);
    if (person) {
      for (const route of ['/entity-image', '/avatar']) image(query(route, { id: row.id }), person.id);
      for (const thumb of ['', '1']) image(query('/entity-image', { kind, id: row.id, ...(thumb ? { thumb } : {}) }), person.id);
      image(query('/avatar', { kind, name }), person.id);
    }
    return row;
  };
  const refs = (rows: Row[]) => rows.map(row => ({ id: row.id, name: row.canonical_name, has_image: row.has_image, has_avatar: row.has_avatar, image_version: row.image_version, avatar_focus: null }));
  const items = films.map((film, index) => {
    const studio = film.studio;
    const series = isBlender(film) ? 'Blender Open Movies' : '';
    const id = index + 1, code = `FILM-${String(id).padStart(3, '0')}`;
    const creators = film.directors.map(name => entity('creator', name, film));
    const performers = film.cast.map(name => entity('performer', name, film));
    if (studio) entity('studio', studio, film);
    if (series) entity('series', series, film);
    for (const tag of new Set([...film.tags, ...(isBlender(film) ? ['开放电影'] : [])])) entity('tag', tag, film);
    const row: Row = { id, code, name: `${film.title}.mp4`, catalog_title: film.title, original_title: film.original_title || film.title,
      title: film.title, location: 'local', medium: 'video', creator: creators[0]?.name || '', studio, series,
      release_date: String(film.year), size: (index + 1) * 100000000, duration: film.seconds, width: 1920, height: 1080,
      ctx_length: film.seconds < 300 ? '速食' : film.seconds <= 900 ? '短' : film.seconds <= 2400 ? '中' : '长', ctx_orient: '横屏', play_count: index % 3, play_seconds: index % 3 * 120, max_reached: index % 3 ? 0.5 : null,
      feedback: index === 0 ? 'like' : null, rating: index === 0 ? 5 : index === 1 ? 4 : null, o_count: 0,
      watch_later: index % 2 === 0, first_seen: now, last_played: index % 3 ? now : null,
      tags: [...new Set([...film.tags, ...(isBlender(film) ? ['开放电影'] : [])])], filter_tags: [...new Set([...film.tags, ...(isBlender(film) ? ['开放电影'] : [])])], performers: performers.map(row => row.name),
      performer_entities: refs(performers), creator_entity: refs(creators)[0], performer_total: performers.length,
      cost: 'free', has_thumb: true, has_local_poster: true, has_cover: true, cover_key: code, cover_frame: { cx: 0.5, cy: 0.5 },
      cover_version: film.poster.sha256, poster_box: null, region: '', effective_region: '', region_label: '', region_settled: false,
      // 此演示协议字段启用有编号影片的封面、作品与筛选分支；内容均为普通电影。
      is_jav: true, demo: true, demo_notice: DEMO_DATA_NOTICE, source_url: film.credit };
    const detail = { ...row, tags: row.tags.map((k: string) => ({ k, cat: 'general', official: true })),
      entities: { creator: creators.map(row => row.name), performer: performers.map(row => row.name), studio: studio ? [studio] : [], series: series ? [series] : [] },
      entity_refs: { creator: refs(creators), performer: refs(performers), studio: refs(entities.filter(e => e.kind === 'studio' && e.name === studio)), series: refs(entities.filter(e => e.kind === 'series' && e.name === series)) },
      field_owners: {}, mutation_revision: 1, sample_images: [], liked: index === 0 ? 1 : 0, like_reason: '', better_version: 0,
      better_version_reason: '', edition_badges: [], display_code: code, display_title: film.title };
    put(query('/api/item', { id }), detail);
    const work = { ok: true, state: 'ready', message: DEMO_DATA_NOTICE, code, title: film.title, release_date: row.release_date,
      studio, publisher: studio, director: film.directors.join('、'), duration: film.seconds / 60, score: null, summary: '',
      tags: row.tags, tag_refs: row.tags.map((name: string) => ({ name, category: 'general', source_name: name })),
      performers: film.cast.join('、'), performer_refs: refs(performers), studio_refs: refs(entities.filter(e => e.kind === 'studio' && e.name === studio)),
      series_refs: refs(entities.filter(e => e.kind === 'series' && e.name === series)), comments_count: 0, preview_count: 0, preview_video_url: '',
      preview_state: 'missing', has_cover: true, cover_version: row.cover_version, cover_url: '', source_image: true,
      source_url: row.source_url, wanted: index === wantedIndex, want_id: index === wantedIndex ? 1 : null, checked_at: now, demo: true };
    for (const endpoint of ['/api/work', '/api/jav/work', '/api/jav/detail']) put(query(endpoint, { code }), work);
    put(query('/api/jav/reviews', { code }), { ok: true, items: [], comments: [], total: 0, more: false });
    put(query('/api/jav/resources', { code }), { state: 'unavailable', items: [], complete: true, warnings: [], error: '仅提供演示' });
    put(query('/api/timeline', { id }), {});
    put(query('/api/playback-plan', { id }), { ok: false, available: false, message: '仅提供演示', segments: [] });
    put(query('/api/stream-plan', { id }), { ok: false, available: false, message: '仅提供演示', segments: [] });
    put(query('/api/subtitles/memory', { video: `item:${id}` }), { selected: null, tracks: [] });
    put(`/api/assets/${id}/subtitles`, { tracks: [], selected: null });
    for (const endpoint of ['/thumb', '/poster', '/cover']) {
      image(query(endpoint, { id }), film.slug); image(query(endpoint, { code }), film.slug);
    }
    for (let c = 0; c < 9; c++) for (const endpoint of ['/thumb', '/poster']) image(query(endpoint, { id, c }), film.slug);
    for (const thumb of [1, 2, 3, 4]) image(query('/cover', { code, thumb }), film.slug);
    for (const endpoint of ['/cover', '/poster']) image(query(endpoint, { key: code }), film.slug);
    image(query('/follow-cover', { id }), film.slug);
    image(query('/follow-stream', { id, index: 0 }), film.slug);
    return row;
  });
  const filters: Record<string, Record<string, number[]>> = {};
  for (const row of entities) {
    const members = items.filter((item, index) => row.kind === 'performer' ? item.performers.includes(row.name) : row.kind === 'creator' ? films[index]!.directors.some(name => name === row.name || row.aliases.includes(name)) : row.kind === 'tag' ? item.tags.includes(row.name) : item[row.kind] === row.name);
    row.asset_count = members.length; row.representative_asset_id = members[0]?.id ?? null;
    (filters[row.kind] ??= {})[row.name] = members.map(item => item.id);
    const photos = { kind: row.kind, name: row.name, entity_id: row.id, sets: [], total: 0, items: [], seed: 0, sample_total: 0, has_more: false };
    const addresses: Record<string, string | number>[] = [{ kind: row.kind, id: row.id }, { kind: row.kind, name: row.name }];
    for (const address of addresses) {
      put(query('/api/entity', address), row); put(query('/api/photos', address), photos);
      put(query('/api/avatar-choices', address), { ok: true, items: [], total: 0 });
    }
    put(query('/api/feeds/discoveries', { limit: 12, entity: row.id }), { ok: true, items: [], more: false });
  }
  const directory = (kind: string) => ({ kind, items: entities.filter(row => row.kind === kind).sort((a, b) => Number(b.has_image) - Number(a.has_image) || b.asset_count - a.asset_count).map(row => ({
    entity_id: row.id, entity_kind: kind, k: row.name, n: row.asset_count, rep: row.representative_asset_id,
    cat: 'general', favorite: false, following: true, has_image: row.has_image, has_avatar: row.has_avatar, image_version: row.image_version,
    avatar_focus: null, identity_categories: row.identity_categories, identity_labels: row.identity_labels,
  })), has_more: false, categories: {} });
  const authors = directory('creator').items.map(row => ({ ...row, key: `entity:${row.entity_id}`, avatar: row.has_image ? `/entity-image?kind=creator&id=${row.entity_id}` : '', providers: ['demo'], held_by: '' }));
  const indexes = { performers: directory('performer'), creators: directory('creator'), studios: directory('studio'), studioSearch: directory('studio'),
    agencies: { kind: 'agencies', items: [], has_more: false }, tags: directory('tag'),
    onlineAuthors: { kind: 'performers', scope: 'online', items: authors, total: authors.length, has_more: false },
    onlineTags: { ...directory('tag'), kind: 'tags', scope: 'online' }, onlineGeneralTags: { ...directory('tag'), kind: 'tags', scope: 'online' } };
  put('/api/sources', { ok: true, sources: [
    { location: 'local', roots: [{ declared: 'R:\\Media', resolved: 'R:\\Media', mapped: true, online: true }], mapped: true, online: true },
    { location: 'online', declared: null, resolved: null, mapped: true, online: true },
  ], offline: [] });
  put('/api/libraries', { libraries: [{ id: 'demo-movies', name: '电影演示馆藏', icon: 'local', folders: 1, metered: false }] });
  put('/api/settings', { sidebarOrder: ['', 'follow', 'jav', 'performers', 'tags', 'studios', 'flagged', 'manage'], metadataRefreshDays: 30,
    followInitialDays: 30, postSetupTutorialDone: false, organizeTemplates: {}, feedHideGroupCompilations: true, feedHideSoloCompilations: false,
    feedHideExcerpts: true, searchHistoryLimit: 10 });
  put('/api/library-shortcuts', { favorites: indexes.performers.items.filter(row => row.has_image).slice(0, 3).map(row => ({
    key: `entity:${row.entity_id}`, entity_id: row.entity_id, kind: 'performer', name: row.k,
    image_url: `/entity-image?kind=performer&id=${row.entity_id}&thumb=1`, image_label: row.k,
  })), filters: [{ id: 'public-movies', name: '普通电影', href: '/?jav=1&sort=release' }] });
  const suggestion = { entities: entities.map(row => ({ kind: row.kind, name: row.name, terms: row.aliases, item: { value: row.name, n: row.asset_count, matched: '', id: null, entity_id: row.id, has_image: row.has_image } })),
    assets: items.map(row => ({ id: row.id, code: row.code, title: row.title, original: row.title, name: row.name, plays: row.play_count,
      item: { value: row.code, n: 0, matched: '', id: row.id, code: row.code, title: row.title, who: row.creator, card: row } })) };
  const discovery = items.map((row, i) => ({ ...row, asset_id: row.id, performers: row.performers.join('、'), performer_refs: row.performer_entities,
    cover_url: '', link: row.source_url, source_score: null, metadata_state: 'ready', metadata_fields: {}, reasons: ['演示推荐排序'],
    ranking_score: 1 - i / (items.length + 1), score: 1 - i / (items.length + 1), taste_score: 1 - i / (items.length + 1), wanted: i === wantedIndex, rank: i + 1 }));
  for (const row of items) for (const limit of [20, 28]) put(query('/api/related', { id: row.id, limit }), { items: items.filter(item => item.id !== row.id).slice(0, limit), total: items.length - 1 });
  for (const scope of ['library', 'external']) put(query('/api/jav/discoveries', { scope, limit: 100, sort: 'taste', direction: 'desc' }), { scope, items: discovery, candidate_total: items.length, sort: 'taste', ranking_method: 'mmr', direction: 'desc', limited: false, source: scope });
  put('/api/feeds/discoveries?limit=12', { ok: true, items: discovery.slice(0, 12).map(row => ({ ...row, read: false, ignored: false, source_name: '公开电影片目', scrape_error: null })), more: false, cover_network: 0 });
  put('/api/feeds', { ok: true, sources: indexes.performers.items.map((row, i) => ({ id: i + 1, kind: 'demo-film', kind_label: '普通电影订阅',
    name: row.k, page_name: '', url: entities.find(entity => entity.id === row.entity_id)!.metadata.source_url, entity_id: row.entity_id, entity_name: row.k,
    enabled: true, interval_minutes: 360, last_fetched_at: now, next_fetch_at: now, last_error: null, last_seen_count: 1, last_new_count: 1,
    seen: 0, has_image: row.has_image, image_version: row.image_version, avatar_focus: null, demo: true })), unread: indexes.performers.items.length, demo_notice: DEMO_DATA_NOTICE });
  const source = { id: 0, provider: 'demo', provider_label: '公开电影片目', ref: 'public-movies', label: '电影资料（演示）', author_name: '电影资料',
    author_key: 'demo:catalog', url: films[0]!.credit, semantics: 'work', enabled: true,
    entity_id: null as number | null, entity_name: '电影资料', avatar_url: null as string | null,
    can_backfill: true, backfill_page: 0, created_at: now, last_checked_at: now, last_status: 'ok', last_error: null, history_exhausted: true };
  const sources: Row[] = authors.map((author, index) => ({ ...source, id: index + 1, ref: `creator-${author.entity_id}`,
    label: `${author.k} · 电影资料`, author_name: author.k, author_key: author.key, entity_id: author.entity_id, entity_name: author.k,
    avatar_url: author.avatar || null, official_avatar_url: author.avatar || null,
    url: entities.find(row => row.id === author.entity_id)!.metadata.source_url }));
  if (items.some(row => !row.creator_entity)) sources.push({ ...source, official_avatar_url: null });
  const groups = items.slice(0, 36).map((row, i) => ({ release_key: films[i]!.slug, primary: { id: row.id, provider: 'demo', provider_label: '公开电影片目',
    resource_provider: 'demo', source_id: row.creator_entity ? authors.findIndex(author => author.entity_id === row.creator_entity.id) + 1 : 0,
    source_label: sources.find(author => author.entity_id === row.creator_entity?.id)?.label || source.label, author_key: row.creator_entity ? `entity:${row.creator_entity.id}` : source.author_key,
    external_id: films[i]!.slug, title: row.title, author: row.creator, credit: row.creator, audio: null, summary: DEMO_DATA_NOTICE,
    url: row.source_url, thumb_url: `/_demo/follow/${films[i]!.slug}.webp`, published_at: `${row.release_date}-01-01T00:00:00Z`, published_precision: 'year',
    version: null, duration: row.duration, variant_kind: 'main', variant_label: null, status: ['new', 'seen', 'saved'][i % 3], asset_id: row.id,
    media_needs_credential: false, media_error: null, has_media: true, media_kind: 'image', playable: false,
    media_items: [{ index: 0, name: `${films[i]!.slug}.webp`, media_kind: 'image', media_type: 'image/webp', resource_provider: 'demo', thumb_url: `/_demo/follow/${films[i]!.slug}.webp` }],
    hidden_media: [], resource_urls: [], tags: row.tags, detail_tags: row.tags, tag_types: Object.fromEntries(row.tags.map((tag: string) => [tag, 'general'])) },
    variants: [], duplicates: [], providers: ['demo'], has_wip: false, is_release: true, newest_at: now, stack: null }));
  const follow = { ok: true, sources, author_aliases: [], alias_suggestions: [], suggestions: [], groups, counts: { new: groups.filter(row => row.primary.status === 'new').length, seen: groups.filter(row => row.primary.status === 'seen').length, saved: groups.filter(row => row.primary.status === 'saved').length, ignored: 0 },
    sort: 'new', dir: 'desc', seed: 1, facets: {}, author_facets: {}, offset: 0, limit: 100, has_more: false, providers: ['demo'], demo_notice: DEMO_DATA_NOTICE };
  put('/api/follow', follow); put('/api/follow?limit=100&offset=0', follow); put('/api/follow?summary=1', { ...follow, groups: [] });
  for (const status of ['new', 'seen', 'saved', 'all']) for (const sort of ['rand', 'new']) for (const author of ['', ...authors.map(row => row.key)]) {
    const selection = groups.filter(group => (status === 'all' || group.primary.status === status) && (!author || group.primary.author_key === author));
    put(query('/api/follow', { limit: 100, offset: 0, status, ...(author ? { author } : {}), sort }), { ...follow, groups: selection, sort });
  }
  for (const group of groups) put(query('/api/follow', { item: group.primary.id }), { ...follow, groups: [group], item: group.primary });
  put('/api/follow/check', { ok: true, status: 'idle' });
  put('/api/follow/status', { ok: true, status: 'idle', sources });
  put('/api/follow/activity', { ok: true, items: [], total: 0 });
  put('/api/follow/suggest', { ok: true, items: [], suggestions: [] });
  put('/api/follow/image-dims', {}); put('/api/follow/credentials', { ok: true, items: [], providers: [] });
  const tasks = { ok: true, available: true, filtered: false, running: [], skipped: [], finished: [
    { id: 1, task: 'scan', kind: 'scan', title: '演示馆藏扫描', label: '演示馆藏扫描', status: 'succeeded', state: 'succeeded', created_at: now, started_at: now, finished_at: now, progress: 1, done: items.length, total: items.length, message: `${items.length} 部演示电影`, details: {}, result: { count: items.length } },
  ], finished_has_more: false, statuses: { active: ['pending', 'running'], finished: ['succeeded', 'failed', 'cancelled', 'interrupted'] }, demo_notice: DEMO_DATA_NOTICE };
  const downloads = { available: true, tasks: items.slice(0, 3).map((row, i) => ({ id: 3 - i, provider: ['115', 'pikpak', 'clouddrive:pikpak:demo'][i],
    provider_label: ['115 收藏 · 115', 'PikPak 收藏 · PikPak', 'PikPak · CloudDrive2'][i], display_name: row.title, code: row.code,
    state: ['remote_running', 'ingested', 'failed'][i], progress: [0.64, 1, 0][i], asset_id: i === 1 ? row.id : null, source_uri: '',
    postprocess_run_id: i === 1 ? 1 : null, cancellable: i === 0, resubmittable: i === 2, error: i === 2 ? '演示失败状态' : '', created_at: now, updated_at: now, demo: true })),
    has_more: false, next_before_id: null, demo_notice: DEMO_DATA_NOTICE };
  const wanted = items[wantedIndex]!;
  const wants = { ok: true, items: [{ id: 1, code: wanted.code, title: wanted.title, state: 'searching', status: 'searching', has_cover: true, cover_version: wanted.cover_version, added_at: now, created_at: now, studio: wanted.studio, performers: wanted.performers.join('、'), asset_id: null, demo: true }],
    counts: { searching: 1, unreleased: 0, given_up: 0, acquired: 0 }, scraping: false, demo_notice: DEMO_DATA_NOTICE };
  const recorded = { '/api/tasks': tasks, '/api/downloads': downloads, '/api/wants': wants, '/api/orphan-records': { total: 0, items: [] } };
  for (const [route, value] of Object.entries(recorded)) put(route, value);
  put('/api/downloads?limit=50', downloads);
  put('/api/library-processing', { status: 'complete', job_id: 'demo-scan', stage: '扫描文件', requested_stage: 'scan', speed_mode: 'standard',
    checked: items.length, total: items.length, metadata_only: false, started_at: null, completed_at: null, error: null,
    eta_seconds_min: 0, eta_seconds_max: 0, message: '演示馆藏扫描快照', demo: true });
  put('/api/media-processing', { metadata_only: false, available: true });
  const tags = directory('tag').items;
  const rank = (row: Row) => ({ name: row.k, score: row.n, web_visits: 0, peach_score: row.n, peach_items: row.n, entity_id: row.entity_id, representative_asset_id: row.rep, evidence: ['演示数据'], has_image: row.has_image, image_version: row.image_version, has_avatar: row.has_avatar });
  const rankings = { browser_categories: [], categories: [{ name: '开放电影', score: items.length }], tags: tags.map(rank), creators: authors.map(rank), performers: directory('performer').items.map(rank),
    browser_tags: [], browser_creators: [], browser_performers: [], peach_tags: tags.map(rank), peach_creators: authors.map(rank), peach_performers: directory('performer').items.map(rank), peach_studios: directory('studio').items.map(rank), peach_series: directory('series').items.map(rank), domains: [] };
  const played = items.filter(row => row.play_count).length, playSeconds = items.reduce((sum, row) => sum + row.play_seconds, 0);
  const taste = { summary: { history_visits: 0, history_sources: 0, peach_items: items.length, peach_seconds: playSeconds, liked: 1, disliked: 0, range_start: now, range_end: now },
    sources: [], activity: { timezone: 'UTC+08:00', days: [], hours: [] }, creator_flows: [], rankings, coverage: { tagged: items.filter(row => row.tags.length).length, identified: items.length, untagged: items.filter(row => !row.tags.length).length, unidentified: 0 }, gaps: [],
    analysis: { headline: `演示偏好：${tags.slice(0, 3).map(row => row.k).join('、')}。`, points: [{ label: '数据说明', text: DEMO_DATA_NOTICE }], confidence: { level: 'low', label: '演示数据' }, explore: [], next_steps: [] },
    privacy: { raw_history_local_only: true, ledger_unchanged: true, candidate_only: true }, window: 'all', updated_at: now, storage: { exports: 0, bytes: 0 }, browsers: [], demo_notice: DEMO_DATA_NOTICE };
  put('/api/taste', taste); for (const window of ['all', '30d', '90d', '7d']) put(query('/api/taste', { window }), { ...taste, window });
  const bytes = items.reduce((sum, row) => sum + row.size, 0);
  put('/api/stats', { by_loc: [{ k: 'local', n: items.length, videos: items.length, bytes }],
    by_medium: [{ k: 'video', n: items.length, bytes }], by_length: ['速食', '短', '中', '长'].map(k => ({ k, n: items.filter(row => row.ctx_length === k).length })).filter(row => row.n), by_quality: [],
    by_library: [{ k: 'demo-movies', name: '电影演示馆藏', icon: 'local', videos: items.length, bytes }],
    attribution: { videos: items.length, creator: items.filter(row => row.creator).length, code: items.length, studio: items.filter(row => row.studio).length, thumb: items.length, duration: items.filter(row => row.duration > 0).length }, tag_source: [], tag_cov: items.filter(row => row.tags.length).length, top_tags: tags,
    consumption: { played, library_played: played, online_played: 0, play_seconds: playSeconds, library_play_seconds: playSeconds, online_play_seconds: 0, o_total: 0, liked: 1, dislike: 0, seen: 0, trash: 0, skimmed: 0 },
    recent: items.filter(row => row.play_count).map(row => ({ ...row, last_played: 1790812800, kind: 'library' })), play_activity: { timezone: 'UTC+08:00', days: [], hours: [] }, replays: [], storage_volumes: [], storage_summary: { volumes: 0, online: 0, measured: 0, free: 0, used: 0, total: 0 }, system_disk: null, disk_c: null, demo_notice: DEMO_DATA_NOTICE });
  const playlist = { id: 1, name: '电影精选（演示）', source_kind: 'manual', source_seed_asset_id: null, current_asset_id: 1, created_at: now, updated_at: now, item_count: items.length, preview_asset_id: 1, preview_ids: items.map(row => row.id), faces: [] };
  put('/api/playlists', { items: [playlist] }); put('/api/playlist?id=1', { ...playlist, items, total: items.length });
  put('/api/tops?n=60', { performers: directory('performer').items.map(row => ({ ...row, id: row.entity_id })), studios: directory('studio').items.map(row => ({ ...row, id: row.entity_id })) });
  put('/api/links', { ok: true, total: entities.length, entities: entities.length, by_kind: { official: entities.length }, by_entity_kind: {}, top_hosts: [...new Set(films.map(film => new URL(film.credit).hostname))].map(host => [host, films.filter(film => new URL(film.credit).hostname === host).length]), top_host_link_ids: {} });
  for (const endpoint of ['/api/review', '/api/review?counts=1']) put(endpoint, { ok: true, items: [], total: 0, sections: {}, counts: {}, has_more: false });
  for (const endpoint of ['/api/ads', '/api/ads?limit=1', '/api/ads?limit=200&status=pending', '/api/duplicates', '/api/duplicates?limit=120', '/api/quality-goals', '/api/quality-goals?limit=200']) put(endpoint, { ok: true, items: [], total: 0, has_more: false });
  return { catalog: { items, tag_categories: Object.fromEntries(tags.map(row => [row.k, 'general'])), entity_filters: filters }, indexes, suggestion, recorded, routes, imageRoutes };
}
