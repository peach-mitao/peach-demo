// 名册查询从同一份当前接口目录回放，分类、搜索和分页共享身份字段。
export function directoryPage(directory, kind, params) {
  const snapshot=directory[kind];
  if(!snapshot)return null;
  const query=(params.get('q')||'').trim().toLowerCase();
  const onlineTags=kind==='onlineTags';
  const source=onlineTags&&params.get('types')!=='all'?directory.onlineGeneralTags:
    kind==='studios'&&query&&directory.studioSearch?directory.studioSearch:snapshot;
  if(!source)return null;
  const available=(source.items||[]).filter(row=>!onlineTags||params.get('types')==='all'||row.cat==='general');
  const all=available.filter(row=>!query||String(row.k||'').toLowerCase().includes(query));
  let category=params.get('category')||params.get('type')||'all';
  if(onlineTags&&!['general','artist','character','copyright','metadata'].includes(category))category='all';
  const rows=all.filter(row=>category==='all'||row.cat===category||(row.identity_categories||[]).includes(category));
  const categories={};
  for(const row of onlineTags?available:all)for(const value of row.cat?[row.cat]:(row.identity_categories||[]))categories[value]=(categories[value]||0)+1;
  const limit=Math.max(1,Math.min(600,Number(params.get('limit'))||120)),offset=Math.max(0,Number(params.get('offset'))||0);
  return {...snapshot,items:rows.slice(offset,offset+limit),total:rows.length,has_more:offset+limit<rows.length,
    ...('categories' in snapshot?{categories}:{})};
}
