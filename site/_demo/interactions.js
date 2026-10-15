// 演示交互的状态留在当前页面内存中，刷新即恢复录制值。
(() => {
  const overlays = () => {
    const notice=document.querySelector('[data-demo-notice]'),toasts=document.querySelector('#toasts');
    if(notice)new ResizeObserver(()=>document.documentElement.style.setProperty('--demo-notice-height',notice.getBoundingClientRect().height+'px')).observe(notice);
    if(toasts){
      const place=()=>{
        const dialogs=[...document.querySelectorAll('dialog[open]')];
        const parent=dialogs.at(-1)||document.body;
        if(toasts.parentElement!==parent)parent.append(toasts);
      };
      new MutationObserver(place).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
      place();
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',overlays,{once:true});else overlays();
  if(new URLSearchParams(location.search).get('favorites')==='1'){
    let attempts=0;
    const open=()=>{
      const button=document.querySelector('button[aria-label="我的收藏"]');
      if(button){button.click();return}
      if(++attempts<100)setTimeout(open,100);
    };
    if(document.body)open();else document.addEventListener('DOMContentLoaded',open,{once:true});
  }
  const networkFetch = window.fetch.bind(window);
  const originalFetch = async (...args) => {
    const response=await networkFetch(...args);
    const input=args[0],url=new URL(input instanceof Request?input.url:input,location.href);
    if(url.origin!==location.origin||!url.pathname.startsWith('/api/')||!response.ok||!(response.headers.get('content-type')||'').includes('application/json')||!globalThis.peachDemoMediaJSON)return response;
    return responseJSON(response,globalThis.peachDemoMediaJSON(await response.json()));
  };
  const items = new Map();
  // 每个访客的草稿只存在当前页面内存中，刷新即恢复夹具。
  const snapshots = new Map();
  const pending = new Map();
  const read = async path => {
    if (!snapshots.has(path)) {
      if(!pending.has(path))pending.set(path,(async()=>{
        const response = await originalFetch(path);
        if (!response.ok) throw new Error(`演示数据读取失败：${path}`);
        snapshots.set(path, await response.json());
      })().finally(()=>pending.delete(path)));
      await pending.get(path);
    }
    return snapshots.get(path);
  };
  const result = data => new Response(JSON.stringify(data), {
    headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
  });
  const configuration = async (path, body) => {
    const config = await read('/api/configuration');
    const key = path.slice('/api/configuration/'.length);
    if (key === 'entry-links') {
      config.entry_links.sites = config.entry_links.sites.map(site => ({...site,host:body.sites?.[site.key]?.host ?? site.host}));
      return config.entry_links;
    }
    if (key === 'access') {
      config.access = {...config.access,mode:body.action === 'disable'?'open':'password'};
      return config.access;
    }
    if (key === 'tunnel') {
      config.tunnel = {...config.tunnel,mode:body.mode,hostname:body.hostname,state:'stopped',
        enabled:false,error:body.enabled?'演示站不会创建公网入口。':''};
      return {...config.tunnel,revision:config.revision};
    }
    if (key === 'updates') return {...config.updates,state:'current',latest_version:config.updates.current_version,message:'演示站展示录制版本，不检查真实更新。'};
    if (key === 'update-status') return config.update_job || {state:'idle',progress:0};
    if (key === 'uninstall') return {message:'演示站不会卸载程序。'};
    if (key === 'update' || key === 'update-restart') return {state:'error',progress:0,message:'演示站不会安装更新或重启服务。'};
    const field = key.split('/')[0].replaceAll('-','_');
    if (config[field]) {
      const next = {...body};
      delete next.password;delete next.confirmation;delete next.current_password;delete next.token;delete next.proxy;
      config[field] = {...config[field],...next};
      return config[field];
    }
    return {ok:true};
  };
  const responseJSON = (response, data) => {
    const headers = new Headers(response.headers);
    for (const name of ['content-length', 'content-encoding', 'etag']) headers.delete(name);
    headers.set('content-type', 'application/json; charset=utf-8');
    headers.set('cache-control', 'no-store');
    return new Response(JSON.stringify(data), {status: response.status, headers});
  };
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) {
      return originalFetch(input, init);
    }
    const request = new Request(input instanceof Request ? input : url, init);
    const path = url.pathname;
    if(request.method==='POST'&&['/api/activity','/api/play'].includes(path))return result({ok:true});
    if(request.method==='GET'&&['/api/library-processing','/api/media-repair'].includes(path))return result(await read(path));
    if(request.method==='POST'&&path==='/api/library-shortcuts'){
      const body=await request.clone().json(),data=await read(path);
      if(body.action==='favorite'){
        const match=row=>body.entity_id?row.entity_id===body.entity_id:row.kind===body.kind&&row.name===body.name;
        if(body.on&&!data.favorites.some(match))data.favorites.push({entity_id:body.entity_id,kind:body.kind,name:body.name,
          image_url:body.entity_id?globalThis.peachDemoMedia(`/entity-image?kind=${encodeURIComponent(body.kind)}&id=${body.entity_id}`):''});
        if(!body.on)data.favorites=data.favorites.filter(row=>!match(row));
      }
      if(body.action==='save_filter')data.filters.push({id:crypto.randomUUID(),name:body.name,href:body.href});
      if(body.action==='delete_filter')data.filters=data.filters.filter(row=>row.id!==body.id);
      return result(data);
    }
    if(request.method==='POST'&&['/api/reveal','/api/taste/import','/api/pick-folder'].includes(path))return new Response(JSON.stringify({message:'演示站不会访问本机文件或打开系统窗口。'}),{status:400,headers:{'content-type':'application/json; charset=utf-8'}});
    const requestKey = path + url.search;
    if (request.method === 'GET' && snapshots.has(requestKey)) return result(snapshots.get(requestKey));
    if (request.method === 'GET' && path === '/api/post-setup-tutorial') {
      const data = await (await originalFetch(request)).json();
      if (snapshots.has('/api/scraping')) data.scraping.sources=snapshots.get('/api/scraping').sources;
      return result(data);
    }
    if (request.method === 'POST' && ['/api/follow/source','/api/feeds/source','/api/follow/credential'].includes(path)) {
      const body=await request.clone().json();
      if(path==='/api/follow/credential'){
        const data=await read('/api/follow/credentials'),provider=data.providers.find(row=>row.provider===body.provider);
        if(provider){provider.fields=Object.keys(body.values||{}).filter(key=>body.values[key]);provider.present=provider.fields.length>0;provider.missing=provider.needs.filter(key=>!provider.fields.includes(key))}
        return result({ok:true,note:'已在本页演示保存，刷新后恢复录制状态。'});
      }
      const data=await read(path==='/api/follow/source'?'/api/follow?summary=1':'/api/feeds');
      if(body.action==='remove')data.sources=data.sources.filter(row=>row.id!==Number(body.id));
      if(body.action==='enabled'){const row=data.sources.find(row=>row.id===Number(body.id));if(row)row.enabled=body.enabled}
      return result({ok:true,source:Number(body.id),enabled:body.enabled});
    }
    if(request.method==='POST'&&path==='/api/playlist'){
      const body=await request.clone().json(),data=await read('/api/playlists');
      if(body.action==='delete'){data.items=data.items.filter(row=>row.id!==Number(body.id));return result({ok:true,deleted:Number(body.id)})}
      let row=data.items.find(row=>row.id===Number(body.id));
      if(body.action==='create'){
        const ids=body.asset_ids||[],id=Math.max(0,...data.items.map(row=>row.id))+1;
        row={id,name:body.name,source_kind:body.source_kind||'manual',source_seed_asset_id:body.source_seed_asset_id||null,
          current_asset_id:ids[0]||null,preview_asset_id:ids[0]||null,preview_ids:ids.slice(0,5),item_count:ids.length,faces:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        data.items.unshift(row);snapshots.set('/api/playlist?id='+id,{...row,items:await Promise.all(ids.map(async id=>await read('/api/item?id='+id)))});
      }
      if(!row)return result({ok:false,error:'播放列表不存在'});
      const detail=await read('/api/playlist?id='+row.id);
      if(body.action==='rename'){row.name=body.name;detail.name=body.name}
      if(body.action==='add')for(const id of body.asset_ids||[])if(!detail.items.some(item=>item.id===id))detail.items.push(await read('/api/item?id='+id));
      if(body.action==='remove')detail.items=detail.items.filter(item=>item.id!==body.asset_id);
      if(body.action==='progress'){row.current_asset_id=body.asset_id;detail.current_asset_id=body.asset_id}
      row.item_count=detail.items.length;return result({ok:true,playlist:detail});
    }
    if(request.method==='POST'&&['/api/links/check','/api/resource-sync/scan'].includes(path)){
      const body=await request.clone().json();
      if(!snapshots.has(path))snapshots.set(path,await(await originalFetch(path,{method:'POST',body:JSON.stringify({status_only:true})})).json());
      const state=snapshots.get(path);
      if(!body.status_only)Object.assign(state,{status:'complete',check_id:'demo',scan_id:'demo',checked:state.total||0,completed_sources:state.total_sources||0,message:'演示检查完成，未访问真实文件或外部链接。'});
      return result(state);
    }
    if(request.method==='POST'&&path==='/api/organize/preview'){
      const body=await request.clone().json(),data=await read('/api/items?limit=1000');
      const render=(template,item)=>String(template||'').replace(/\{(number|code|title|studio|creator)\}/g,(_,key)=>String(key==='number'?item.code:key==='title'?item.catalog_title||item.name:item[key]||'').replace(/[\\/:*?"<>|]/g,'_'));
      const rows=data.items.filter(item=>!body.location||item.location===body.location).map(item=>({current_path:'R:\\Media\\'+item.name,
        target_path:'R:\\Media\\'+(body.dir_template?render(body.dir_template,item)+'\\':'')+render(body.file_template,item)+'.mp4',action:'rename'}));
      return result({counts:{change:rows.length,unchanged:0},reasons:{},rows:rows.slice(0,20),truncated:rows.length>20});
    }
    if(request.method==='POST'&&['/api/organize/apply','/api/organize/rollback'].includes(path)){
      const data=await read('/api/organize');delete data.moved;delete data.restored;
      Object.assign(data,{status:'complete',[path.endsWith('rollback')?'restored':'moved']:0,last_batch:path.endsWith('rollback')?'':'demo',message:'演示站未移动真实文件。'});return result(data);
    }
    if (path.startsWith('/api/configuration/') && (request.method !== 'GET' || ['updates','update-status','automatic-updates'].includes(path.split('/').at(-1)))) {
      let body = {};try {body = await request.clone().json()}catch{}
      return result(await configuration(path,body));
    }
    if (request.method === 'POST' && path === '/api/taste/source') {
      const body=await request.clone().json();
      const key='/api/taste?window='+encodeURIComponent(body.window||'all'),dashboard=await read(key);
      dashboard.sources=dashboard.sources.filter(source=>source.source_key!==body.source_key);
      dashboard.summary.history_sources=dashboard.sources.length;
      return result({removed:1,dashboard});
    }
    if (request.method === 'POST' && ['/api/scraping/settings','/api/scraping/check','/api/scraping/amane-bridge/check','/api/scraping/amane-bridge/rebuild','/api/library-processing','/api/media-repair','/api/follow/check','/api/feeds/check','/api/taste/refresh'].includes(path)) {
      const body = await request.clone().json().catch(()=>({}));
      if (path === '/api/scraping/settings') {
        const data = await read('/api/scraping');
        const saved = data.sources.find(source=>source.source===body.source);
        if (!saved) return result({ok:false,error:'演示来源不存在'});
        saved.network = body.network ?? saved.network;
        saved.cookie_saved = body.revoke?false:Boolean(body.cookie||body.cookies_text||saved.cookie_saved);
        return result({saved});
      }
      if (path === '/api/scraping/check') return result({results:[{label:'演示连接检查',ok:true,message:'演示站展示录制结果，不连接外部采集来源。'}]});
      if (path === '/api/scraping/amane-bridge/check') return result({latest:'v'+(await read('/api/scraping/amane-bridge')).version});
      if (path === '/api/scraping/amane-bridge/rebuild') {
        const data=await read('/api/scraping/amane-bridge');
        data.job={status:'failed',error:'演示站不会安装工具。'};
        return result(data.job);
      }
      const seed = await read(path);
      const next = {...seed,status:'complete',message:'演示操作已完成；未处理真实文件或连接外部来源。',
        job_id:'demo-'+Date.now(),completed_at:Date.now()/1000,library:body.library||seed.library};
      snapshots.set(path,next);
      return result(next);
    }
    if (url.pathname === '/api/item' && request.method === 'GET') {
      const response = await originalFetch(request);
      if (!response.ok) return response;
      const item = await response.clone().json();
      if (!Number.isInteger(item.id)) return response;
      const previous = items.get(item.id);
      if (previous) Object.assign(item,previous);
      items.set(item.id, item);
      return previous ? responseJSON(response, item) : response;
    }
    if (!['/api/feedback','/api/watch-later','/api/preference','/api/quality-goal'].includes(path) || request.method !== 'POST') return originalFetch(request);
    let body;
    try { body = await request.clone().json(); } catch { return originalFetch(request); }
    let item = items.get(Number(body.id));
    if (!item) {
      const seed = await originalFetch(new URL(`/api/item?id=${encodeURIComponent(body.id)}`, location.href));
      if (!seed.ok) return originalFetch(request);
      item = await seed.json();
      if (!Number.isInteger(item.id)) return originalFetch(request);
      items.set(item.id, item);
    }
    const response = await originalFetch(request);
    if (!response.ok) return response;
    const feedbackResult = await response.clone().json();
    if (feedbackResult.error || feedbackResult.ok === false) return response;
    if (path === '/api/watch-later') item.watch_later = !item.watch_later;
    else if (path === '/api/preference') {item.liked=body.liked;item.like_reason=body.reason||''}
    else if (path === '/api/quality-goal') {item.better_version=body.wanted;item.better_version_reason=body.reason||''}
    else if (body.kind === 'o' || body.kind === 'o-undo') item.o_count = Math.max(0, (Number(item.o_count) || 0) + (body.kind === 'o' ? 1 : -1));
    else if (body.kind === 'rate') item.rating=body.value||null;
    else if (body.kind === 'dispose') item.disposal=item.disposal==='trash'?null:'trash';
    else item.feedback=item.feedback===body.kind?null:body.kind;
    return responseJSON(response, {...feedbackResult, ...item});
  };
})();
