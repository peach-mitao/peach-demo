// 发现视图从同一份已录资料排序，更新资料请求仍回放当前演示快照。
import type {DiscoveryRow} from './types.ts';

const sorts = ['taste', 'release_date', 'source_score', 'duration', 'code'] as const;
type Sort = typeof sorts[number];
const isSort = (value: string | null): value is Sort => sorts.some(sort => sort === value);

function orderDiscoveries<T extends DiscoveryRow>(rows: T[], sort: Sort, direction: string) {
  const order=direction==='asc'?1:-1;
  const column=sort==='taste'?'taste_score':sort;
  return [...rows].sort((a,b)=>{
    const left=a[column]??(sort==='taste'?a.score:null),right=b[column]??(sort==='taste'?b.score:null);
    if(left==null||left==='')return right==null||right===''?0:1;
    if(right==null||right==='')return -1;
    return order*(typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right)));
  });
}

export function discoveryPage<T extends {items: DiscoveryRow[]}>(snapshot: T, params: URLSearchParams) {
  const asked=params.get('sort'),sort=isSort(asked)?asked:'taste';
  const direction=params.get('direction')==='asc'?'asc':'desc';
  const items=orderDiscoveries(snapshot.items,sort,direction);
  const limit=Math.max(1,Math.min(100,Math.trunc(Number(params.get('limit')))||60));
  return {...snapshot,sort,direction,ranking_method:sort==='taste'?'mmr':'field-sort',items:items.slice(0,limit).map((row,i)=>({...row,rank:i+1}))};
}

interface ReleaseRow extends DiscoveryRow {
  id: number;
  title: string;
  studio: string;
  tags: string[];
  performer_refs: { name: string }[];
}
export type {ReleaseRow};

export function releasePage(rows:ReleaseRow[],params:URLSearchParams) {
  const asked=params.get('sort'),sort=isSort(asked)?asked:'release_date';
  const direction=params.get('direction')==='asc'?'asc':'desc';
  const search=(params.get('q')||'').trim().toLowerCase();
  const picks={
    performer:(row:ReleaseRow)=>row.performer_refs.map(person=>person.name),
    studio:(row:ReleaseRow)=>[row.studio],
    tag:(row:ReleaseRow)=>row.tags,
  };
  const dimensions=Object.keys(picks) as (keyof typeof picks)[];
  const matches=(row:ReleaseRow,skip?:keyof typeof picks)=>[row.code,row.title].some(value=>value?.toLowerCase().includes(search)) &&
    dimensions.every(key=>key===skip||!params.get(key)||picks[key](row).includes(params.get(key)!));
  const selected=rows.filter(row=>matches(row));
  const facet=(key:keyof typeof picks)=>{
    const counts=new Map<string,number>();
    for(const row of rows.filter(item=>matches(item,key)))for(const name of picks[key](row))
      if(name)counts.set(name,(counts.get(name)||0)+1);
    return [...counts].map(([name,count])=>({name,count,...(key==='studio'?{has_logo:false}:{})}))
      .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  };
  const column=params.get('column');
  if(column==='release'){
    const date_values=[...new Set(selected.map(row=>row.release_date).filter((value):value is string=>Boolean(value)))].sort();
    return {column,date_values};
  }
  if(column==='people'||column==='studio'||column==='tags'){
    const query=(params.get('query')||'').toLowerCase();
    const values=facet(column==='people'?'performer':column==='tags'?'tag':'studio').filter(row=>row.name.toLowerCase().includes(query));
    const offset=Math.max(0,Math.trunc(Number(params.get('offset')))||0);
    const count=Math.min(100,Math.max(1,Math.trunc(Number(params.get('limit')))||24));
    return {items:values.slice(offset,offset+count),next_offset:offset+count<values.length?offset+count:null};
  }
  const size=Math.min(100,Math.max(1,Math.trunc(Number(params.get('size')))||24));
  const page=Math.max(1,Math.trunc(Number(params.get('page')))||1);
  const items=orderDiscoveries(selected,sort,direction).slice((page-1)*size,page*size);
  return {items,total:selected.length,candidate_total:rows.length,page,size,sort,direction,
    facets:{performers:facet('performer'),studios:facet('studio'),tags:facet('tag')},metadata_unread:0,metadata_job:null};
}

// 订阅推荐只缩小已录制的首屏，超出不完整录制范围的请求保持未取得。
export function feedDiscoveryPage<T extends {items: unknown[]; more?: boolean}>(snapshot: T,params: URLSearchParams){
  if([...params.keys()].some(key=>!['limit','_','library'].includes(key)))return null;
  const limit=Math.min(100,Math.max(1,Math.trunc(Number(params.get('limit')))||12));
  if(snapshot.more&&limit>snapshot.items.length)return null;
  return{...snapshot,items:snapshot.items.slice(0,limit),more:!!snapshot.more||snapshot.items.length>limit};
}
