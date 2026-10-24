import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { movieScript, movieHTML } from '../scripts/public_copy.ts';
test('普通电影展示投影只改字串而保留协议和表达式', () => {
    const source = 'const JAV=3;globalThis.result=["女优",`番号 ${JAV} 高潮`,"/api/jav/detail",/JAV/];';
    const context: Record<string, any> = {};
    vm.runInNewContext(movieScript(source), context);
    assert.deepEqual([...context.result].slice(0, 3), ['演员', '编号 3 精彩片段', '/api/jav/detail']);
    assert.equal(String(context.result[3]), '/JAV/');
});
test('页面可见文本使用普通电影术语且保留脚本与路径', () => {
    const html = '<script>const JAV=1</script><a href="/jav" aria-label="搜索女优">JAV</a><style>.JAV{}</style>';
    assert.equal(movieHTML(html), '<script>const JAV=1</script><a href="/jav" aria-label="搜索演员">影片</a><style>.JAV{}</style>');
});
