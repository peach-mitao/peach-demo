// 发现视图从同一份已录资料排序，更新资料请求仍回放当前演示快照。
import type {DiscoveryRow} from './types.ts';

const sorts = ['taste', 'release_date', 'source_score', 'duration', 'code'] as const;
type Sort = typeof sorts[number];
const isSort = (value: string | null): value is Sort => sorts.some(sort => sort === value);

export function discoveryPage<T extends {items: DiscoveryRow[]}>(snapshot: T, params: URLSearchParams) {
  const asked=params.get('sort'),sort=isSort(asked)?asked:'taste';
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

// 订阅推荐只缩小已录制的首屏，超出不完整录制范围的请求保持未取得。
export function feedDiscoveryPage<T extends {items: unknown[]; more?: boolean}>(snapshot: T,params: URLSearchParams){
  if([...params.keys()].some(key=>!['limit','_','library'].includes(key)))return null;
  const limit=Math.min(100,Math.max(1,Math.trunc(Number(params.get('limit')))||12));
  if(snapshot.more&&limit>snapshot.items.length)return null;
  return{...snapshot,items:snapshot.items.slice(0,limit),more:!!snapshot.more||snapshot.items.length>limit};
}
