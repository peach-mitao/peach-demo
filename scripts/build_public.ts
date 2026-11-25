import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { buildStatic, staticImageExpressions } from './build_static.ts';
import { buildReplay } from './build_replay.ts';
import { DEMO_SETTINGS, NOTICE } from '../src/page-shell.ts';
import sharp from 'sharp';
import { bundlePlayer } from './bundle_player.ts';
import { pageRoutes } from './demo_pages.ts';
import { englishEditorCopy, localizeDemoScript, movieHTML, movieScript } from './public_copy.ts';
import { verifyPublicMovies } from './prepare_public_movies.ts';
import { FILMS, PEOPLE, DEMO_DATA_NOTICE, STUDIOS } from '../src/public-movies.ts';
import { MOVIE_RIGHTS } from '../src/movie-rights.ts';
import { englishCatalog, englishInteractionCopy, originalEntityNames } from './catalog_names.ts';
import { catalogName } from '../src/catalog-language.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildPublic(site = path.join(root, 'site'), out = path.join(root, 'public')) {
    await verifyPublicMovies(site);
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
    await sharp(await readFile(path.join(site, 'peach-logo.png'))).resize({ width: 64, withoutEnlargement: true }).png().toFile(path.join(out, 'peach-logo-64.png'));
    await sharp(await readFile(path.join(site, 'peach-logo.png'))).resize({ width: 128, withoutEnlargement: true }).png().toFile(path.join(out, 'peach-logo-128.png'));
    const assets = async (name:string, body:string|Uint8Array, extension:string) => {
        const hash = createHash('sha256').update(body).digest('hex');
        const url = `/_demo/${name}-${hash}.${extension}`;
        await writeFile(path.join(out, url), body);
        return url;
    };
    await writeFile(path.join(out, '_demo/catalog-original-names.json'), JSON.stringify(originalEntityNames));
    const boot = await build({ stdin: { contents: `
        import {installDemoPlayback} from './src/demo-playback.ts';
        import {browserReplay} from './src/browser-replay.ts';
        import {originalCatalogURL} from './src/catalog-language.ts';
        import {mediaURL,mediaJSON,mediaHTML} from './src/media.ts';
        import * as tags from './src/tag-management.ts';
        installDemoPlayback(window);
        const images=${JSON.stringify(images)},variants=${JSON.stringify(variants)},videos=${JSON.stringify(videos)};
        const originalNames=${JSON.stringify(originalEntityNames)};
        globalThis.peachDemoTags=tags;
        globalThis.peachDemoMedia=v=>{
            if (typeof v !== 'string' || !v.startsWith('/')) return v;
            const url=new URL(v,location.origin);
            const original=originalCatalogURL(url,originalNames);
            return mediaURL(original===url?v:original.pathname+original.search,images,location.origin,variants,videos);
        };
        globalThis.peachDemoMediaJSON=v=>mediaJSON(v,images,location.origin,variants,videos);
        globalThis.peachDemoHTML=v=>mediaHTML(v,images,location.origin,variants,videos);
        const files=${JSON.stringify(replay.files)}, network=window.fetch.bind(window);
        const local=browserReplay(files,network,location.origin,{originalNames});
        const english=browserReplay(files,network,location.origin,{names:${JSON.stringify(englishCatalog)},originalNames});
        globalThis.peachDemoReplay=request=>(document.documentElement.lang==='en'?english:local)(request);
    `, resolveDir: root }, bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', minify: true });
    const runtime = await assets('runtime', boot.outputFiles[0].contents, 'js');
    const interaction = await assets('interactions', localizeDemoScript(await readFile(path.join(site, '_demo/interactions.js'), 'utf8'), englishInteractionCopy), 'js');
    const tour = await assets('tour', await readFile(path.join(site, '_demo/tour.js')), 'js');
    const editorAsset = async (name: string) =>
        assets(name, localizeDemoScript(await readFile(path.join(site, `_demo/${name}.js`), 'utf8'), englishEditorCopy), 'js');
    const editorCore = await editorAsset('copy-editor-core');
    const editor = await editorAsset('copy-editor');
    const editorUI = await editorAsset('edit-toolbar');
    const behaviorBuild=await build({entryPoints:[path.join(root,'browser/behavior.ts')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',minify:true});
    const behavior=await assets('behavior',behaviorBuild.outputFiles[0].contents,'js');
    const tourGate = `<script>if(new URLSearchParams(location.search).has('tour'))document.write('<script src="${tour}"><'+ '/script>')</script>`;
    const editorGate = `<script>if(new URLSearchParams(location.search).has('edit')){document.body.dataset.peachCopyMode='local';document.write('<script defer src="${editorCore}"><'+ '/script><script defer src="${editorUI}"><'+ '/script><script defer src="${editor}"><'+ '/script>')}</script>`;
    await writeFile(path.join(out,'404.html'),(await readFile(path.join(site,'404.html'),'utf8')).replace('</body>',editorGate+'</body>'));
    const player = await bundlePlayer(await readFile(path.join(site, 'dist/peach-app.js'), 'utf8'), site, out);
    const app = await build({ entryPoints: [path.join(site, 'dist/peach-app.js')], outdir: path.join(out, 'dist'), bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, entryNames: 'demo-[name]-[hash]', chunkNames: 'demo-chunk-[hash]', external: ['/dist/demo-video-*'], metafile: true, plugins: [{ name: 'demo-media', setup(builder) { builder.onLoad({ filter: /\.js$/ }, async (args) => ({ contents: movieScript(player.rewrite(staticImageExpressions(await readFile(args.path, 'utf8')).source)), loader: 'js' })); } }] });
    const appOutput = Object.entries(app.metafile.outputs).find(([, info]) => info.entryPoint && path.resolve(info.entryPoint) === path.join(site, 'dist/peach-app.js'))?.[0];
    if (!appOutput)
        throw Error('应用入口构建未取得');
    const appURL = '/' + path.relative(out, path.resolve(appOutput)).split(path.sep).join('/');
    const decorate = (html:string) => movieHTML(html).replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="media-src \'none\'">').replace('</head>', DEMO_SETTINGS + `<script src="${runtime}"></script><script src="${interaction}"></script>` + tourGate + '</head>').replace('src="/dist/peach-app.js"', `src="${appURL}"`).replace('</body>', NOTICE + editorGate + `<script defer src="${behavior}"></script></body>`);
    const rights = [...FILMS.map(film => ({ ...film.poster, ...MOVIE_RIGHTS[film.slug], title: film.title, kind: '电影图片' })), ...PEOPLE.map(person => ({ ...person.portrait, title: person.name, kind: '人物肖像' })), ...STUDIOS.map(studio => ({ ...studio.logo, title: studio.name, kind: '厂牌标识' }))];
    const escape = (value: unknown) => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
    await mkdir(path.join(out, 'film-sources'), { recursive: true });
    await writeFile(path.join(out, 'film-sources.json'), JSON.stringify({ notice: DEMO_DATA_NOTICE, images: '官方电影代表图；按容器缩放或裁切显示。', films: rights }, null, 2));
    await writeFile(path.join(out, 'film-sources/index.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>素材来源与许可 · Peach</title><link rel="stylesheet" href="/app.css"><style>body{margin:0;padding:clamp(20px,5vw,64px);font:16px/1.7 system-ui;background:var(--ground,#fff);color:var(--ink,#222)}main{max-width:760px;margin:auto}article{padding:24px 0;border-bottom:1px solid var(--border-15,#8884)}h1{font-size:28px}h2{font-size:20px}a{color:inherit;text-decoration:underline}p{overflow-wrap:anywhere}</style></head><body><main><a href="/">返回演示站</a><h1>素材来源与许可</h1><p>${escape(DEMO_DATA_NOTICE)}</p><p>图片来自 Blender 与 Wikimedia Commons，按容器缩放或裁切。播放入口仅提供演示，不加载视频。Public domain 的具体依据见各图片的原始文件页。</p>${rights.map(item => `<article><h2>${escape(item.title)}</h2><p>${escape(item.kind)} · ${escape(item.attribution || item.artist)}</p><p><a href="${escape(item.source)}">原始来源</a> · <a href="${escape(item.license_url)}">${escape(item.license)}</a> · <a href="${escape(item.license_source || item.source)}">许可依据</a></p><p>${escape(item.changes)}</p></article>`).join('')}</main>${editorGate}</body></html>`);
    const sourcePage = await readFile(path.join(out, 'film-sources/index.html'), 'utf8');
    const englishSources = sourcePage.replace('lang="zh-CN"', 'lang="en"')
        .replaceAll('素材来源与许可', 'Sources and licenses').replace('返回演示站', 'Back to the demo')
        .replace(escape(DEMO_DATA_NOTICE), 'Film and image credits are listed below. Catalog codes, file details, ratings, viewing, follows and task statuses are sample data.')
        .replace('图片来自 Blender 与 Wikimedia Commons，按容器缩放或裁切。播放入口仅提供演示，不加载视频。Public domain 的具体依据见各图片的原始文件页。', 'Images from Blender and Wikimedia Commons are resized or cropped to fit. Playback controls demonstrate the interface. See the original file pages for the basis of each public domain designation.')
        .replaceAll('>电影图片 · ', '>Film image · ').replaceAll('>人物肖像 · ', '>Portrait · ').replaceAll('>厂牌标识 · ', '>Studio logo · ')
        .replaceAll('>原始来源<', '>Original source<').replaceAll('>许可依据<', '>License details<')
        .replace(/<h2>(.*?)<\/h2>/g, (heading, title) => {
            const item = rights.find(row => escape(row.title) === title);
            return item ? `<h2>${escape(catalogName(englishCatalog, item.title))}</h2>` : heading;
        })
        .replaceAll('页面按容器缩放或裁切。', 'Resized or cropped to fit.')
        .replaceAll('从顶部裁成正方形后缩放至240像素宽并转换为WebP；头像按圆形容器裁切。', 'Cropped to a square from the top, resized to 240 pixels wide, and converted to WebP. Portraits use a circular crop.')
        .replaceAll('缩放至240像素宽并转换为WebP；头像按圆形容器裁切。', 'Resized to 240 pixels wide and converted to WebP. Portraits use a circular crop.')
        .replaceAll('缩放至480像素宽并转换为WebP；页面按容器裁切。', 'Resized to 480 pixels wide and converted to WebP. Displayed cropped to fit.')
        .replaceAll('按 Peach 应用的厂牌图标规则烤成不透明方图，缩放至480像素宽并转换为WebP；按容器缩放显示。', 'Rendered as an opaque square, resized to 480 pixels wide and converted to WebP.')
        .replaceAll(' · 未署名', ' · Uncredited');
    await mkdir(path.join(out, 'film-sources/en'), { recursive: true });
    await writeFile(path.join(out, 'film-sources/en/index.html'), englishSources);
    await writeFile(path.join(out, 'index.html'), decorate(await readFile(path.join(site, 'index.html'), 'utf8')));
    const entry = JSON.parse(await readFile(path.join(site, '_fixtures/entry-pages.json'), 'utf8'));
    for (const route of ['login', 'setup'] as const) {
        await mkdir(path.join(out, route), { recursive: true });
        const englishTitle = entry[`${route}_en`]?.match(/<title>([^<]+)<\/title>/)?.[1];
        const page = englishTitle ? entry[route].replace('<html ', `<html data-demo-title-en="${escape(englishTitle)}" `) : entry[route];
        await writeFile(path.join(out, route, 'index.html'), decorate(page));
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
