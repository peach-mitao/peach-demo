import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { buildStatic, staticImageExpressions } from './build_static.ts';
import { buildReplay } from './build_replay.ts';
import { DEMO_SETTINGS, FOLLOW_IMAGES, NOTICE } from '../src/page-shell.ts';
import sharp from 'sharp';
import { bundlePlayer } from './bundle_player.ts';
import { pageRoutes } from './demo_pages.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildPublic(site = path.join(root, 'site'), out = path.join(root, 'public')) {
    const resolved = path.resolve(out);
    if (resolved !== path.join(root, 'public'))
        throw Error('公开构建输出目录无效');
    await rm(resolved, { recursive: true, force: true });
    await mkdir(out, { recursive: true });
    const { images, variants, videos } = await buildStatic(site);
    const replay = await buildReplay(site, images);
    await cp(site, out, { recursive: true, filter: file => !file.endsWith('.mp4') && !file.endsWith('.map') && !/[/\\]dist[/\\]demo-/.test(file) && ![/[/\\](?:_fixtures|_media)(?:[/\\]|$)/, /[/\\]_demo[/\\]data(?:[/\\]|$)/, /[/\\]_demo[/\\]images(?:[/\\]|$)/, /[/\\]_demo[/\\](?:interactions|tour|media-runtime|copy-editor|copy-editor-core|behavior(?:-(?:core|contract|rules|version))?)\.js$/, /[/\\]_demo[/\\]assets[/\\]behavior-(?:core|contract)\.js$/].some(pattern => pattern.test(file)) });
    const generated = new Set([...Object.values(replay.files), ...Object.values(images), ...Object.values(variants).flatMap(value => Object.values(value))]);
    for (const url of generated) {
        await mkdir(path.dirname(path.join(out, url)), { recursive: true });
        await cp(path.join(site, url), path.join(out, url));
    }
    await sharp(await readFile(path.join(site, 'peach-logo.png'))).resize({ width: 256, withoutEnlargement: true }).png().toFile(path.join(out, 'peach-logo.png'));
    const assets = async (name:string, body:string|Uint8Array, extension:string) => {
        const hash = createHash('sha256').update(body).digest('hex');
        const url = `/_demo/${name}-${hash}.${extension}`;
        await writeFile(path.join(out, url), body);
        return url;
    };
    const boot = await build({ stdin: { contents: `import {browserReplay} from './src/browser-replay.ts';import {mediaURL,mediaJSON,mediaHTML} from './src/media.ts';import * as tags from './src/tag-management.ts';const images=${JSON.stringify(images)},variants=${JSON.stringify(variants)},videos=${JSON.stringify(videos)};globalThis.peachDemoTags=tags;globalThis.peachDemoMedia=v=>mediaURL(v,images,location.origin,variants,videos);globalThis.peachDemoMediaJSON=v=>mediaJSON(v,images,location.origin,variants,videos);globalThis.peachDemoHTML=v=>mediaHTML(v,images,location.origin,variants,videos);globalThis.peachDemoReplay=browserReplay(${JSON.stringify(replay.files)},window.fetch.bind(window),location.origin);`, resolveDir: root }, bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', minify: true });
    const runtime = await assets('runtime', boot.outputFiles[0].contents, 'js');
    const interaction = await assets('interactions', await readFile(path.join(site, '_demo/interactions.js')), 'js');
    const tour = await assets('tour', await readFile(path.join(site, '_demo/tour.js')), 'js');
    const editorCore = await assets('copy-editor-core', await readFile(path.join(site, '_demo/copy-editor-core.js')), 'js');
    const editor = await assets('copy-editor', await readFile(path.join(site, '_demo/copy-editor.js')), 'js');
    const behaviorBuild=await build({entryPoints:[path.join(root,'browser/behavior.ts')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',minify:true});
    const behavior=await assets('behavior',behaviorBuild.outputFiles[0].contents,'js');
    const tourGate = `<script>if(new URLSearchParams(location.search).has('tour'))document.write('<script src="${tour}"><'+ '/script>')</script>`;
    const editorGate = `<script>if(new URLSearchParams(location.search).has('edit')){document.body.dataset.peachCopyMode='local';document.write('<script defer src="${editorCore}"><'+ '/script><script defer src="${editor}"><'+ '/script>')}</script>`;
    const player = await bundlePlayer(await readFile(path.join(site, 'dist/peach-app.js'), 'utf8'), site, out);
    const app = await build({ entryPoints: [path.join(site, 'dist/peach-app.js')], outdir: path.join(out, 'dist'), bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, entryNames: 'demo-[name]-[hash]', chunkNames: 'demo-chunk-[hash]', external: ['/dist/demo-video-*'], metafile: true, plugins: [{ name: 'demo-media', setup(builder) { builder.onLoad({ filter: /\.js$/ }, async (args) => ({ contents: player.rewrite(staticImageExpressions(await readFile(args.path, 'utf8')).source), loader: 'js' })); } }] });
    const appOutput = Object.entries(app.metafile.outputs).find(([, info]) => info.entryPoint && path.resolve(info.entryPoint) === path.join(site, 'dist/peach-app.js'))?.[0];
    if (!appOutput)
        throw Error('应用入口构建未取得');
    const appURL = '/' + path.relative(out, path.resolve(appOutput)).split(path.sep).join('/');
    const decorate = (html:string) => html.replace('</head>', DEMO_SETTINGS + FOLLOW_IMAGES + `<script src="${runtime}"></script><script src="${interaction}"></script>` + tourGate + '</head>').replace('src="/dist/peach-app.js"', `src="${appURL}"`).replace('</body>', NOTICE + editorGate + `<script defer src="${behavior}"></script></body>`);
    await writeFile(path.join(out, 'index.html'), decorate(await readFile(path.join(site, 'index.html'), 'utf8')));
    const entry = JSON.parse(await readFile(path.join(site, '_fixtures/entry-pages.json'), 'utf8'));
    for (const route of ['login', 'setup'] as const) {
        await mkdir(path.join(out, route), { recursive: true });
        await writeFile(path.join(out, route, 'index.html'), decorate(entry[route]));
    }
    await mkdir(path.join(out, 'integrations/peach-userscript-bridge'), { recursive: true });
    await writeFile(path.join(out, 'integrations/peach-userscript-bridge/index.html'), entry.userscript_bridge.html);
    const bridgeHeaders = Object.entries(entry.userscript_bridge.headers).filter(([key]) => !['content-type', 'content-length'].includes(key.toLowerCase())).map(([key, value]) => `  ${key}: ${value}`).join('\n');
    const immutable = ['/_demo/images/*', '/_demo/data/*', '/_demo/runtime-*', '/_demo/interactions-*', '/_demo/tour-*', '/_demo/copy-editor-*', '/_demo/behavior-*', '/dist/demo-*'].map(rule => `${rule}\n  Cache-Control: public, max-age=31536000, immutable`).join('\n');
    await writeFile(path.join(out, '_headers'), `/*\n  X-Robots-Tag: noindex, nofollow\n/\n  Cache-Control: no-cache\n/_demo/replay-files.json\n  Cache-Control: no-cache\n${immutable}\n/vendor/*\n  Cache-Control: public, max-age=86400\n/integrations/peach-userscript-bridge*\n${bridgeHeaders}\n`);
    const routes = [...new Set(pageRoutes.map(route => route.split('?')[0]))].filter(route => !['/', '/login', '/setup'].includes(route));
    await writeFile(path.join(out, '_redirects'), [...routes, ...['performers', 'creators', 'studios', 'agencies', 'tags', 'series', 'assets', 'works', 'posts'].map(prefix => '/' + prefix + '/:id')].map(route => `${route} / 200`).join('\n') + '\n');
    const report = { version: 1, runtime, interaction, appURL, playerURL: player.url, replayFixtures: replay.fixtures, images: Object.keys(images).length, variants: Object.keys(variants).length, videos: Object.keys(videos).length };
    await mkdir(path.join(root, 'evidence'), { recursive: true });
    await writeFile(path.join(root, 'evidence/public-build.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
    return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
    await buildPublic();
