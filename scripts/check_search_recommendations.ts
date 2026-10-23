import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BASE || 'http://127.0.0.1:8791', out = new URL('../evidence/search-recommendations/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' }), report = [];
try {
    for (const width of [1440, 390, 320] as const) {
        const height = width === 1440 ? 960 : 844;
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: 'dark', reducedMotion: 'reduce' });
        await context.addInitScript(() => localStorage.setItem('peach.settings.v1', JSON.stringify({ theme: 'dark', detailAutoplay: false })));
        const page = await context.newPage(), errors: string[] = [], failed: Record<string,any>[] = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('response', r => { if (r.status() >= 400)
            failed.push({ status: r.status(), url: r.url() }); });
        await page.goto(base, { waitUntil: 'networkidle' });
        if (width < 761)
            await page.locator('#searchBtn').click();
        await page.locator('#q').focus();
        const menu = page.locator('#searchMenu');
        await menu.waitFor({ state: 'visible' });
        const avatar = menu.locator('[data-search-value="Billyhhyb"] img.favatar');
        await avatar.waitFor();
        await avatar.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => { const img = (document.querySelector('#searchMenu [data-search-value="Billyhhyb"] img.favatar') as HTMLElement); return (img as HTMLImageElement)?.complete && (img as HTMLImageElement).naturalWidth > 0; });
        const phases = [];
        const phaseSizes:[string,number,number?][]=[['open',height],...(width<761?[['keyboard-sized',440],['restored',height],['visual-keyboard-sized',height,440],['visual-restored',height]] as [string,number,number?][]:[])];
        for (const [phase, nextHeight, visibleHeight] of phaseSizes) {
            await page.setViewportSize({ width, height: nextHeight });
            await page.evaluate(visibleHeight => {
                const viewport = window.visualViewport;
                if (visibleHeight)
                    Object.defineProperty(viewport, 'height', { configurable: true, get: () => visibleHeight });
                else
                    Reflect.deleteProperty(viewport!,'height');
                viewport!.dispatchEvent(new Event('resize'));
            }, visibleHeight);
            await page.waitForFunction(() => {
                const menu = (document.querySelector('#searchMenu') as HTMLElement), notice = (document.querySelector('[data-demo-notice]') as HTMLElement);
                const mr = menu?.getBoundingClientRect(), nr = notice?.getBoundingClientRect();
                const bottom = (visualViewport?.height || innerHeight) + (visualViewport?.offsetTop || 0);
                return mr?.height > 0 && mr.bottom <= nr.top - 8 && Math.abs(nr.bottom - (bottom - 12)) < 1;
            });
            const state = await page.evaluate(() => {
                const menu = (document.querySelector('#searchMenu') as HTMLElement), notice = (document.querySelector('[data-demo-notice]') as HTMLElement), font = getComputedStyle(notice);
                return { menu: menu.getBoundingClientRect().toJSON(), notice: notice.getBoundingClientRect().toJSON(), noticeText: notice.innerText, layoutHeight: innerHeight, visualHeight: visualViewport!.height,
                    noticeLineHeight: parseFloat(font.lineHeight), noticePadding: parseFloat(font.paddingTop) + parseFloat(font.paddingBottom) + parseFloat(font.borderTopWidth) + parseFloat(font.borderBottomWidth),
                    sections: [...(menu.querySelectorAll('[data-search-group]') as NodeListOf<HTMLElement>)].filter(group => group.checkVisibility()).map(group => ({ title: (group.querySelector('h3') as HTMLElement)?.innerText, rows: (group.querySelectorAll('[data-search-value]') as NodeListOf<HTMLElement>).length })),
                    overflow: document.documentElement.scrollWidth > innerWidth, copyright: (notice.querySelector('a') as HTMLAnchorElement)?.href,
                    avatar: { src: ((menu.querySelector('[data-search-value="Billyhhyb"] img') as HTMLElement) as HTMLImageElement)?.currentSrc, width: ((menu.querySelector('[data-search-value="Billyhhyb"] img') as HTMLElement) as HTMLImageElement)?.naturalWidth } };
            });
            assert.ok(state.sections.every(section => section.rows > 0));
            assert.ok(state.sections.some(section => section.title?.includes('关注图片')));
            assert.ok(state.sections.some(section => section.title?.includes('订阅新作')));
            assert.equal(state.overflow, false);
            assert.equal(state.copyright, 'https://peach.video/copyright/');
            if (width < 761) {
                assert.equal(state.noticeText, '演示站 · 操作不保存 · 版权投诉');
                assert.ok(state.notice.height <= state.noticeLineHeight + state.noticePadding + 1);
            }
            phases.push({ phase, height: nextHeight, ...state });
        }
        assert.ok(Math.abs(phases.at(-1)!.menu.height - phases[0].menu.height) < 1, '视口恢复后下拉恢复高度');
        if (process.argv.includes('--blur')) {
            await page.locator('#q').evaluate(input => input.blur());
            await page.waitForTimeout(250);
            assert.equal(await menu.isVisible(), true, '完成输入后推荐保留');
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(failed, []);
        report.push({ width, phases, blurChecked: process.argv.includes('--blur'), errors, failed });
        console.log(JSON.stringify({ width, phases: phases.map(p => ({ phase: p.phase, gap: p.notice.top - p.menu.bottom, notice: p.noticeText, sections: p.sections })), errors, failed }));
        await context.close();
    }
}
finally {
    await browser.close();
    await writeFile(new URL('report.json', out), JSON.stringify({ base, viewportTest: '浏览器视口缩放及 visualViewport 高度受控模拟；真实系统键盘未操控', report }, null, 2));
}
