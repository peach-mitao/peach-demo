import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {behaviorVersion} from '../scripts/behavior_version.ts';

test('布局指纹只接收运行时输入，缺少录制包时拒绝生成',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'peach-layout-version-'));
 const files=['browser/fixture.ts','browser/types.d.ts','src/page-shell.ts','scripts/build_public.ts',
  'scripts/prepare_showcase.ts','scripts/bundle_player.ts','site/index.html','site/app.css','site/board.css','site/dist/peach-app.js'];
 try{
  for(const file of files){await mkdir(path.dirname(path.join(directory,file)),{recursive:true});await writeFile(path.join(directory,file),'fixture\n')}
  const root=pathToFileURL(directory+path.sep),initial=await behaviorVersion(root);
  await writeFile(path.join(directory,'browser/types.d.ts'),'export declare const typed:string;');
  assert.equal(await behaviorVersion(root),initial);
  await writeFile(path.join(directory,'browser/fixture.ts'),'runtime change\n');
  assert.notEqual(await behaviorVersion(root),initial);
  await rm(path.join(directory,'site/index.html'));
  await assert.rejects(behaviorVersion(root),{code:'ENOENT'});
 }finally{await rm(directory,{recursive:true,force:true})}
});
