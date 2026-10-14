import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {fixtureHash,fixtureKey} from '../src/key.mjs';
import worker from '../src/worker.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const origin='https://example.test';
const portraitHash=await fixtureHash('GET /entity-image?id=102&kind=performer');
const files=new Map([
 ['/_fixtures/manifest.json',JSON.stringify({fixtures:{[portraitHash]:'png'},paths:[],alias:{}})],
 [`/_fixtures/${portraitHash}.png`,new Uint8Array([8,9,10])],
 ['/_fixtures/catalog.json',JSON.stringify({items:[
  {id:1,name:'示例一',code:'DEMO-001',is_jav:true,tags:[],performers:[],o_count:2,duration:120,size:100,location:'local'},
  {id:2,name:'示例二',code:'DEMO-002',is_jav:true,tags:[],performers:[],o_count:5,duration:240,size:200,location:'local'}
 ]})],
 ['/_media/1.mp4',new Uint8Array([0,1,2,3,4,5,6,7])],
 ['/favicon.ico',new Uint8Array([1,2,3])]
]);
const env={ASSETS:{async fetch(input){const name=new URL(input instanceof Request?input.url:input).pathname;return files.has(name)?new Response(files.get(name)):new Response('not found',{status:404})}}};
const call=(path,init)=>worker.fetch(new Request(origin+path,init),env);
test('资料图片的版本参数复用已审核的演示图片',async()=>{
 const response=await call('/entity-image?kind=performer&id=102&v=updated');
 assert.equal(response.status,200);
 assert.equal(response.headers.get('content-type'),'image/png');
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[8,9,10]);
});
test('请求键按查询参数顺序规范化',async()=>{
 assert.equal(fixtureKey('GET',new URL(origin+'/api/items?b=2&a=1')),fixtureKey('GET',new URL(origin+'/api/items?a=1&b=2')));
 assert.equal((await fixtureHash('GET /x')).length,20);
});
test('私有录制文件不通过公开路径返回',async()=>{
 for(const path of ['/_fixtures/manifest.json','/_media/1.mp4'])assert.equal((await call(path)).status,404);
});
test('视频提供有效的分段、尾部和越界响应',async()=>{
 const range=await call('/stream?id=1',{headers:{Range:'bytes=2-4'}});
 assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),'bytes 2-4/8');
 assert.deepEqual([...new Uint8Array(await range.arrayBuffer())],[2,3,4]);
 const suffix=await call('/stream?id=1',{headers:{Range:'bytes=-2'}});
 assert.deepEqual([...new Uint8Array(await suffix.arrayBuffer())],[6,7]);
 assert.equal((await call('/stream?id=1',{headers:{Range:'bytes=99-100'}})).status,416);
 assert.equal((await call('/stream?id=invalid')).status,404);
});
test('排序升降序均保留馆藏数据',async()=>{
 const desc=await (await call('/api/items?sort=o&dir=desc')).json();
 const asc=await (await call('/api/items?sort=o&dir=asc')).json();
 assert.deepEqual(desc.items.map(item=>item.id),[2,1]);
 assert.deepEqual(asc.items.map(item=>item.id),[1,2]);
 assert.equal(desc.total,2);assert.equal(asc.total,2);
});
test('演示写操作不改变录制馆藏',async()=>{
 assert.deepEqual(await (await call('/api/feedback',{method:'POST',body:'{}'})).json(),{ok:true});
 assert.equal((await (await call('/api/items')).json()).total,2);
});
