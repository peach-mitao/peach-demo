// 从本地录制图片生成公开静态副本；JSON、原始清单和视频保留在私有回放目录。
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {parse} from 'acorn';
import {build} from 'esbuild';
import {IMAGE_PATHS,IMAGE_EXTENSIONS} from '../src/media.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));

function prefix(node){
  if(!node)return '';
  if(node.type==='Literal'&&typeof node.value==='string')return node.value;
  if(node.type==='TemplateLiteral')return node.quasis[0].value.cooked;
  if(node.type==='BinaryExpression'&&node.operator==='+')return prefix(node.left);
  return '';
}
export function staticImageExpressions(source){
  const tree=parse(source,{ecmaVersion:'latest',sourceType:'module'}),ranges=[],versionHelpers=new Set();
  const children=node=>Object.values(node).flatMap(value=>Array.isArray(value)?value:value&&typeof value.type==='string'?[value]:[]).filter(value=>value&&typeof value.type==='string');
  function findVersions(node){
    const fn=node.type==='VariableDeclarator'&&node.id.type==='Identifier'?node.init:null,body=fn?.body;
    if(fn?.type==='ArrowFunctionExpression'&&body.type==='ConditionalExpression'&&fn.params[0]?.type==='Identifier'&&body.alternate.type==='Identifier'&&body.alternate.name===fn.params[0].name&&body.consequent.type==='TemplateLiteral'&&body.consequent.quasis[1]?.value.cooked==='&v=')versionHelpers.add(node.id.name);
    children(node).forEach(findVersions);
  }
  findVersions(tree);
  function visit(node){
    if(!node||typeof node!=='object')return;
    if(node.type==='CallExpression'&&node.callee.type==='Identifier'&&versionHelpers.has(node.callee.name)&&IMAGE_PATHS.has(prefix(node.arguments[0]).split('?')[0])){
      ranges.push([node.start,node.end,'peachDemoMedia']);return;
    }
    const start=prefix(node);
    const html=node.type==='TemplateLiteral'?node.quasis.map(part=>part.value.cooked).join(''):node.type==='Literal'&&typeof node.value==='string'?node.value:'';
    if(/<(?:img|source|video)\b[^>]*\b(?:src|poster)=["']\/(?:[^"'<>]*\?)/i.test(html)){
      ranges.push([node.start,node.end,'peachDemoHTML']);return;
    }
    if(start.includes('?')&&IMAGE_PATHS.has(start.split('?')[0])){
      ranges.push([node.start,node.end,'peachDemoMedia']);return;
    }
    for(const value of Object.values(node)){
      if(Array.isArray(value))value.forEach(visit);
      else if(value&&typeof value.type==='string')visit(value);
    }
  }
  visit(tree);
  for(const [start,end,helper] of ranges.sort((a,b)=>b[0]-a[0]))source=source.slice(0,start)+`globalThis.${helper}(`+source.slice(start,end)+')'+source.slice(end);
  return {source,count:ranges.length};
}

export async function buildStatic(site=path.join(root,'site')){
  const manifest=JSON.parse(await readFile(path.join(site,'_fixtures/manifest.json'),'utf8'));
  const images={},out=path.join(site,'_demo/images');await mkdir(out,{recursive:true});
  for(const [key,ext] of Object.entries(manifest.fixtures)){
    if(!IMAGE_EXTENSIONS.has(ext))continue;
    if(!/^[a-f0-9]{20}$/.test(key))throw Error('录制图片键格式无效');
    const source=path.join(site,`_fixtures/${key}.${ext}`),body=await readFile(source);
    const name=createHash('sha256').update(body).digest('hex')+'.'+ext;
    await copyFile(source,path.join(out,name));images[key]=`/_demo/images/${name}`;
  }
  for(const [alias,key] of Object.entries(manifest.alias||{}))if(images[key])images[alias]=images[key];
  const runtime=await build({stdin:{contents:`import {mediaURL,mediaJSON,mediaHTML} from './src/media.mjs';const images=${JSON.stringify(images)};globalThis.peachDemoMedia=value=>mediaURL(value,images,location.origin);globalThis.peachDemoMediaJSON=value=>mediaJSON(value,images,location.origin);globalThis.peachDemoHTML=value=>mediaHTML(value,images,location.origin);`,resolveDir:root},bundle:true,write:false,format:'iife',minify:true,platform:'browser',target:'es2022'});
  await writeFile(path.join(site,'_demo/media-runtime.js'),runtime.outputFiles[0].contents);
  let count=0;
  for(const entry of await readdir(path.join(site,'dist'))){
    if(!entry.endsWith('.js')||entry.startsWith('demo-'))continue;
    const result=staticImageExpressions(await readFile(path.join(site,'dist',entry),'utf8'));
    count+=result.count;
    // 所有构建包在同一目录，包间相对导入也指向经过转换的副本。
    const ast=parse(result.source,{ecmaVersion:'latest',sourceType:'module'}),imports=[];
    for(const node of ast.body)if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source?.value.startsWith('./')&&node.source.value.endsWith('.js'))imports.push(node.source);
    let source=result.source;
    for(const node of imports.sort((a,b)=>b.start-a.start))source=source.slice(0,node.start)+JSON.stringify('./demo-'+node.value.slice(2))+source.slice(node.end);
    await writeFile(path.join(site,'dist','demo-'+entry),source);
  }
  await writeFile(path.join(site,'_headers'),`/_demo/images/*\n  Cache-Control: public, max-age=31536000, immutable\n/_demo/media-runtime.js\n  Cache-Control: no-cache\n/dist/demo-*\n  Cache-Control: no-cache\n`);
  console.log(`静态图片 ${Object.keys(images).length} 个键；前端图片表达式 ${count} 处。`);
  return {images,count};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await buildStatic();
