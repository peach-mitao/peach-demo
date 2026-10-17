import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const base=process.env.BASE||'http://127.0.0.1:8791';
const out=new URL('../evidence/v043/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),report=[];
async function visibleImages(page){
 return page.evaluate(async()=>{
  const targets=Array.from(document.images).filter(img=>img.checkVisibility()&&img.getBoundingClientRect().width>0);
  const images=await new Promise(resolve=>{
   if(!targets.length){resolve([]);return}
   const observer=new IntersectionObserver(entries=>{observer.disconnect();resolve(entries.filter(entry=>entry.isIntersecting).map(entry=>entry.target))});
   targets.forEach(img=>observer.observe(img));
  });
  let timeout;
  try{await Promise.race([Promise.all(images.map(img=>img.decode())),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('可见图片解码超时')),10000)})])}
  finally{clearTimeout(timeout)}
  return images.map(img=>({src:img.currentSrc,naturalWidth:img.naturalWidth,width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height}));
 });
}
const routes=[['home','/'],['people','/performers'],['profile','/performers/'+encodeURIComponent('凉森玲梦')],
 ['follow','/follow?media=images'],['stats','/stats'],['feeds','/subscriptions?tab=feeds'],
 ['follow-table','/subscriptions?tab=list'],['data','/data-cleanup'],['player','/assets/1']];
try{
 for(const width of [1440,390])for(const dpr of [1,2]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:960},deviceScaleFactor:dpr,reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('peach.settings.v1',JSON.stringify({detailAutoplay:false,followLayout:'table'})));
  const page=await context.newPage(),errors=[],failed=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failed.push({status:r.status(),url:r.url()})});
  page.on('request',r=>{if(r.method()==='POST'&&/\/api\/(library-processing|play|activity)(?:\?|$)/.test(r.url()))writes.push(r.url())});
  for(const [name,path] of routes){
   await page.goto(base+path,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.body.innerText.length>100);
   await page.waitForFunction(()=>!Array.from(document.querySelectorAll('[data-skeleton]')).some(e=>e.getBoundingClientRect().height>0));
   const images=await visibleImages(page);
   const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
    text:document.body.innerText.slice(0,7000)}));
   state.images=images;
   assert.equal(state.overflow,false,`${name} ${width}/${dpr} 横向溢出`);
   assert.ok(state.text?.length>10,`${name} 内容未取得`);
   assert.ok(state.images.every(img=>img.naturalWidth>0),`${name} 可见图片加载失败`);
   if(name==='data')assert.ok(await page.getByRole('button',{name:'同步媒体库',exact:true}).count());
   if(name==='feeds')assert.match(state.text,/凉森玲梦/);
   if(name==='follow-table')assert.match(state.text,/Billyhhyb/);
   if(name==='player'){
    const button=page.getByRole('button',{name:/记一次高潮/});
    const initial=await page.evaluate(async()=>await(await fetch('/api/item?id=1')).json());
    await button.click();await page.waitForFunction(count=>document.querySelector('#oCount')?.textContent===String(count),initial.o_count+1);
    await page.getByRole('button',{name:'撤销',exact:true}).last().click();
    await page.waitForFunction(count=>document.querySelector('#oCount')?.textContent===String(count),initial.o_count);
   }
   if(dpr===2)await page.screenshot({path:fileURLToPath(new URL(`${name}-${width}.png`,out))});
   report.push({name,width,dpr,...state,errors:[...errors],failed:[...failed]});
  }
  await page.goto(base+'/data-cleanup',{waitUntil:'networkidle'});
  const controls=page.locator('[data-processing-controls]').first();
  await controls.getByRole('button',{name:'处理速度：标准',exact:true}).click();
  const slider=page.getByRole('slider');await slider.focus();await slider.press('Home');await slider.press('Tab');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog',{name:'处理速度',exact:true}).waitFor({state:'hidden'});
  await controls.getByRole('button',{name:'处理速度：低占用',exact:true}).waitFor();
  const start=page.getByRole('button',{name:'同步媒体库',exact:true});
  await start.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const button=Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='同步媒体库');if(!button)return false;const r=button.getBoundingClientRect();return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))});
  await start.click();
  const dialog=page.getByRole('dialog',{name:'同步媒体库',exact:true});
  await dialog.getByRole('button',{name:'同步媒体库',exact:true}).click();
  await controls.getByRole('button',{name:'暂停',exact:true}).click();
  await controls.getByRole('button',{name:'继续',exact:true}).waitFor();
  assert.equal(await page.evaluate(async()=> (await(await fetch('/api/library-processing')).json()).status),'paused');
  await controls.getByRole('button',{name:'继续',exact:true}).click();
  await controls.getByRole('button',{name:'暂停',exact:true}).waitFor();
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.evaluate(async()=> (await(await fetch('/api/library-processing')).json()).status),'complete');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(writes,[],'扫描操作与行为上报在当前页面处理');
  report.push({width,dpr,processingControls:true,refreshReset:true,noProcessingRequests:true});
  console.log(JSON.stringify({width,dpr,routes:routes.length,processingControls:true,errors,failed}));
  await context.close();
 }
 const context=await browser.newContext();
 for(const path of ['/_fixtures/manifest.json','/_media/1.mp4'])assert.equal((await context.request.get(base+path)).status(),404);
 const range=await context.request.get(base+'/stream?id=1',{headers:{Range:'bytes=0-99'}});
 assert.equal(range.status(),206);assert.equal((await range.body()).length,100);
 await context.close();
}finally{await writeFile(new URL('browser-report.json',out),JSON.stringify({base,report},null,2));await browser.close()}
