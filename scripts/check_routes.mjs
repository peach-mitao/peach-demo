import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.BASE||'http://127.0.0.1:8791';
const routes=['/','/jav','/performers','/creators','/studios','/agencies','/tags','/follow?media=images',
  '/playlists','/stats','/taste','/review','/data-cleanup','/duplicates','/quality-goals','/sources',
  '/settings/library','/settings/subscriptions','/settings/downloads','/settings/network',
  '/settings/maintenance','/settings/diagnostics','/tasks','/subscriptions?tab=feeds','/junk-files','/trash'];
const browser=await chromium.launch({channel:'chrome'}),report=[];
const out=new URL('../evidence/routes/',import.meta.url);await mkdir(out,{recursive:true});
try{
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await context.addInitScript(()=>localStorage.setItem('peach.settings.v1',JSON.stringify({detailAutoplay:false})));
    const page=await context.newPage();let errors=[],failed=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)failed.push([response.status(),new URL(response.url()).pathname+new URL(response.url()).search])});
    try{
      for(const route of routes){
        errors=[];failed=[];
        await page.goto(base+route,{waitUntil:'networkidle'});
        await page.waitForFunction(()=>!Array.from(document.querySelectorAll('[data-skeleton]')).some(element=>element.getBoundingClientRect().height>0));
        const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,text:document.body.innerText.slice(-1800)}));
        const row={width,route,errors:[...errors],failed:[...failed],...state};report.push(row);
        assert.deepEqual(row.errors,[],`${width} ${route} 运行错误`);assert.deepEqual(row.failed,[],`${width} ${route} 回放未取得`);
        assert.equal(row.overflow,false,`${width} ${route} 横向溢出`);
      }
      console.log(`PASS ${width}: ${routes.length} 个页面，无运行错误、回放缺失或横向溢出`);
    }finally{await context.close()}
  }
}finally{await browser.close();await writeFile(new URL('report.json',out),JSON.stringify({base,report},null,2))}
