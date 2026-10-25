"use strict";
// 演示站自动演示：地址带 ?tour=<场景> 时，用假光标逐字输入与点击；loop=1 显式启用循环。
// 输出全是 Peach 前端对录制回放的真实反应，脚本只负责「手」：移动、聚焦、派发输入与按键、点击。
// 访客按一下鼠标、键盘或滚轮就停下，把页面交还给人。
// Worker 只在地址带 tour 时把本文件同步插进 <head>，所以它先于 app.js 运行，能改外观设置。
(() => {
    const SCENES = {
        search: '/',
        feed: '/performers/135',
        review: '/review',
        avatar: '/performers/163',
    };
    const params = new URLSearchParams(location.search);
    const scene = params.get('tour') as keyof typeof SCENES;
    if (!Object.hasOwn(SCENES, scene!))
        return;
    const looping = params.get('loop')==='1';
    const destination=new URL(SCENES[scene],location.href);
    destination.searchParams.set('tour',scene);if(looping)destination.searchParams.set('loop','1');
    if(location.pathname!==destination.pathname){location.replace(destination.href);return}
    document.documentElement.dataset.demoTourState='loading';
    // 音效一律关掉，免得访客一打开就响。
    try {
        const key = 'peach.settings.v1';
        const settings = JSON.parse(localStorage.getItem(key) || '{}');
        settings.uiSounds = false;
        localStorage.setItem(key, JSON.stringify(settings));
    }
    catch (_e) { /* 存储被禁时照常播，只是会有音效 */ }
    const style = document.createElement('style');
    style.textContent = `
    .peach-tour-cursor{position:fixed;left:0;top:0;z-index:2147483647;width:26px;height:26px;pointer-events:none;
      transform:translate(-40px,-40px);transition-property:transform;transition-timing-function:cubic-bezier(.45,.05,.25,1);
      filter:drop-shadow(0 2px 5px rgba(0,0,0,.45))}
    .peach-tour-cursor svg{display:block;width:100%;height:100%;transition:transform .12s ease}
    .peach-tour-cursor.down svg{transform:scale(.82)}
    .peach-tour-ripple{position:fixed;z-index:2147483646;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;
      pointer-events:none;border:2px solid rgba(255,255,255,.85);animation:peach-tour-ripple .55s ease-out forwards}
    @keyframes peach-tour-ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.5);opacity:0}}
    .peach-tour-key{position:fixed;z-index:2147483647;pointer-events:none;padding:5px 10px;border-radius:8px;
      font:600 14px/1.2 system-ui,sans-serif;color:#f4f4f5;background:rgba(24,24,27,.92);
      border:1px solid rgba(255,255,255,.18);box-shadow:0 4px 14px rgba(0,0,0,.4),inset 0 -2px 0 rgba(255,255,255,.08);
      animation:peach-tour-key .9s ease forwards}
    @keyframes peach-tour-key{0%{opacity:0;transform:translateY(6px)}15%,70%{opacity:1;transform:none}100%{opacity:0}}
    .peach-tour-hover .feednewtools{opacity:1}
    html.peach-tour-veil body{opacity:0}
    body{transition:opacity .45s ease}`;
    document.head.append(style);
    if (looping)
        document.documentElement.classList.add('peach-tour-veil');
    class Stopped extends Error {
    }
    let stopped = false;
    const stop = () => {
        if (stopped)
            return;
        stopped = true;
        document.documentElement.dataset.demoTourState='stopped';
        document.documentElement.classList.remove('peach-tour-veil');
        cursor?.remove();
        const url = new URL(location.href);
        url.searchParams.delete('tour');
        url.searchParams.delete('loop');
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    };
    for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) {
        window.addEventListener(type, (event) => { if (event.isTrusted)
            stop(); }, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
    // 停下只在步骤之间生效：一步里的光标滑行照常走完，不会停在半路。
    const gate = () => {
        if (stopped)
            throw new Stopped();
    };
    const sleep = async (ms?: number|undefined) => {
        gate();
        await new Promise((resolve) => setTimeout(resolve, ms));
        gate();
    };
    const waitFor = async <T>(probe:()=>T, timeout = 20000):Promise<NonNullable<T>> => {
        const started = performance.now();
        for (;;) {
            if (stopped)
                throw new Stopped();
            const found = probe();
            if (found)
                return found;
            if (performance.now() - started > timeout)
                throw new Error('导览等不到页面元素');
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    };
    const visible = (el: HTMLElement) => !!el && el.isConnected && el.getClientRects().length > 0;
    let cursor: HTMLDivElement;
    let at = { x: innerWidth * 0.62, y: innerHeight * 0.72 };
    const place = (point: { x: any; y: any; }, ms: number) => {
        cursor.style.transitionDuration = `${ms}ms`;
        cursor.style.transform = `translate(${point.x - 5}px,${point.y - 3}px)`;
        at = point;
    };
    const showCursor = () => {
        cursor = document.createElement('div');
        cursor.className = 'peach-tour-cursor';
        cursor.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 2.5v17.2l4.3-4.1 2.7 6.2 3-1.3-2.7-6.1h6z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
        document.body.append(cursor);
        place(at, 0);
    };
    const scrollTo = async (el: HTMLElement, block: ScrollLogicalPosition = 'center') => {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 70 && rect.bottom <= innerHeight - 40)
            return;
        el.scrollIntoView({ behavior: 'smooth', block });
        await sleep(750);
    };
    // fx / fy 是落点在元素里的相对位置，默认正中。
    const moveTo = async (el: HTMLElement, { fx = 0.5, fy = 0.5 } = {}) => {
        await gate();
        await scrollTo(el);
        const rect = el.getBoundingClientRect();
        const point = { x: rect.left + rect.width * fx, y: rect.top + rect.height * fy };
        const ms = Math.round(Math.min(950, Math.max(380, Math.hypot(point.x - at.x, point.y - at.y) * 0.9)));
        place(point, ms);
        await new Promise((resolve) => setTimeout(resolve, ms + 60));
    };
    const press = async () => {
        cursor.classList.add('down');
        const ripple = document.createElement('div');
        ripple.className = 'peach-tour-ripple';
        ripple.style.left = `${at.x}px`;
        ripple.style.top = `${at.y}px`;
        document.body.append(ripple);
        setTimeout(() => ripple.remove(), 600);
        await new Promise((resolve) => setTimeout(resolve, 130));
        cursor.classList.remove('down');
    };
    const click = async (el: HTMLElement, where?: {fx?:number;fy?:number}) => {
        await moveTo(el, where);
        await sleep(160);
        await press();
        gate();
        el.click();
    };
    const keycap = (label: string|null) => {
        const cap = document.createElement('div');
        cap.className = 'peach-tour-key';
        cap.textContent = label;
        cap.style.left = `${at.x + 18}px`;
        cap.style.top = `${at.y + 16}px`;
        document.body.append(cap);
        setTimeout(() => cap.remove(), 950);
    };
    const key = async (el: { dispatchEvent: (arg0: KeyboardEvent) => void; }, name: string, label: string) => {
        await gate();
        keycap(label);
        el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    };
    // 逐字写进输入框，每个字派一次 input：Peach 的联想就是按 input 事件取的。
    const type = async (input: { value: any; dispatchEvent: (arg0: InputEvent) => void; }, text: string) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set;
        for (const ch of text) {
            await sleep(170 + Math.random() * 130);
            setter!.call(input, input.value + ch);
            input.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
        }
    };
    const buttonNamed = (name: string, root:Document|HTMLElement = document) => [...(root.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)].find((b) => b.textContent!.trim() === name && visible(b));
    const SCRIPTS = {
        async search(ready: () => void) {
            const searchButton=await waitFor(()=>document.querySelector<HTMLButtonElement>('#searchBtn')||document.querySelector<HTMLInputElement>('#q'));
            if(searchButton.id==='searchBtn'&&visible(searchButton)&&innerWidth<761)searchButton.click();
            const input = await waitFor(() => (document.querySelector('#q') as HTMLInputElement));
            // 作品网格是 React 画的 <article>；顶上那排订阅新作（#feedNew）也是，搜索结果在它下面。
            const works = () => [...(document.querySelectorAll('article:has(img.poster)') as NodeListOf<HTMLElement>)]
                .filter((card) => visible(card) && !(card.closest('#feedNew') as HTMLElement));
            await waitFor(() => works().length > 6);
            ready();
            await sleep(900);
            await click(input, { fx: 0.06 });
            input.focus();
            await type(input, '卓别林');
            const menu = await waitFor(() => { const m = (document.querySelector('#searchMenu') as HTMLElement); return visible(m) && (m.querySelector('img') as HTMLImageElement) ? m : null; });
            await sleep(1500);
            await moveTo(menu, { fx: 0.3, fy: 0.35 });
            await sleep(700);
            await moveTo(input, { fx: 0.12 });
            await sleep(250);
            await key(input, 'Enter', '↵ 回车');
            await waitFor(() => new URLSearchParams(location.search).get('q') === '卓别林');
            await sleep(1400);
            const cards = await waitFor(() => { const found = works(); return found.length ? found : null; });
            await scrollTo(cards[0], 'center');
            for (const card of cards.slice(0, 3)) {
                await moveTo(card, { fx: 0.5, fy: 0.4 });
                await sleep(450);
            }
            await sleep(1800);
        },
        async feed(ready: () => void) {
            const subscribed=()=>document.querySelector<HTMLInputElement>('[role="switch"][aria-label="订阅新作"]');
            const target=await waitFor(()=>document.querySelector<HTMLElement>('[data-feed-new]:has([data-feed-id] img)')||subscribed());
            ready();
            if(target instanceof HTMLInputElement){
                const control=target.closest<HTMLElement>('[data-entry-feed]')||target;
                await sleep(700);await click(control);await sleep(900);
                const restore=await waitFor(subscribed);await click(restore.closest<HTMLElement>('[data-entry-feed]')||restore);await sleep(900);return;
            }
            const row=target;
            await sleep(700);
            await scrollTo(row, 'center');
            await sleep(500);
            const cards = [...(row.querySelectorAll('[data-feed-id]') as NodeListOf<HTMLElement>)];
            const act = async (card: HTMLElement, prefix: string) => {
                await moveTo(card, { fy: 0.35 });
                await sleep(350);
                const button = (card.querySelector(`button[aria-label^="${prefix}"]`) as HTMLElement);
                card.classList.add('peach-tour-hover'); // 卡片的操作钮只在 :hover / :focus-within 时露出来
                await sleep(450);
                await click(button);
                card.classList.remove('peach-tour-hover');
                await sleep(1300);
            };
            await act(cards[0], '标为已看过');
            await act(cards[1], '标为已看过');
            await act(cards[2], '不想看');
            await sleep(1800);
        },
        async review(ready: () => void) {
            await waitFor(()=>document.querySelector('main')?.textContent?.match(/复核|审核|候选|暂无|没有/));
            ready();
            if(!buttonNamed('通过')){await sleep(1800);return}
            await sleep(1000);
            for (const name of ['通过', '通过', '拒绝'] as const) {
                const button = await waitFor(() => buttonNamed(name));
                const card = (button.closest('article,li,section') as HTMLElement) ?? button;
                await moveTo(card, { fx: 0.45, fy: 0.3 });
                await sleep(650);
                await click(button);
                await sleep(1400);
            }
            await sleep(1500);
        },
        async avatar(ready: () => void) {
            const faceNear = (button: HTMLButtonElement) => {
                let holder:HTMLElement|null = button;
                for (let i = 0; i < 4 && holder && !(holder.querySelector('img') as HTMLImageElement); i++)
                    holder = holder.parentElement;
                return (holder?.querySelector('img') as HTMLImageElement);
            };
            const open = await waitFor(() => (document.querySelector('button[aria-label^="更换"]') as HTMLButtonElement));
            const face = faceNear(open);
            await waitFor(() => face?.complete && face.naturalWidth);
            ready();
            await sleep(1000);
            await click(open);
            const dialog = await waitFor(() => [...(document.querySelectorAll('[role=dialog],dialog[open]') as NodeListOf<HTMLElement>)]
                .find((d) => d.textContent.includes('更换头像')));
            await waitFor(()=>!dialog.querySelector('[data-skeleton],[aria-busy="true"]'));
            await sleep(900);
            const choices = [...(dialog.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)].filter((b) => (b.querySelector('img') as HTMLImageElement));
            if(!choices.length){await sleep(1200);return}
            for (const choice of choices.slice(0, 3)) {
                await moveTo(choice, { fy: 0.45 });
                await sleep(380);
            }
            await click(choices[Math.min(3,choices.length-1)], { fy: 0.45 });
            // 第二步「框出头像那一块」：Peach 已经把方框放在脸上，左下角圆形预览就是换上后的样子。
            const crop = await waitFor(() => [...(document.querySelectorAll('[role=dialog]') as NodeListOf<HTMLElement>)]
                .find((d) => d.textContent.includes('框出头像') && buttonNamed('用这一块', d)));
            await sleep(700);
            const frame = (crop.querySelector('[style*="--crop-l"]') as HTMLElement);
            if (frame) {
                await moveTo(frame, { fx: 0.48, fy: 0.2 });
                await sleep(900);
            }
            const preview = [...(crop.querySelectorAll('span') as NodeListOf<HTMLElement>)].find((s) => getComputedStyle(s).backgroundImage.includes('avatar-choice'));
            const look = preview && getComputedStyle(preview);
            const shot = look && { image: look.backgroundImage, size: look.backgroundSize, position: look.backgroundPosition };
            await moveTo(preview ?? crop, { fx: 0.5, fy: 0.5 });
            await sleep(700);
            await click(buttonNamed('用这一块', crop)!);
            await waitFor(() => !visible(crop), 5000).catch(() => { });
            await sleep(300);
            // 演示站的写请求不落地，重取的头像还是原来那张；按预览的同一块画面换上去，就是真实 Peach 保存后的样子。
            const target = faceNear((document.querySelector('button[aria-label^="更换"]') as HTMLButtonElement)) ?? face;
            // 头像 <img> 的尺寸按原图的人脸框（data-facebox）算，不能换它的 src；在外框上叠一层同形状的画面。
            const portrait = target.parentElement;
            if (shot && portrait) {
                if (getComputedStyle(portrait).position === 'static')
                    portrait.style.position = 'relative';
                const layer = document.createElement('span');
                layer.style.cssText = `position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;
          transition:opacity .35s ease;background:${shot.image} ${shot.position} / ${shot.size} no-repeat`;
                portrait.append(layer);
                requestAnimationFrame(() => requestAnimationFrame(() => { layer.style.opacity = '1'; }));
            }
            await moveTo(target, { fx: 0.8, fy: 0.85 });
            await sleep(2600);
        },
    };
    const run = async () => {
        let announced = false;
        const ready = () => {
            if (announced)
                return;
            announced = true;
            document.documentElement.dataset.demoTourState='running';
            document.documentElement.classList.remove('peach-tour-veil');
        };
        try {
            showCursor();
            await SCRIPTS[scene](ready);
            ready();
            document.documentElement.dataset.demoTourState='complete';
            await sleep(300);
            if(!looping||stopped){cursor?.remove();return}
            document.documentElement.classList.add('peach-tour-veil');
            await new Promise((resolve) => setTimeout(resolve, 480));
            if (!stopped&&!document.hidden)
                location.replace(`${SCENES[scene]}?tour=${scene}&loop=1`);
        }
        catch (error) {
            if (error instanceof Stopped)
                return;
            // 页面没按预期长出来（多半是重录后控件变了）：停在当前画面，把页面交还给人。
            console.error('[peach-tour]', error);
            ready();
            document.documentElement.dataset.demoTourState='error';
            cursor?.remove();
        }
    };
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', run, { once: true });
    else
        run();
})();
