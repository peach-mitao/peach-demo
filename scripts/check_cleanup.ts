import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.BASE || 'http://127.0.0.1:8791';
const out = new URL('../evidence/cleanup/', import.meta.url);
const browser = await chromium.launch({ channel: 'chrome' });
const report: unknown[] = [];
await mkdir(out, { recursive: true });
try {
    for (const width of [1440, 390]) {
        for (const edit of [false, true]) {
            const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
            await context.addInitScript(() => localStorage.setItem('peach.settings.v1', JSON.stringify({ detailAutoplay: false })));
            const page = await context.newPage(), errors: string[] = [], media: string[] = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('request', request => {
                if (request.resourceType() === 'media' || /\/stream(?:\?|$)|\.mp4(?:\?|$)/.test(request.url())) media.push(request.url());
            });
            for (const route of ['/duplicates', '/junk-files', '/review']) {
                await page.goto(base + route + (edit ? '?edit' : ''), { waitUntil: 'networkidle' });
                const title = (await page.title()).split(' · ')[0]!;
                const heading = page.getByRole('heading', { name: title, exact: true }).first();
                await heading.waitFor();
                await page.waitForFunction(() => ![...document.querySelectorAll<HTMLElement>('[data-skeleton]')].some(node => node.checkVisibility()));
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${route} ${width} overflow`);
                if (edit) {
                    await page.locator('[data-copy-bar]').waitFor();
                    const point = await heading.evaluate(node => {
                        const range = document.createRange(); range.selectNodeContents(node);
                        const box = range.getBoundingClientRect();
                        return { x: box.left + 8, y: box.top + box.height / 2 };
                    });
                    await page.mouse.click(point.x, point.y);
                    const input = page.locator('[data-copy-inline]');
                    await input.waitFor();
                    const original = await input.innerText();
                    await input.fill('临时验收文字');
                    await input.press('Escape');
                    assert.equal(await heading.innerText(), original, `${route} cancel restores text`);
                }
                report.push({ route, width, edit, state: 'public-empty', errors: [...errors], media: [...media] });
            }
            assert.deepEqual(errors, []);
            assert.deepEqual(media, []);
            await context.close();
        }
        // 只在本浏览器注入重复组，公开片目与来源证明保持生成器输出。
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const names = ['FILM-001 Elephants Dream [1080p] 完整文件名.mp4', 'FILM-001 Elephants Dream [720p] 完整文件名.mp4'];
        await context.addInitScript(({ names }) => {
            let replay: (request: Request) => Promise<Response>;
            Object.defineProperty(globalThis, 'peachDemoReplay', {
                configurable: true,
                get: () => replay,
                set: (original: (request: Request) => Promise<Response>) => {
                    replay = async request => {
                        if (new URL(request.url).pathname !== '/api/duplicates') return original(request);
                        return Response.json({ total: 2, files: 4, reclaimable: 2000, groups: [0, 1].map(index => ({
                            code: `FILM-00${index + 1}`, count: 2, identical: false, drives: ['R:'], cross_drive: false, reclaimable: 1000,
                            files: [0, 1].map(part => ({ id: part + 1, code: 'FILM-001', has_cover: true, cover_version: '',
                                name: index ? names[part] : 'FILM-001.mp4',
                                path: `R:\\Media\\${part ? 'second' : 'first'}\\${index ? names[part] : 'FILM-001.mp4'}`,
                                location: 'local', drive: 'R:', size: 1000, duration: 3600, is_largest: part === 0, is_longest: part === 0,
                            })),
                        })) });
                    };
                },
            });
        }, { names });
        const page = await context.newPage(), errors: string[] = [], media: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
            if (request.resourceType() === 'media' || /\/stream(?:\?|$)|\.mp4(?:\?|$)/.test(request.url())) media.push(request.url());
        });
        await page.goto(base + '/duplicates?edit', { waitUntil: 'networkidle' });
        const group = page.getByRole('region', { name: 'FILM-002', exact: true });
        await group.waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.duplicate-row img')].every(image => image.complete && image.naturalWidth > 0));
        const name = page.getByRole('button', { name: names[0], exact: true });
        await page.waitForFunction(({ expected, narrow }) => {
            const text = document.querySelector(`button[title="${expected}"]`)?.textContent;
            return narrow ? text?.includes('…') : text === expected;
        }, { expected: names[0], narrow: width === 390 });
        assert.ok(await group.locator('mark[data-review-difference]').count() > 0);
        const highlight = await group.locator('mark[data-review-difference]').first().evaluate(node => getComputedStyle(node).backgroundColor);
        assert.ok(highlight !== 'transparent' && highlight !== 'rgba(0, 0, 0, 0)');
        assert.deepEqual(await page.getByRole('region', { name: 'FILM-001', exact: true }).locator('button[title="FILM-001.mp4"]').allTextContents(), ['FILM-001.mp4', 'FILM-001.mp4']);
        await name.click({ modifiers: ['Alt'] });
        const editor = page.locator('[data-copy-input]');
        await editor.waitFor();
        await editor.press('Escape');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: fileURLToPath(new URL(`duplicates-${width}.png`, out)), fullPage: true });
        assert.deepEqual(errors, []);
        assert.deepEqual(media, []);
        report.push({ route: '/duplicates?edit', width, state: 'isolated-populated', covers: true, highlight, fullName: width === 1440, errors, media });
        console.log(`PASS cleanup ${width}: public/edit routes, isolated duplicate covers, filename differences, no video`);
        await context.close();
    }
} finally {
    await writeFile(new URL('report.json', out), JSON.stringify({ base, report }, null, 2));
    await browser.close();
}
