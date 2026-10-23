import type {AnyNode} from 'acorn';
import {children,isNode} from './ast.ts';
import type {FixtureManifest} from '../src/types.ts';
// 从本地录制图片生成公开静态副本；JSON、原始清单和视频保留在私有回放目录。
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { parse } from 'acorn';
import sharp from 'sharp';
import { IMAGE_PATHS, IMAGE_EXTENSIONS } from '../src/media.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const MEDIA_EXPRESSIONS = new Set([...IMAGE_PATHS, '/stream']);
function prefix(node?: AnyNode | null | undefined): string {
    if (!node)
        return '';
    if (node.type === 'Literal' && typeof node.value === 'string')
        return node.value;
    if (node.type === 'TemplateLiteral')
        return node.quasis[0].value.cooked||'';
    if (node.type === 'BinaryExpression' && node.operator === '+')
        return prefix(node.left);
    return '';
}
export function staticImageExpressions(source: string) {
    const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }), ranges: [number,number,string][] = [], versionHelpers: Set<string> = new Set();
    function findVersions(node: AnyNode) {
        const fn = node.type === 'VariableDeclarator' && node.id.type === 'Identifier' ? node.init : null;
        const body=fn?.type==='ArrowFunctionExpression'?fn.body:null;
        if (node.type==='VariableDeclarator'&&node.id.type==='Identifier'&&fn?.type === 'ArrowFunctionExpression' && body?.type === 'ConditionalExpression' && fn.params[0]?.type === 'Identifier' && body.alternate.type === 'Identifier' && body.alternate.name === fn.params[0].name && body.consequent.type === 'TemplateLiteral' && body.consequent.quasis[1]?.value.cooked === '&v=')
            versionHelpers.add(node.id.name);
        children(node).forEach(findVersions);
    }
    findVersions(tree);
    function visit(node: AnyNode) {
        if (!node || typeof node !== 'object')
            return;
        if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&!node.callee.computed&&node.callee.object.type==='Identifier'&&node.callee.object.name==='document'&&node.callee.property.type==='Identifier'&&node.callee.property.name==='createElement'&&node.arguments.length===1&&node.arguments[0]?.type==='Literal'&&node.arguments[0].value==='video'){
            ranges.push([node.start,node.end,'video']);
            return;
        }
        if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && versionHelpers.has(node.callee.name) && MEDIA_EXPRESSIONS.has(prefix(node.arguments[0]).split('?')[0])) {
            ranges.push([node.start, node.end, 'peachDemoMedia']);
            return;
        }
        const start = prefix(node);
        const html = node.type === 'TemplateLiteral' ? node.quasis.map((part) => part.value.cooked).join('') : node.type === 'Literal' && typeof node.value === 'string' ? node.value : '';
        if (/<(?:img|source|video)\b[^>]*\b(?:src|poster)=["']\/(?:[^"'<>]*\?)/i.test(html)) {
            ranges.push([node.start, node.end, 'peachDemoHTML']);
            return;
        }
        if (start.includes('?') && MEDIA_EXPRESSIONS.has(start.split('?')[0])) {
            ranges.push([node.start, node.end, 'peachDemoMedia']);
            return;
        }
        children(node).forEach(visit);
    }
    visit(tree);
    for (const [start, end, helper] of ranges.sort((a, b) => b[0] - a[0]))
        source = source.slice(0, start) + (helper==='video'?`Object.assign(${source.slice(start,end)},{crossOrigin:"anonymous"})`:`globalThis.${helper}(${source.slice(start,end)})`) + source.slice(end);
    return { source, count: ranges.length };
}
export async function buildStatic(site = path.join(root, 'site')) {
    // 内容指纹同时用作不可变 R2 对象键，编号清单仅供 Worker 查询。
    const media = path.join(site, '_media'), videos: Record<string,{key:string;size:number}> = {};
    await mkdir(media, { recursive: true });
    for (const entry of await readdir(media, { withFileTypes: true })) {
        if (entry.isFile() && /^\d+\.mp4$/.test(entry.name)) {
            const body = await readFile(path.join(media, entry.name));
            if (!body.length)
                throw Error(`演示视频为空：${entry.name}`);
            const hash = createHash('sha256').update(body).digest('hex');
            videos[entry.name.slice(0, -4)] = { key: `demo/videos/${hash}.mp4`, size: body.length };
        }
    }
    await writeFile(path.join(media, 'index.json'), JSON.stringify({ version: 1, videos }));
    const manifest: FixtureManifest = JSON.parse(await readFile(path.join(site, '_fixtures/manifest.json'), 'utf8'));
    const images: Record<string,string> = {}, variants: Record<string,Record<string,string>> = {}, out = path.join(site, '_demo/images');
    await mkdir(out, { recursive: true });
    for (const [key, ext] of Object.entries(manifest.fixtures)) {
        if (!IMAGE_EXTENSIONS.has(ext))
            continue;
        if (!/^[a-f0-9]{20}$/.test(key))
            throw Error('录制图片键格式无效');
        const source = path.join(site, `_fixtures/${key}.${ext}`), body = await readFile(source);
        const name = createHash('sha256').update(body).digest('hex') + '.' + ext;
        await copyFile(source, path.join(out, name));
        images[key] = `/_demo/images/${name}`;
        if (['jpg', 'png', 'webp', 'avif'].includes(ext)) {
            const metadata = await sharp(body).metadata();
            if (!metadata.pages || metadata.pages === 1)
                for (const width of [384, 960] as const)
                    if (metadata.width > width) {
                        const resized = await sharp(body).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
                        if (resized.length >= body.length)
                            continue;
                        const small = createHash('sha256').update(resized).digest('hex') + '.webp';
                        await writeFile(path.join(out, small), resized);
                        (variants[images[key]] ??= {})[width] = `/_demo/images/${small}`;
                    }
        }
    }
    for (const [alias, key] of Object.entries(manifest.alias || {}))
        if (images[key])
            images[alias] = images[key];
    const follow = path.join(site, '_demo/follow');
    for (const entry of await readdir(follow, { withFileTypes: true }).catch(error => { if ((error as {code?:string}).code === 'ENOENT')
        return []; throw error; })) {
        if (!entry.isFile() || !/\.(jpg|jpeg|png|webp)$/.test(entry.name))
            continue;
        const body = await sharp(await readFile(path.join(follow, entry.name))).rotate().resize({ width: 384, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        const name = createHash('sha256').update(body).digest('hex') + '.webp';
        await writeFile(path.join(out, name), body);
        images['/_demo/follow/' + entry.name] = `/_demo/images/${name}`;
    }
    console.log(`静态图片 ${Object.keys(images).length} 个键；缩略图 ${Object.keys(variants).length} 组。`);
    return { images, variants, videos };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
    await buildStatic();
