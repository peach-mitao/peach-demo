import test from 'node:test';
import assert from 'node:assert/strict';
import {stream} from '../src/stream.ts';
import {videoURL,VIDEO_CACHE} from '../src/video.ts';
import {mediaURL,mediaJSON,mediaHTML} from '../src/media.ts';
import {media,videoKey} from './media.ts';
const call=(env:Parameters<typeof stream>[1],path='/stream?id=1',init?:RequestInit)=>{const url=new URL(path,'https://demo.example');return stream(new Request(url,init),env,url)};

test('视频地址在文本、JSON 与 HTML 中直接指向公开内容对象',()=>{
 const videos={'1':{key:videoKey}},expected=videoURL(videoKey)!;
 assert.equal(mediaURL('/stream?id=1&session=private',{},undefined,{},videos),expected);
 assert.deepEqual(mediaJSON({url:'/stream?id=1'}, {},undefined,{},videos),{url:expected});
 assert.equal(mediaHTML('<video src="/stream?id=1&amp;session=private"></video>',{},undefined,{},videos),'<video src="'+expected+'"></video>');
 for(const bad of ['../private.mp4','https://other.example/x.mp4','demo/videos/no.mp4'])assert.equal(videoURL(bad),null);
});
test('GET 与 HEAD 的编号入口只返回无正文的受限媒体域名跳转',async()=>{
 const {env,stats}=media();
 for(const method of ['GET','HEAD']){
  const response=await call(env,'/stream?id=1&session=ignored',{method,headers:{range:'bytes=0-1'}});
  assert.equal(response.status,308);assert.equal(response.headers.get('location'),videoURL(videoKey));
  assert.equal(response.headers.get('cache-control'),'no-cache');assert.equal(await response.text(),'');
 }
 const response=await call(env,'/stream?id=1&v='+'a'.repeat(64));
 assert.equal(response.headers.get('cache-control'),VIDEO_CACHE);assert.equal(stats.indexes,1);
});
test('不支持的方法、编号与过期内容指纹不被缓存',async()=>{
 for(const path of ['/stream?id=missing','/stream?id=2','/stream?id=1&v='+'b'.repeat(64)]){
  const response=await call(media().env,path);assert.equal(response.status,404);assert.equal(response.headers.get('cache-control'),'no-store');
 }
 const response=await call(media().env,'/stream?id=1',{method:'POST'});assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'GET, HEAD');
});
test('损坏清单不产生外域或路径穿越跳转',async()=>{
 for(const value of [{}, {version:1,videos:{'1':{key:'../private.mp4',size:8}}},{version:1,videos:{'1':{key:videoKey,size:0}}}]){
  const env={ASSETS:{fetch:async()=>Response.json(value)}};assert.equal((await call(env)).status,503);
 }
});
