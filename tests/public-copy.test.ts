import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { movieScript, movieHTML, movieText } from '../scripts/public_copy.ts';
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
test('输入提示里的示例番号换成演示编号', () => {
    assert.equal(movieText('输入番号，例如 SSIS-950'), '输入编号，例如 FILM-001');
    assert.equal(movieText('例如 ABF-087、SYKH-145…'), '例如 FILM-001、FILM-002…');
});
test('英文和中文命名空间各用自己的电影术语', () => {
    const source = 'const en={nav:"JAV",subs:"JAV subscriptions"},zh={nav:"JAV"};globalThis.result={"zh-CN":{navigation:zh},en:{navigation:en}};';
    const context: Record<string, any> = {};
    vm.runInNewContext(movieScript(source), context);
    assert.equal(context.result['zh-CN'].navigation.nav, '影片');
    assert.equal(context.result.en.navigation.nav, 'Films');
    assert.equal(context.result.en.navigation.subs, 'Film subscriptions');
});

test('存储来源注册表按页面语言显示名称并保留来源 ID', () => {
    const source = movieScript('globalThis.result=[{id:"local",name:"本地磁盘",label:"本地磁盘",default_cost:"free"},{label:"本地磁盘"}];');
    for (const [lang, label] of [['en', 'Local disk'], ['zh-CN', '本地磁盘']]) {
        const context = { document: { documentElement: { lang } }, result: [] as { id?: string; name?: string; label: string }[] };
        vm.runInNewContext(source, context);
        assert.equal(context.result[0]?.id, 'local');
        assert.equal(context.result[0]?.name, label);
        assert.equal(context.result[0]?.label, label);
        assert.equal(context.result[1]?.label, '本地磁盘');
    }
});

test('缺少系列图标时复用已有的列表字形', () => {
    const sprite = '<svg><symbol id="ri-list-unordered" viewBox="0 0 24 24"><path d="M4 4h16"/></symbol></svg>';
    const patched = movieHTML(sprite);
    assert.match(patched, /<symbol id="i-list" [^>]*><use href="#ri-list-unordered"/);
    assert.equal(movieHTML(patched), patched);
});
