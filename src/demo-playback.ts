// 演示保留播放器及其控件；媒体地址和播放调用停留在浏览器内。
export const DEMO_PLAYBACK_MESSAGE = '仅提供演示';
export function installDemoPlayback(scope: Window & typeof globalThis) {
    scope.document.documentElement.dataset.demoPlayback = 'stub';
    let notice: HTMLElement | null = null, timer: number | undefined;
    const inform = () => {
        const doc = scope.document;
        if (!doc.body) return;
        notice ??= Object.assign(doc.createElement('div'), { textContent: DEMO_PLAYBACK_MESSAGE });
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        notice.setAttribute('data-demo-playback-notice', '');
        notice.style.cssText = 'position:fixed;left:50%;bottom:max(64px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483001;padding:12px 18px;border-radius:var(--control-radius,8px);background:var(--ground,#fff);color:var(--ink,#222);border:1px solid var(--border-15,#8884);font:500 14px/1.5 system-ui;box-shadow:0 4px 20px #0002;pointer-events:none';
        const dialogs = doc.querySelectorAll('dialog[open]');
        (dialogs[dialogs.length - 1] || doc.body).append(notice);
        if (timer) scope.clearTimeout(timer);
        timer = scope.setTimeout(() => notice?.remove(), 2600);
    };
    const media = scope.HTMLMediaElement.prototype;
    // 属性赋值、setAttribute、<source> 和 srcObject 共用这个边界。
    for (const prototype of [media, scope.HTMLSourceElement.prototype]) {
        const setter = prototype.setAttribute;
        prototype.setAttribute = function (name: string, value: string) {
            if (name.toLowerCase() === 'src' || name.toLowerCase() === 'autoplay') return;
            setter.call(this, name, value);
        };
        Object.defineProperty(prototype, 'src', { configurable: true, get: () => '', set() {} });
    }
    Object.defineProperty(media, 'srcObject', { configurable: true, get: () => null, set() {} });
    Object.defineProperty(media, 'autoplay', { configurable: true, get: () => false, set() {} });
    media.load = function () {};
    media.play = function () { inform(); return Promise.resolve(); };
    scope.document.addEventListener('click', event => {
        const node = event.target instanceof scope.Element ? event.target : null;
        const control = node?.closest('.vjs-big-play-button,.vjs-play-control,[data-miniplayer-play],[data-mini-play],[data-player-menu-action="play"],[data-demo-play],a[href^="vlc:"],a[href^="iina:"],a[href^="potplayer:"]');
        const button = node?.closest('button,a,[role="button"]');
        const label = button?.getAttribute('aria-label') || button?.getAttribute('title') || button?.textContent?.trim();
        if (control || (button && /^(?:播放|播放正片|开始播放|继续播放|外部播放|生成播放链接|在外部播放器打开|Play|Play Video|Resume)$/.test(label || ''))) {
            event.preventDefault(); event.stopImmediatePropagation(); inform();
        }
    }, true);
    return inform;
}
