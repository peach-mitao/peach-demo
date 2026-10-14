import {readFile,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const config=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
assert.equal(config.repository.url,'https://github.com/peach-mitao/peach-demo.git');
for(const file of ['src/worker.js','src/key.mjs','site/_demo/interactions.js','site/_demo/tour.js','site/_demo/copy-editor.js'])assert.ok((await stat(new URL(file,root))).size>0,file);
if(process.argv.includes('--assets')){
 for(const file of ['site/index.html','site/app.css','site/dist/peach-app.js','site/dist/peach-app.css','site/_fixtures/manifest.json','site/_fixtures/catalog.json'])assert.ok((await stat(new URL(file,root))).size>0,`发布文件未取得：${file}`);
 const manifest=JSON.parse(await readFile(new URL('site/_fixtures/manifest.json',root),'utf8'));
 assert.ok(manifest.fixtures&&Array.isArray(manifest.paths));
}
console.log('PASS: 演示工程与发布入口');
