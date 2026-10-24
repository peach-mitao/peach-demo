import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
test('播放入口显示提示并保留控件，媒体赋值和程序播放均不请求视频', async () => {
    const bundle = await build({ stdin: { contents: 'import {installDemoPlayback} from "./src/demo-playback.ts";installDemoPlayback(window);', resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, bundle: true, write: false, platform: 'browser', format: 'iife' });
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const requests: string[] = [];
        page.on('request', request => requests.push(request.url()));
        await page.setContent('<dialog open><video controls poster="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E"></video><button aria-label="播放">播放</button><button aria-label="关闭">关闭</button></dialog>');
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        const result = await page.evaluate(async () => {
            const video = document.querySelector('video')!;
            video.src = 'https://media.example/forbidden.mp4';
            video.setAttribute('src', 'https://media.example/forbidden-attribute.mp4');
            video.autoplay = true;
            const source = document.createElement('source');
            source.src = 'https://media.example/forbidden-source.mp4';
            source.setAttribute('src', 'https://media.example/forbidden-source-attribute.mp4');
            video.append(source);
            video.load(); await video.play();
            return { src: video.src, attribute: video.getAttribute('src'), source: source.src, sourceAttribute: source.getAttribute('src'), paused: video.paused, time: video.currentTime, controls: video.controls, autoplay: video.autoplay, poster: video.poster };
        });
        assert.equal(result.src, ''); assert.equal(result.source, '');
        assert.equal(result.attribute, null); assert.equal(result.sourceAttribute, null);
        assert.equal(result.paused, true); assert.equal(result.time, 0); assert.equal(result.controls, true);
        assert.equal(result.autoplay, false); assert.match(result.poster, /^data:image/);
        await page.getByRole('button', { name: '播放', exact: true }).click();
        assert.equal(await page.locator('[data-demo-playback-notice]').textContent(), '仅提供演示');
        assert.equal(await page.locator('dialog [data-demo-playback-notice]').count(), 1);
        assert.equal(await page.getByRole('button').count(), 2);
        assert.deepEqual(requests.filter(url => /^https?:/.test(url)), []);
    } finally { await browser.close(); }
});
