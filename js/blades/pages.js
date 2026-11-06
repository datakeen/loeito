/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Pages blade: rotate, reorder, delete, duplicate, insert, merge, extract and split. Shows a contact-sheet grid. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;

  L.rotatePages = (pages, delta) => {
    if (!pages.length) return;
    if (!L.reduceMotion()) L.markSpin(pages.map(p => p.id), delta);
    L.mutate(`rotate ${pages.length > 1 ? pages.length + ' pages' : 'page'}`, () => {
      const ids = new Set(pages.map(p => p.id));
      L.state.pages = L.state.pages.map(p => ids.has(p.id) ? { ...p, rot: ((p.rot + delta) % 360 + 360) % 360 } : p);
    });
  };
  L.rotateSelected = delta => L.rotatePages(L.selectedPages(), delta);
  L.deletePages = async pages => {
    const s = L.state;
    if (pages.length >= s.pages.length) return L.toast('A document needs at least one page.', { kind: 'err' });
    L.mutate(`delete ${pages.length > 1 ? pages.length + ' pages' : 'page'}`, () => {
      const ids = new Set(pages.map(p => p.id)), curId = s.pages[s.cur].id;
      const firstIdx = Math.min(...pages.map(p => L.pageIndex(p.id)));
      s.pages = s.pages.filter(p => !ids.has(p.id));
      s.sel = new Set();
      s.cur = ids.has(curId) ? Math.min(firstIdx, s.pages.length - 1) : L.pageIndex(curId);
    });
  };
  L.duplicatePages = pages => {
    const s = L.state;
    L.mutate('duplicate', () => {
      const ids = new Set(pages.map(p => p.id)), out = [];
      for (const p of s.pages) { out.push(p); if (ids.has(p.id)) out.push({ ...p, id: L.uid('p'), ann: JSON.parse(JSON.stringify(p.ann)), dig: null }); }
      s.pages = out;
    });
  };
  L.insertBlank = async () => {
    const s = L.state, ref = L.page(), proxy = await L.proxy(ref), v = L.makeView(proxy, ref, 1);
    const bytes = await L.blankPdf(v.width, v.height);
    const { id } = await L.addSource(new Uint8Array(bytes), 'Blank page');
    L.mutate('insert blank page', () => { s.pages.splice(s.cur + 1, 0, L.newPage(id, 0)); s.cur += 1; });
  };
  /* ——— Moving pages with the keyboard, and a page clipboard that works across tabs ——— */
  const selIds = () => { const s = L.state; return s.sel.size ? new Set(s.sel) : new Set(s.pages[s.cur] ? [s.pages[s.cur].id] : []); };
  // One step: every selected page swaps with its unselected neighbour (scattered pages each move, a range moves as a block).
  function stepPages(arr, ids, dir) {
    let moved = false;
    const order = dir > 0 ? [...arr.keys()].reverse() : [...arr.keys()];
    for (const i of order) {
      const j = i + dir;
      if (!ids.has(arr[i].id) || j < 0 || j >= arr.length || ids.has(arr[j].id)) continue;
      [arr[i], arr[j]] = [arr[j], arr[i]]; moved = true;
    }
    return moved;
  }
  L.movePagesBy = (steps, label) => {
    const s = L.state, ids = selIds(); if (!ids.size || !steps) return;
    const arr = s.pages.slice(), dir = Math.sign(steps); let any = false;
    for (let k = 0; k < Math.abs(steps); k++) { if (!stepPages(arr, ids, dir)) break; any = true; }
    if (!any) return;
    const curId = s.pages[s.cur]?.id;
    L.mutate(label || 'move pages', () => { s.pages = arr; s.sel = ids; s.cur = Math.max(0, L.pageIndex(curId)); });
    revealSelection();
  };
  L.movePagesTo = where => { // 'start' | 'end' | index (0-based, before that page)
    const s = L.state, ids = selIds(); if (!ids.size) return;
    const moving = s.pages.filter(p => ids.has(p.id)), rest = s.pages.filter(p => !ids.has(p.id));
    let at = where === 'start' ? 0 : where === 'end' ? rest.length : L.clamp(where, 0, rest.length);
    if (typeof where === 'number') at = rest.findIndex((p, k) => s.pages.indexOf(p) >= where); if (at < 0) at = rest.length;
    rest.splice(at, 0, ...moving);
    L.mutate('move pages', () => { s.pages = rest; s.sel = ids; s.cur = L.pageIndex(moving[0].id); });
    revealSelection();
  };
  L.pageClip = null; // { pages: [clones], from }
  L.copyPages = (cut = false) => {
    const s = L.state, ids = selIds(), pages = s.pages.filter(p => ids.has(p.id)); if (!pages.length) return;
    L.pageClip = { pages: pages.map(p => L.clonePage(p)) };
    if (cut) {
      if (pages.length >= s.pages.length) return L.toast('A document needs at least one page — copy instead.', { kind: 'err' });
      L.mutate(`cut ${pages.length > 1 ? pages.length + ' pages' : 'page'}`, () => { const first = s.pages.indexOf(pages[0]); s.pages = s.pages.filter(p => !ids.has(p.id)); s.sel = new Set(); s.cur = Math.min(first, s.pages.length - 1); });
    }
    L.toast(`${pages.length} page${pages.length > 1 ? 's' : ''} ${cut ? 'cut' : 'copied'} — Ctrl V pastes after the selected page, also in another tab`, { icon: cut ? 'scissors' : 'copy', ms: 3600 });
    L.renderInspector();
  };
  L.pastePages = (before = false) => {
    const s = L.state, c = L.pageClip; if (!c) return L.toast('Nothing to paste yet — select pages and press Ctrl C or Ctrl X.', { icon: 'info' });
    const ids = selIds(), idx = s.pages.map((p, i) => (ids.has(p.id) ? i : -1)).filter(i => i >= 0);
    const at = idx.length ? (before ? Math.min(...idx) : Math.max(...idx) + 1) : s.pages.length;
    const fresh = c.pages.map(p => ({ ...L.clonePage(p), id: L.uid('p') }));
    L.mutate(`paste ${fresh.length > 1 ? fresh.length + ' pages' : 'page'}`, () => { s.pages.splice(at, 0, ...fresh); s.sel = new Set(fresh.map(p => p.id)); s.cur = at; });
    revealSelection();
  };
  function revealSelection() {
    requestAnimationFrame(() => { const id = [...L.state.sel][0]; const el = id && L.$(`#grid-view [data-id="${id}"]`); el && el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  }
  // cards per row, so ↑ ↓ move a whole row
  const perRow = () => { const cards = L.$$('#grid-view .gcard'); if (cards.length < 2) return 1; const top = cards[0].offsetTop; let n = 0; for (const c of cards) { if (c.offsetTop !== top) break; n++; } return Math.max(1, n); };

  const selectWhere = fn => { const s = L.state; s.sel = new Set(s.pages.filter((p, i) => fn(i)).map(p => p.id)); L.emit('select'); };

  L.extractPages = async pages => {
    const t = L.task('Extracting pages'), S = L.state;
    try {
      const bytes = await L.buildPdf({ state: S, pages, task: t });
      const nums = pages.map(p => L.pageIndex(p.id, S) + 1);
      await L.saveFile(bytes, `${L.safeName(S.name)} — p${nums.length > 3 ? nums[0] + '–' + nums[nums.length - 1] : nums.join(',')}.pdf`, 'application/pdf', 'pdf');
    } catch (e) { if (e.message !== 'Cancelled') L.error('Couldn’t extract', e); } finally { t.done(); }
  };

  async function splitDialog() {
    const s = L.state, n = s.pages.length;
    let mode = 'oddeven', every = Math.max(1, Math.ceil(n / 2)), ranges = `1-${Math.ceil(n / 2)}, ${Math.ceil(n / 2) + 1}-${n}`, dest = 'files';
    const preview = h('p', { class: 'muted tiny' });
    const groups = () => {
      if (mode === 'every') { const g = []; for (let i = 0; i < n; i += every) g.push({ pages: s.pages.slice(i, i + every) }); return g; }
      if (mode === 'single') return s.pages.map(p => ({ pages: [p] }));
      if (mode === 'oddeven') return [{ pages: s.pages.filter((_, i) => i % 2 === 0), label: 'odd pages' }, { pages: s.pages.filter((_, i) => i % 2 === 1), label: 'even pages' }].filter(g => g.pages.length);
      return ranges.split(/[;,]/).map(r => ({ pages: L.parseRanges(r, n).map(i => s.pages[i]) })).filter(g => g.pages.length);
    };
    const span = x => x.length === 1 ? `p${L.pageIndex(x[0].id, s) + 1}` : `p${L.pageIndex(x[0].id, s) + 1}–${L.pageIndex(x[x.length - 1].id, s) + 1}`;
    const upd = () => { const g = groups(); preview.textContent = `Creates ${g.length} ${dest === 'tabs' ? 'tab' : 'file'}${g.length === 1 ? '' : 's'}: ` + g.slice(0, 6).map(x => x.label ? `${x.label} (${x.pages.length})` : span(x.pages)).join(', ') + (g.length > 6 ? ', …' : ''); };
    const everyIn = ui.num(every, v => { every = Math.max(1, Math.round(v || 1)); upd(); }, { min: 1, max: n });
    const rangeIn = h('input', { class: 'input', value: ranges, oninput: e => { ranges = e.target.value; upd(); } });
    const fields = h('div', { class: 'stack', style: { marginTop: '12px' } });
    const show = () => { fields.replaceChildren(mode === 'every' ? ui.field('Pages per file', everyIn) : mode === 'ranges' ? ui.field('Ranges — each comma-separated range becomes a file', rangeIn) : h('span'), preview); upd(); };
    const body = h('div', { class: 'stack', style: { gap: '12px' } },
      ui.seg([{ label: 'Odd / even', value: 'oddeven' }, { label: 'Every N', value: 'every' }, { label: 'Ranges', value: 'ranges' }, { label: 'Each page', value: 'single' }], mode, v => { mode = v; show(); }),
      fields,
      ui.field('Put the parts', ui.seg([{ label: 'Save as files', value: 'files', icon: 'download' }, { label: 'Open as new tabs', value: 'tabs', icon: 'docplus' }], dest, v => { dest = v; upd(); })));
    show();
    const ok = await L.dialog({ title: 'Split document', text: 'Save each part as its own PDF (a .zip when there are several), or open the parts as tabs to keep working.', body, actions: [{ label: 'Cancel', value: false }, { label: 'Split', primary: true, value: true }] });
    if (!ok) return;
    const g = groups();
    if (dest === 'tabs') {
      let last;
      for (const [i, part] of g.entries()) {
        const d = L.newDoc();
        Object.assign(d.state, { pages: part.pages.map(p => ({ ...L.clonePage(p), id: L.uid('p') })), name: L.safeName(`${s.name} — ${part.label || 'part ' + (i + 1)}`), dirty: true, meta: { ...s.meta, title: '' } });
        L.docs.push(d); last = d;
      }
      L.switchDoc(last); L.toast(`Opened ${g.length} parts as tabs`, { kind: 'ok', icon: 'scissors' });
      return;
    }
    const t = L.task('Splitting');
    try {
      const files = [];
      for (let i = 0; i < g.length; i++) {
        if (t.cancelled) throw new Error('Cancelled');
        t.set(i / g.length, `Part ${i + 1} of ${g.length}`);
        const label = g[i].label || `part ${String(i + 1).padStart(String(g.length).length, '0')}`;
        files.push({ name: `${L.safeName(s.name)} — ${label}.pdf`, data: await L.buildPdf({ state: s, pages: g[i].pages }), mime: 'application/pdf' });
      }
      await L.zipAndSave(files, `${L.safeName(s.name)} — split.zip`);
      L.toast(`Split into ${files.length} files`, { kind: 'ok' });
    } catch (e) { if (e.message !== 'Cancelled') L.error('Split failed', e); } finally { t.done(); }
  }

  /* ——— Grid (contact sheet) ———
     Every card acts on itself: its buttons rotate / delete that page (or the whole selection when it is part of it).
     Click, Ctrl-click, Shift-click or drag a rectangle on empty space to select; drag cards to reorder (they glide). */
  const gridEls = new Map();
  const G = { size: L.pref('gridSize', 168), forceSidebar: false, justMarqueed: false };
  const targets = p => { const s = L.state; return s.sel.has(p.id) && s.sel.size > 1 ? s.pages.filter(q => s.sel.has(q.id)) : [p]; };
  function renderGrid() {
    const grid = L.$('#grid-view'), s = L.state;
    const before = new Map([...gridEls].map(([id, el]) => [id, el.isConnected ? el.getBoundingClientRect() : null]));
    const keep = new Set(s.pages.map(p => p.id));
    for (const [id, el] of gridEls) if (!keep.has(id)) { el.remove(); gridEls.delete(id); }
    s.pages.forEach((p, i) => {
      let el = gridEls.get(p.id);
      if (!el) {
        const find = () => L.state.pages.find(q => q.id === p.id);
        const act = fn => e => { e.stopPropagation(); fn(targets(find())); };
        el = h('div', { class: 'gcard appear', 'data-id': p.id, draggable: 'true' },
          h('div', { class: 'tframe' }, h('div', { class: 'ph' }),
            h('div', { class: 'hover-actions' },
              h('button', { class: 'icon-btn small', title: 'Rotate left (Shift R)', onclick: act(ps => L.rotatePages(ps, -90)) }, L.icon('rotl')),
              h('button', { class: 'icon-btn small', title: 'Rotate right (R)', onclick: act(ps => L.rotatePages(ps, 90)) }, L.icon('rotr')),
              h('button', { class: 'icon-btn small', title: 'Delete page (Delete)', onclick: act(ps => L.deletePages(ps)) }, L.icon('trash')))),
          h('span', { class: 'num' }));
        el.addEventListener('click', e => { if (G.justMarqueed) return; L.clickSelect(find(), e); });
        el.addEventListener('dblclick', () => { L.go(L.pageIndex(p.id)); L.setBlade('view'); });
        gridEls.set(p.id, el);
      }
      if (grid.children[i] !== el) grid.insertBefore(el, grid.children[i] || null);
      el.querySelector('.num').textContent = i + 1;
      el.classList.toggle('selected', s.sel.has(p.id) || (s.sel.size === 0 && i === s.cur));
      if (el.dataset.sig !== L.pageSignature(p)) { if (el.querySelector('img')) L.fillThumb(el); else L.observeThumb(el); }
    });
    // glide every card that changed place (reorder, delete, duplicate, insert)
    if (L.reduceMotion()) return;
    for (const [id, el] of gridEls) {
      const b = before.get(id); if (!b) continue;
      const a = el.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
  // Rubber-band selection on empty grid space (Ctrl / Shift adds to the selection).
  function wireMarquee(grid) {
    let m = null;
    grid.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('.gcard') || L.viewer.hand || L.viewer.space) return;
      const s = L.state, add = e.ctrlKey || e.metaKey || e.shiftKey;
      m = { x: e.clientX, y: e.clientY, base: add ? new Set(s.sel) : new Set(), box: h('div', { class: 'marquee' }), moved: false };
      document.body.append(m.box); grid.setPointerCapture(e.pointerId); e.preventDefault();
    });
    grid.addEventListener('pointermove', e => {
      if (!m) return;
      const x1 = Math.min(m.x, e.clientX), y1 = Math.min(m.y, e.clientY), x2 = Math.max(m.x, e.clientX), y2 = Math.max(m.y, e.clientY);
      if (!m.moved && x2 - x1 < 4 && y2 - y1 < 4) return;
      m.moved = true;
      Object.assign(m.box.style, { left: x1 + 'px', top: y1 + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' });
      const sel = new Set(m.base);
      for (const [id, el] of gridEls) { const r = el.getBoundingClientRect(); if (r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1) sel.add(id); }
      L.state.sel = sel;
      for (const [id, el] of gridEls) el.classList.toggle('selected', sel.has(id));
    });
    const end = () => {
      if (!m) return;
      m.box.remove();
      if (!m.moved) L.state.sel = m.base; // a plain click on empty space clears the selection
      m = null; G.justMarqueed = true; setTimeout(() => { G.justMarqueed = false; }, 0);
      L.emit('select');
    };
    grid.addEventListener('pointerup', end); grid.addEventListener('pointercancel', end);
  }
  // Card size: slider, or Ctrl-wheel over the grid. Big cards bring the page list back; small ones put it away.
  function sidebarForGrid(on) { L.$('#workspace').classList.toggle('grid-nosb', on && !G.forceSidebar && G.size < 300); }
  function setSize(v) {
    G.size = L.clamp(Math.round(v), 110, 420); L.setPref('gridSize', G.size);
    L.$('#grid-view').style.setProperty('--card', G.size + 'px');
    const sl = L.$('.grid-hud input'); if (sl) sl.value = G.size;
    sidebarForGrid(true);
  }
  L.showSidebarAnyway = () => { G.forceSidebar = true; sidebarForGrid(L.state.blade === 'pages'); };
  let wired = false;
  const showGrid = on => {
    const grid = L.$('#grid-view');
    if (!wired) {
      L.wireReorder(grid, '.gcard'); wireMarquee(grid); wired = true;
      grid.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); e.stopPropagation(); setSize(G.size * L.wheelFactor(e)); }, { passive: false, capture: true });
      L.$('#stage-wrap').append(h('div', { class: 'grid-hud', hidden: true },
        h('button', { class: 'icon-btn small', title: 'Smaller pages', onclick: () => setSize(G.size / 1.2) }, L.icon('minus')),
        h('input', { type: 'range', min: 110, max: 420, value: G.size, 'aria-label': 'Page size', oninput: e => setSize(+e.target.value) }),
        h('button', { class: 'icon-btn small', title: 'Larger pages', onclick: () => setSize(G.size * 1.2) }, L.icon('plus'))));
    }
    grid.hidden = !on; L.$('#sheet').hidden = on; L.$('#stage-hud').hidden = on; L.$('.grid-hud').hidden = !on;
    grid.style.setProperty('--card', G.size + 'px');
    sidebarForGrid(on);
    if (on) renderGrid();
  };
  L.on('change', () => { if (L.state.blade === 'pages') renderGrid(); });
  L.on('select', () => { if (L.state.blade === 'pages') { renderGrid(); L.renderInspector(); } });
  L.on('page', () => { if (L.state.blade === 'pages') renderGrid(); });

  L.registerBlade({
    id: 'pages', label: 'Pages', icon: 'pages', color: '#5e5ce6',
    desc: 'Rotate, reorder, delete, merge, extract and split pages.',
    activate() { showGrid(true); },
    deactivate() { showGrid(false); },
    key(e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input,textarea')) { L.deletePages(L.selectedPages()); return true; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { selectWhere(() => true); return true; }
      if (e.target.closest('input,textarea,select')) return;
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && k === 'c') { L.copyPages(false); return true; }
      if (mod && k === 'x') { L.copyPages(true); return true; }
      if (mod && k === 'v') { L.pastePages(e.shiftKey); return true; }
      if (mod && k === 'd') { L.duplicatePages(L.selectedPages()); return true; }
      const ARROW = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -perRow(), ArrowDown: perRow() };
      if (e.key in ARROW && e.altKey) { // walk without moving: Alt + arrows (Shift extends the selection)
        const s = L.state, i = L.clamp(s.cur + ARROW[e.key], 0, s.pages.length - 1), p = s.pages[i];
        if (e.shiftKey) { s.sel = new Set([...selIds(), p.id]); } else s.sel = new Set([p.id]);
        s.anchor = p.id; L.go(i); L.emit('select'); revealSelection(); return true;
      }
      if (e.key in ARROW && !mod) { L.movePagesBy(ARROW[e.key], e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 'move pages a row' : 'move pages'); return true; }
      if ((e.key === 'Home' || e.key === 'End') && !mod) { L.movePagesTo(e.key === 'Home' ? 'start' : 'end'); return true; }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'r' && !e.target.closest('input,textarea')) { L.rotatePages(L.selectedPages(), e.shiftKey ? -90 : 90); return true; }
      if (e.key === 'Escape' && L.state.sel.size) { L.state.sel = new Set(); L.emit('select'); return true; }
    },
    inspector() {
      const sel = L.selectedPages(), n = sel.length, s = L.state;
      const what = n === 1 ? `Page ${L.pageIndex(sel[0].id) + 1}` : `${n} pages selected`;
      const others = L.docs.filter(d => d !== L.doc);
      let target = others.length ? others[0].id : 'new';
      const rangeIn = h('input', { class: 'input', placeholder: 'e.g. 1-3, 8, 12-', onkeydown: e => { if (e.key === 'Enter') applyRange(); e.stopPropagation(); } });
      const applyRange = () => { const idx = new Set(L.parseRanges(rangeIn.value, s.pages.length)); if (!idx.size) return L.toast('Type pages like 1-3, 8, 12-', { kind: 'err' }); selectWhere(i => idx.has(i)); };
      const send = move => L.transferPages(L.selectedPages().map(p => p.id), target === 'new' ? 'new' : L.docs.find(d => d.id === target), { move });
      return [
        ui.head('pages', 'Pages', 'Click a page to select it; Ctrl-click, Shift-click or drag a box for several. Drag to reorder. A page’s own buttons act on it at once.'),
        ui.section('Select · ' + what,
          h('div', { class: 'grid4' },
            ui.btn('All', null, () => selectWhere(() => true)),
            ui.btn('Odd', null, () => selectWhere(i => i % 2 === 0)),
            ui.btn('Even', null, () => selectWhere(i => i % 2 === 1)),
            ui.btn('None', null, () => { s.sel = new Set(); L.emit('select'); })),
          h('div', { class: 'row', style: { marginTop: '8px' } }, rangeIn, ui.btn('Select', null, applyRange))),
        ui.section('Send to another document',
          ui.field(`Copy or move ${n === 1 ? 'this page' : `these ${n} pages`} to`,
            ui.select([...others.map(d => ({ value: d.id, label: d.state.name })), { value: 'new', label: '＋ New tab' }], target, v => { target = v; })),
          h('div', { class: 'grid2', style: { marginTop: '10px' } },
            ui.btn('Copy', 'duplicate', () => send(false), 'primary'),
            ui.btn('Move', 'extract', () => send(true))),
          h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, others.length ? 'Or drag pages onto a tab — hold Shift to move instead of copy.' : 'Open another PDF (Ctrl O) to send pages to it, or make a new tab.')),
        ui.section('Move & clipboard · ' + what,
          h('div', { class: 'move-pad' },
            h('button', { class: 'tool', title: 'Move to the start (Home)', onclick: () => L.movePagesTo('start') }, '⇤'),
            h('button', { class: 'tool', title: 'Move up a row (↑)', onclick: () => L.movePagesBy(-perRow()) }, '↑'),
            h('button', { class: 'tool', title: 'Move to the end (End)', onclick: () => L.movePagesTo('end') }, '⇥'),
            h('button', { class: 'tool', title: 'Move one place left (←)', onclick: () => L.movePagesBy(-1) }, '←'),
            h('button', { class: 'tool', title: 'Move down a row (↓)', onclick: () => L.movePagesBy(perRow()) }, '↓'),
            h('button', { class: 'tool', title: 'Move one place right (→)', onclick: () => L.movePagesBy(1) }, '→')),
          h('div', { class: 'row', style: { marginTop: '8px' } },
            h('input', { class: 'input', type: 'number', min: 1, max: s.pages.length, placeholder: 'Before page…', onkeydown: e => { e.stopPropagation(); if (e.key === 'Enter') { const v = +e.target.value; if (v >= 1) L.movePagesTo(v - 1); } } }),
            ui.btn('Move', null, e => { const v = +e.currentTarget.previousSibling.value; if (v >= 1) L.movePagesTo(v - 1); })),
          h('div', { class: 'grid3', style: { marginTop: '8px' } },
            ui.btn('Cut', 'scissors', () => L.copyPages(true)), ui.btn('Copy', 'copy', () => L.copyPages(false)),
            ui.btn(L.pageClip ? `Paste ${L.pageClip.pages.length}` : 'Paste', 'duplicate', () => L.pastePages(false), L.pageClip ? 'primary' : '')),
          h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Keys: ← → ↑ ↓ move · Home / End · Ctrl X / C / V (Ctrl Shift V pastes before) · Ctrl D duplicate · Alt + arrows walk without moving.')),
        ui.section('Rotate · ' + what,
          h('div', { class: 'grid3' },
            h('button', { class: 'tool', onclick: () => L.rotateSelected(-90) }, L.icon('rotl'), 'Left'),
            h('button', { class: 'tool', onclick: () => L.rotateSelected(90) }, L.icon('rotr'), 'Right'),
            h('button', { class: 'tool', onclick: () => L.rotateSelected(180) }, L.icon('rot180'), '180°')),
          h('div', { class: 'row', style: { marginTop: '10px' } },
            ui.btn('Rotate all pages…', null, async () => {
              const v = await L.dialog({ title: 'Rotate all pages', text: 'Turn every page in the document.', actions: [{ label: 'Cancel', value: null }, { label: 'Left', value: -90 }, { label: '180°', value: 180 }, { label: 'Right', primary: true, value: 90 }] });
              if (v) L.rotatePages(L.state.pages, v);
            }, 'ghost'))),
        ui.section('Arrange',
          h('div', { class: 'grid2' },
            ui.btn('Duplicate', 'duplicate', () => L.duplicatePages(L.selectedPages())),
            ui.btn('Delete', 'trash', () => L.deletePages(L.selectedPages()), 'danger'),
            ui.btn('Blank page', 'docplus', () => L.insertBlank()),
            ui.btn('Reverse', 'rot180', () => L.mutate('reverse order', () => { s.pages = s.pages.slice().reverse(); s.cur = s.pages.length - 1 - s.cur; })))),
        ui.section('Combine & separate',
          h('div', { class: 'stack' },
            ui.btn('Merge this with other files…', 'merge', () => L.openMerge({ withCurrent: true }), 'block primary'),
            ui.btn('Add PDFs or images…', 'plus', () => L.pickFiles(true), 'block'),
            ui.btn(`Extract ${n === 1 ? 'this page' : n + ' pages'} as PDF`, 'extract', () => L.extractPages(sel), 'block'),
            ui.btn('Split — odd / even, ranges, each page…', 'scissors', splitDialog, 'block')),
          h('p', { class: 'muted tiny', style: { margin: '10px 0 0' } }, 'Tip: drop files onto the page list to insert them where you drop.')),
      ];
    },
  });
})();
