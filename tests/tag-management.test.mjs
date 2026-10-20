import test from 'node:test';
import assert from 'node:assert/strict';
import {tagInventory,previewTags,applyTagPlan,tagDirectory} from '../src/tag-management.mjs';
const indexes={tags:{items:[{entity_id:1,k:'旅行',n:2,cat:'general'},{entity_id:2,k:'风景',n:1,cat:'general'}]},
  onlineTags:{items:[{k:'landscape',n:2,cat:'general'},{k:'portrait',n:1,cat:'general'},{k:'artist',n:1,cat:'artist'}]}};
const items=[{tags:['旅行','风景']},{tags:['旅行']}];

test('本地标签预览统计资源去重和关联重叠',()=>{
  const state=tagInventory(indexes),command={operation:'merge',ids:[1,2],target_id:1};
  const plan=previewTags(state,command,items,'token');assert.equal(plan.assets,2);assert.equal(plan.overlap,1);
  const result=applyTagPlan(state,plan,{...command,token:'token'});
  assert.equal(result.items.length,1);assert.deepEqual(result.items[0].aliases,['风景']);assert.equal(state.items.length,2);
});
test('改名保留身份与别名，隐藏和恢复成对生效',()=>{
  let state=tagInventory(indexes);
  for(const command of [{operation:'rename',ids:[1],name:'远行'},{operation:'hide',ids:[1]},{operation:'restore',ids:[1]}]){
    state=applyTagPlan(state,previewTags(state,command,items,'token'),{...command,token:'token'});
    assert.equal(state.items[0].entity_id,1);
    if(command.operation==='hide')assert.equal(tagDirectory(state,new URLSearchParams()).items.length,1);
  }
  assert.equal(state.items[0].k,'远行');assert.deepEqual(state.items[0].aliases,['旅行']);
  assert.equal(tagDirectory(state,new URLSearchParams({q:'旅行'})).items[0].k,'远行');
});
test('过期、篡改和重复名称的计划拒绝执行',()=>{
  const state=tagInventory(indexes),command={operation:'hide',ids:[1]},plan=previewTags(state,command,items,'token');
  assert.throws(()=>applyTagPlan(state,plan,{...command,token:'wrong'}));
  assert.throws(()=>applyTagPlan({...state,revision:1},plan,{...command,token:'token'}));
  assert.throws(()=>applyTagPlan(state,plan,{...command,ids:[2],token:'token'}));
  assert.throws(()=>previewTags(state,{operation:'rename',ids:[1],name:'风景'},items));
});
test('在线标签保持稳定来源身份并拒绝跨类型合并',()=>{
  const state=tagInventory(indexes,'online'),ids=state.items.map(row=>row.id);
  assert.throws(()=>previewTags(state,{scope:'online',operation:'merge',ids:[ids[0],ids[2]],target_id:ids[0]}));
  const command={scope:'online',operation:'merge',ids:ids.slice(0,2),target_id:ids[0]};
  const next=applyTagPlan(state,previewTags(state,command,[],'token'),{...command,token:'token'});
  assert.equal(next.items[0].id,ids[0]);assert.deepEqual(next.items[0].aliases,['portrait']);
});
