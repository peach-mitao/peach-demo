// Peach 演示站：页面使用 Peach 前端，接口与媒体按本地录制包回放。
// 馆藏列表和筛选读录制目录，按请求参数计算；其余接口依次查完整键、同路径录制响应和兜底。
// 写操作不落地：页面内交互适配提供临时状态，Worker 提供录制响应，刷新恢复录制状态。
import {fixtureHash, fixtureKey} from './key.ts';
import {directoryPage} from './directory.ts';
import {discoveryPage,feedDiscoveryPage} from './discovery.ts';
import {followPage} from './follow.ts';
import {stream} from './stream.ts';
import {folderIndex,folderItems,folderPage} from './folders.mjs';

const TYPES = {
  json: 'application/json; charset=utf-8', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif',
  gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon', vtt: 'text/vtt; charset=utf-8',
  txt: 'text/plain; charset=utf-8', m3u8: 'application/vnd.apple.mpegurl', bin: 'application/octet-stream',
};
// Peach 的媒体与探活端点（src/peach/routes_media.py）：没有夹具时回 404，不能落进单页兜底回成 HTML。
const MEDIA_PATHS = new Set(['/thumb', '/poster', '/cover', '/timeline', '/avatar', '/entity-image', '/logo',
  '/link-mark', '/site-mark', '/source-icon', '/work-icon', '/follow-avatar', '/follow-stream', '/follow-cover',
  '/follow-qualities', '/photo', '/photo-thumb', '/sample-thumb', '/sample-image', '/endcard-frame',
  '/avatar-choice', '/healthz']);
let manifest = null;
let directory = null;
let follow = null;
let feedDiscoveries = null;
const discoveries = new Map();
// 演示馆藏首页默认开大图（竖版封面），保留访客已选择的布局。
const DEMO_SETTINGS = `<script>try{const k='peach.settings.v1',s=JSON.parse(localStorage.getItem(k)||'{}');
if(!('homeLayout' in s))s.homeLayout='big';localStorage.setItem(k,JSON.stringify(s))}catch(_e){}</script>`;
// 演示数据里的关注更新全是图片帖，而关注页默认是视频模式（只认地址栏的 media 参数），直接进去是空的。
// 从别处进关注页、或直接打开 /follow 时补上 media=images；已经在关注页里切回视频的不拦。
const FOLLOW_IMAGES = `<script>(()=>{const fix=u=>{try{const url=new URL(u,location.href);
if(url.pathname==='/follow'&&!url.searchParams.has('media')&&location.pathname!=='/follow'){
url.searchParams.set('media','images');return url.pathname+url.search+url.hash}}catch(_e){}return u};
for(const name of ['pushState','replaceState']){const original=history[name].bind(history);
history[name]=(state,title,u)=>original(state,title,u==null?u:fix(u))}
if(location.pathname==='/follow'&&!new URLSearchParams(location.search).has('media')){
const url=new URL(location.href);url.searchParams.set('media','images');history.replaceState(null,'',url.pathname+url.search)}
})()</script>`;
// 底部居中的说明跟随主题，在窄屏和安全区内换行。
const NOTICE = `<style>
#postSetupTutorial{bottom:calc(var(--demo-notice-height,34px) + 24px);max-height:calc(100dvh - var(--demo-notice-height,34px) - 48px)}
#toasts [data-sonner-toaster][data-y-position=bottom]{bottom:max(var(--offset-bottom,24px),calc(var(--demo-notice-height,34px) + 24px))}
#searchMenu{max-height:min(60vh,520px,var(--demo-search-space,100vh))!important}
#searchMenu [data-search-group]:not(:has([data-search-value])){display:none}
[data-demo-copy="compact"]{display:none}
@media(max-width:560px){
 [data-demo-copy="full"]{display:none}
 [data-demo-copy="compact"]{display:inline}
 [data-demo-notice]{white-space:nowrap}
 #searchMenu{max-height:min(70vh,var(--demo-search-space,100vh))!important}
}
</style><div role="note" data-demo-notice style="position:fixed;left:50%;transform:translateX(-50%);bottom:max(12px,env(safe-area-inset-bottom));z-index:2147483000;pointer-events:none;
padding:6px 10px;border-radius:12px;width:max-content;box-sizing:border-box;text-align:center;max-width:calc(100vw - 24px);font:12px/1.4 system-ui,sans-serif;
background:var(--color-background-primary-default,#fff);color:var(--color-text-secondary,#555);
border:1px solid var(--color-separator-border,#0002);box-shadow:0 2px 8px #0001">
<span data-demo-copy="full">Peach 演示站：数据是录制回放，操作不会保存 · </span><span data-demo-copy="compact">演示站 · 操作不保存 · </span><a href="https://peach.video/copyright/" target="_blank" rel="noopener" style="display:inline;line-height:inherit;pointer-events:auto;color:inherit;text-decoration:underline"><span data-demo-copy="full">版权投诉 / DMCA</span><span data-demo-copy="compact">版权投诉</span></a></div>`;
// 自动演示（site/_demo/tour.js）：只在地址带 tour 时同步插进 <head>，要赶在 app.js 读外观设置之前。
const TOUR = '<script src="/_demo/tour.js"></script>';
const INTERACTIONS = '<script src="/_demo/media-runtime.js"></script><script src="/_demo/interactions.js"></script>';

