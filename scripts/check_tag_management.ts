import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.BASE || 'http://127.0.0.1:8791';
const browser = await chromium.launch({ channel: 'chrome' });
try {
    for (const width of [1440, 390] as const)
        for (const scope of ['local', 'online'] as const) {
            const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 960 }, reducedMotion: 'reduce' });
            const page = await context.newPage(), failed: string[] = [], errors: string[] = [], writes: string[] = [];
            page.on('pageerror', error => errors.push((error instanceof Error ? error.message : String(error))));
            page.on('response', response => { if (response.status() >= 400)
                failed.push(response.url()); });
            page.on('request', request => { if (request.method() !== 'GET' && new URL(request.url()).pathname.startsWith('/api/tag-management'))
                writes.push(request.url()); });
            const key = '/api/tag-management' + (scope === 'online' ? '?scope=online' : '');
            const inventory = () => page.evaluate(async (key) => (await fetch(key)).json(), key);
            const ready = () => page.waitForFunction(() => ![...(document.querySelectorAll('[data-tag-manager] [data-skeleton],[data-tag-manager] [aria-busy="true"]') as NodeListOf<HTMLElement>)].some(element => element.checkVisibility()));
            const confirm = async (label: string) => {
                await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click();
                await page.getByRole('dialog').waitFor({ state: 'hidden' });
                // 成功回调在库存刷新后清空选择，此时才开始下一项操作。
                await page.locator('[data-tag-manager] [data-selection-dock]').waitFor({ state: 'hidden' });
                await ready();
            };
            const select = async (name: string) => page.locator('[data-tag-manager] [data-k]').filter({ hasText: name }).first().click();
            try {
                await page.goto(base + '/tags' + (scope === 'online' ? '?scope=online' : ''), { waitUntil: 'networkidle' });
                await page.locator('[data-tag-mode]').click();
                await ready();
                const initial = await inventory(), tag = initial.items[0], id = tag.id ?? tag.entity_id, name = `演示标签-${scope}`;
                await page.getByRole('button', { name: `编辑标签 ${tag.k}`, exact: true }).click();
                await page.getByRole('dialog').getByLabel('标签名称').fill(name);
                await page.getByRole('dialog').getByRole('button', { name: '预览影响范围', exact: true }).click();
                await confirm('重命名标签');
                let current = await inventory(), renamed = current.items.find((row: { id: any; entity_id: any; }) => (row.id ?? row.entity_id) === id);
                assert.equal(renamed.k, name);
                assert.ok(renamed.aliases.includes(tag.k));
                await select(name);
                await page.getByRole('button', { name: '隐藏', exact: true }).click();
                await confirm('隐藏标签');
                assert.equal((await inventory()).items.find((row: { id: any; entity_id: any; }) => (row.id ?? row.entity_id) === id).hidden, true);
                await page.locator('[data-tag-manager]').getByRole('button', { name: '已隐藏', exact: true }).click();
                await select(name);
                await page.getByRole('button', { name: '恢复', exact: true }).click();
                await confirm('恢复标签');
                await page.locator('[data-tag-manager]').getByRole('button', { name: '使用中', exact: true }).click();
                current = await inventory();
                const pair = current.items.filter((row: { cat: any; hidden: any; }) => row.cat === renamed.cat && !row.hidden).slice(0, 2);
                for (const row of pair)
                    await select(row.k);
                await page.getByRole('button', { name: '合并', exact: true }).click();
                await page.getByRole('dialog').getByRole('button', { name: '预览影响范围', exact: true }).click();
                await confirm('合并标签');
                assert.equal((await inventory()).items.length, initial.items.length - 1);
                await page.reload({ waitUntil: 'networkidle' });
                await page.locator('[data-tag-mode]').click();
                await ready();
                assert.equal((await inventory()).items.find((row: { id: any; entity_id: any; }) => (row.id ?? row.entity_id) === id).k, tag.k);
                assert.deepEqual(writes, []);
                assert.deepEqual(errors, []);
                assert.deepEqual(failed, []);
                console.log(`PASS: ${width} ${scope} 标签读取、改名、隐藏、恢复、合并和刷新恢复，无服务器写入`);
            }
            finally {
                await context.close();
            }
        }
}
finally {
    await browser.close();
}
