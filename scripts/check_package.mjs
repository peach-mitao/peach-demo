import {readFile,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fixtureHash,fixtureKey} from '../src/key.mjs';
const root=new URL('../',import.meta.url);
const config=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
assert.equal(config.repository.url,'https://github.com/peach-mitao/peach-demo.git');
for(const file of ['src/worker.js','src/key.mjs','src/directory.mjs','src/discovery.mjs','src/follow.mjs','site/_demo/interactions.js','site/_demo/tour.js','site/_demo/copy-editor.js'])assert.ok((await stat(new URL(file,root))).size>0,file);
if(process.argv.includes('--assets')){
 for(const file of ['site/index.html','site/app.css','site/dist/peach-app.js','site/dist/peach-app.css','site/_fixtures/manifest.json','site/_fixtures/catalog.json','site/_fixtures/indexes.json'])assert.ok((await stat(new URL(file,root))).size>0,`发布文件未取得：${file}`);
 const manifest=JSON.parse(await readFile(new URL('site/_fixtures/manifest.json',root),'utf8'));
 assert.ok(manifest.fixtures&&Array.isArray(manifest.paths));
 const indexes=JSON.parse(await readFile(new URL('site/_fixtures/indexes.json',root),'utf8'));
 const catalog=JSON.parse(await readFile(new URL('site/_fixtures/catalog.json',root),'utf8'));
 async function recorded(path){
  const own=await fixtureHash(fixtureKey('GET',new URL(path,'https://demo.example'))),hash=manifest.alias?.[own]??own;
  assert.equal(manifest.fixtures[hash],'json',`资料回放未取得：${path}`);
  assert.ok((await stat(new URL(`site/_fixtures/${hash}.json`,root))).size>0,path);
 }
 for(const [key,kind] of Object.entries({performers:'performer',creators:'creator',studios:'studio',studioSearch:'studio',agencies:'agency',tags:'tag',onlineAuthors:'creator',onlineTags:'tag',onlineGeneralTags:'tag'})){
  const page=indexes[key];assert.ok(page&&Array.isArray(page.items)&&!page.has_more,`名册未取齐：${key}`);
  for(const row of page.items){
   const id=row.entity_id;
   if(key==='onlineTags'||key==='onlineGeneralTags')continue;
   assert.ok(Number.isInteger(id)&&id>0,`身份 ID 未取得：${key}/${row.k}`);
   await recorded(`/api/entity?kind=${row.entity_kind||kind}&id=${id}`);
  }
 }
 assert.ok(catalog.tag_categories&&catalog.entity_filters,'筛选目录未取得');
 for(const row of catalog.items){assert.ok(Array.isArray(row.filter_tags),`完整标签未取得：${row.id}`);await recorded(`/api/item?id=${row.id}`)}
}
console.log('PASS: 演示工程与发布入口');
