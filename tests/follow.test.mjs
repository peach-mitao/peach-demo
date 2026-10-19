import test from 'node:test';
import assert from 'node:assert/strict';
import {followPage} from '../src/follow.ts';
const snapshot={sources:[{author_key:'entity:152',avatar_url:'/follow-avatar?provider=kemono&ref=demo'}],
 author_aliases:[],counts:{new:3},groups:[1,2,3].map(id=>({primary:{id},release_key:String(id)})),has_more:false};

test('推荐分页保留作者身份和头像来源',()=>{
 const page=followPage(snapshot,new URLSearchParams('limit=20&sort=rand&seed=50000'));
 assert.equal(page.sources[0].author_key,'entity:152');assert.equal(page.sources[0].avatar_url,'/follow-avatar?provider=kemono&ref=demo');
 assert.deepEqual(page.groups.map(group=>group.primary.id),[2,1,3]);assert.equal(page.has_more,false);
 assert.deepEqual(snapshot.groups.map(group=>group.primary.id),[1,2,3]);
});
test('随机分页使用同一粒种子且不重不漏',()=>{
 const first=followPage(snapshot,new URLSearchParams('limit=2&sort=rand&seed=50000'));
 const second=followPage(snapshot,new URLSearchParams('limit=2&offset=2&sort=rand&seed=50000'));
 assert.equal(first.has_more,true);assert.equal(second.has_more,false);
 assert.deepEqual([...first.groups,...second.groups].map(group=>group.primary.id),[2,1,3]);
 assert.deepEqual(followPage(snapshot,new URLSearchParams('sort=rand&seed=0')).groups.map(group=>group.primary.id),[1,2,3]);
});
test('不完整录制和未支持的筛选保持未取得',()=>{
 assert.equal(followPage({...snapshot,has_more:true},new URLSearchParams('sort=rand')),null);
 for(const query of ['author=unknown','status=saved','sort=hot'])assert.equal(followPage(snapshot,new URLSearchParams(query)),null);
});
