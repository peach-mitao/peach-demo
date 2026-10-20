// 记录真实渲染、分区和请求证据。--verify 才执行验收断言。
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {demoScenarios} from './demo_pages.mjs';

const base=process.env.BASE||'http://127.0.0.1:8791';
const verify=process.argv.includes('--verify');
const asked=process.argv.indexOf('--route');
const scenarios=asked<0?await demoScenarios():process.argv.slice(asked+1).filter(value=>!value.startsWith('--')).map(route=>({route,mode:process.argv.includes('--manage')?'tag-management':'browse'}));
const routes=scenarios.map(row=>row.route);
const browser=await chromium.launch({channel:'chrome'});
const out=new URL(process.env.COVERAGE_OUT||'../evidence/coverage/',import.meta.url);await mkdir(out,{recursive:true});
const report=[];
function contentReady(){
  const immerse=document.querySelector('[data-immerse]:not([hidden])');
  if(immerse)return Boolean(immerse.querySelector('video')?.readyState>=2);
  const scope=[...document.querySelectorAll('dialog[open],[role="dialog"][aria-modal="true"]')].find(element=>element.checkVisibility())||document;
  return ![...scope.querySelectorAll('[data-skeleton],[aria-busy="true"]')].some(element=>{
    const rect=element.getBoundingClientRect();
    return element.checkVisibility({opacityProperty:true})&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth;
  });
}
try{
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:width===390?844:960},reducedMotion:'reduce',colorScheme:'light'});
    await context.addInitScript(()=>{
      const settings={detailAutoplay:false,uiSounds:false,theme:'light'};
      if(new URLSearchParams(location.search).get('view')==='table')settings.followLayout='table';
      localStorage.setItem('peach.settings.v1',JSON.stringify(settings));
    });
    const page=await context.newPage();let errors=[],failed=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{
      const url=new URL(response.url());
      if(url.origin!==base)return;
      if(url.pathname.startsWith('/api/'))requests.push({method:response.request().method(),path:url.pathname+url.search,status:response.status()});
      if(response.status()>=400)failed.push({path:url.pathname+url.search,status:response.status()});
    });
    try{
      for(const [index,{route,mode}] of scenarios.entries()){
        errors=[];failed=[];requests=[];let loadError='';
        try{
          await page.goto(base+route,{waitUntil:'networkidle',timeout:30000});
          if(mode==='tag-management')await page.locator('[data-tag-mode]').click();
          await page.waitForFunction(contentReady,null,{timeout:12000});
        }catch(error){loadError=error.message.split('\n')[0]}
        await page.evaluate(()=>window.scrollTo(0,0));
        const prefix=`${width}-${String(index).padStart(2,'0')}`;
        await page.screenshot({path:fileURLToPath(new URL(prefix+'.png',out)),fullPage:false});
        const states=[];
        const tabs=page.getByRole('tab');
        for(let at=0;at<await tabs.count()&&at<16;at++){
          const tab=tabs.nth(at);if(!await tab.isVisible())continue;
          const name=await tab.innerText();
          try{
            await tab.click({timeout:5000});await page.waitForLoadState('networkidle',{timeout:12000});
            if(mode==='tag-management'&&await page.locator('[data-tag-mode]').getAttribute('aria-pressed')==='false')await page.locator('[data-tag-mode]').click();
            await page.waitForFunction(contentReady,null,{timeout:12000});
            await page.screenshot({path:fileURLToPath(new URL(`${prefix}-tab-${at}.png`,out)),fullPage:false});
          }catch(error){errors.push(`${name}: ${error.message.split('\n')[0]}`)}
          states.push(name);
        }
        if(mode==='tag-management'){
          const manager=page.locator('[data-tag-manager]');
          for(const name of ['已隐藏','使用中']){
            await manager.getByRole('button',{name,exact:true}).click();await page.waitForFunction(contentReady,null,{timeout:12000});
            await page.screenshot({path:fileURLToPath(new URL(`${prefix}-${name==='已隐藏'?'hidden':'active'}.png`,out)),fullPage:false});
            states.push(name);
          }
          const edit=manager.getByRole('button',{name:/^编辑标签 /}).first();
          if(await edit.count()){
            await edit.click();await page.getByRole('dialog').waitFor();
            await page.screenshot({path:fileURLToPath(new URL(`${prefix}-rename.png`,out)),fullPage:false});
            await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();states.push('重命名弹层');
          }
        }
        // 截图与布局使 IntersectionObserver 启动资源查询；在取最终状态前等待布局回调及其请求。
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        try{
          await page.waitForLoadState('networkidle',{timeout:12000});
          await page.waitForFunction(contentReady,null,{timeout:12000});
        }catch(error){loadError=error.message.split('\n')[0]}
        await page.screenshot({path:fileURLToPath(new URL(`${prefix}-settled.png`,out)),fullPage:false});
        const state=await page.evaluate(()=>{
          const head=document.querySelector('[data-index-head]'),title=head?.querySelector('h2')?.getBoundingClientRect();
          const search=head?.querySelector('[data-index-search]')?.getBoundingClientRect();
          const controls=head?[...head.querySelectorAll('[data-shortcuts-trigger],[data-tag-mode],[data-index-layout]')]:[];
          const indexHeader=title&&search?{searchWidth:search.width,aligned:[search,...controls.map(node=>node.getBoundingClientRect())]
            .every(box=>Math.abs(box.top+box.bottom-title.top-title.bottom)<2)}:null;
          return {indexHeader,overflow:document.documentElement.scrollWidth>innerWidth,
          title:document.title,text:document.body.innerText.slice(-5000),
          brokenImages:Array.from(document.images).filter(img=>img.checkVisibility()&&img.complete&&!img.naturalWidth).map(img=>img.currentSrc)};
        });
        state.loading=!(await page.evaluate(contentReady));
        report.push({width,route,mode,states,loadError,errors:[...errors],failed:[...failed],requests:[...requests],...state});
        console.log(`${width} ${route} ${mode}: ${failed.length} 失败请求，${errors.length} 运行错误${loadError?'，加载未就绪':''}`);
      }
    }finally{await context.close()}
  }
}finally{
  await browser.close();
  await writeFile(new URL('report.json',out),JSON.stringify({base,routes,report},null,2));
}
if(verify){
  const failures=report.filter(row=>row.errors.length||row.failed.length||row.overflow||row.loading||row.brokenImages.length||row.loadError
    ||(row.indexHeader&&(!row.indexHeader.aligned||row.indexHeader.searchWidth<64))||/演示回放未取得|演示数据读取失败/.test(row.text));
  if(failures.length)throw Error(`界面覆盖未通过：${failures.map(row=>`${row.width} ${row.route}`).join('、')}`);
  console.log(`PASS: ${routes.length} 个入口，桌面和手机全部通过。`);
}
