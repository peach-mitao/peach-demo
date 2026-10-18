// 关注推荐复用完整录制分组；排序与分页不改变作者来源及头像字段。
export function followPage(snapshot,params){
  const supported=new Set(['limit','offset','sort','dir','seed','_','library']);
  if([...params.keys()].some(key=>!supported.has(key))||snapshot.has_more)return null;
  const sort=params.get('sort')||'new',dir=params.get('dir')==='asc'?'asc':'desc';
  if(!['new','rand'].includes(sort))return null;
  const raw=params.get('seed')||'1',seed=/^\d+$/.test(raw)?Number(raw):1;
  const groups=[...(snapshot.groups||[])];
  if(sort==='rand'){
    // 与 Peach web_follow._seed_key、_sorted_groups 使用同一排序式。
    const scale=(seed||1)%99991||7,rank=group=>(group.primary.id*scale)%99991;
    groups.sort((a,b)=>rank(a)-rank(b)||a.primary.id-b.primary.id);
  }else if(dir==='asc')groups.reverse();
  const limit=Math.min(1000,Math.max(1,Math.trunc(Number(params.get('limit')))||200));
  const offset=Math.max(0,Math.trunc(Number(params.get('offset')))||0);
  return{...snapshot,groups:groups.slice(offset,offset+limit),sort,dir,seed,limit,offset,has_more:offset+limit<groups.length};
}
