import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {fixtureKey,fixtureHash} from '../src/key.ts';
import {configuration,downloads,downloadCheck,cloudProxies,providers,downloadTasks} from '../src/showcase.mjs';

export async function prepareShowcase(site=fileURLToPath(new URL('../site/',import.meta.url))) {
  const directory=path.join(site,'_fixtures');
  const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
  const catalog=JSON.parse(await readFile(path.join(directory,'catalog.json'),'utf8'));
  const indexes=JSON.parse(await readFile(path.join(directory,'indexes.json'),'utf8'));
  const info=JSON.parse(await readFile(path.join(site,'_demo/frontend-source.json'),'utf8'));
  const entry=JSON.parse(await readFile(path.join(directory,'entry-pages.json'),'utf8'));
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
    userscript:{version:'0.1.0',minimum_version:'0.1.0',install_url:'https://github.com/peach-mitao/peach-userscript'}});
  await write('/api/configuration/indexers',{indexers:[{key:'demo-torznab',name:'演示索引器',url:'https://indexer.example.com/api',enabled:true,api_key_set:true}],max_indexers:4});
  const snapshot={available:true,providers,tasks:downloadTasks(catalog.items),has_more:false,next_before_id:null};
  await write('/api/downloads',snapshot);
  await write('/api/downloads?limit=50',snapshot);
  const sample=catalog.items.filter(item=>item.code).slice(0,4),phases=['searching','unreleased','given_up','acquired'];
  await write('/api/wants',{ok:true,scraping:false,counts:Object.fromEntries(phases.map(phase=>[phase,1])),
    items:sample.map((item,index)=>({id:700+index,code:item.code,origin:'code',title:item.catalog_title||item.name,
      link:null,release_date:item.release_date,studio:item.studio,performers:item.performers.join('、'),phase:phases[index],
      fresh:false,search_count:index,last_search_at:null,last_search_outcome:null,given_up_at:null,
      acquired_asset_id:index===3?item.id:null,acquired_at:index===3?'2026-10-20T08:00:00Z':null,
      follow_item_id:null,follow_provider:null,cover:item.has_cover?`/cover?code=${encodeURIComponent(item.cover_key||item.code)}`:null,remote_cover:false,
      scraped:true,scrape_error:null,created_at:'2026-10-20T08:00:00Z'}))});
  const first=sample[0];
  await write('/api/orphan-records',{total:1,items:[{id:900001,name:'演示旧文件.mp4',code:first.code,location:'local',duration:first.duration,size:first.size,
    vanished_at:1792396800,has_thumb:false,records:{rating:4,play_count:2,watch_queue:1},
    candidates:[{id:first.id,name:first.name,location:first.location,duration:first.duration,size:first.size}]}]});
  const tasks=await read('/api/tasks');
  const run={host:'演示设备',trigger:'manual',started_at:'2026-10-20T08:00:00Z',finished_at:'2026-10-20T08:02:00Z',
    elapsed_seconds:120,progress_current:catalog.items.length,progress_total:catalog.items.length,progress_label:'处理完成',
    result_summary:{checked:catalog.items.length},error:'',parent_run_id:null,root_run_id:null,followup_key:'',followup_depth:0};
  await write('/api/tasks',{...tasks,finished:[{...run,id:101,task_key:'library-processing',task_label:'媒体处理',status:'succeeded'},
    {...run,id:100,task_key:'scan',task_label:'扫描媒体库',status:'succeeded'}],finished_has_more:false});
  for(const [key,value] of Object.entries(config))if(['automatic_updates','remote_reporting','library_sharing'].includes(key))await write('/api/configuration/'+key.replaceAll('_','-'),value);
  await write('/api/configuration/library-sharing/preview',{data:{library:catalog.items.filter(item=>item.code).slice(0,3).map(item=>({code:item.code,rating:item.rating,tags:item.tags})),
    preferences:{tags:['剧情','旅行']},coverage:{uncoded_items:catalog.items.filter(item=>!item.code).length}},bytes:1024,token:'demo-preview',schema:1});
  await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest));
  console.log(`演示配置：${info.version} / ${info.commit.slice(0,9)}；下载渠道 ${providers.length} 个。`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await prepareShowcase();
