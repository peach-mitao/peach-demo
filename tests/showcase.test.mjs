import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration,cloudProxies,downloadTasks,providers} from '../src/showcase.mjs';

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
