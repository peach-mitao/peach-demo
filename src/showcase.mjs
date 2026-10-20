// 演示专用连接配置，只使用公开占位地址。
export const sources = [
  {location:'local', root:'R:\\Media', path:'R:\\Media', library:'演示馆藏', library_icon:'local', online:true, cost:'free'},
  {location:'115', root:'A:\\115', path:'A:\\115', library:'115 收藏', library_icon:'115', online:true, cost:'metered'},
  {location:'pikpak', root:'B:\\PikPak', path:'B:\\PikPak', library:'PikPak 收藏', library_icon:'pikpak', online:true, cost:'metered'},
];
export const providers = [
  {key:'115', source:'115', label:'115 收藏 · 115', configured:true, target:'/115/Peach', root:'A:\\115', can_cancel:true},
  {key:'pikpak', source:'pikpak', label:'PikPak 收藏 · PikPak', configured:true, target:'/Peach', root:'B:\\PikPak', can_cancel:true},
  {key:'clouddrive:pikpak:demo', source:'pikpak', label:'PikPak · CloudDrive2', configured:true, target:'/PikPak/Peach', root:'B:\\PikPak', can_cancel:true},
];
export const downloads = () => ({available:true, media_sources:['local','115','pikpak'],
  config:{clouddrive_address:'http://localhost:19798', targets:{'115':'/115/Peach',pikpak:'/Peach'}, pikpak_root:'B:\\PikPak', wait_hours:24},
  token_set:true, pikpak:{logged_in:true,username:'demo@example.com',remember:false,method:'browser'},
  pikpak_browser:{available:true,state:'idle',message:''}, pikpak_roots:['B:\\PikPak'], providers:structuredClone(providers), max_wait_hours:168});
export const downloadCheck = () => ({ok:true,address:'http://localhost:19798',
  permissions:[{name:'allow_add_offline_download',label:'提交离线任务',granted:true},{name:'allow_list_offline_downloads',label:'查看离线任务',granted:true}],
  missing:[],root:'/115',folder:{path:'/115/Peach',can_offline:true,cloud:'115'},
  quota:{total:100,used:12,left:88},suggested_target:{path:'/115/Peach',exists:true},suggested_pikpak_root:'B:\\PikPak',problems:[]});
const proxy = mode => ({mode,host:'',port:0,username:'',password_set:false});
export const cloudProxies = () => ({accounts:sources.slice(1).map((source,index)=>({
  id:`demo-cloud-${index+1}`,name:source.library,cloud:source.location,path:index?'/PikPak':'/115',revision:'demo-1',writable:true,
  api:proxy('system'),data:proxy('direct'),libraries:[{name:source.library,root:source.root,location:source.location}],
})),unlinked:[]});
export function configuration(recorded, version) {
  const data=structuredClone(recorded);
  Object.assign(data,{editable:true,notice:'',port_editable:true,ledger_read_only:false,revision:'demo-configuration',
    media_sources:structuredClone(sources),media_dirs:sources.map(row=>row.path),library_count:sources.length,downloads:downloads(),
    remote_reporting:{usage:false,errors:false,available:true,fields:{usage:'版本与系统信息',errors:'故障类型与代码位置'},notice:''},
    library_sharing:{enabled:false,available:true,schema:1,fields:['作品','标签','评分','观看汇总','偏好维度'],notice:'每周上传作品、标签、评分、观看汇总及偏好维度明细。'},
  });
  data.updates={...data.updates,current_version:version,latest_version:version,state:'current',message:'已是最新版本',release_url:'https://github.com/peach-mitao/peach/releases'};
  data.facts=data.facts.map(row=>row.term==='版本'?{...row,value:version}:row);
  data.access={mode:'password',revision:'demo-access',password_set:true};
  data.automatic_updates={mode:'notify',interval_hours:24,available:true,download_available:true};
  data.tunnel={...data.tunnel,available:true,named_available:true,mode:'named',hostname:'peach.example.com',token_set:true,state:'stopped'};
  data.push_discovery={...data.push_discovery,enabled:true,available:true,watch_local:true,cloud:true,local_running:true,
    local_roots:['R:\\Media'],media_roots:sources.map(row=>row.root),
    prefixes:[{prefix:'/115/Peach',root:'A:\\115'},{prefix:'/PikPak/Peach',root:'B:\\PikPak'}]};
  // 操作系统卸载保持不可执行；演示不能创建真实系统操作。
  return data;
}
