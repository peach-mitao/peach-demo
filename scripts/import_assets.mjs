import {readdir,mkdir,copyFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../site/',import.meta.url));
if(!process.argv[2])throw Error('请提供录制包目录：npm run assets:import -- <目录>');
const source=path.resolve(process.argv[2]);
for(const file of ['_fixtures/manifest.json','_fixtures/catalog.json','_fixtures/indexes.json'])await stat(path.join(source,file));
let count=0;
async function copy(from,to){
 await mkdir(to,{recursive:true});
 for(const entry of await readdir(from,{withFileTypes:true})){
  if(entry.isSymbolicLink())throw Error('录制包不接受符号链接');
  if(++count>10000)throw Error('录制包超过文件数量上限');
  const src=path.join(from,entry.name),dest=path.join(to,entry.name);
  if(entry.isDirectory())await copy(src,dest);
  else {if((await stat(src)).size>25*1024*1024)throw Error(`静态资源过大：${entry.name}`);await copyFile(src,dest)}
 }
}
for(const dir of ['_fixtures','_media','_demo/follow']){
 try{await stat(path.join(source,dir))}catch(error){if(error.code==='ENOENT')continue;throw error}
 await copy(path.join(source,dir),path.join(root,dir));
}
console.log(`导入 ${count} 个本地录制包条目；前端代码与演示脚本保持不变。`);
