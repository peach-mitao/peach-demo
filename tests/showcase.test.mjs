import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration,cloudProxies,providers} from '../src/showcase.mjs';
import {downloadTasks} from './showcase-fixtures.mjs';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fixtureHash,fixtureKey} from '../src/key.ts';
import {prepareShowcase} from '../scripts/prepare_showcase.mjs';

test('演示配置展示下载、代理和诊断能力并保留录制对象',()=>{
  const seed={updates:{},facts:[{term:'版本',value:'0.1.0'}],tunnel:{},push_discovery:{prefixes:[]}};
  const data=configuration(seed,'1.2.3');
  assert.equal(data.editable,true);assert.equal(data.downloads.pikpak.logged_in,true);
  assert.deepEqual(data.downloads.providers.map(row=>row.key),providers.map(row=>row.key));
  assert.equal(data.updates.current_version,'1.2.3');assert.equal(data.facts[0].value,'1.2.3');
  assert.equal(data.remote_reporting.usage,false);assert.equal(data.library_sharing.enabled,false);
  assert.ok(data.push_discovery.prefixes.every(row=>data.media_dirs.includes(row.root)));
  assert.equal(seed.downloads,undefined);assert.deepEqual(seed.push_discovery.prefixes,[]);
});
test('云盘代理对应已声明媒体库且不包含凭据',()=>{
  for(const account of cloudProxies().accounts){
    assert.ok(account.libraries.length);assert.equal(account.writable,true);
    assert.equal(Object.hasOwn(account.api,'password'),false);assert.equal(account.data.mode,'direct');
  }
});
test('示例云下载使用馆藏身份和可执行的终态',()=>{
  const tasks=downloadTasks([{id:1,name:'示例一'},{id:2,name:'示例二'},{id:3,name:'示例三'}]);
  assert.deepEqual(tasks.map(task=>task.state),['remote_running','ingested','failed']);
  assert.equal(tasks[1].asset_id,2);assert.equal(tasks[0].cancellable,true);assert.equal(tasks[2].resubmittable,true);
});

test('素材构建保留录制业务状态，重复构建也不拼装事件',async()=>{
  const site=await mkdtemp(path.join(tmpdir(),'peach-recorded-state-'));
  try{
    const directory=path.join(site,'_fixtures');await mkdir(directory);await mkdir(path.join(site,'_demo'));await mkdir(path.join(site,'integrations'));
    await writeFile(path.join(site,'integrations/jav-userscript-release.json'),JSON.stringify({version:'0.4.0',bridge_min_version:'0.4.0',install_url:'/integrations/peach-jav.user.js'}));
    await writeFile(path.join(site,'integrations/jav-sites.json'),JSON.stringify({sites:[]}));
    const key=route=>fixtureHash(fixtureKey('GET',new URL(route,'https://demo.example')));
    const recorded={
      '/api/tasks':{available:[],running:[],finished:[{id:91,status:'failed'}]},
      '/api/wants':{ok:true,items:[],counts:{},scraping:false},
      '/api/orphan-records':{total:0,items:[]},
      '/api/downloads':{available:true,tasks:[{id:82,code:'FIXTURE-1',state:'ingested',asset_id:987,postprocess_run_id:91}],has_more:false,next_before_id:null},
    };
    const manifest={fixtures:{},paths:[],alias:{}};
    for(const [route,data] of Object.entries({'/api/configuration':{facts:[],updates:{},tunnel:{},push_discovery:{}},'/healthz':{ok:true}})){
      const hash=await key(route);manifest.fixtures[hash]='json';await writeFile(path.join(directory,hash+'.json'),JSON.stringify(data));
    }
    for(const [name,data] of Object.entries({'manifest.json':manifest,'catalog.json':{items:[]},'indexes.json':{tags:{items:[]},onlineTags:{items:[]}},
      'entry-pages.json':{commit:'fixture-commit'},'recorded-state.json':recorded}))await writeFile(path.join(directory,name),JSON.stringify(data));
    await writeFile(path.join(site,'_demo/frontend-source.json'),JSON.stringify({commit:'fixture-commit',version:'1.2.3'}));
    for(let build=0;build<2;build++){
      await prepareShowcase(site);
      const browser=JSON.parse(await readFile(path.join(directory,await key('/api/configuration/jav-browser')+'.json'),'utf8'));
      assert.equal(browser.userscript.version,'0.4.0');assert.equal(browser.userscript.install_url,'/integrations/peach-jav.user.js');
      for(const [route,expected] of Object.entries(recorded)){
        const actual=JSON.parse(await readFile(path.join(directory,await key(route)+'.json'),'utf8'));
        if(route==='/api/downloads'){
          delete actual.providers;
          assert.deepEqual(actual,{...expected,tasks:expected.tasks.map(task=>({...task,asset_id:null}))},route);
        }else assert.deepEqual(actual,expected,route);
      }
    }
  }finally{await rm(site,{recursive:true,force:true})}
});
