/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito documents: tabs, switching, closing, and moving / copying pages between open documents. */
(() => {
  const L = window.Loeito, h = L.h;

  L.switchDoc = doc => {
    if (!doc || doc === L.doc) return;
    const blade = L.state.blade, b = L.blade();
    b && b.deactivate && b.deactivate();
    if (L.doc) { const st = L.$('#stage'); L.doc.view = { zoom: L.viewer.zoom, top: st.scrollTop, left: st.scrollLeft }; }
    L.doc = doc; L.state = doc.state; L.state.blade = blade;
    L.viewer.zoom = doc.view.zoom; L.viewer.hits = null; L.viewer.page = null; L.viewer.restoreScroll = { top: doc.view.top, left: doc.view.left };
    L.$('#welcome').hidden = true;
    L.closeSearch && !L.$('#search-pop').hidden && L.closeSearch();
    const nb = L.blade(); nb && nb.activate && nb.activate();
    L.emit('docs'); L.emit('change', { switched: true }); L.emit('history');
    const p = L.page(); if (p && !L.proxySync(p)) L.proxy(p).then(() => { if (L.doc === doc) L.renderInspector(); });
  };
  L.addDoc = (doc, activate = true) => { L.docs.push(doc); if (activate) L.switchDoc(doc); else L.emit('docs'); return doc; };

  L.closeDoc = async doc => {
    if (doc.state.dirty && !(await L.confirm(`Close “${doc.state.name}”?`, 'It has changes that haven’t been saved.', 'Close without saving', true))) return false;
    const i = L.docs.indexOf(doc); if (i < 0) return false;
    L.docs.splice(i, 1);
    if (doc === L.doc) {
      const next = L.docs[Math.min(i, L.docs.length - 1)];
      if (next) { L.doc = null; L.switchDoc(next); }
      else {
        const b = L.blade(); b && b.deactivate && b.deactivate();
        L.doc = null; L.state = L.freshState('view');
        L.$('#welcome').hidden = false;
        L.emit('docs'); L.emit('cleared'); L.emit('history');
      }
    } else L.emit('docs');
    L.collectSources();
    return true;
  };

  const pageLabel = (pages, S) => {
    const nums = pages.map(p => L.pageIndex(p.id, S) + 1).sort((a, b) => a - b);
    const runs = []; for (const n of nums) { const r = runs[runs.length - 1]; if (r && n === r[1] + 1) r[1] = n; else runs.push([n, n]); }
    return 'p' + runs.map(([a, b]) => (a === b ? a : `${a}–${b}`)).join(',');
  };
  // Copy or move pages of the active document into another open document (or a new tab).
  L.transferPages = (ids, target, { move = false } = {}) => {
    const S = L.state, src = L.doc;
    const pages = S.pages.filter(p => ids.includes(p.id));
    if (!pages.length || target === src) return;
    if (move && pages.length >= S.pages.length) { L.toast('Can’t move every page out — a document needs at least one. Copy them instead.', { kind: 'err', ms: 4200 }); return; }
    const label = pageLabel(pages, S), n = pages.length, what = n === 1 ? '1 page' : `${n} pages`;
    const copies = pages.map(p => ({ ...L.clonePage(p), id: L.uid('p') }));
    let dest = target;
    if (target === 'new') {
      dest = L.newDoc();
      Object.assign(dest.state, { pages: copies, name: L.safeName(`${S.name} — ${label}`), dirty: true, meta: { ...S.meta, title: '' } });
      L.docs.push(dest);
    } else {
      L.inDoc(dest, () => L.mutate(`add ${what} from “${S.name}”`, () => { dest.state.pages.push(...copies); }, { silent: true }));
    }
    if (move) L.mutate(`move ${what} to “${dest.state.name}”`, () => {
      const gone = new Set(ids), curId = S.pages[S.cur].id;
      S.pages = S.pages.filter(p => !gone.has(p.id)); S.sel = new Set();
      S.cur = gone.has(curId) ? Math.min(S.cur, S.pages.length - 1) : L.pageIndex(curId);
    });
    L.emit('docs');
    if (target === 'new') { L.switchDoc(dest); L.toast(`New document with ${what}`, { kind: 'ok', icon: 'docplus' }); }
    else L.toast(`${move ? 'Moved' : 'Copied'} ${what} to “${dest.state.name}”`, { kind: 'ok', icon: move ? 'extract' : 'duplicate', ms: 4200, action: { label: 'Show', fn: () => L.switchDoc(dest) } });
  };

  /* ——— Tab bar ——— */
  function renderTabs() {
    const bar = L.$('#tabbar');
    bar.hidden = L.docs.length < 2;
    document.body.classList.toggle('has-tabs', L.docs.length >= 2);
    if (bar.hidden) return;
    bar.replaceChildren(...L.docs.map(d => {
      const tab = h('div', { class: 'tab' + (d === L.doc ? ' active' : ''), title: d.state.name, role: 'tab', 'aria-selected': d === L.doc ? 'true' : 'false' },
        L.icon('doc'), h('span', { class: 'tname' }, d.state.name || 'Untitled'),
        d.state.dirty ? h('span', { class: 'tdirty', title: 'Unsaved changes' }) : null,
        h('button', { class: 'tclose', title: 'Close tab', onclick: e => { e.stopPropagation(); L.closeDoc(d); } }, L.icon('close')));
      tab.addEventListener('mousedown', e => { if (e.button === 1) { e.preventDefault(); L.closeDoc(d); } });
      tab.addEventListener('click', () => L.switchDoc(d));
      // pages dragged from the sidebar / grid land here: copy, or move with Shift
      tab.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('text/x-loeito-pages') && d !== L.doc) { e.preventDefault(); e.dataTransfer.dropEffect = e.shiftKey ? 'move' : 'copy'; tab.classList.add('drop'); } });
      tab.addEventListener('dragleave', () => tab.classList.remove('drop'));
      tab.addEventListener('drop', e => {
        tab.classList.remove('drop');
        const ids = (e.dataTransfer.getData('text/x-loeito-pages') || '').split(',').filter(Boolean);
        if (!ids.length || d === L.doc) return;
        e.preventDefault(); e.stopPropagation();
        L.transferPages(ids, d, { move: e.shiftKey });
      });
      return tab;
    }), h('button', { class: 'icon-btn small tab-add', title: 'Open another document (Ctrl O)', onclick: () => L.pickFiles(false) }, L.icon('plus')));
  }
  L.on('docs', renderTabs);
  L.on('change', () => { if (L.docs.length >= 2) renderTabs(); });
})();
