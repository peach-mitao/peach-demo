import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base = process.env.BASE || 'http://127.0.0.1:8791';
const hoverOnly = process.argv.includes('--hover-only');
if (!hoverOnly) {
const full = await fetch(base + '/stream?id=1');
assert.equal(full.status, 200);
assert.equal(full.headers.get('content-type'), 'video/mp4');
const whole = Buffer.from(await full.arrayBuffer());
assert.ok(whole.length > 0);
for (const [range, start, end] of [
  ['bytes=0-99', 0, 100], [`bytes=${Math.floor(whole.length / 2)}-${Math.floor(whole.length / 2) + 99}`, Math.floor(whole.length / 2), Math.floor(whole.length / 2) + 100],
  ['bytes=-100', whole.length - 100, whole.length], ['bytes=-99999999', 0, whole.length],
]) {
  const response = await fetch(base + '/stream?id=1', {headers: {range}});
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), `bytes ${start}-${end - 1}/${whole.length}`);
  assert.ok(Buffer.from(await response.arrayBuffer()).equals(whole.subarray(start, end)));
}
assert.equal((await fetch(base + '/stream?id=1', {headers: {range: `bytes=${whole.length}-`}})).status, 416);
const head = await fetch(base + '/stream?id=1', {method: 'HEAD'});
assert.equal(head.status, 200);
assert.equal(head.headers.get('content-length'), String(whole.length));
assert.equal((await head.arrayBuffer()).byteLength, 0);
for (const [condition, status] of [[head.headers.get('etag'), 206], ['"different"', 200]]) {
  const response = await fetch(base + '/stream?id=1', {headers: {range: 'bytes=-2', 'if-range': condition}});
  assert.equal(response.status, status);
  assert.ok(Buffer.from(await response.arrayBuffer()).equals(status === 206 ? whole.subarray(-2) : whole));
}
assert.equal((await fetch(base + '/stream?id=999999')).status, 404);
console.log('PASS: 视频首段、中段、末段、超长后缀、HEAD、越界与缺失文件');
}

const browser = await chromium.launch({channel: 'chrome'});
try {
  if (!hoverOnly) for (const width of [1440, 390]) {
   for (const fallback of [false, true]) {
    const page = await browser.newPage({viewport: {width, height: width === 390 ? 844 : 900}, reducedMotion: 'reduce'});
    try {
      await page.addInitScript(() => localStorage.setItem('peach.settings.v1', JSON.stringify({detailAutoplay: false})));
      if (fallback) await page.route('**/api/timeline?**', route => route.fulfill({json: null}));
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/assets/1', {waitUntil: 'networkidle'});
      const video = page.locator('#stage video').first();
      await video.waitFor({state: 'attached'});
      await video.evaluate(async node => {node.muted = true; await node.play()});
      await page.waitForFunction(() => {
        const node = document.querySelector('#stage video');
        return node?.duration > 0 && node.videoWidth > 0 && node.currentTime > .1;
      });
      await video.evaluate(node => {node.pause(); node.currentTime = node.duration * .65});
      await page.waitForFunction(() => {
        const node = document.querySelector('#stage video');
        return !node.seeking && node.currentTime >= node.duration * .6 && node.readyState >= 2;
      });
      const progress = page.locator('.vjs-progress-control').first();
      await progress.hover({position: {x: 20, y: 5}});
      const preview = page.locator('[data-player-seek-preview]');
      await preview.waitFor({state: 'visible'});
      const image = preview.locator('img');
      await page.waitForFunction(() => {
        const image = document.querySelector('[data-player-seek-preview] img');
        return image?.complete && image.naturalWidth > 0;
      });
      assert.ok(await image.getAttribute('src'));
      assert.deepEqual(errors, []);
      console.log(`PASS: ${width}px 视频元数据、解码、跳转与${fallback ? '九宫格回退' : '时间轴'}缩略图`);
    } finally {await page.close()}
   }
  }
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  try {
    await page.addInitScript(() => localStorage.setItem('peach.settings.v1', JSON.stringify({detailAutoplay: false, homeLayout: 'big', hoverPreview: 'video'})));
    await page.goto(base + '/?loc=local', {waitUntil: 'networkidle'});
    const card = page.locator('[data-hover-mode="video"]').first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.waitForFunction(() => !window.__scrolling);
    await page.mouse.move(0, 0);
    const picture = await card.locator('[data-media-pic]').boundingBox();
    await page.mouse.move(picture.x + picture.width / 2, Math.min(850, picture.y + picture.height / 2));
    const hover = page.locator('video.hv').first();
    await hover.waitFor({state: 'attached'});
    await page.waitForFunction(() => {
      const node = document.querySelector('video.hv');
      return node?.duration > 0 && node.videoWidth > 0 && node.currentTime > .1;
    });
    await hover.evaluate(node => {node.currentTime = node.duration * .8});
    await page.waitForFunction(() => {
      const node = document.querySelector('video.hv');
      return node && !node.seeking && node.readyState >= 2;
    });
    console.log('PASS: 卡片视频预览解码与跳转');
  } finally {await page.close()}
} finally {await browser.close()}
