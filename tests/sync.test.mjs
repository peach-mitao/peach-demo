import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readStylesheet,syncFrontend} from '../scripts/sync_frontend.mjs';

test('React 入口与构建包可同步到独立演示目录',async()=>{
 const root=path.resolve(await mkdtemp(path.join(tmpdir(),'peach-demo-react-')));
 try{
  const source=path.join(root,'app'),target=path.join(root,'site');
  const files={'web/index.html':'<script type="module" src="/dist/peach-app.js"></script>','web/board.css':'board',
   'web/css/01-base.css':'base','web/dist/peach-app.js':'app','web/dist/peach-app.css':'react','web/vendor/license.txt':'license'};
  for(const name of ['javten','fc2ppvdb','avwikidb','github'])files[`resources/site-marks/${name}.png`]='icon';
  files['resources/peach-logo.png']='logo';files['resources/peach.ico']='favicon';
  for(const [name,body] of Object.entries(files)){const file=path.join(source,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,body)}
  await syncFrontend(source,target);
  assert.equal(await readFile(path.join(target,'dist/peach-app.js'),'utf8'),'app');
  assert.equal(await readFile(path.join(target,'app.css'),'utf8'),'base');
  assert.equal(await readFile(path.join(target,'index.html'),'utf8'),files['web/index.html']);
  assert.equal(await readFile(path.join(target,'peach-logo.png'),'utf8'),'logo');
  assert.equal(await readFile(path.join(target,'favicon.ico'),'utf8'),'favicon');
 }finally{await rm(root,{recursive:true,force:true})}
});

test('样式按应用分区规则筛选并按文件名拼接',async()=>{
 const web=await mkdtemp(path.join(tmpdir(),'peach-demo-css-'));
 try{
  await mkdir(path.join(web,'css'));
  for(const [name,body] of [['12-cards.css','卡片\n'],['01-base.css','基础\n'],['09-skeleton.css','骨架\n'],['draft.css','草稿'],['99-TEMP.css','临时'],['02-topbar.css.map','映射']])await writeFile(path.join(web,'css',name),body);
  assert.deepEqual(await readStylesheet(web),Buffer.from('基础\n骨架\n卡片\n'));
 }finally{await rm(web,{recursive:true,force:true})}
});

test('没有有效样式分区时拒绝同步',async()=>{
 const web=await mkdtemp(path.join(tmpdir(),'peach-demo-css-'));
 try{
  await mkdir(path.join(web,'css'));
  await writeFile(path.join(web,'css','draft.css'),'草稿');
  await assert.rejects(readStylesheet(web),/样式分区未取得/);
 }finally{await rm(web,{recursive:true,force:true})}
});
