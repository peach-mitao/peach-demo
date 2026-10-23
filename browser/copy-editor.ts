"use strict";
// 演示站仅适配浏览器草稿和工具条；编辑交互使用应用仓库的唯一共享核心。
(() => {
    const Core = globalThis.PeachCopyEditorCore, key = 'peach.copy-edits.v1';
    let edits = {}, active = true, editor: CopyEditor;
    try {
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        if (saved && typeof saved === 'object' && !Array.isArray(saved))
            edits = saved;
    }
    catch { }
    const originals = new WeakMap(), css = document.createElement('style');
    css.dataset.copyEditor = '';
    css.textContent = `
    [data-copy-highlight]{pointer-events:none;z-index:2147483646;outline:1.5px dashed var(--tungsten);outline-offset:3px;border-radius:var(--badge-radius);display:none}
    [data-copy-inline]{outline:2px solid var(--tungsten);outline-offset:3px;border-radius:var(--badge-radius);background:var(--hover);user-select:text;cursor:text}
    [data-copy-input]{z-index:2147483647;padding:2px 6px;border:0;border-radius:var(--badge-radius);outline:2px solid var(--tungsten);background:var(--ground);color:var(--ink)}
    [data-copy-bar]{position:fixed;bottom:calc(16px + var(--demo-notice-height,0px));left:50%;transform:translateX(-50%);z-index:2147483647;padding:8px 14px;border-radius:var(--floating-radius);display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--ground,#fff);color:var(--ink,#111);box-shadow:0 2px 18px #0003;font:13px/1.4 system-ui;max-width:calc(100vw - 32px);width:max-content;box-sizing:border-box}
    [data-copy-bar] button{font:inherit;cursor:pointer}[data-copy-bar] [role=status]{flex-basis:100%;overflow-wrap:anywhere}
  `;
    document.head.append(css);
    const highlight = document.createElement('div');
    highlight.dataset.copyEditor = '';
    highlight.dataset.copyHighlight = '';
    const bar = document.createElement('div');
    bar.dataset.copyEditor = '';
    bar.dataset.copyBar = '';
    const title = document.createElement('b');
    title.textContent = '改字模式';
    const hint = document.createElement('span');
    hint.textContent = '点文字编辑，切换照常；Alt+点击改控件文字；回车保存，Esc 取消';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    bar.append(title, hint);
    const say = (message: string|null) => { status.textContent = message; };
    const button = (label: string|null, action: ((this: GlobalEventHandlers,ev: PointerEvent) => any)|null) => { const element = document.createElement('button'); element.type = 'button'; element.textContent = label; element.onclick = action; bar.append(element); return element; };
    const toggle = button('暂停编辑', () => { if (editor.busy)
        return; editor.commit(); active = !active; editor.hideHighlight(); toggle.textContent = active ? '暂停编辑' : '继续编辑'; });
    button('导出修改', () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(edits, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'peach-copy-edits.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    button('退出', () => { if (editor.busy)
        return; editor.commit(true); const url = new URL(location.href); url.searchParams.delete('edit'); location.href = url.href; });
    bar.append(status);
    document.body.append(highlight, bar);
    const apply = () => { if (editor?.editing || editor?.busy)
        return; Core.applyDrafts(document.body, edits, originals); };
    editor = Core.create({ highlight, isActive: () => active, onStatus: say,
        onBusy: (value) => { bar.setAttribute('aria-busy', String(value)); if (!value)
            apply(); },
        resolve: (node) => ({ original: originals.get(node) ?? node.data.trim(), multiline: !!node.parentElement?.closest('pre,code') }),
        save(edit, text) {
            const next = { ...edits, [edit.original]: text };
            localStorage.setItem(key, JSON.stringify(next));
            edits = next;
            originals.set(edit.node, edit.original);
            return { text, message: text ? '已保存到本浏览器' : '已删除文字，刷新后仍保留' };
        },
    });
    new MutationObserver(apply).observe(document.body, { childList: true, subtree: true, characterData: true });
    apply();
})();
