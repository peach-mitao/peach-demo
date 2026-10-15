import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../site/_demo/interactions.js',import.meta.url),'utf8');
function page(){
  const calls=[],context={Request,Response,Headers,URL,URLSearchParams,crypto,
    location:{href:'https://demo.example/',origin:'https://demo.example',search:''},
    document:{readyState:'loading',addEventListener(){}},
    fetch:async(input,init)=>{const url=input instanceof Request?new URL(input.url):new URL(input,'https://demo.example');calls.push({path:url.pathname,search:url.search,method:input.method||init?.method||'GET'});return new Response(JSON.stringify({status:'complete',id:1,items:[]}),{headers:{'content-type':'application/json'}})}};
  context.window=context;context.peachDemoMedia=value=>value;context.peachDemoMediaJSON=value=>value;
  vm.runInNewContext(source,context);return {fetch:context.fetch,calls};
}
test('固定处理状态合并并发读取，重复轮询不产生网络请求',async()=>{
  const p=page();await Promise.all([p.fetch('/api/library-processing'),p.fetch('/api/library-processing')]);
  assert.equal((await (await p.fetch('/api/library-processing')).json()).status,'complete');assert.equal(p.calls.length,1);
  const write=await p.fetch('/api/library-processing',{method:'POST',body:'{}'});assert.equal((await write.json()).status,'complete');
  assert.match((await (await p.fetch('/api/library-processing')).json()).job_id,/^demo-/);assert.equal(p.calls.length,1);
});
test('演示行为上报在浏览器确认，馆藏查询仍携带完整参数',async()=>{
  const p=page();for(const path of ['/api/activity','/api/play'])assert.equal((await (await p.fetch(path,{method:'POST',body:'{}'})).json()).ok,true);
  assert.equal(p.calls.length,0);await p.fetch('/api/items?q=one&seed=123');await p.fetch('/api/items?q=two&seed=456');
  assert.deepEqual(p.calls.map(call=>call.search),['?q=one&seed=123','?q=two&seed=456']);
});
