import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.ts';
import type {ReplayEnv} from '../src/types.ts';

test('回放清单读取不依赖其他请求未完成的上下文', {timeout:1000}, async()=>{
  let reads=0;
  const env: ReplayEnv={ASSETS:{async fetch(input){
    const path=new URL(input instanceof Request?input.url:input,'https://demo.example').pathname;
    if(path==='/_demo/replay-files.json'){
      reads++;
      if(reads===1)return await new Promise<never>(()=>{});
      return Response.json({'/_fixtures/manifest.json':'/_demo/data/manifest.json'});
    }
    if(path==='/_demo/data/manifest.json')return Response.json({fixtures:{},paths:[]});
    return new Response('not found',{status:404});
  }}};
  void worker.fetch(new Request('https://demo.example/api/unknown'),env);
  await new Promise<void>(resolve=>queueMicrotask(resolve));
  assert.equal((await worker.fetch(new Request('https://demo.example/api/unknown'),env)).status,404);
  assert.equal(reads,2);
});
