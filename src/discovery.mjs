// 发现视图从同一份已录资料排序，更新资料请求仍回放当前演示快照。
export function discoveryPage(snapshot, params) {
  const asked=params.get('sort'),sort=['taste','release_date','source_score','duration','code'].includes(asked)?asked:'taste';
  const direction=params.get('direction')==='asc'?'asc':'desc',order=direction==='asc'?1:-1;
  const column=sort==='taste'?'taste_score':sort;
  const items=[...snapshot.items].sort((a,b)=>{
    const left=a[column]??(sort==='taste'?a.score:null),right=b[column]??(sort==='taste'?b.score:null);
    if(left==null||left==='')return right==null||right===''?0:1;
    if(right==null||right==='')return -1;
    return order*(typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right)));
  });
  const limit=Math.max(1,Math.min(100,Math.trunc(Number(params.get('limit')))||60));
  return {...snapshot,sort,direction,ranking_method:sort==='taste'?'mmr':'field-sort',items:items.slice(0,limit).map((row,i)=>({...row,rank:i+1}))};
}
