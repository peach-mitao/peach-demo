// 演示馆藏首页默认开大图（竖版封面）；关注页的图片默认瀑布流、只看图片不带文字。保留访客已选择的布局。
const DEMO_SETTINGS = `<script>try{const k='peach.settings.v1',s=JSON.parse(localStorage.getItem(k)||'{}');
if(!('homeLayout' in s))s.homeLayout='big';if(!('detailAutoplay' in s))s.detailAutoplay=false;
if(!('photoLayout' in s))s.photoLayout='masonry';if(!('followImagesOnly' in s))s.followImagesOnly=true;
localStorage.setItem(k,JSON.stringify(s))}catch(_e){}</script>`;
// 页脚链接共用一套下划线：应用外链样式只给新窗口链接加 3px 偏移，站内链接也写明同值，三条线才对齐。
const NOTICE_LINK = 'display:inline;line-height:inherit;pointer-events:auto;color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px';
// 底部居中的说明跟随主题，在窄屏和安全区内换行。
const NOTICE = `<style>
#postSetupTutorial{bottom:calc(var(--demo-notice-height,34px) + 24px);max-height:calc(100dvh - var(--demo-notice-height,34px) - 48px)}
#toasts [data-sonner-toaster][data-y-position=bottom]{bottom:max(var(--offset-bottom,24px),calc(var(--demo-notice-height,34px) + 24px))}
#searchMenu{max-height:min(60vh,520px,var(--demo-search-space,100vh))!important}
#searchMenu [data-search-group]:not(:has([data-search-value])){display:none}
[data-demo-notice] a{display:inline}
[data-demo-copy="compact"]{display:none}
@media(max-width:560px){
 [data-demo-notice]{white-space:nowrap}
 #searchMenu{max-height:min(70vh,var(--demo-search-space,100vh))!important}
}
/* 完整写法在 390 宽手机上放得下，只有更窄的屏幕换精简写法。 */
@media(max-width:370px){
 [data-demo-copy="full"]{display:none}
 [data-demo-copy="compact"]{display:inline}
}
</style><div role="note" data-demo-notice style="position:fixed;left:50%;transform:translateX(-50%);bottom:max(12px,env(safe-area-inset-bottom));z-index:2147483000;pointer-events:auto;user-select:text;
padding:6px 10px;border-radius:12px;width:max-content;box-sizing:border-box;text-align:center;max-width:calc(100vw - 24px);font:12px/1.4 system-ui,sans-serif;
background:var(--color-background-primary-default,#fff);color:var(--color-text-secondary,#555);
border:1px solid var(--color-separator-border,#0002);box-shadow:0 2px 8px #0001">
<span data-demo-copy="full">Peach 演示站 · </span><span data-demo-copy="compact">演示站 · </span><a href="https://peach.video/" target="_blank" rel="noopener" style="${NOTICE_LINK}">官网</a> · <a href="https://github.com/peach-mitao/peach" target="_blank" rel="noopener" style="${NOTICE_LINK}">GitHub</a> · <a href="/film-sources/" style="${NOTICE_LINK}">素材来源</a> · <a href="https://peach.video/copyright/" target="_blank" rel="noopener" style="${NOTICE_LINK}">DMCA</a> · <a href="https://peach.video/privacy/analytics" target="_blank" rel="noopener" style="${NOTICE_LINK}"><span data-demo-copy="full">统计偏好</span><span data-demo-copy="compact">统计</span></a></div>`;
export { DEMO_SETTINGS, NOTICE };
