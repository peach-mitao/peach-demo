import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base = process.env.BASE || 'http://127.0.0.1:8791';
const out = new URL('../evidence/folders/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' }), report = [];
try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1120, height: 560 }, { width: 390, height: 844 }] as const) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
        await context.addInitScript(() => localStorage.setItem('peach.settings.v1', JSON.stringify({ detailAutoplay: false })));
        const page = await context.newPage(), errors: string[] = [], failed: string[] = [];
        page.on('pageerror', error => errors.push(error.stack || (error instanceof Error ? error.message : String(error))));
        page.on('response', response => { if (response.status() >= 400)
            failed.push(`${response.status()} ${new URL(response.url()).pathname}${new URL(response.url()).search}`); });
        try {
            await page.goto(base + '/?browse=folders', { waitUntil: 'networkidle' });
            const read = (path: string) => page.evaluate(async (target) => await (await fetch(target)).json(), path);
            const rootPage = await read('/api/folders'), root = rootPage.roots[0];
            assert.ok(root?.has_children);
            const catalog = await read('/api/items?limit=1000');
            assert.equal(root.files, catalog.items.filter((item: { location: string }) => item.location === root.location).length);
            const open = (id: any) => page.locator('#catalogFolderHeader').getByRole('button', { name: id, exact: true }).click();
            await open(root.name);
            await page.getByRole('navigation', { name: '文件夹路径' }).getByLabel(root.name, { exact: true }).waitFor();
            const groupPage = await read('/api/folders?' + new URLSearchParams({ folder: root.id }));
            const group = groupPage.children.find((row: { name: string; }) => row.name === '编号影片');
            assert.ok(group, '普通电影目录分组未取得');
            await open(group.name);
            const leafPage = await read('/api/folders?' + new URLSearchParams({ folder: group.id }));
            const leaf = leafPage.children[0];
            assert.ok(leaf);
            if (viewport.width < 1100)
                await page.getByRole('button', { name: '打开文件夹目录', exact: true }).click();
            const navigation = viewport.width < 1100 ? page.getByRole('dialog', { name: '文件夹目录', exact: true }) : page.locator('#catalogFoldersTree');
            await navigation.getByRole('treegrid', { name: '媒体目录' }).waitFor();
            await navigation.getByRole('textbox', { name: '查找文件夹' }).fill(leaf.name);
            const matches = await read('/api/folders?' + new URLSearchParams({ q: leaf.name }));
            const sameNames = matches.matches.filter((row: { name: string }) => row.name === leaf.name);
            const matchIndex = sameNames.findIndex((row: { id: string }) => row.id === leaf.id);
            assert.ok(matchIndex >= 0, '目录搜索保留完整身份');
            await navigation.getByRole('button', { name: leaf.name, exact: true }).nth(matchIndex).click();
            await page.waitForFunction(id => new URLSearchParams(location.search).get('folder') === id, leaf.id);
            await page.waitForFunction(() => !(document.querySelector('#grid [data-skeleton]') as HTMLElement));
            const items = await read('/api/items?' + new URLSearchParams({ folder: leaf.id, limit: '1000' }));
            assert.equal(items.total, leaf.files);
            assert.ok(items.total > 0 && items.total < root.files);
            assert.equal(await page.locator('#grid [data-media-card]').count(), items.total);
            await page.getByText('包含子文件夹', { exact: true }).click();
            await page.waitForFunction(() => new URLSearchParams(location.search).get('folder_recursive') === '0');
            await page.getByText('包含子文件夹', { exact: true }).click();
            if (viewport.width >= 1100) {
                for (const y of [0, 600, 0] as const) {
                    await page.evaluate(async (value) => { scrollTo(0, value); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); }, y);
                    const geometry = await navigation.evaluate(element => {
                        const tree = element.getBoundingClientRect(), filter = (document.querySelector('[data-catalog-frame]') as HTMLElement).getBoundingClientRect();
                        const notice = (document.querySelector('[data-demo-notice]') as HTMLElement).getBoundingClientRect();
                        return { top: tree.top, bottom: tree.bottom, filter: filter.bottom, notice: notice.top,
                            sticky: getComputedStyle(element).top, offset: document.body.style.getPropertyValue('--folder-sticky-top'),
                            available: document.body.style.getPropertyValue('--folder-available-height'), scrollY,
                            main: document.getElementById('main')!.getBoundingClientRect().toJSON() };
                    });
                    assert.ok(geometry.top >= geometry.filter && geometry.bottom <= geometry.notice - 8, JSON.stringify(geometry));
                }
            }
            await page.getByRole('button', { name: '设置目录用途', exact: true }).click();
            const dialog = page.getByRole('dialog', { name: '设置目录用途', exact: true });
            await dialog.getByRole('button', { name: '预览影响', exact: true }).click();
            await dialog.getByRole('region', { name: '目录用途影响范围' }).waitFor();
            await dialog.getByRole('button', { name: '保存目录用途', exact: true }).click();
            await dialog.waitFor({ state: 'hidden' });
            const saved = await page.evaluate(async (id) => await (await fetch('/api/folders?' + new URLSearchParams({ folder: id }))).json(), leaf.id);
            assert.equal(saved.rule.purpose, 'category');
            await page.getByRole('button', { name: '设置目录用途', exact: true }).click();
            await dialog.getByRole('button', { name: '移除规则', exact: true }).click();
            await page.getByRole('button', { name: '移除目录规则', exact: true }).click();
            await page.getByRole('dialog', { name: '移除目录规则', exact: true }).waitFor({ state: 'hidden' });
            await page.getByRole('radiogroup', { name: '馆藏显示方式' }).locator('label').filter({ has: page.getByRole('radio', { name: '列表', exact: true }) }).click();
            const image = page.locator('[data-list-picture] img.cover').first();
            await image.waitFor();
            assert.equal(await image.evaluate(element => getComputedStyle(element).objectFit), 'contain');
            await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.classList.add('dark'); scrollTo(0, 0); });
            await page.screenshot({ path: fileURLToPath(new URL(`folders-${viewport.width}.png`, out)) });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            report.push({ viewport, total: items.total, search: true, rules: true, wholeCover: true, errors, failed });
            console.log(JSON.stringify(report.at(-1)));
            assert.deepEqual(errors, []);
            assert.deepEqual(failed, []);
        }
        finally {
            await context.close();
        }
    }
}
finally {
    await writeFile(new URL('report.json', out), JSON.stringify({ base, report }, null, 2));
    await browser.close();
}
