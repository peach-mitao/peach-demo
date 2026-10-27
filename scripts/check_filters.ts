import assert from 'node:assert/strict';
import { chromium, type Locator } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base = process.env.BASE || 'http://127.0.0.1:8791', out = new URL('../evidence/v043/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' }), report = [];
const style = (locator: Locator) => locator.evaluate((e: Element) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { text: e.textContent.trim(), pressed: e.getAttribute('aria-pressed'), borderStyle: s.borderTopStyle, borderRadius: s.borderRadius, background: s.backgroundColor, color: s.color, height: r.height, width: r.width }; });
try {
    for (const width of [1440, 390] as const)
        for (const theme of ['light', 'dark'] as const) {
            const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 960 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
            await context.addInitScript(theme => localStorage.setItem('peach.settings.v1', JSON.stringify({ detailAutoplay: false, theme })), theme);
            const page = await context.newPage(), errors: string[] = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.goto(base, { waitUntil: 'networkidle' });
            const tag = page.locator('[data-catalog-tag]').first();
            await tag.waitFor();
            const normal = await style(tag);
            assert.equal(normal.pressed, 'false');
            assert.equal(normal.borderStyle, 'dashed');
            await tag.hover();
            const hover = await style(tag);
            assert.notEqual(hover.color, normal.color);
            await tag.click();
            await page.locator('[data-catalog-tag][aria-pressed="true"]').first().waitFor();
            const selected = await style(page.locator('[data-catalog-tag][aria-pressed="true"]').first());
            assert.equal(selected.borderStyle, 'solid');
            assert.notEqual(selected.background, normal.background);
            await page.waitForFunction(() => !Array.from((document.querySelectorAll('[data-skeleton]') as NodeListOf<HTMLElement>)).some(e => e.getBoundingClientRect().height > 0));
            assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
            await page.screenshot({ path: fileURLToPath(new URL(`filters-${width}-${theme}.png`, out)) });
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
            assert.equal(overflow, false);
            assert.deepEqual(errors, []);
            report.push({ width, theme, normal, hover, selected, overflow, errors, url: page.url() });
            await context.close();
        }
}
finally {
    await browser.close();
    await writeFile(new URL('filter-report.json', out), JSON.stringify({ base, sourceCommit: process.env.PEACH_SOURCE_COMMIT || null, report }, null, 2));
}
console.log(JSON.stringify(report));
