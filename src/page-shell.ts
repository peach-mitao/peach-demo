// 演示馆藏首页默认开大图（竖版封面），保留访客已选择的布局。
const DEMO_SETTINGS = `<script>try{const k='peach.settings.v1',s=JSON.parse(localStorage.getItem(k)||'{}');
if(!('homeLayout' in s))s.homeLayout='big';if(!('detailAutoplay' in s))s.detailAutoplay=false;
localStorage.setItem(k,JSON.stringify(s))}catch(_e){}</script>`;
// 演示数据里的关注更新全是图片帖，而关注页默认是视频模式（只认地址栏的 media 参数），直接进去是空的。
// 从别处进关注页、或直接打开 /follow 时补上 media=images；已经在关注页里切回视频的不拦。
const FOLLOW_IMAGES = `<script>(()=>{const fix=u=>{try{const url=new URL(u,location.href);
if(url.pathname==='/follow'&&!url.searchParams.has('media')&&location.pathname!=='/follow'){
url.searchParams.set('media','images');return url.pathname+url.search+url.hash}}catch(_e){}return u};
for(const name of ['pushState','replaceState']){const original=history[name].bind(history);
history[name]=(state,title,u)=>original(state,title,u==null?u:fix(u))}
if(location.pathname==='/follow'&&!new URLSearchParams(location.search).has('media')){
const url=new URL(location.href);url.searchParams.set('media','images');history.replaceState(null,'',url.pathname+url.search)}
})()</script>`;
// 底部居中的说明跟随主题，在窄屏和安全区内换行。
const NOTICE = `<style>
#postSetupTutorial{bottom:calc(var(--demo-notice-height,34px) + 24px);max-height:calc(100dvh - var(--demo-notice-height,34px) - 48px)}
#toasts [data-sonner-toaster][data-y-position=bottom]{bottom:max(var(--offset-bottom,24px),calc(var(--demo-notice-height,34px) + 24px))}
#searchMenu{max-height:min(60vh,520px,var(--demo-search-space,100vh))!important}
#searchMenu [data-search-group]:not(:has([data-search-value])){display:none}
[data-demo-notice] a{display:inline}
[data-demo-copy="compact"]{display:none}
@media(max-width:560px){
 [data-demo-copy="full"]{display:none}
 [data-demo-copy="compact"]{display:inline}
 [data-demo-notice]{white-space:nowrap}
 #searchMenu{max-height:min(70vh,var(--demo-search-space,100vh))!important}
}
</style><div role="note" data-demo-notice style="position:fixed;left:50%;transform:translateX(-50%);bottom:max(12px,env(safe-area-inset-bottom));z-index:2147483000;pointer-events:auto;user-select:text;
padding:6px 10px;border-radius:12px;width:max-content;box-sizing:border-box;text-align:center;max-width:calc(100vw - 24px);font:12px/1.4 system-ui,sans-serif;
background:var(--color-background-primary-default,#fff);color:var(--color-text-secondary,#555);
border:1px solid var(--color-separator-border,#0002);box-shadow:0 2px 8px #0001">
<span data-demo-copy="full">Peach 演示站：电影资料与操作示例，不提供视频 · </span><span data-demo-copy="compact">仅供演示 · 操作不保存 · </span><a href="/film-sources/" style="display:inline;line-height:inherit;pointer-events:auto;color:inherit;text-decoration:underline">素材来源</a> · <a href="https://peach.video/copyright/" target="_blank" rel="noopener" style="display:inline;line-height:inherit;pointer-events:auto;color:inherit;text-decoration:underline"><span data-demo-copy="full">版权投诉 / DMCA</span><span data-demo-copy="compact">版权投诉</span></a> · <a href="https://peach.video/privacy/analytics" target="_blank" rel="noopener" style="display:inline;line-height:inherit;pointer-events:auto;color:inherit;text-decoration:underline"><span data-demo-copy="full">统计偏好</span><span data-demo-copy="compact">统计</span></a></div>`;
export { DEMO_SETTINGS, FOLLOW_IMAGES, NOTICE };
