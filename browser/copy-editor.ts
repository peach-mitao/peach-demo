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
  `;
    document.head.append(css);
    const highlight = document.createElement('div');
    highlight.dataset.copyEditor = '';
    highlight.dataset.copyHighlight = '';
    const toolbar = globalThis.PeachCopyToolbar.create(), {bar, say, button} = toolbar;
    const toggle = button('暂停编辑', () => { if (editor.busy)
        return; editor.commit(); active = !active; editor.hideHighlight(); toggle.textContent = active ? '暂停编辑' : '继续编辑'; toolbar.setActive(active); });
    button('导出修改', () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(edits, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'peach-copy-edits.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    button('退出', () => { if (editor.busy)
        return; editor.commit(true); const url = new URL(location.href); url.searchParams.delete('edit'); location.href = url.href; }).setAttribute('aria-label','退出编辑');
    document.body.append(highlight, toolbar.host);
    const placeToolbar = () => {const host=document.querySelector('dialog[open]')||document.body;host.append(highlight,toolbar.host)};
    new MutationObserver(placeToolbar).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
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
