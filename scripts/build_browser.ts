import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {transform,build} from 'esbuild';
import {behaviorVersion} from './behavior_version.ts';
import {verifyBehavior} from './sync_behavior.ts';
import {verifySupport} from './verify_support.ts';
import {verifyEditorUI} from './sync_editor_ui.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildBrowser(){
  await verifyBehavior();await verifySupport();await verifyEditorUI();await behaviorVersion();
  const source=path.join(root,'browser'),out=path.join(root,'site/_demo');
  await mkdir(out,{recursive:true});
  await mkdir(path.join(root,'site/assets'),{recursive:true});
  await build({entryPoints:[path.join(source,'assets/page-support.ts')],outfile:path.join(root,'site/assets/support-ui/page-support.js'),bundle:true,format:'iife',platform:'browser',target:'es2022',charset:'utf8'});
  for(const entry of await readdir(source,{withFileTypes:true})){
    if(!entry.isFile()||!entry.name.endsWith('.ts')||entry.name.endsWith('.d.ts'))continue;
    const file=path.join(source,entry.name),result=await transform(await readFile(file,'utf8'),{loader:'ts',target:'es2022',charset:'utf8',sourcefile:file});
    await writeFile(path.join(out,entry.name.replace(/\.ts$/,'.js')),result.code.replace(/(from\s+["'][^"']+)\.ts(["'])/g,'$1.js$2'));
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await buildBrowser();