const json = (body, status = 200) => new Response(body, {status, headers: {'content-type': TYPES.json}});

async function fixture(env, url, ext) {
  const response = await env.ASSETS.fetch(new URL(`/_fixtures/${ext.hash}.${ext.ext}`, url));
  if (!response.ok) return null;
  const headers = new Headers(response.headers);
  headers.set('content-type', TYPES[ext.ext] ?? TYPES.bin);
  // 夹具文件名来自请求键、不随内容变：重录后同一个地址（如 /entity-image?id=92）可能换成另一个人的图，
  // 缓存一天会让老访客看到上一版的图。图片每次都回来问一声，ETag 由静态资源层按内容给，没变就回 304。
  headers.set('cache-control', ext.ext === 'json' ? 'no-store' : 'public, max-age=0, must-revalidate');
  return new Response(response.body, {status: 200, headers});
}

async function lookup(env, url, method) {
  const keys = [fixtureKey(method, url)];
  if (MEDIA_PATHS.has(url.pathname) && url.searchParams.has('v')) {
    const image = new URL(url);
    image.searchParams.delete('v');
    keys.push(fixtureKey(method, image));
  }
  if (url.search) keys.push(`${method} ${url.pathname}`);
  for (const key of keys) {
    // alias：同一份字节换了个地址（换头像候选图就是封面与九宫格格子），指向已有的那个文件。
    const own = await fixtureHash(key);
    const hash = manifest.alias?.[own] ?? own;
    const ext = manifest.fixtures[hash];
    if (ext) {
      const response = await fixture(env, url, {hash, ext});
      if (response) return response;
    }
  }
  return null;
}

