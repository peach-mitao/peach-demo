// 从 Peach 检出的构建产物同步前端，不访问账本或生产服务。
import path from 'node:path';
import {readFile,readdir,mkdir,writeFile,access} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function readStylesheet(web){
 const dir=path.join(web,'css');
 const names=(await readdir(dir)).filter(name=>/^\d{2}-[a-z0-9-]+\.css$/.test(name)).sort();
 if(!names.length)throw Error('Peach 样式分区未取得');
 return Buffer.concat(await Promise.all(names.map(name=>readFile(path.join(dir,name)))));
}
export async function syncFrontend(source=process.env.PEACH_APP,target=path.join(root,'site')){
if(!source){
 for(const candidate of [path.resolve(root,'../peach'),path.resolve(root,'../../../peach-app')]){
  try{await access(path.join(candidate,'web/dist/peach-app.js'));source=candidate;break}catch{}
 }
}
if(!source)throw Error('Peach 源码未取得：npm run sync -- <Peach 检出目录>');
source=path.resolve(source);
const web=path.join(source,'web'),names=['index.html','app.css','board.css'];
async function walk(dir){for(const entry of await readdir(path.join(web,dir),{withFileTypes:true})){const name=`${dir}/${entry.name}`;if(entry.isDirectory())await walk(name);else if(!name.endsWith('.map'))names.push(name)}}
for(const dir of ['dist','vendor'])await walk(dir);
const staged=[];
for(const name of names)staged.push({name,body:name==='app.css'?await readStylesheet(web):await readFile(path.join(web,name))});
for(const entry of await readdir(path.join(source,'resources/site-marks'),{withFileTypes:true})){
 if(entry.isFile())staged.push({name:`site-icon/${entry.name}`,body:await readFile(path.join(source,'resources/site-marks',entry.name))});
}
for(const [resource,name] of [['peach-logo.png','peach-logo.png'],['peach.ico','favicon.ico']])staged.push({name,body:await readFile(path.join(source,'resources',resource))});
const version=(await readFile(path.join(source,'src/peach/__init__.py'),'utf8')).match(/__version__\s*=\s*"([^"]+)"/)?.[1];
if(!version)throw Error('应用版本未取得');
const commit=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const info={repository:'https://github.com/peach-mitao/peach',commit,version,
 files:Object.fromEntries(staged.map(({name,body})=>[name,createHash('sha256').update(body).digest('hex')]))};
for(const {name,body} of staged){const file=path.join(target,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,body)}
await mkdir(path.join(target,'_demo'),{recursive:true});
await writeFile(path.join(target,'_demo/frontend-source.json'),JSON.stringify(info,null,2)+'\n');
console.log(`同步 ${staged.length} 个前端文件；演示脚本、录制响应与媒体保持不变。`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await syncFrontend(process.argv[2]);
