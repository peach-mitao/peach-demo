import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.BASE||'http://127.0.0.1:8791';
const out=new URL('../evidence/tour/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),report=[];
try{
    for(const width of [1440,390]){
        for(const scene of ['search','feed','review','avatar']){
            const context=await browser.newContext({viewport:{width,height:900}});
            await context.addInitScript(()=>localStorage.setItem('peach.settings.v1',JSON.stringify({detailAutoplay:false})));
            const page=await context.newPage(),errors:string[]=[],external:string[]=[];
            page.on('pageerror',error=>errors.push(error.message));
            page.on('console',msg=>{if(msg.type()==='error'&&msg.text().includes('[peach-tour]'))errors.push(msg.text())});
            await page.route('**/*',route=>{
                if(new URL(route.request().url()).origin!==new URL(base).origin){external.push(route.request().url());return route.abort()}
                return route.continue();
            });
            await page.goto(`${base}/?tour=${scene}`,{waitUntil:'domcontentloaded'});
            try{
                await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.demoTourState||''),null,{timeout:45000});
                assert.equal(await page.locator('html').getAttribute('data-demo-tour-state'),'complete',JSON.stringify(errors));
                const url=page.url();await page.waitForTimeout(1000);
                assert.equal(page.url(),url,'单次导览完成后保留当前页面');
                assert.equal(await page.locator('.peach-tour-cursor').count(),0);
                assert.deepEqual(errors,[]);
                assert.deepEqual(external,[],'自动导览只读取本地回放');
                await page.screenshot({path:new URL(`${width}-${scene}.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
                report.push({width,scene,url});console.log(JSON.stringify(report.at(-1)));
            }catch(error){
                console.error((await page.locator('body').innerText()).slice(0,3500));throw error;
            }finally{await context.close()}
        }
    }
    const page=await browser.newPage();
    await page.goto(`${base}/?tour=search`,{waitUntil:'domcontentloaded'});
    await page.mouse.click(10,10);
    assert.equal(await page.locator('html').getAttribute('data-demo-tour-state'),'stopped');
    assert.equal(new URL(page.url()).searchParams.has('tour'),false);
    await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));
}finally{await browser.close()}
