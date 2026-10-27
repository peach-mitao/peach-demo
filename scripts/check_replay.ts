import assert from 'node:assert/strict';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.BASE || 'http://127.0.0.1:8791';
const report = [];
const browser = await chromium.launch({ channel: 'chrome' });
try {
    for (const width of [1440, 390] as const) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 960 }, reducedMotion: 'reduce' });
        await context.addInitScript(() => localStorage.setItem('peach.settings.v1', JSON.stringify({ detailAutoplay: false, uiSounds: false })));
        const page = await context.newPage(), requests: string[] = [], errors: string[] = [];
        page.on('request', request => { if (new URL(request.url()).origin === base)
            requests.push(new URL(request.url()).pathname); });
        page.on('pageerror', error => errors.push((error instanceof Error ? error.message : String(error))));
        page.on('console', message => { if (message.type() === 'error' && message.text().startsWith('Peach replay missing:'))
            errors.push(message.text()); });
        for (const route of ['/', '/?q=ABW', '/follow?media=images'] as const) {
            requests.length = 0;
            errors.length = 0;
            await page.goto(base + route, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => ![...(document.querySelectorAll('[data-skeleton],[aria-busy="true"]') as NodeListOf<HTMLElement>)].some(node => node.checkVisibility() && node.getBoundingClientRect().bottom > 0 && node.getBoundingClientRect().top < innerHeight), undefined, { timeout: 15000 });
            const first = [...requests], before = requests.length;
            if (route === '/')
                await page.waitForTimeout(60000);
            const networkApis = first.filter((path) => path.startsWith('/api/') || path === '/healthz');
            const state = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, images: [...document.images].filter(img => img.checkVisibility() && img.complete && !img.naturalWidth).map(img => img.src), resources: (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map(r => ({ name: new URL(r.name, location.href).pathname, transfer: r.transferSize, encoded: r.encodedBodySize })) }));
            report.push({ width, route, networkApis, idleRequests: requests.slice(before), ...state, errors: [...errors] });
            assert.deepEqual(networkApis, [], `${width}px ${route} API 网络请求`);
            assert.deepEqual(requests.slice(before), [], `${width}px ${route} 静置网络请求`);
            assert.deepEqual(errors, []);
            assert.deepEqual(state.images, []);
            assert.equal(state.overflow, false);
            console.log(`PASS: ${width}px ${route} 浏览器回放与静置请求`);
        }
        await context.close();
    }
    for (const path of ['/_fixtures/manifest.json', '/_media/index.json', '/_fixtures', '/_media'] as const)
        assert.equal((await fetch(base + path)).status, 404, path);
    const assets = JSON.parse(await readFile(new URL('../evidence/public-build.json', import.meta.url), 'utf8'));
    for (const path of [assets.runtime, assets.appURL, assets.playerURL] as const) {
        const response = await fetch(base + path, { method: 'HEAD' });
        assert.equal(response.status, 200);
        assert.match(response.headers.get('cache-control')!, /max-age=31536000, immutable/);
        assert.doesNotMatch(response.headers.get('cache-control')!, /no-cache/);
        assert.equal((await fetch(base + path, { headers: { 'if-none-match': response.headers.get('etag')! } })).status, 304);
    }
    for (const path of ['/_demo/images/missing.webp', '/_demo/data/missing.json', '/dist/demo-missing.js'] as const) {
        const response = await fetch(base + path);
        assert.equal(response.status, 404);
        assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    console.log('PASS: 私有目录返回 404');
}
finally {
    await mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
    await writeFile(new URL('../evidence/browser-replay.json', import.meta.url), JSON.stringify(report, null, 2));
    await browser.close();
}
