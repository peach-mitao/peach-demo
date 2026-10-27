import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {tmpdir} from 'node:os';

test('Windows 自动换行检出保持共用工具条的实际字节摘要',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'peach-editor-checkout-'));
 const seed=path.join(directory,'seed'),checkout=path.join(directory,'checkout');
 const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 try{
  await mkdir(path.join(seed,'site/_demo'),{recursive:true});
  await writeFile(path.join(seed,'.gitattributes'),await readFile(new URL('../.gitattributes',import.meta.url)));
  const lock=JSON.parse(await readFile(new URL('../editor-ui-source.json',import.meta.url),'utf8'));
  const body=(await readFile(new URL('../site/_demo/edit-toolbar.js',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  await writeFile(path.join(seed,lock.target),body);
  git('init','-q',seed);git('-C',seed,'config','user.name','Fixture');git('-C',seed,'config','user.email','fixture@example.invalid');
  git('-C',seed,'add','.gitattributes',lock.target);git('-C',seed,'commit','-qm','fixture');
  git('clone','-q','--config','core.autocrlf=true',seed,checkout);
  const actual=await readFile(path.join(checkout,lock.target));
  assert.equal(createHash('sha256').update(actual).digest('hex'),lock.sha256);
  assert.equal(actual.includes(Buffer.from('\r\n')),false);
 }finally{await rm(directory,{recursive:true,force:true})}
});
