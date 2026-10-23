import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {transform} from 'esbuild';

const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildBrowser(){
  const source=path.join(root,'browser'),out=path.join(root,'site/_demo');
  await mkdir(out,{recursive:true});
  for(const entry of await readdir(source,{withFileTypes:true})){
    if(!entry.isFile()||!entry.name.endsWith('.ts')||entry.name.endsWith('.d.ts'))continue;
    const file=path.join(source,entry.name),result=await transform(await readFile(file,'utf8'),{loader:'ts',target:'es2022',charset:'utf8',sourcefile:file});
    await writeFile(path.join(out,entry.name.replace(/\.ts$/,'.js')),result.code);
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await buildBrowser();
