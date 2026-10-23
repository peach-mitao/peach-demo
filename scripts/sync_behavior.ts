import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const digest=(body:string)=>createHash('sha256').update(body.replaceAll('\r\n','\n')).digest('hex');
export async function verifyBehavior(production=false,directory=root){
 const manifest=JSON.parse(await readFile(path.join(directory,'behavior-source.json'),'utf8'));
 if(manifest.repository!=='https://github.com/peach-mitao/peach-site'||!/^[a-f0-9]{40}$/.test(manifest.commit)||typeof manifest.draft!=='boolean'||production&&manifest.draft)throw Error('行为统计来源尚未定稿，请同步已提交的官网源码');
 const required=['browser/assets/behavior-contract.ts','browser/assets/behavior-core.ts','scripts/behavior_artifacts.ts'];
 if(!manifest.files||typeof manifest.files!=='object'||Object.keys(manifest.files).length!==required.length||required.some(file=>!/^[a-f0-9]{64}$/.test(manifest.files[file]||'')))throw Error('行为统计来源清单不完整');
 for(const [file,hash] of Object.entries(manifest.files))if(!required.includes(file)||digest(await readFile(path.join(directory,file),'utf8'))!==hash)throw Error('共用行为统计源码已偏离来源：'+file);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const source=process.argv[2];if(!source)throw Error('请指定官网仓库目录');
 if(JSON.parse(await readFile(path.join(source,'package.json'),'utf8')).name!=='peach-site')throw Error('来源不是官网仓库');
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),draft=execFileSync('git',['status','--porcelain'],{cwd:source,encoding:'utf8'}).trim().length>0;
 if(draft&&!process.argv.includes('--draft'))throw Error('官网源码尚未提交；预览同步须显式使用 --draft');
 const files:Record<string,string>={};for(const file of ['browser/assets/behavior-contract.ts','browser/assets/behavior-core.ts','scripts/behavior_artifacts.ts']){const body=await readFile(path.join(source,file),'utf8');files[file]=digest(body);await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),body)}
 await writeFile(path.join(root,'behavior-source.json'),JSON.stringify({repository:'https://github.com/peach-mitao/peach-site',commit,draft,files},null,2)+'\n');
}
