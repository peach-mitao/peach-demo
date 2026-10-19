import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fixtureHash} from '../src/key.ts';
import {mediaURL,mediaJSON,mediaHTML} from '../src/media.ts';
import {buildStatic,staticImageExpressions} from '../scripts/build_static.mjs';
import {createHash} from 'node:crypto';
import {mediaFiles} from '../scripts/media_storage.ts';

test('静态图片解析与录制键、版本参数、别名及原路径兜底一致',async()=>{
  const images={};
  images[await fixtureHash('GET /cover?code=DEMO-001&thumb=1')]='/_demo/images/one.jpg';
  images[await fixtureHash('GET /logo')]='/_demo/images/logo.svg';
  for(const url of ['/cover?thumb=1&code=DEMO-001','/cover?code=DEMO-001&thumb=1&v=updated'])assert.equal(mediaURL(url,images),images[await fixtureHash('GET /cover?code=DEMO-001&thumb=1')]+new URL(url,'https://demo.example').search);
  assert.equal(mediaURL('/logo?studio=demo',images),'/_demo/images/logo.svg?studio=demo');
  const versioned=new URL(mediaURL('/cover?code=DEMO-001&thumb=1',images)+'&v=updated','https://demo.peach.video');
  assert.equal(versioned.pathname,'/_demo/images/one.jpg');assert.equal(versioned.searchParams.get('v'),'updated');
  for(const url of ['/cover?code=unknown','https://other.test/cover?code=DEMO-001','//other.test/cover?code=DEMO-001','/_fixtures/private.json','/stream?id=1','文字'])assert.equal(mediaURL(url,images),url);
  assert.deepEqual(mediaJSON({items:[{image_url:'/logo?studio=demo',id:1}],cursor:null},images),{items:[{image_url:'/_demo/images/logo.svg?studio=demo',id:1}],cursor:null});
});

test('前端图片模板和拼接完整转换，查询和非图片地址保持语义',()=>{
  const source='const id=2; globalThis.output=[`/cover?code=${id}&thumb=1`,"/poster?id="+id+"&c=4","/api/items?q=test",`/stream?id=${id}`,"/cover"];';
  const calls=[],context={peachDemoMedia:url=>{calls.push(url);return 'static:'+url}};
  const result=staticImageExpressions(source);vm.runInNewContext(result.source,context);
  assert.equal(result.count,2);assert.deepEqual(calls,['/cover?code=2&thumb=1','/poster?id=2&c=4']);
  assert.deepEqual([...context.output],['static:/cover?code=2&thumb=1','static:/poster?id=2&c=4','/api/items?q=test','/stream?id=2','/cover']);
});

test('HTML 图片模板在创建 DOM 前解析，保留转义参数和其他标签',async()=>{
  const images={[await fixtureHash('GET /poster?c=4&id=1')]:'/_demo/images/poster.jpg'};
  const source='const id=1; globalThis.html=`<img class="poster" src="/poster?id=${id}&amp;c=4"><a href="/poster?id=1&c=4">链接</a>`;';
  const context={peachDemoHTML:html=>mediaHTML(html,images)};
  vm.runInNewContext(staticImageExpressions(source).source,context);
  assert.equal(context.html,'<img class="poster" src="/_demo/images/poster.jpg?id=1&amp;c=4"><a href="/poster?id=1&c=4">链接</a>');
});

test('图片版本帮助函数使用完整请求匹配版本专属图片',async()=>{
  const images={
    [await fixtureHash('GET /cover?code=one')]:'/_demo/images/base.jpg',
    [await fixtureHash('GET /cover?code=one&v=edited')]:'/_demo/images/edited.jpg',
  };
  const context={peachDemoMedia:value=>mediaURL(value,images)};
  vm.runInNewContext(staticImageExpressions('const version=(u,v)=>v?`${u}&v=${encodeURIComponent(v)}`:u;globalThis.image=version(`/cover?code=one`,"edited");').source,context);
  assert.equal(context.image,'/_demo/images/edited.jpg?code=one&v=edited');
});

test('构建导出带内容指纹的图片，私有 JSON 不进入静态映射',async()=>{
  const site=await mkdtemp(path.join(tmpdir(),'peach-static-'));
  try{
    await mkdir(path.join(site,'_fixtures'));await mkdir(path.join(site,'dist'));
    await mkdir(path.join(site,'_media'));await writeFile(path.join(site,'_media/1.mp4'),'video');
    const own=await fixtureHash('GET /cover?code=one'),alias=await fixtureHash('GET /cover?code=two'),json=await fixtureHash('GET /api/item?id=1');
    await writeFile(path.join(site,'_fixtures/manifest.json'),JSON.stringify({fixtures:{[own]:'png',[json]:'json'},alias:{[alias]:own}}));
    await writeFile(path.join(site,`_fixtures/${own}.png`),'image');await writeFile(path.join(site,`_fixtures/${json}.json`),'{"private":true}');
    await writeFile(path.join(site,'dist/peach-app.js'),'globalThis.image="/cover?code=one"');
    const first=await buildStatic(site);assert.equal(Object.keys(first.images).length,2);assert.equal(first.images[own],first.images[alias]);assert.equal(first.images[json],undefined);
    const key=`demo/videos/${createHash('sha256').update('video').digest('hex')}.mp4`;
    assert.deepEqual(JSON.parse(await readFile(path.join(site,'_media/index.json'),'utf8')),{version:1,videos:{'1':{key,size:5}}});
    assert.equal((await mediaFiles(site))[0].key,key);
    await writeFile(path.join(site,'_media/1.mp4'),'corrupted');
    await assert.rejects(mediaFiles(site),/素材与清单不一致/);
    await writeFile(path.join(site,'_media/1.mp4'),'video');
    assert.match(first.images[own],/^\/_demo\/images\/[a-f0-9]{64}\.png$/);
    assert.equal(await readFile(path.join(site,first.images[own]),'utf8'),'image');
    assert.equal(await readFile(path.join(site,'dist/peach-app.js'),'utf8'),'globalThis.image="/cover?code=one"');
    const runtime=await readFile(path.join(site,'_demo/media-runtime.js'),'utf8'),context={location:{origin:'https://demo.peach.video'},TextEncoder,URL,URLSearchParams};
    vm.runInNewContext(runtime,context);vm.runInNewContext(await readFile(path.join(site,'dist/demo-peach-app.js'),'utf8'),context);
    assert.equal(context.image,first.images[own]+'?code=one');
    await writeFile(path.join(site,`_fixtures/${own}.png`),'new image');
    const second=await buildStatic(site);assert.notEqual(first.images[own],second.images[own]);
  }finally{await rm(site,{recursive:true,force:true})}
});
