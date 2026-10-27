import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {verifyBehavior} from '../scripts/sync_behavior.ts';

test('共用统计源码校验拒绝草稿、缺项和副本漂移',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'peach-behavior-source-')),body='fixture\n',hash=createHash('sha256').update(body).digest('hex');
 const files=Object.fromEntries(['browser/assets/behavior-contract.ts','browser/assets/behavior-core.ts','scripts/behavior_artifacts.ts'].map(file=>[file,hash]));
 const manifest={repository:'https://github.com/peach-mitao/peach-site',commit:'a'.repeat(40),draft:false,files};
 const save=(value:unknown)=>writeFile(path.join(directory,'behavior-source.json'),JSON.stringify(value));
 try{
  for(const file of Object.keys(files)){await mkdir(path.dirname(path.join(directory,file)),{recursive:true});await writeFile(path.join(directory,file),body)}
  await save(manifest);await verifyBehavior(true,directory);
  await save({...manifest,draft:true});await verifyBehavior(false,directory);await assert.rejects(verifyBehavior(true,directory),/尚未定稿/);
  await save({...manifest,files:{}});await assert.rejects(verifyBehavior(true,directory),/清单不完整/);
  await save(manifest);await writeFile(path.join(directory,'browser/assets/behavior-core.ts'),'drift');await assert.rejects(verifyBehavior(true,directory),/偏离来源/);
 }finally{await rm(directory,{recursive:true,force:true})}
});