// 未单独录制的搜索与筛选从同一份演示馆藏计算，列表和筛选字段保持完整。
let catalog = null;
let folders = null;
async function loadCatalog(env,url) {
  catalog ??= await env.ASSETS.fetch(new URL('/_fixtures/catalog.json',url)).then(r=>r.json());
  folders ??= folderIndex(catalog.items);
  return catalog;
}
async function catalogItems(env,url) {
  await loadCatalog(env,url);
  const p=url.searchParams,fold=text=>String(text??'').toLowerCase().replaceAll('-','');
  const words=fold(p.get('q')).split(/\s+/).filter(Boolean);
  const tags=(p.get('tag')||'').split(',').filter(Boolean);
  return folderItems(folders,catalog.items,p).filter(it=>{
    if(p.get('loc')&&!p.get('loc').split(',').includes(it.location))return false;
    if(p.get('jav')==='1'&&!it.is_jav)return false;
    for(const kind of ['creator','studio','performer','agency','series']){
      const name=p.get(kind);if(!name)continue;
      const members=catalog.entity_filters?.[kind]?.[name];
      if(members?!members.includes(it.id):kind==='performer'?!(it.performers||[]).includes(name):it[kind]!==name)return false;
    }
    if(p.get('owner')==='none'&&(it.creator||(it.performers||[]).length))return false;
    if(p.get('len')&&it.ctx_length!==p.get('len'))return false;
    if(p.get('orient')&&it.ctx_orient!==p.get('orient'))return false;
    if(!p.get('orient')&&p.get('exclude_vertical')==='1'&&it.ctx_orient==='竖屏')return false;
    if(p.get('region')&&(it.effective_region||'none')!==p.get('region'))return false;
    const filterTags=it.filter_tags||it.tags;
    if(tags.length&&!(p.get('tag_match')==='any'?tags.some(t=>filterTags.includes(t)):tags.every(t=>filterTags.includes(t))))return false;
    const state=p.get('state');
    if(state==='unseen'&&it.play_count)return false;
    if(state==='later'&&!it.watch_later)return false;
    if(state==='flagged'&&!it.feedback&&!it.rating&&!it.o_count)return false;
    if(state==='trash')return false;
    if(p.get('dur_min')&&it.duration<Number(p.get('dur_min')))return false;
    if(p.get('dur_max')&&it.duration>Number(p.get('dur_max')))return false;
    return words.every(word=>[it.name,it.catalog_title,it.code,it.studio,it.creator,...(it.performers||[]),...it.tags].some(field=>fold(field).includes(word)));
  });
}
async function fallbackCatalog(env,url,facets=false) {
  const items=await catalogItems(env,url),sum=key=>items.reduce((n,it)=>n+(Number(it[key])||0),0);
  if(facets){
    const counts=pick=>{const counts=new Map();for(const it of items)for(const k of pick(it))if(k)counts.set(k,(counts.get(k)||0)+1);return [...counts].map(([k,n])=>({k,n})).sort((a,b)=>b.n-a.n)};
    return json(JSON.stringify({locations:counts(it=>[it.location]),orientations:counts(it=>[it.ctx_orient]),regions:counts(it=>[it.effective_region||'none']),
      creators:counts(it=>[it.creator]),tags:counts(it=>it.filter_tags||it.tags).filter(row=>catalog.tag_categories?.[row.k]!=='meta').map(row=>({...row,cat:catalog.tag_categories?.[row.k]||'general'})),
      tech:counts(it=>it.filter_tags||it.tags).filter(row=>catalog.tag_categories?.[row.k]==='meta'),tagperformers:counts(it=>it.performers||[]),follow_tags:[],
      stats:{total:items.length,bytes:sum('size'),duration:sum('duration'),played:items.filter(it=>it.play_count).length,flagged:items.filter(it=>it.feedback||it.rating||it.o_count).length,attributed:items.filter(it=>it.creator||it.code).length}}));
  }
  const order=url.searchParams.get('dir')==='asc'?1:-1;
  const sort={rating:'rating',o:'o_count',plays:'play_count',dur:'duration',size:'size',release:'release_date',new:'first_seen',played:'last_played'}[url.searchParams.get('sort')];
  const rank=id=>{let n=(Number(url.searchParams.get('seed'))||0)^id;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return(n^(n>>>16))>>>0};
  if(sort){
    const missing=value=>value==null||value==='';
    items.sort((a,b)=>missing(a[sort])?(missing(b[sort])?order*(a.id-b.id):1):missing(b[sort])?-1:
      order*((typeof a[sort]==='number'&&typeof b[sort]==='number'?a[sort]-b[sort]:String(a[sort]).localeCompare(String(b[sort])))||a.id-b.id));
  }
  else items.sort((a,b)=>rank(a.id)-rank(b.id));
  const offset=Math.max(0,Number(url.searchParams.get('offset'))||0),limit=Math.min(1000,Math.max(1,Number(url.searchParams.get('limit'))||60));
  return json(JSON.stringify({total:items.length,bytes:sum('size'),items:items.slice(offset,offset+limit),has_more:offset+limit<items.length}));
}
// 联想从录制目录过滤与排序，遵循 Peach 的 q_suggest（src/peach/web_entity.py）。
// 不到 3 个字符的拉丁输入比词首（整串开头或空格之后），其余比子串；同类里规范名前缀命中的在前，再按作品数、名字。
const SUGGEST_GROUPS = [['performer', '女优'], ['creator', '创作者'], ['studio', '厂牌'], ['agency', '事务所'],
  ['series', '系列'], ['tag', '标签'], ['asset', '视频']];
