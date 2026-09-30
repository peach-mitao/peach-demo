// 从 Peach 检出的构建产物同步前端，不访问账本或生产服务。
import path from 'node:path';
import {readFile,readdir,mkdir,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let source=process.argv[2]||process.env.PEACH_APP;
if(!source){
 for(const candidate of [path.resolve(root,'../peach'),path.resolve(root,'../../../peach-app')]){
  try{await access(path.join(candidate,'web/app.js'));source=candidate;break}catch{}
 }
}
if(!source)throw Error('Peach 源码未取得：npm run sync -- <Peach 检出目录>');
source=path.resolve(source);
const web=path.join(source,'web'),names=['index.html','app.css','board.css','app.js'];
async function walk(dir){for(const entry of await readdir(path.join(web,dir),{withFileTypes:true})){const name=`${dir}/${entry.name}`;if(entry.isDirectory())await walk(name);else if(!name.endsWith('.map'))names.push(name)}}
for(const dir of ['js','dist','vendor'])await walk(dir);
const staged=[];
for(const name of names)staged.push({name,body:await readFile(path.join(web,name))});
for(const name of ['javten','fc2ppvdb','avwikidb','github'])staged.push({name:`site-icon/${name}.png`,body:await readFile(path.join(source,'resources/site-marks',`${name}.png`))});
for(const {name,body} of staged){const target=path.join(root,'site',name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,body)}
console.log(`同步 ${staged.length} 个前端文件；演示脚本、录制响应与媒体保持不变。`);
