import {readFile} from 'node:fs/promises';
import {fixtureHash,fixtureKey} from '../src/key.ts';

// 页面类型、配置分区和互斥视图各自登记；详情对象来自已导入的演示包。
export const pageRoutes = [
  '/login', '/setup',
  '/', '/?browse=folders', '/?jav=1', '/unseen', '/watch-later', '/flagged',
  '/jav?tab=discover', '/jav?tab=discover&scope=library', '/jav?tab=wants',
  '/performers', '/performers?category=animation', '/creators', '/studios', '/agencies', '/tags', '/tags?scope=online',
  '/follow?media=images', '/follow?media=images&view=table', '/playlists', '/wall', '/immerse',
  '/stats', '/taste', '/review', '/data-cleanup', '/duplicates', '/quality-goals', '/sources',
  '/tasks', '/subscriptions?tab=list', '/subscriptions?tab=add', '/subscriptions?tab=feeds', '/junk-files', '/trash',
  ...['appearance','playback','jav','search','content','library','subscriptions','downloads','network','maintenance','diagnostics'].map(key=>'/settings/'+key),
];
export async function demoPages(site=new URL('../site/',import.meta.url)) {
  const load=async name=>JSON.parse(await readFile(new URL(name,site),'utf8'));
  const catalog=await load('_fixtures/catalog.json'),indexes=await load('_fixtures/indexes.json');
  const manifest=await load('_fixtures/manifest.json');
  const recorded=async route=>{
    const own=await fixtureHash(fixtureKey('GET',new URL(route,'https://demo.example')));
    const key=manifest.alias?.[own]??own;
    return manifest.fixtures[key]==='json'?load(`_fixtures/${key}.json`):null;
  };
  const routes=[...pageRoutes];
  for(const key of ['performers','creators','studios','agencies','tags']){
    const row=indexes[key]?.items?.[0];
    if(row)routes.push(`/${key}/${row.entity_id}`);
  }
  const creator=indexes.onlineAuthors?.items?.[0];
  if(creator)routes.push(`/creators/${creator.entity_id}`);
  const item=catalog.items.find(row=>row.code);
  if(item)routes.push(`/assets/${item.id}`,`/works/${item.code}`);
  const series=Object.keys(catalog.entity_filters?.series||{})[0];
  if(series){
    const detail=await recorded('/api/entity?'+new URLSearchParams({kind:'series',name:series}));
    if(!detail?.id)throw Error('系列详情身份未取得');
    routes.push('/series/'+detail.id);
  }
  const playlists=await recorded('/api/playlists');
  const playlist=playlists?.items?.[0];
  if(playlist){
    const detail=await recorded('/api/playlist?id='+playlist.id);
    if(detail?.items?.[0])routes.push(`/assets/${detail.items[0].id}?playlist=${playlist.id}`);
  }
  const follow=await recorded('/api/follow?limit=100&offset=0');
  if(follow?.groups?.[0])routes.push('/posts/'+follow.groups[0].primary.id);
  return [...new Set(routes)];
}
export async function demoScenarios(){
  return [...(await demoPages()).map(route=>({route,mode:'browse'})),
    {route:'/tags',mode:'tag-management'},{route:'/tags?scope=online',mode:'tag-management'}];
}
