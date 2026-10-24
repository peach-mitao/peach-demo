// 编辑工具条由官网维护；演示站只同步构建产物并校验来源摘要。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const digest=(body:Uint8Array)=>createHash('sha256').update(body).digest('hex');
export async function verifyEditorUI(){
 const lock=JSON.parse(await readFile(path.join(root,'editor-ui-source.json'),'utf8'));
 if(lock.repository!=='https://github.com/peach-mitao/peach-site'||lock.path!=='site/assets/edit-toolbar.js'||!/^[a-f0-9]{40}$/.test(lock.commit)||lock.target!=='site/_demo/edit-toolbar.js')throw Error('文案工具条来源无效，请运行 edit:ui:sync');
 if(digest(await readFile(path.join(root,lock.target)))!==lock.sha256)throw Error('共用文案工具条偏离固定来源，请通过 edit:ui:sync 同步');
 return lock;
}
export async function syncEditorUI(source:string){
 const checkout=path.resolve(source),commit=execFileSync('git',['-C',checkout,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const body=await readFile(path.join(checkout,'site/assets/edit-toolbar.js'));
 const built=JSON.parse(await readFile(path.join(checkout,'editor-ui-build.json'),'utf8')),sources:Record<string,string>=built.sources;
 if(built.sha256!==digest(body))throw Error('官网工具条构建摘要不符，请先运行官网 browser:build');
 for(const [name,hash]of Object.entries(sources)){
  if(name.includes('..')||path.isAbsolute(name)||digest(await readFile(path.join(checkout,name)))!==hash)throw Error('官网工具条来源已变化，请先运行官网 browser:build：'+name);
 }
 const target='site/_demo/edit-toolbar.js';await mkdir(path.dirname(path.join(root,target)),{recursive:true});await writeFile(path.join(root,target),body);
 await writeFile(path.join(root,'editor-ui-source.json'),JSON.stringify({repository:'https://github.com/peach-mitao/peach-site',commit,draft:!!execFileSync('git',['-C',checkout,'status','--porcelain','--',...Object.keys(sources)],{encoding:'utf8'}).trim(),path:'site/assets/edit-toolbar.js',target,sha256:digest(body),sources},null,2)+'\n');
 await verifyEditorUI();console.log('已同步共用文案工具条及来源摘要');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv[2]==='--check')await verifyEditorUI();
 else {if(!process.argv[2])throw Error('请指定官网检出目录');await syncEditorUI(process.argv[2])}
}
