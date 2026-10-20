// 标签操作使用演示目录和页面草稿，不连接真实账本。
export const tagId = row => row.id ?? row.entity_id;
export function tagInventory(indexes, scope='local') {
  return {revision:0,duplicate_groups:[],items:(scope==='online'?indexes.onlineTags:indexes.tags).items.map(row=>({
    ...row,...(scope==='online'?{id:`demo:${row.cat||'general'}:${row.k}`}:{entity_id:row.entity_id}),
    hidden:false,aliases:[...(row.aliases||[])],originals:[row.k],
  }))};
}
export function previewTags(inventory, command, items=[], token='demo') {
  const operation=command.operation,ids=[...new Set(command.ids||[])];
  if(!['rename','merge','hide','restore','repair'].includes(operation))throw Error('未知的标签操作');
  const tags=inventory.items.filter(row=>ids.some(id=>String(id)===String(tagId(row))));
  if(!tags.length||tags.length!==ids.length)throw Error('请选择有效标签');
  const name=String(command.name||'').trim();
  if(operation==='rename'){
    if(tags.length!==1||!name||name.length>80)throw Error('标签名须为 1 至 80 个字符');
    if(inventory.items.some(row=>row!==tags[0]&&[row.k,...row.aliases].some(word=>word.toLocaleLowerCase()===name.toLocaleLowerCase())))throw Error('名称已属于其他标签，请使用合并标签');
  }
  if(operation==='merge'){
    if(tags.length<2||!tags.some(row=>String(tagId(row))===String(command.target_id)))throw Error('请选择至少两个标签，并从中选择保留的标签');
    if(command.scope==='online'&&new Set(tags.map(row=>row.cat||'general')).size!==1)throw Error('在线标签只能合并相同来源类型');
  }
  const names=new Set(tags.flatMap(row=>row.originals||[row.k]));
  const assets=items.filter(item=>[...(item.filter_tags||item.tags||[])].some(tag=>names.has(typeof tag==='string'?tag:tag.name))).length;
  const count=command.scope==='online'?tags.reduce((sum,row)=>sum+row.n,0):assets;
  return {...command,name,tags:structuredClone(tags),assets:count,overlap:Math.max(0,tags.reduce((sum,row)=>sum+row.n,0)-count),token,revision:inventory.revision};
}
export function applyTagPlan(inventory, plan, command) {
  if(command.token!==plan.token||plan.revision!==inventory.revision)throw Error('标签已变化，请重新预览操作范围');
  for(const key of ['operation','ids','name','target_id','scope']){
    const expected=key==='name'?String(plan[key]||'').trim():plan[key];
    const actual=key==='name'?String(command[key]||'').trim():command[key];
    if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('操作已变化，请重新预览操作范围');
  }
  const next=structuredClone(inventory),selected=new Set(plan.tags.map(row=>String(tagId(row))));
  const rows=next.items.filter(row=>selected.has(String(tagId(row))));
  if(plan.operation==='rename'){
    const row=rows[0];row.aliases=[...new Set([...row.aliases,row.k])];row.k=plan.name;
  }else if(['hide','restore'].includes(plan.operation)){
    for(const row of rows)row.hidden=plan.operation==='hide';
  }else if(plan.operation==='merge'){
    const target=rows.find(row=>String(tagId(row))===String(plan.target_id));
    target.aliases=[...new Set(rows.flatMap(row=>[row.k,...row.aliases]))].filter(name=>name!==target.k);
    target.originals=[...new Set(rows.flatMap(row=>row.originals||[row.k]))];target.n=plan.assets;
    next.items=next.items.filter(row=>!selected.has(String(tagId(row)))||row===target);
  }
  next.revision++;return next;
}
export function tagDirectory(inventory, params) {
  const query=(params.get('q')||'').toLocaleLowerCase(),category=params.get('category')||params.get('type')||'all';
  const available=inventory.items.filter(row=>!row.hidden&&(!query||[row.k,...row.aliases].some(name=>name.toLocaleLowerCase().includes(query))));
  const rows=available.filter(row=>category==='all'||row.cat===category),categories={};
  for(const row of available)categories[row.cat||'general']=(categories[row.cat||'general']||0)+1;
  const offset=Math.max(0,Number(params.get('offset'))||0),limit=Math.max(1,Math.min(600,Number(params.get('limit'))||120));
  return {kind:'tags',items:rows.slice(offset,offset+limit),total:rows.length,has_more:offset+limit<rows.length,categories};
}
