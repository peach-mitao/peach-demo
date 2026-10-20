// 演示交互的状态留在当前页面内存中，刷新即恢复录制值。
(() => {
  const overlays = () => {
    document.querySelector('form[action="/login"]')?.addEventListener('submit',event=>{
      event.preventDefault();location.assign('/');
    });
    const notice=document.querySelector('[data-demo-notice]'),toasts=document.querySelector('#toasts');
    const menu=document.querySelector('#searchMenu');
    let queued=false;
    const layout=()=>{
      queued=false;
      const viewport=window.visualViewport,bottom=viewport?viewport.offsetTop+viewport.height:innerHeight;
      if(notice){
        notice.style.bottom=`max(12px,env(safe-area-inset-bottom),${Math.max(12,innerHeight-bottom+12)}px)`;
        document.documentElement.style.setProperty('--demo-notice-height',notice.getBoundingClientRect().height+'px');
      }
      if(menu){
        const edge=notice?.checkVisibility()?Math.min(bottom-12,notice.getBoundingClientRect().top-12):bottom-12;
        document.documentElement.style.setProperty('--demo-search-space',Math.max(0,edge-menu.getBoundingClientRect().top)+'px');
      }
    };
    const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(layout)}};
    const observer=new ResizeObserver(schedule);
    if(notice)observer.observe(notice);
    if(menu){observer.observe(menu);new MutationObserver(schedule).observe(menu,{attributes:true,attributeFilter:['hidden']})}
    window.addEventListener('resize',schedule);
    window.visualViewport?.addEventListener('resize',schedule);
    window.visualViewport?.addEventListener('scroll',schedule);
    layout();
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
  const folderRules = new Map();
  const folderPlans = new Map();
  let folderRevision = 0;
  let searchHistory = [];
  // 每个访客的草稿只存在当前页面内存中，刷新即恢复夹具。
  const snapshots = new Map();
  const pending = new Map();
  const tagPlans = new Map();
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
  const result = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
  });
  let processingRun = null;
  const renderOrganize = (template, values, directory = false) => {
    const text = String(template || '').trim().replaceAll('\\', '/');
    if (/^(?:\/|[a-z]:)|(?:^|\/)\.\.(?:\/|$)/i.test(text) || (!directory && text.includes('/'))) throw Error('请使用相对目录，文件名不能包含目录分隔符。');
    const fill = source => source.replace(/\{([a-z]+)\}/g, (_, key) => {
      if (!Object.hasOwn(values, key)) throw Error(`不支持的占位符：{${key}}`);
      return String(values[key] || '').replace(/[\\/:*?"<>|]/g, '_');
    });
    const optional = text.replace(/\[([^\[\]]*)\]/g, (_, group) => {
      const keys = [...group.matchAll(/\{([a-z]+)\}/g)].map(match => match[1]);
      keys.forEach(key => { if (!Object.hasOwn(values, key)) throw Error(`不支持的占位符：{${key}}`) });
      return keys.some(key => !values[key]) ? '' : fill(group);
    });
    if (/[\[\]]/.test(optional)) throw Error('可选分组格式无效。');
    const result = fill(optional);
    if (/[{}]/.test(result)) throw Error('占位符格式无效。');
    return result;
  };
  const organizeValues = item => ({number:item.code,code:item.code,title:item.catalog_title||item.name,
    studio:item.studio||'',creator:item.creator||'',series:item.series||'',year:String(item.release||'').slice(0,4),
    actors:(item.performers||[]).join('、'),cd:'',mosaic:item.is_jav?'有码':'',definition:'1080p'});
  const processingState = async () => {
    const state = await read('/api/library-processing');
    state.metadata_only=snapshots.get('/api/media-processing')?.metadata_only??state.metadata_only??false;
    if (processingRun && state.status === 'running') {
      const elapsed = processingRun.elapsed + Date.now() - processingRun.started;
      const fraction = Math.min(1, elapsed / 30000);
      state.checked = Math.floor(state.total * fraction);
      state.eta_seconds_min = state.eta_seconds_max = Math.max(0,Math.ceil((30000 - elapsed) / 1000));
      if (fraction === 1) {
        Object.assign(state, {status:'complete',completed_at:Date.now()/1000,
          message:'演示操作已完成；未处理真实文件或连接外部来源。'});
        processingRun = null;
      }
    }
    return state;
  };
  const configuration = async (path, body) => {
    const config = await read('/api/configuration');
    const key = path.slice('/api/configuration/'.length);
    if(key==='downloads/check'||key==='downloads/folder')return read('/api/configuration/downloads/check');
    if(key==='downloads'){
      const {token: _token,...safe}=body;
      config.downloads.config={...config.downloads.config,...safe};
      return {...config.downloads,report:await read('/api/configuration/downloads/check')};
    }
    if(key.startsWith('downloads/pikpak/')){
      const account=config.downloads.pikpak;
      account.logged_in=!key.endsWith('logout');
      account.username=account.logged_in?'demo@example.com':'';
      return key.endsWith('/login')?{ok:true,settings:config.downloads}:config.downloads;
    }
    if(key==='cloud-proxies'){
      const state=await read(path),account=state.accounts.find(row=>row.id===body.id);
      if(!account)throw Error('演示账号不存在');
      for(const field of ['api','data'])if(body[field]){
        const {password,clear_password,...value}=body[field];
        account[field]={...account[field],...value,password_set:clear_password?false:Boolean(password||account[field].password_set)};
      }
      return account;
    }
    if(key==='indexers'){
      const state=await read(path);
      state.indexers=(body.indexers||[]).map(({api_key,clear_api_key,...row})=>({...row,api_key_set:clear_api_key?false:Boolean(api_key||row.api_key_set)}));
      return state;
    }
    if(key==='jav-browser'){
      const state=await read(path);
      state.enabled=body.action!=='disable';state.provider=body.provider||state.provider;
      state.active_provider=state.enabled?state.provider:'';
      return {...state,...(state.enabled?{token:'demo-preview-token'}:{})};
    }
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
    if(path==='/api/tag-management'||path==='/api/tag-management/preview'){
      const body=request.method==='GET'?{}:await request.clone().json();
      const scope=body.scope||url.searchParams.get('scope')||'local',key='/api/tag-management'+(scope==='online'?'?scope=online':'');
      const inventory=await read(key);
      if(request.method==='GET')return result(inventory);
      try{
        if(path.endsWith('/preview')){
          const catalog=await read('/api/items?limit=1000');
          const plan=globalThis.peachDemoTags.previewTags(inventory,body,catalog.items,crypto.randomUUID());
          tagPlans.set(plan.token,plan);return result(plan);
        }
        const plan=tagPlans.get(body.token);if(!plan)return result({message:'请先预览操作范围'},409);
        snapshots.set(key,globalThis.peachDemoTags.applyTagPlan(inventory,plan,body));tagPlans.delete(body.token);
        return result({ok:true});
      }catch(error){return result({message:error.message},400)}
    }
    if(request.method==='GET'&&((path==='/api/index'&&url.searchParams.get('kind')==='tags')||path==='/api/follow/tags')){
      const key='/api/tag-management'+(path==='/api/follow/tags'?'?scope=online':'');
      if(snapshots.has(key)){
        const inventory=snapshots.get(key);
        const source=path==='/api/follow/tags'&&url.searchParams.get('types')!=='all'?{...inventory,items:inventory.items.filter(row=>row.cat==='general')}:inventory;
        return result(globalThis.peachDemoTags.tagDirectory(source,url.searchParams));
      }
    }
    if(['/api/setup','/api/setup/restore'].includes(path)&&request.method==='POST')return result({
      url:'/',restored:path.endsWith('/restore'),scan_requested:false,history_guide:false,standalone:false,redirect:null,
      facts:[{term:'数据目录',value:'C:\\Users\\peach\\peach-data'}],
    });
    if(path==='/api/subtitles/convert'&&request.method==='POST'){
      const name=url.searchParams.get('name')||'';
      if(!name.toLowerCase().endsWith('.vtt'))return result({error:'演示站可加载 WebVTT 文件或在线演示字幕。'},400);
      return new Response(await request.text(),{headers:{'content-type':'text/vtt; charset=utf-8'}});
    }
    if(path==='/api/wants/magnets'){
      const state=await read('/api/wants'),want=state.items.find(row=>row.id===Number(url.searchParams.get('id')));
      if(!want)return result({state:'unavailable',items:[],error:'条目不存在'},404);
      if(!want.code||['unreleased','acquired'].includes(want.phase))return result({state:'unavailable',items:[],error:''});
      return originalFetch('/api/jav/resources?'+new URLSearchParams({code:want.code}));
    }
    if(path==='/api/wants'){
      const state=await read(path);
      if(request.method==='GET')return result(url.searchParams.has('follow')?{want:state.items.find(row=>row.follow_item_id===Number(url.searchParams.get('follow')))||null}:state);
      const body=await request.clone().json();
      if(body.action==='remove')state.items=state.items.filter(row=>!body.ids.includes(row.id));
      if(body.action==='reset')for(const item of state.items)if(body.ids.includes(item.id))item.phase='searching';
      const existing=state.items.find(row=>body.code?row.code===body.code:body.follow_item_id&&row.follow_item_id===body.follow_item_id);
      if(body.action==='add'&&!existing){
        state.items.unshift({id:Date.now(),code:body.code||null,title:body.code||'演示想要作品',origin:'code',phase:'searching',
          performers:'',studio:'',release_date:null,cover:null,remote_cover:false,search_count:0,scraped:false,created_at:new Date().toISOString(),follow_item_id:body.follow_item_id||null});
      }
      state.counts=Object.fromEntries(['searching','unreleased','given_up','acquired'].map(phase=>[phase,state.items.filter(row=>row.phase===phase).length]));
      return result(body.action==='add'?{created:!existing,want:existing||state.items[0]}:{ok:true});
    }
    if(path==='/api/orphan-records'&&request.method==='GET')return result(await read(path));
    if(path==='/api/orphan-records/attach'&&request.method==='POST'){
      const body=await request.clone().json(),state=await read('/api/orphan-records');
      state.items=state.items.filter(row=>row.id!==body.id&&row.id!==body.asset_id);state.total=state.items.length;
      return result({ok:true,moved:1,batch:'demo-attach'});
    }
    if(path==='/api/downloads'||path.startsWith('/api/downloads/')){
      const state=await read('/api/downloads');
      if(request.method==='GET'){
        const before=Number(url.searchParams.get('before_id')),limit=Math.max(1,Math.min(50,Number(url.searchParams.get('limit'))||20));
        const rows=state.tasks.filter(row=>!before||row.id<before),tasks=rows.slice(0,limit),more=rows.length>limit;
        return result({...state,tasks,has_more:more,next_before_id:more?tasks.at(-1).id:null});
      }
      const body=await request.clone().json(),task=state.tasks.find(row=>row.id===body.id);
      if(path==='/api/downloads'){
        let previous=state.tasks.find(row=>row.source_uri===body.magnet);
        if(!previous){
          const provider=state.providers.find(row=>row.key===body.provider);
          if(!provider)return result({ok:false,message:'请选择演示下载渠道'},400);
          previous={...state.tasks[0],id:Math.max(0,...state.tasks.map(row=>row.id))+1,source_uri:body.magnet,code:body.code||'',
            display_name:body.title||body.code||'演示云下载',provider:provider.key,provider_label:provider.label,target:provider.target};
          state.tasks.unshift(previous);
        }
        Object.assign(previous,{state:'remote_running',state_label:'下载中',cancellable:true,resubmittable:false,failure_reason:null,failure_detail:null,progress:0});
        return result({ok:true,outcome:'submitted',task:previous});
      }
      if(task){
        if(path.endsWith('/cancel'))Object.assign(task,{state:'cancelled',state_label:'已取消',cancellable:false,progress:null});
        if(path.endsWith('/postprocess'))Object.assign(task,{postprocess_state:'complete',postprocess_label:'整理完成',postprocess_retryable:false});
        return result({ok:true,task});
      }
      return result({ok:false,message:'演示任务不存在'},404);
    }
    if(path==='/api/configuration'){
      const config=await read(path);
      if(request.method==='POST'){
        const body=await request.clone().json();
        for(const key of ['media_dirs','media_sources','port'])if(Object.hasOwn(body,key))config[key]=body[key];
      }
      return result(config);
    }
    if(path.startsWith('/api/configuration/')&&request.method==='GET'&&snapshots.has(path))return result(snapshots.get(path));
    if(path==='/api/subtitles/memory'){
      const key=path+url.search,state=await read(key);
      if(request.method==='PUT'){
        const body=await request.clone().json();state.selected=body.selected;
        if(body.track){
          const track={key:body.track.key,name:body.track.name,src:URL.createObjectURL(new Blob([body.track.text],{type:'text/vtt'}))};
          state.tracks=[...state.tracks.filter(row=>row.key!==track.key),track];
        }
      }
      return result(state);
    }
    if(path==='/api/folders'&&request.method==='GET'){
      const response=await originalFetch(input,init);
      if(!response.ok)return response;
      const data=await response.json();
      return responseJSON(response,{...data,rule:folderRules.get(data.selected?.id)||null,
        rules:[...folderRules.values()],rules_revision:folderRevision});
    }
    if(['/api/folders/preview','/api/folders/rule'].includes(path)&&request.method==='POST'){
      const body=await request.clone().json();
      const response=await originalFetch('/api/folders?'+new URLSearchParams({folder:body.folder||''}));
      if(!response.ok)return response;
      const folder=(await response.json()).selected;
      if(!folder)return result({message:'请选择演示目录。'},400);
      if(path==='/api/folders/rule'&&body.expected_revision!==folderRevision)return result({message:'目录规则已更新，请重新预览。'},409);
      if(path==='/api/folders/rule'&&body.action==='remove'){
        folderRules.delete(folder.id);folderPlans.delete(folder.id);folderRevision++;
        return result({ok:true,withdrawn:0});
      }
      if(!['category','creator','performer','seller','studio'].includes(body.purpose)||
        (body.purpose!=='category'&&!String(body.name||'').trim()))return result({message:'请填写目录用途和关联名称。'},400);
      const signature=JSON.stringify([body.purpose,body.name||'',body.recursive!==false,body.future!==false]);
      if(path==='/api/folders/preview'){
        const dataResponse=await originalFetch('/api/items?'+new URLSearchParams({folder:folder.id,folder_recursive:body.recursive===false?'0':'1',limit:'1000'}));
        if(!dataResponse.ok)return dataResponse;
        const data=await dataResponse.json(),plan=crypto.randomUUID();
        folderPlans.set(folder.id,{plan,signature,revision:folderRevision});
        return result({plan_version:plan,total:data.total,applicable:body.purpose==='category'?0:data.total,
          withdrawn:0,conflicts:[],sample:data.items.slice(0,5).map(row=>({id:row.id,name:row.name}))});
      }
      const plan=folderPlans.get(folder.id);
      if(!plan||plan.plan!==body.plan_version||plan.signature!==signature||plan.revision!==folderRevision)return result({message:'目录用途已改变，请重新预览。'},409);
      folderRules.set(folder.id,{id:folder.id,location:folder.location,path:folder.path,purpose:body.purpose,
        name:String(body.name||'').trim(),entity_id:null,recursive:body.recursive!==false,future:body.future!==false});
      folderPlans.delete(folder.id);folderRevision++;
      return result({ok:true,applied:0,conflicts:0});
    }
    if(path==='/api/search-history'&&['GET','POST'].includes(request.method)){
      if(request.method==='POST'){
        const body=await request.clone().json(),query=String(body.query||'').trim();
        searchHistory=searchHistory.filter(value=>value.toLocaleLowerCase()!==query.toLocaleLowerCase());
        if(query&&body.operation!=='remove')searchHistory=[query,...searchHistory].slice(0,100);
      }
      const limit=Math.max(0,Math.min(100,Number(url.searchParams.get('limit'))||10));
      return result({items:searchHistory.slice(0,limit)});
    }
    if(request.method==='POST'&&['/api/activity','/api/play'].includes(path))return result({ok:true});
    if(path==='/api/media-processing'&&['GET','POST'].includes(request.method)){
      const policy=snapshots.get(path)||{metadata_only:false};
      if(request.method==='POST'){
        const body=await request.clone().json().catch(()=>({}));
        if(typeof body.metadata_only!=='boolean')return result({message:'视频预览设置无效。'},400);
        policy.metadata_only=body.metadata_only;
      }
      snapshots.set(path,policy);return result(policy);
    }
    if(request.method==='GET'&&path==='/api/library-processing'){
      if(url.searchParams.get('estimate')==='1')return result({traffic:{used_bytes:0,estimated_bytes:0,estimated_min_bytes:0,estimated_max_bytes:0,
        metered_used_bytes:0,metered_estimated_bytes:0,metered_estimated_min_bytes:0,metered_estimated_max_bytes:0,partial:false,unknown_files:false,sources:[],
        disk:{estimated_bytes:0,temporary_bytes:0,volumes:[],cache_unknown:false,can_fit:null}}});
      return result(await processingState());
    }
    if(request.method==='GET'&&path==='/api/media-repair')return result(await read(path));
    if(request.method==='POST'&&path==='/api/library-processing'){
      const body=await request.clone().json().catch(()=>({})),state=await processingState();
      const active=['running','paused'].includes(state.status);
      if(body.speed_mode&&!['low','standard','high'].includes(body.speed_mode))return result({message:'处理速度无效。'},400);
      if(body.action){
        if(body.job_id&&body.job_id!==state.job_id)return result({message:'演示任务已结束，请重新操作。'},409);
        if(body.action==='set_speed'){
          state.speed_mode=body.speed_mode||'standard';
          return result(state);
        }
        if(!active||!processingRun)return result({message:'当前没有可控制的演示任务。'},409);
        if(body.action==='pause'&&state.status==='running'){
          processingRun.elapsed+=Date.now()-processingRun.started;
          state.status='paused';
        }else if(body.action==='resume'&&state.status==='paused'){
          processingRun.started=Date.now();state.status='running';
        }else return result({message:'演示任务状态与操作不匹配。'},409);
        return result(state);
      }
      if(active)return result({message:'演示任务正在进行。'},409);
      const next={...state,status:'running',job_id:'demo-'+crypto.randomUUID(),requested_stage:body.stage||'scan',
        stage:body.stage==='previews'?'生成视频预览':body.stage==='metadata'?'补全资料':'扫描文件',
        speed_mode:body.speed_mode||state.speed_mode||'standard',checked:0,total:Math.max(1,Number(state.total)||123),
        eta_seconds_min:30,eta_seconds_max:30,eta_kind:'measured',started_at:Date.now()/1000,error:null,completed_at:null};
      processingRun={started:Date.now(),elapsed:0};snapshots.set(path,next);return result(next);
    }
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
    if(request.method==='GET'&&path==='/api/organize/example'){
      const values={code:'ABC-123',number:'ABC-123',title:'标题',studio:'厂牌',creator:'创作者',series:'系列',year:'2024',actors:'甲、乙',cd:'2',mosaic:'无码',definition:'1080p'};
      let field='file';
      try {
        const filename=renderOrganize(url.searchParams.get('file_template'),values)||'ABC-123 标题';field='dir';
        const directory=renderOrganize(url.searchParams.get('dir_template'),values,true);
        return result({ok:true,example:[directory,filename+'.mp4'].filter(Boolean).join('/')});
      } catch(error) { return result({ok:false,error:error.message,field}) }
    }
    if(request.method==='POST'&&path==='/api/organize/preview'){
      const body=await request.clone().json(),data=await read('/api/items?limit=1000');
      let rows;
      try { rows=data.items.filter(item=>!body.location||item.location===body.location).map(item=>({current_path:'R:\\Media\\'+item.name,
        target_path:'R:\\Media\\'+[renderOrganize(body.dir_template,organizeValues(item),true),
          (renderOrganize(body.file_template,organizeValues(item))||item.name.replace(/\.[^.]+$/,''))+'.mp4'].filter(Boolean).join('\\'),action:'rename'})) }
      catch(error) { return result({error:error.message,message:error.message},400) }
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
    if (request.method === 'POST' && ['/api/scraping/settings','/api/scraping/check','/api/scraping/amane-bridge/check','/api/scraping/amane-bridge/rebuild','/api/media-repair','/api/follow/check','/api/feeds/check','/api/taste/refresh'].includes(path)) {
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
