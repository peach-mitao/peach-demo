// 关注推荐复用完整录制分组；排序与分页不改变作者来源及头像字段。
import type {FollowGroup} from './types.ts';
import {catalogName, type CatalogNames} from './catalog-language.ts';

export function followPage<T extends {groups?: FollowGroup[]; has_more?: boolean}>(snapshot: T,params: URLSearchParams,names: CatalogNames = {}){
  const supported=new Set(['limit','offset','sort','dir','seed','_','library','author','provider','status','tag','work','dur_min','dur_max']);
  if([...params.keys()].some(key=>!supported.has(key))||snapshot.has_more)return null;
  const sort=params.get('sort')||'new',dir=params.get('dir')==='asc'?'asc':'desc';
  if(!['new','rand'].includes(sort))return null;
  const raw=params.get('seed')||'1',seed=/^\d+$/.test(raw)?Number(raw):1;
  const values = (key: string) => (params.get(key) || '').split(',').filter(Boolean);
  const authors = values('author'), providers = values('provider');
  const tags = values('tag').map(tag => catalogName(names, tag));
  const works = values('work'), status = params.get('status');
  const min = Number(params.get('dur_min')) || 0, max = Number(params.get('dur_max')) || Infinity;
  // 公开片目没有在线作品题材。带时长的筛选只匹配有时长的条目。
  const groups = (snapshot.groups || []).filter(({primary}) => !works.length
      && (!status || status === 'all' || primary.status === status)
      && (!authors.length || authors.includes(primary.author_key || ''))
      && (!providers.length || providers.includes(primary.provider || ''))
      && tags.every(tag => primary.tags?.includes(tag))
      && ((!min && max === Infinity) || (!!primary.duration && primary.duration >= min && primary.duration <= max)));
  if(sort==='rand'){
    // 与 Peach web_follow._seed_key、_sorted_groups 使用同一排序式。
    const scale=(seed||1)%99991||7,rank=(group: FollowGroup)=>(group.primary.id*scale)%99991;
    groups.sort((a,b)=>rank(a)-rank(b)||a.primary.id-b.primary.id);
  }else if(dir==='asc')groups.reverse();
  const limit=Math.min(1000,Math.max(1,Math.trunc(Number(params.get('limit')))||200));
  const offset=Math.max(0,Math.trunc(Number(params.get('offset')))||0);
  return{...snapshot,groups:groups.slice(offset,offset+limit),sort,dir,seed,limit,offset,has_more:offset+limit<groups.length};
}
