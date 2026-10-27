import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.BASE || 'http://127.0.0.1:8791';
const browser = await chromium.launch({ channel: 'chrome' });
try {
    for (const width of [1440, 390] as const) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const page = await context.newPage(), errors: string[] = [];
        page.on('pageerror', error => errors.push((error instanceof Error ? error.message : String(error))));
        await page.goto(base + '/?edit', { waitUntil: 'networkidle' });
        await page.locator('[data-copy-bar]').waitFor();
        assert.equal(await page.getByRole('group', {name:'文案编辑'}).locator('[data-copy-state]').textContent(),'改字模式');
        const help=page.getByRole('button',{name:'编辑使用说明'});
        await help.focus();
        await page.getByRole('tooltip').waitFor();
        assert.match(await page.getByRole('tooltip').innerText(),/Alt \+ 点击/);
        await help.press('Escape');
        const note=page.locator(`[data-demo-notice] [data-demo-copy="${width===390?'compact':'full'}"]`).first();
        const footerPoint=await note.evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const rect=range.getClientRects()[0];return{x:rect.left+12,y:rect.top+rect.height/2}});
        await page.mouse.click(footerPoint.x,footerPoint.y);
        await page.locator('[data-copy-inline]').waitFor();
        await page.locator('[data-copy-inline]').press('Escape');
        await page.locator('[data-demo-notice] a').first().click({modifiers:['Alt']});
        await page.locator('[data-copy-input]').waitFor();
        await page.locator('[data-copy-input]').fill(`素材出处 ${width}`);
        await page.locator('[data-copy-input]').press('Enter');
        await page.reload({waitUntil:'networkidle'});
        assert.equal(await page.locator('[data-demo-notice] a').first().textContent(),`素材出处 ${width}`);
        await page.locator('[data-folder-mode-toggle]').click();
        await page.waitForFunction(() => document.body.hasAttribute('data-folder-browse'));
        await page.locator('[data-folder-mode-toggle]').click();
        await page.waitForFunction(() => !document.body.hasAttribute('data-folder-browse'));
        const layouts = page.getByRole('radiogroup', { name: '馆藏显示方式' });
        await layouts.locator('label').filter({ has: page.getByRole('radio', { name: '列表', exact: true }) }).click();
        await page.locator('[data-catalog-table]').waitFor();
        assert.equal(await page.locator('[data-copy-input],[data-copy-inline]').count(), 0, '切换没有被编辑模式拦截');
        const heading = page.getByRole('heading', { name: '首页', exact: true });
        await heading.click({ trial: true });
        const point = await heading.evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); const rect = range.getClientRects()[0]; return { x: rect.left + 12, y: rect.top + rect.height / 2 }; });
        await page.mouse.click(point.x, point.y);
        const editor = page.locator('[data-copy-inline]');
        await editor.fill(`编辑预览 ${width}`);
        await editor.press('Enter');
        await page.waitForFunction(() => document.querySelector('[data-copy-toolbar-host]')?.shadowRoot?.querySelector('[role="status"]')?.textContent?.includes('已保存'));
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: `编辑预览 ${width}`, exact: true }).waitFor();
        const updated = page.getByRole('heading', { name: `编辑预览 ${width}`, exact: true });
        await updated.click({ trial: true });
        const erase = await updated.evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); const rect = range.getClientRects()[0]; return { x: rect.left + 12, y: rect.top + rect.height / 2 }; });
        await page.mouse.click(erase.x, erase.y);
        await editor.fill('');
        await editor.press('Enter');
        await page.waitForFunction(() => document.querySelector('[data-copy-toolbar-host]')?.shadowRoot?.querySelector('[role="status"]')?.textContent?.includes('已删除'));
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await page.getByRole('heading', { name: `编辑预览 ${width}`, exact: true }).count(), 0);
        assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        console.log(`PASS ${width}: 演示编辑模式切换目录、切换布局、改字与刷新恢复`);
        await context.close();
    }
}
finally {
    await browser.close();
}
