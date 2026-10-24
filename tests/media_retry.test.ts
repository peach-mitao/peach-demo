import test from 'node:test';
import assert from 'node:assert/strict';
import {retryTransient} from '../scripts/media_storage.ts';

test('媒体回读的临时网络错误按有界退避恢复',async()=>{
  let attempts=0;const delays:number[]=[];
  assert.equal(await retryTransient(async()=>{if(++attempts<3)throw Error('fetch failed');return 'verified';},async value=>{delays.push(value);}), 'verified');
  assert.equal(attempts,3);assert.deepEqual(delays,[2000,4000]);
});
test('持续连接失败最多重试四次',async()=>{
  let attempts=0;const delays:number[]=[];
  await assert.rejects(retryTransient(async()=>{attempts++;throw Error('ECONNRESET');},async value=>{delays.push(value);}),/ECONNRESET/);
  assert.equal(attempts,5);assert.deepEqual(delays,[2000,4000,6000,8000]);
});
test('权限与内容完整性错误直接拒绝',async()=>{
  for(const message of ['403 Authentication error','R2 内容校验失败','媒体域名元数据校验失败']){
    let attempts=0;
    await assert.rejects(retryTransient(async()=>{attempts++;throw Error(message);},async()=>{throw Error('不应等待');}));
    assert.equal(attempts,1);
  }
});
