import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { publicMovies } from '../src/public-movies.ts';
const base = process.env.BASE || 'http://127.0.0.1:8791';
const out = new URL('../evidence/v043/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' }), report = [];
async function visibleImages(page: Page) {
    return page.evaluate(async () => {
        const targets = Array.from(document.images).filter(img => img.checkVisibility() && img.getBoundingClientRect().width > 0);
        const images = await new Promise<HTMLImageElement[]>(resolve => {
            if (!targets.length) {
                resolve([]);
                return;
            }
            const observer = new IntersectionObserver(entries => { observer.disconnect(); resolve(entries.filter(entry => entry.isIntersecting).map(entry => entry.target as HTMLImageElement)); });
            targets.forEach(img => observer.observe(img));
        });
        let timeout;
        try {
            await Promise.race([Promise.all(images.map((img: { decode: () => Promise<any>; currentSrc: any; }) => img.decode().catch((error: any) => { throw Error(`图片解码失败：${img.currentSrc}`, { cause: error }); }))), new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('可见图片解码超时')), 10000); })]);
        }
        finally {
            clearTimeout(timeout);
        }
        return images.map(img => ({ src: img.currentSrc, naturalWidth: img.naturalWidth, width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height }));
    });
}
const movies = publicMovies(), performer = movies.indexes.performers.items[0]!;
const routes = [['home', '/'], ['people', '/performers'], ['profile', '/performers/' + performer.entity_id],
    ['follow', '/follow?media=images'], ['stats', '/stats'], ['feeds', '/subscriptions?tab=feeds'],
    ['follow-table', '/subscriptions?tab=list'], ['data', '/data-cleanup'], ['player', '/assets/1']];
try {
    for (const width of [1440, 390] as const)
        for (const dpr of [1, 2] as const) {
            const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 960 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
            await context.addInitScript(() => localStorage.setItem('peach.settings.v1', JSON.stringify({ detailAutoplay: false, followLayout: 'table' })));
            const page = await context.newPage(), errors: string[] = [], failed: Record<string,any>[] = [], writes: string[] = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('response', r => { if (r.status() >= 400)
                failed.push({ status: r.status(), url: r.url() }); });
            page.on('request', r => { if (r.method() === 'POST' && /\/api\/(library-processing|play|activity)(?:\?|$)/.test(r.url()))
                writes.push(r.url()); });
            for (const [name, path] of routes) {
                await page.goto(base + path, { waitUntil: 'networkidle' });
                await page.waitForFunction(() => document.body.innerText.length > 100);
                await page.waitForFunction(() => !Array.from((document.querySelectorAll('[data-skeleton]') as NodeListOf<HTMLElement>)).some(e => e.getBoundingClientRect().height > 0));
                const images = await visibleImages(page);
                const state: {overflow:boolean;text:string;images?:{naturalWidth:number}[]} = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
                    text: document.body.innerText.slice(0, 7000) }));
                state.images = images;
                assert.equal(state.overflow, false, `${name} ${width}/${dpr} 横向溢出`);
                assert.ok(state.text?.length > 10, `${name} 内容未取得`);
                assert.ok(state.images!.every((img: { naturalWidth: number; }) => img.naturalWidth > 0), `${name} 可见图片加载失败`);
                if (name === 'home') {
                    const visible = await page.evaluate(async () => (await (await fetch('/api/items?loc=local%2C115&limit=1000')).json()).total);
                    assert.equal(visible, movies.catalog.items.length, '默认来源包含完整电影馆藏');
                }
                if (name === 'data') {
                    assert.ok(await page.getByRole('button', { name: '同步媒体库', exact: true }).count());
                    const links = page.locator('#link-manager');
                    if (await links.count()) {
                        await links.scrollIntoViewIfNeeded();
                        await visibleImages(page);
                    }
                }
                if (name === 'feeds')
                    assert.ok(state.text.includes(performer.k), '订阅列表包含普通电影演员样本');
                if (name === 'follow-table')
                    assert.ok(state.text.includes(movies.indexes.onlineAuthors.items[0]!.k), '关注列表包含真实导演');
                if (name === 'player') {
                    const button = page.getByRole('button', { name: /^标记精彩片段\s+\d+$/ });
                    const initial = await page.evaluate(async () => await (await fetch('/api/item?id=1')).json());
                    await button.click();
                    await page.waitForFunction(count => (document.querySelector('#oCount') as HTMLElement)?.textContent === String(count), initial.o_count + 1);
                    await page.getByRole('button', { name: '撤销', exact: true }).last().click();
                    await page.waitForFunction(count => (document.querySelector('#oCount') as HTMLElement)?.textContent === String(count), initial.o_count);
                }
                if (dpr === 2)
                    await page.screenshot({ path: fileURLToPath(new URL(`${name}-${width}.png`, out)) });
                report.push({ name, width, dpr, ...state, errors: [...errors], failed: [...failed] });
            }
            await page.goto(base + '/data-cleanup', { waitUntil: 'networkidle' });
            const start = page.getByRole('button', { name: '同步媒体库', exact: true });
            await start.scrollIntoViewIfNeeded();
            await page.waitForFunction(() => { const button = Array.from((document.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)).find(e => e.textContent.trim() === '同步媒体库'); if (!button)
                return false; const r = button.getBoundingClientRect(); return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); });
            await start.click();
            const dialog = page.getByRole('dialog', { name: '同步媒体库', exact: true });
            await dialog.getByRole('region', { name: '磁盘预估', exact: true }).waitFor();
            const slider = dialog.getByRole('slider');
            await slider.focus();
            await slider.press('Home');
            await slider.press('Tab');
            assert.doesNotMatch(await dialog.innerText(), /流量预估未取得/);
            await dialog.getByRole('button', { name: '同步媒体库', exact: true }).click();
            const controls = page.locator('[data-processing-controls]').first();
            await controls.getByRole('button', { name: '处理速度：低占用', exact: true }).waitFor();
            await controls.getByRole('button', { name: '暂停', exact: true }).click();
            await controls.getByRole('button', { name: '继续', exact: true }).waitFor();
            assert.equal(await page.evaluate(async () => (await (await fetch('/api/library-processing')).json()).status), 'paused');
            await controls.getByRole('button', { name: '继续', exact: true }).click();
            await controls.getByRole('button', { name: '暂停', exact: true }).waitFor();
            await page.reload({ waitUntil: 'networkidle' });
            assert.equal(await page.evaluate(async () => (await (await fetch('/api/library-processing')).json()).status), 'complete');
            assert.deepEqual(errors, []);
            assert.deepEqual(failed, []);
            assert.deepEqual(writes, [], '扫描操作与行为上报在当前页面处理');
            report.push({ width, dpr, processingControls: true, refreshReset: true, noProcessingRequests: true });
            console.log(JSON.stringify({ width, dpr, routes: routes.length, processingControls: true, errors, failed }));
            await context.close();
        }
    const context = await browser.newContext();
    for (const path of ['/_fixtures/manifest.json', '/_media/1.mp4'] as const)
        assert.equal((await context.request.get(base + path)).status(), 404);
    const range = await context.request.get(base + '/stream?id=1', { headers: { Range: 'bytes=0-99' } });
    assert.equal(range.status(), 403);
    assert.deepEqual(await range.json(), { demo: true, message: '仅提供演示' });
    await context.close();
}
finally {
    await writeFile(new URL('browser-report.json', out), JSON.stringify({ base, report }, null, 2));
    await browser.close();
}
