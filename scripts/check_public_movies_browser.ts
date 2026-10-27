import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { FILMS, PEOPLE } from '../src/public-movies.ts';
const base = process.env.BASE || 'http://127.0.0.1:58891';
const out = new URL('../evidence/public-movies/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
try {
    for (const width of [1440, 390]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 960 }, reducedMotion: 'reduce' });
        const page = await context.newPage(), errors: string[] = [], media: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (request.resourceType() === 'media' || /(?:\/stream(?:\?|$)|\/follow-stream(?:\?|$)|\.mp4(?:\?|$))/.test(request.url())) media.push(request.url()); });
        await page.goto(base + '/?sort=release&dir=desc', { waitUntil: 'networkidle' });
        await page.locator('[aria-label="打开 FILM-001 Big Buck Bunny详情"]').waitFor();
        assert.equal(await page.locator('[aria-label="进入播放墙"]').count(), 1);
        assert.equal(await page.locator('[aria-label="进入沉浸模式"]').count(), 1);
        await page.screenshot({ path: fileURLToPath(new URL(`home-${width}.png`, out)), animations: 'disabled' });
        await page.goto(base + '/assets/1', { waitUntil: 'networkidle' });
        await page.locator('dialog[open] video').first().waitFor();
        const video = page.locator('dialog[open] video').first();
        const state = await video.evaluate(video => ({ src: (video as HTMLVideoElement).currentSrc, poster: (video as HTMLVideoElement).poster, paused: (video as HTMLVideoElement).paused }));
        assert.equal(state.src, ''); assert.equal(state.paused, true); assert.match(state.poster, /\/_demo\/images\//);
        await page.getByRole('button', { name: /^(播放|Play|Play Video)$/ }).first().click();
        assert.equal(await page.locator('[data-demo-playback-notice]').textContent(), '仅提供演示');
        assert.equal(await video.evaluate(video => (video as HTMLVideoElement).paused), true);
        assert.equal(await page.locator('[data-stage-action="later"]').count(), 1);
        assert.ok(await page.getByRole('button', { name: /精彩片段/ }).count());
        await page.screenshot({ path: fileURLToPath(new URL(`detail-${width}.png`, out)), animations: 'disabled' });
        await page.goto(base + '/film-sources/', { waitUntil: 'networkidle' });
        assert.equal(await page.getByRole('heading', { level: 2 }).count(), FILMS.length + PEOPLE.length);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.goto(base + '/?edit', { waitUntil: 'networkidle' });
        await page.locator('[data-copy-bar]').waitFor();
        assert.match(await page.locator('[data-copy-bar]').innerText(), /改字模式/);
        assert.deepEqual(media, []);
        assert.deepEqual(errors, []);
        report.push({ width, cover: state.poster, controls: true, prompt: '仅提供演示', videoRequests: media.length, sources: FILMS.length + PEOPLE.length, errors });
        await context.close();
        console.log(`PASS ${width}：普通电影封面、详情、播放提示、来源和编辑预览，无视频请求`);
    }
} finally { await browser.close(); await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2)); }
