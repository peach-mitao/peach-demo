import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
export async function behaviorVersion(){
 const root=new URL('../',import.meta.url),hash=createHash('sha256');
 async function add(directory:string){for(const entry of (await readdir(new URL(directory,root),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=directory+entry.name;if(entry.isDirectory())await add(name+'/');else if(name.endsWith('.ts')&&!name.endsWith('behavior-version.ts'))hash.update(name+'\0').update((await readFile(new URL(name,root),'utf8')).replaceAll('\r\n','\n'))}}
 await add('browser/');
 for(const name of ['src/page-shell.ts','scripts/build_public.ts','scripts/prepare_showcase.ts','scripts/bundle_player.ts','site/index.html','site/app.css','site/board.css','site/dist/peach-app.js'])hash.update(name+'\0').update((await readFile(new URL(name,root),'utf8')).replaceAll('\r\n','\n'));
 const version=hash.digest('hex');await writeFile(new URL('browser/behavior-version.ts',root),`// 构建生成的布局指纹。\nexport const layoutVersion='${version}';\n`);return version;
}
