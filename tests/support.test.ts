import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.ts';

test('缺失文档使用禁止缓存的 HTML 404，资源与私有路径不返回支持页',async()=>{
 const requested:string[]=[];
 const env={ASSETS:{fetch(input:Request|string|URL){const url=new URL(input instanceof Request?input.url:input);requested.push(url.pathname);return Promise.resolve(url.pathname==='/404.html'?new Response('<h1>missing</h1>',{headers:{'content-type':'text/html','cache-control':'public,max-age=31536000'}}):new Response('not found',{status:404,headers:{'cache-control':'public,max-age=31536000'}}))}}};
 for(const method of ['GET','HEAD']){
  const response=await worker.fetch(new Request('https://demo.example/missing',{method,headers:{accept:'text/html'}}),env);
  assert.equal(response.status,404);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(await response.text(),method==='HEAD'?'':'<h1>missing</h1>');
 }
 requested.length=0;
 const asset=await worker.fetch(new Request('https://demo.example/absent.js'),env);assert.equal(asset.status,404);assert.equal(await asset.text(),'not found');assert.equal(asset.headers.get('cache-control'),'no-store');assert.deepEqual(requested,['/absent.js']);
 requested.length=0;
 const secret=await worker.fetch(new Request('https://demo.example/_fixtures/private',{headers:{accept:'text/html'}}),env);assert.equal(secret.status,404);assert.deepEqual(await secret.json(),{error:'not found'});assert.deepEqual(requested,[]);
});
