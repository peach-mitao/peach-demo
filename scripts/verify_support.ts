import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export async function verifySupport(production=false){
 const root=fileURLToPath(new URL('../',import.meta.url)),manifest=JSON.parse(await readFile(path.join(root,'support-source.json'),'utf8'));
 if(manifest.repository!=='https://github.com/peach-mitao/peach-site'||!/^[a-f0-9]{40}$/.test(manifest.commit)||typeof manifest.draft!=='boolean'||production&&manifest.draft)throw Error('共用支持页来源尚未定稿');
 for(const [name,hash] of Object.entries(manifest.files)){if(name.includes('..')||path.isAbsolute(name)||createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==hash)throw Error('共用支持页偏离固定来源：'+name)}
}