let suggestions = null;
async function suggest(env, url) {
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 64);
  if (!query) return json(JSON.stringify({q: '', groups: []}));
  suggestions ??= await env.ASSETS.fetch(new URL('/_fixtures/suggest.json', url))
    .then((r) => (r.ok ? r.json() : {entities: [], assets: []}));
  const asked = new Set((url.searchParams.get('kind') ?? '').split(',').map((part) => part.trim()));
  const wanted = new Set(SUGGEST_GROUPS.map(([kind]) => kind).filter((kind) => asked.has(kind)));
  if (!wanted.size) SUGGEST_GROUPS.forEach(([kind]) => wanted.add(kind));
  const perGroup = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 5, 20));
  // 照 SQLite 的 LIKE 比：不分大小写，输入里的 _ 与 % 也是通配符（Peach 没有转义它们）。
  const like = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('_', '.').replaceAll('%', '.*');
  const wordHead = query.length < 3 && /^[\x00-\x7f]*$/.test(query);
  const pattern = new RegExp(wordHead ? `^${like}|^.* ${like}` : `^.*${like}`, 'is');
  const head = new RegExp(`^${like}`, 'is');
  const hit = (text) => pattern.test(String(text ?? ''));
  const prefix = (text) => head.test(String(text ?? ''));
  const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const buckets = new Map(), totals = new Map();
  const entities = suggestions.entities.filter((e) => wanted.has(e.kind) && (hit(e.name) || e.terms.some(hit)))
    .sort((a, b) => (prefix(b.name) - prefix(a.name)) || (b.item.n - a.item.n) || byName(a.name, b.name));
  for (const entity of entities) {
    totals.set(entity.kind, (totals.get(entity.kind) ?? 0) + 1);
    const bucket = buckets.get(entity.kind) ?? [];
    buckets.set(entity.kind, bucket);
    if (bucket.length < perGroup) bucket.push({...entity.item, matched: hit(entity.name) ? '' : entity.terms.find(hit)});
  }
  if (wanted.has('asset')) {
    const rank = (a) => (prefix(a.code) ? 0 : [a.code, a.title, a.original].some(hit) ? 1 : 2);
    const assets = suggestions.assets.filter((a) => [a.code, a.title, a.original, a.name].some(hit))
      .sort((a, b) => (rank(a) - rank(b)) || (b.plays - a.plays) || (b.id - a.id));
    if (assets.length) {
      buckets.set('asset', assets.slice(0, perGroup).map((a) => a.item));
      totals.set('asset', assets.length);
    }
  }
  return json(JSON.stringify({q: query, groups: SUGGEST_GROUPS.filter(([kind]) => buckets.get(kind)?.length)
    .map(([kind, label]) => ({kind, label, total: totals.get(kind) ?? 0, items: buckets.get(kind)}))}));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/stream') return stream(request, env, url);
    if (url.pathname.startsWith('/_fixtures/') || url.pathname.startsWith('/_media/')) return json('{"error":"not found"}', 404);
    manifest ??= await env.ASSETS.fetch(new URL('/_fixtures/manifest.json', url)).then((r) => r.json());
    const method = request.method === 'HEAD' ? 'GET' : request.method;
    if(method==='GET'&&url.pathname==='/api/folders'){
      await loadCatalog(env,url);
      const page=folderPage(folders,url.searchParams);
      return page?json(JSON.stringify(page)):json('{"message":"目录不存在或已移出演示库"}',404);
    }
    if(method==='GET'&&url.pathname==='/api/jav/discoveries'){
      const scope=url.searchParams.get('scope')==='library'?'library':'external';
      if(!discoveries.has(scope)){
        const canonical=new URL('/api/jav/discoveries',url);
        canonical.search=new URLSearchParams({scope,limit:'100',sort:'taste',direction:'desc'}).toString();
        const snapshot=await lookup(env,canonical,method);
        if(snapshot)discoveries.set(scope,await snapshot.json());
      }
      if(discoveries.has(scope))return json(JSON.stringify(discoveryPage(discoveries.get(scope),url.searchParams)));
    }
    if(method==='GET'&&['/api/index','/api/follow/authors','/api/follow/tags'].includes(url.pathname)){
      directory ??= await env.ASSETS.fetch(new URL('/_fixtures/indexes.json',url)).then(r=>r.ok?r.json():{});
      const kind=url.pathname==='/api/index'?url.searchParams.get('kind'):url.pathname.endsWith('/authors')?'onlineAuthors':'onlineTags';
      const page=directoryPage(directory,kind,url.searchParams);
      if(page)return json(JSON.stringify(page));
    }
    if(method==='GET'&&url.pathname==='/api/items'&&url.searchParams.get('state')!=='trash')return fallbackCatalog(env,url);
    if(method==='GET'&&url.pathname==='/api/facets'&&url.searchParams.get('state')!=='trash')return fallbackCatalog(env,url,true);
    const recorded = await lookup(env, url, method);
    if (recorded) {
      if (url.pathname === '/api/links') {
        const data = await recorded.json();
        // 旧录制只有主机统计；新版按链接 ID 取站标，缺失时保留通用站标。
        return json(JSON.stringify({...data, top_host_link_ids: data.top_host_link_ids ?? {}}));
      }
      const etag = recorded.headers.get('etag');
      if (etag && request.headers.get('if-none-match') === etag) {
        return new Response(null, {status: 304, headers: {etag, 'cache-control': recorded.headers.get('cache-control')}});
      }
      return recorded;
    }
    if(method==='GET'&&url.pathname==='/api/tops'){
      const snapshot=await lookup(env,new URL('/api/tops?n=60',url),method);
      if(snapshot){
        const data=await snapshot.json(),items=await catalogItems(env,url);
        const limit=Math.max(1,Math.min(60,Number(url.searchParams.get('n'))||28));
        const offset=Math.max(0,Number(url.searchParams.get('page'))||0)*limit;
        const pick=(rows,kind)=>rows.map(row=>({...row,n:items.filter(item=>kind==='performer'?(item.performers||[]).includes(row.k):item.studio===row.k).length}))
          .filter(row=>row.n).sort((a,b)=>b.n-a.n).slice(offset,offset+limit);
        return json(JSON.stringify({performers:pick(data.performers,'performer'),studios:pick(data.studios,'studio')}));
      }
    }
    if(method==='GET'&&url.pathname==='/api/follow'){
      if(!follow){
        const snapshot=await lookup(env,new URL('/api/follow?limit=100&offset=0',url),method);
        if(snapshot)follow=await snapshot.json();
      }
      const page=follow&&followPage(follow,url.searchParams);
      if(page)return json(JSON.stringify(page));
    }
    if(method==='GET'&&url.pathname==='/api/feeds/discoveries'){
      if(!feedDiscoveries){
        const snapshot=await lookup(env,new URL('/api/feeds/discoveries?limit=12',url),method);
        if(snapshot)feedDiscoveries=await snapshot.json();
      }
      const page=feedDiscoveries&&feedDiscoveryPage(feedDiscoveries,url.searchParams);
      if(page)return json(JSON.stringify(page));
    }
    if (method !== 'GET') return json('{"ok":true}');
    if (url.pathname === '/api/items') return fallbackCatalog(env,url);
    if (url.pathname === '/api/suggest') return suggest(env, url);
    if (url.pathname === '/api/facets') return fallbackCatalog(env,url,true);
    if (url.pathname.startsWith('/api/')) return new Response('{"error":"unavailable","message":"演示回放未取得"}',{status:404,headers:{'content-type':TYPES.json,'x-peach-demo-missing':'1'}});
    if (MEDIA_PATHS.has(url.pathname) || manifest.paths.includes(url.pathname)) return json('{"error":"unavailable"}', 404);
    const assetRequest = new Request(request);
    if (request.headers.get('sec-fetch-dest') === 'document' || (request.headers.get('accept') ?? '').includes('text/html')) {
      assetRequest.headers.delete('if-none-match');
      assetRequest.headers.delete('if-modified-since');
    }
    const response = await env.ASSETS.fetch(assetRequest);
    if (!(response.headers.get('content-type') ?? '').startsWith('text/html')) return response;
    // 页面包含演示脚本，不能复用静态 index.html 的校验器。
    const pageHeaders = new Headers(response.headers);
    pageHeaders.set('cache-control', 'no-store');
    pageHeaders.delete('etag');
    pageHeaders.delete('last-modified');
    const page = new Response(response.body, {status: response.status, headers: pageHeaders});
    return new HTMLRewriter()
      .on('head', {element: (head) => head.prepend(DEMO_SETTINGS + FOLLOW_IMAGES + INTERACTIONS
        + (url.searchParams.has('tour') ? TOUR : ''), {html: true})})
      .on('script[src="/dist/peach-app.js"]', {element: script=>script.setAttribute('src','/dist/demo-peach-app.js')})
      .on('body', {element: (body) => {
        body.append(NOTICE, {html: true});
        if(url.searchParams.has('edit')){body.setAttribute('data-peach-copy-mode','local');body.append('<script src="/_demo/copy-editor.js" defer></script>',{html:true})}
      }})
      .transform(page);
  },
};
