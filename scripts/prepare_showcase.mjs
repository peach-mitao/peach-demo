import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {fixtureKey,fixtureHash} from '../src/key.ts';
import {configuration,downloads,downloadCheck,cloudProxies,providers} from '../src/showcase.mjs';
import {tagInventory} from '../src/tag-management.mjs';

export async function prepareShowcase(site=fileURLToPath(new URL('../site/',import.meta.url))) {
  const directory=path.join(site,'_fixtures');
  const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
  const catalog=JSON.parse(await readFile(path.join(directory,'catalog.json'),'utf8'));
  const indexes=JSON.parse(await readFile(path.join(directory,'indexes.json'),'utf8'));
  const info=JSON.parse(await readFile(path.join(site,'_demo/frontend-source.json'),'utf8'));
  const entry=JSON.parse(await readFile(path.join(directory,'entry-pages.json'),'utf8'));
  const release=JSON.parse(await readFile(path.join(site,'integrations/jav-userscript-release.json'),'utf8'));
  const sites=JSON.parse(await readFile(path.join(site,'integrations/jav-sites.json'),'utf8')).sites;
  const recorded=JSON.parse(await readFile(path.join(directory,'recorded-state.json'),'utf8'));
  if(entry.commit!==info.commit)throw Error('入口页与应用前端来源不一致，请从同一应用检出运行 record_entry_pages.py');
  const hash=async route=>fixtureHash(fixtureKey('GET',new URL(route,'https://demo.example')));
  const read=async route=>{
    const own=await hash(route),key=manifest.alias?.[own]??own;
    return JSON.parse(await readFile(path.join(directory,`${key}.json`),'utf8'));
  };
  const write=async(route,data)=>{
    const key=await hash(route);
    if(manifest.alias)delete manifest.alias[key];
    manifest.fixtures[key]='json';
    await writeFile(path.join(directory,`${key}.json`),JSON.stringify(data));
  };
  const writeMissing=async(route,data)=>{
    const own=await hash(route),key=manifest.alias?.[own]??own;
    if(!manifest.fixtures[key])await write(route,data);
  };
  const config=configuration(await read('/api/configuration'),info.version);
  await write('/api/configuration',config);
  const health=await read('/healthz');
  await write('/healthz',{...health,version:info.version,build_commit:info.commit});
  await write('/api/tag-management',tagInventory(indexes));
  await write('/api/tag-management?scope=online',tagInventory(indexes,'online'));
  for(const item of catalog.items)await write('/api/subtitles/memory?video='+encodeURIComponent(`item:${item.id}`),{selected:null,tracks:[]});
  for(const row of indexes.tags.items){
    const photos={kind:'tag',name:row.k,entity_id:row.entity_id,sets:[],total:0,items:[],seed:0,sample_total:0,has_more:false};
    await writeMissing('/api/photos?'+new URLSearchParams({kind:'tag',name:row.k}),photos);
    await writeMissing('/api/photos?'+new URLSearchParams({kind:'tag',id:String(row.entity_id)}),photos);
    await writeMissing('/api/feeds/discoveries?'+new URLSearchParams({limit:'12',entity:String(row.entity_id)}),{ok:true,items:[],more:false});
  }
  await write('/api/configuration/downloads',downloads());
  await write('/api/configuration/downloads/check',downloadCheck());
  await write('/api/configuration/downloads/pikpak/browser-login',downloads());
  await write('/api/configuration/cloud-proxies',cloudProxies());
  await write('/api/configuration/jav-browser',{enabled:true,provider:'115',active_provider:'115',available:true,problems:[],providers,
    sites,userscript:{version:release.version,minimum_version:release.bridge_min_version,install_url:release.install_url}});
  await write('/api/configuration/indexers',{indexers:[{key:'demo-torznab',name:'演示索引器',url:'https://indexer.example.com/api',enabled:true,api_key_set:true}],max_indexers:4});
  const runIds=new Set([...(recorded['/api/tasks'].running||[]),...(recorded['/api/tasks'].finished||[])].map(row=>row.id));
  const snapshot={...recorded['/api/downloads'],providers,tasks:recorded['/api/downloads'].tasks.map(task=>({...task,
    asset_id:catalog.items.some(item=>item.id===task.asset_id&&item.code===task.code)?task.asset_id:null,
    postprocess_run_id:runIds.has(task.postprocess_run_id)?task.postprocess_run_id:null,
  }))};
  await write('/api/downloads',snapshot);
  await write('/api/downloads?limit=50',snapshot);
  for(const route of ['/api/wants','/api/orphan-records','/api/tasks'])await write(route,recorded[route]);
  for(const [key,value] of Object.entries(config))if(['automatic_updates','remote_reporting','library_sharing'].includes(key))await write('/api/configuration/'+key.replaceAll('_','-'),value);
  await write('/api/configuration/library-sharing/preview',{data:{library:catalog.items.filter(item=>item.code).slice(0,3).map(item=>({code:item.code,rating:item.rating,tags:item.tags})),
    preferences:{tags:['剧情','旅行']},coverage:{uncoded_items:catalog.items.filter(item=>!item.code).length}},bytes:1024,token:'demo-preview',schema:1});
  await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest));
  console.log(`演示配置：${info.version} / ${info.commit.slice(0,9)}；下载渠道 ${providers.length} 个。`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await prepareShowcase();
