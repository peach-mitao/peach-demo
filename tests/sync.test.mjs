import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readStylesheet} from '../scripts/sync_frontend.mjs';

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
