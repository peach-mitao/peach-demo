// 共用支持页的源码与资源由官网固定来源提供，不在演示站维护第二份实现。
import {readFile,writeFile,mkdir,readdir,cp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const source=process.argv[2];if(!source)throw Error('请指定官网检出目录');
const root=fileURLToPath(new URL('../',import.meta.url)),files:Record<string,string>={};
for(const name of ['page-support.ts','site-language.ts']){const body=(await readFile(path.join(source,'browser/assets',name),'utf8')).replaceAll('\r\n','\n');await writeFile(path.join(root,'browser/assets',name),body);files['browser/assets/'+name]=createHash('sha256').update(body).digest('hex')}
await mkdir(path.join(root,'site/assets'),{recursive:true});
await cp(path.join(source,'site/assets/support-ui'),path.join(root,'site/assets/support-ui'),{recursive:true});
await cp(path.join(source,'site/assets/support.css'),path.join(root,'site/assets/support-ui/support.css'));
const html=(await readFile(path.join(source,'site/404.html'),'utf8')).replaceAll('\r\n','\n').replace('data-support-home-en="/en/"','data-support-home-en="/"').replace('<script src="/assets/locale.js"></script>','').replace('/assets/page-support.js','/assets/support-ui/page-support.js').replace('/assets/support.css','/assets/support-ui/support.css');
await writeFile(path.join(root,'site/404.html'),html);
async function record(relative:string){for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){const name=path.posix.join(relative,entry.name);if(entry.isDirectory())await record(name);else if(entry.name!=='page-support.js')files[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')}}
await record('site/assets/support-ui');files['site/404.html']=createHash('sha256').update(await readFile(path.join(root,'site/404.html'))).digest('hex');
await writeFile(path.join(root,'support-source.json'),JSON.stringify({repository:'https://github.com/peach-mitao/peach-site',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),draft:!!execFileSync('git',['status','--porcelain'],{cwd:source,encoding:'utf8'}).trim(),files},null,2)+'\n');console.log('已同步共用404、语言解析与生产样式；演示首页地址保持当前站点');
