/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Crop blade: drag a frame, nudge it numerically, auto-trim margins, apply to one, some or all pages. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;
  const C = { draft: null, pageId: null, drag: null, scope: 'this' };

  const full = p => L.pageBox(L.proxySync(p));
  function ensureDraft() {
    const p = L.page(); if (!p || !L.proxySync(p)) return null;
    if (C.pageId !== p.id || !C.draft) { C.pageId = p.id; C.draft = p.crop ? { ...p.crop } : full(p); }
    return C.draft;
  }
  // Insets (pt) of the draft from the page box, expressed in user space edges.
  const insetsOf = (p, r) => { const b = full(p); return { l: r.x - b.x, b: r.y - b.y, r: b.x + b.w - (r.x + r.w), t: b.y + b.h - (r.y + r.h) }; };
  const applyInsets = (p, ins) => {
    const b = full(p), x = b.x + ins.l, y = b.y + ins.b, w = b.w - ins.l - ins.r, hh = b.h - ins.b - ins.t;
    if (w < 10 || hh < 10) return null;
    return (Math.abs(ins.l) + Math.abs(ins.r) + Math.abs(ins.t) + Math.abs(ins.b) < 0.5) ? null : { x, y, w, h: hh };
  };
  function targets() {
    const s = L.state, i = s.cur;
    if (C.scope === 'all') return s.pages;
    if (C.scope === 'selected') return L.selectedPages();
    if (C.scope === 'odd' || C.scope === 'even') return s.pages.filter((_, k) => (k % 2 === 0) === (C.scope === 'odd'));
    return [s.pages[i]];
  }
  async function apply() {
    const p = L.page(), r = ensureDraft(); if (!r) return;
    const ins = insetsOf(p, r), list = targets();
    for (const q of list) await L.proxy(q);
    L.mutate(list.length > 1 ? `crop ${list.length} pages` : 'crop', () => {
      const ids = new Set(list.map(q => q.id));
      L.state.pages = L.state.pages.map(q => ids.has(q.id) ? { ...q, crop: q.id === p.id ? (applyInsets(q, ins) ? { ...r } : null) : applyInsets(q, ins) } : q);
    });
    C.draft = null;
    L.toast(list.length > 1 ? `Cropped ${list.length} pages` : 'Page cropped', { kind: 'ok', icon: 'crop' });
  }
  function reset(all) {
    L.mutate(all ? 'reset all crops' : 'reset crop', () => {
      L.state.pages = L.state.pages.map((q, k) => (all || k === L.state.cur) ? { ...q, crop: null } : q);
    });
    C.draft = null;
  }

  // Find the inked area of a page (ignoring speckles and dark scanner borders), returned as a user-space rect.
  async function contentBox(p, padPt = 8) {
    const proxy = await L.proxy(p), c = document.createElement('canvas');
    const base = L.makeView(proxy, p, 1, { full: true }), scale = 1000 / Math.max(base.width, base.height);
    const view = await L.renderInto(c, p, scale, { full: true, dpr: 1, annotations: true, readback: true });
    const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
    // Ink is counted on a coarse grid; cells with no inked neighbour are scanner specks and ignored.
    const S = 6, GW = Math.ceil(W / S), GH = Math.ceil(H / S), cnt = new Uint16Array(GW * GH);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; if (d[k] + d[k + 1] + d[k + 2] < 540) cnt[((y / S) | 0) * GW + ((x / S) | 0)]++; }
    const ink = i => cnt[i] >= 3;
    // scanner edges: grid rows / columns that are almost entirely inked are borders, not content
    const rowFill = new Uint16Array(GH), colFill = new Uint16Array(GW);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) if (ink(gy * GW + gx)) { rowFill[gy]++; colFill[gx]++; }
    let x0 = GW, y0 = GH, x1 = -1, y1 = -1;
    for (let gy = 3; gy < GH - 3; gy++) { // skip the outermost ~2% where scanner shadows live
      if (rowFill[gy] > GW * 0.8) continue;
      for (let gx = 3; gx < GW - 3; gx++) {
        if (colFill[gx] > GH * 0.8 || !ink(gy * GW + gx)) continue;
        let nb = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && ink((gy + dy) * GW + gx + dx)) nb++;
        if (nb < 2) continue;
        if (gx < x0) x0 = gx; if (gx > x1) x1 = gx; if (gy < y0) y0 = gy; if (gy > y1) y1 = gy;
      }
    }
    if (x1 < 0 || y1 < 0) return null;
    x0 *= S; y0 *= S; x1 = Math.min(W - 1, (x1 + 1) * S); y1 = Math.min(H - 1, (y1 + 1) * S);
    const pad = padPt * scale;
    const sr = { x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad), w: Math.min(W, x1 + pad) - Math.max(0, x0 - pad), h: Math.min(H, y1 + pad) - Math.max(0, y0 - pad) };
    return view.rectToPdf(sr);
  }
  async function autoTrim(scopeAll) {
    const list = scopeAll ? L.state.pages : L.selectedPages(), doc = L.doc;
    const t = L.task('Finding margins'); const res = new Map();
    try {
      for (let i = 0; i < list.length; i++) {
        if (t.cancelled) throw new Error('Cancelled');
        t.set(i / list.length, `Page ${i + 1} of ${list.length}`);
        const r = await contentBox(list[i]); if (r) res.set(list[i].id, r);
      }
    } catch (e) { if (e.message !== 'Cancelled') L.error('Auto-trim failed', e); t.done(); return; }
    t.done();
    if (!res.size) return L.toast('Couldn’t find any content to trim to.', { kind: 'err' });
    L.inDoc(doc, () => L.mutate(`auto-trim ${res.size} page${res.size > 1 ? 's' : ''}`, () => { L.state.pages = L.state.pages.map(q => res.has(q.id) ? { ...q, crop: res.get(q.id) } : q); }, { silent: doc !== L.doc }));
    C.draft = null;
    L.toast(`Trimmed ${res.size} page${res.size > 1 ? 's' : ''}`, { kind: 'ok', icon: 'wand' });
  }

  /* ——— Interaction ——— */
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const handlePos = (b, k) => [b.x + (k.includes('w') ? 0 : k.includes('e') ? b.w : b.w / 2), b.y + (k.includes('n') ? 0 : k.includes('s') ? b.h : b.h / 2)];
  function pointer(type, ev) {
    const view = L.viewer.view, r = ensureDraft(); if (!r || !view) return;
    const b = view.rectToScreen(r);
    if (type === 'hover') {
      const k = HANDLES.find(k => { const q = handlePos(b, k); return Math.hypot(q[0] - ev.sx, q[1] - ev.sy) < 10; });
      L.setCursor(k ? 'crosshair' : (ev.sx > b.x && ev.sx < b.x + b.w && ev.sy > b.y && ev.sy < b.y + b.h) ? 'move' : 'crosshair');
      return;
    }
    if (type === 'down') {
      const k = HANDLES.find(k => { const q = handlePos(b, k); return Math.hypot(q[0] - ev.sx, q[1] - ev.sy) < 10; });
      if (k) C.drag = { mode: k, b0: b, s: [ev.sx, ev.sy] };
      else if (ev.sx > b.x && ev.sx < b.x + b.w && ev.sy > b.y && ev.sy < b.y + b.h) C.drag = { mode: 'move', b0: b, s: [ev.sx, ev.sy] };
      else C.drag = { mode: 'new', s: [ev.sx, ev.sy] };
      return;
    }
    if (type === 'move' && C.drag) {
      const d = C.drag, W = view.width, H = view.height, dx = ev.sx - d.s[0], dy = ev.sy - d.s[1];
      let nb;
      if (d.mode === 'new') nb = { x: Math.min(d.s[0], ev.sx), y: Math.min(d.s[1], ev.sy), w: Math.abs(dx), h: Math.abs(dy) };
      else if (d.mode === 'move') nb = { ...d.b0, x: L.clamp(d.b0.x + dx, 0, W - d.b0.w), y: L.clamp(d.b0.y + dy, 0, H - d.b0.h) };
      else {
        let { x, y, w, h: hh } = d.b0, x2 = x + w, y2 = y + hh;
        if (d.mode.includes('w')) x = Math.min(x2 - 10, x + dx); if (d.mode.includes('e')) x2 = Math.max(x + 10, x2 + dx);
        if (d.mode.includes('n')) y = Math.min(y2 - 10, y + dy); if (d.mode.includes('s')) y2 = Math.max(y + 10, y2 + dy);
        nb = { x, y, w: x2 - x, h: y2 - y };
      }
      nb.x = L.clamp(nb.x, 0, W); nb.y = L.clamp(nb.y, 0, H); nb.w = Math.min(nb.w, W - nb.x); nb.h = Math.min(nb.h, H - nb.y);
      if (nb.w > 4 && nb.h > 4) { C.draft = view.rectToPdf(nb); L.drawOverlay(); }
      return;
    }
    if (type === 'up' && C.drag) { C.drag = null; L.renderInspector(); }
  }
  function draw({ svg, view }) {
    const r = ensureDraft(); if (!r) return;
    const b = view.rectToScreen(r), W = view.width, H = view.height;
    svg.append(L.s('path', { d: `M0 0H${W}V${H}H0Z M${b.x} ${b.y}V${b.y + b.h}H${b.x + b.w}V${b.y}Z`, fill: 'rgba(0,0,0,.45)', 'fill-rule': 'evenodd', 'pointer-events': 'none' }));
    const g = L.s('g', { 'pointer-events': 'none' });
    g.append(L.s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: 'none', stroke: '#fff', 'stroke-width': 1.5 }));
    for (const f of [1 / 3, 2 / 3]) {
      g.append(L.s('line', { x1: b.x + b.w * f, y1: b.y, x2: b.x + b.w * f, y2: b.y + b.h, stroke: 'rgba(255,255,255,.45)', 'stroke-width': 0.75 }));
      g.append(L.s('line', { x1: b.x, y1: b.y + b.h * f, x2: b.x + b.w, y2: b.y + b.h * f, stroke: 'rgba(255,255,255,.45)', 'stroke-width': 0.75 }));
    }
    const L2 = 16, T = 4;
    for (const [cx, cy, sx, sy] of [[b.x, b.y, 1, 1], [b.x + b.w, b.y, -1, 1], [b.x, b.y + b.h, 1, -1], [b.x + b.w, b.y + b.h, -1, -1]])
      g.append(L.s('path', { d: `M${cx} ${cy + sy * L2}V${cy}H${cx + sx * L2}`, fill: 'none', stroke: '#fff', 'stroke-width': T, 'stroke-linecap': 'round', transform: `translate(${-sx * T / 2},${-sy * T / 2})` }));
    for (const k of ['n', 'e', 's', 'w']) { const [x, y] = handlePos(b, k); g.append(L.s('rect', { x: x - (k === 'n' || k === 's' ? 9 : 2), y: y - (k === 'e' || k === 'w' ? 9 : 2), width: k === 'n' || k === 's' ? 18 : 4, height: k === 'e' || k === 'w' ? 18 : 4, rx: 2, fill: '#fff' })); }
    const label = `${(b.w / view.scale / L.MM).toFixed(0)} × ${(b.h / view.scale / L.MM).toFixed(0)} mm`;
    g.append(L.s('rect', { x: b.x + b.w / 2 - 50, y: b.y + 10, width: 100, height: 22, rx: 11, fill: 'rgba(0,0,0,.6)' }));
    g.append(L.s('text', { x: b.x + b.w / 2, y: b.y + 25, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11.5, 'font-weight': 600 }, label));
    svg.append(g);
  }

  L.registerBlade({
    id: 'crop', label: 'Crop', icon: 'crop', color: '#30a46c', precise: true,
    desc: 'Trim margins on one page or all of them — by hand or automatically.',
    fullPage: () => true,
    activate() { C.draft = null; L.setCursor('crosshair'); L.render(); },
    deactivate() { C.draft = null; C.drag = null; L.render(); },
    draw, pointer,
    key(e) { if (e.key === 'Enter' && !e.target.closest('input,textarea')) { apply(); return true; } },
    inspector() {
      const p = L.page(), r = ensureDraft();
      const v = p && L.proxySync(p) && L.makeView(L.proxySync(p), p, 1, { full: true });
      // margins in display orientation (mm)
      let m = { top: 0, right: 0, bottom: 0, left: 0 };
      if (r && v) { const b = v.rectToScreen(r); m = { top: b.y, left: b.x, right: v.width - b.x - b.w, bottom: v.height - b.y - b.h }; }
      const setM = (k, mm) => {
        const b = v.rectToScreen(ensureDraft()); const pt = Math.max(0, mm * L.MM);
        let { x, y, w, h: hh } = b;
        if (k === 'top') { hh = y + hh - pt; y = pt; } if (k === 'left') { w = x + w - pt; x = pt; }
        if (k === 'right') w = v.width - pt - x; if (k === 'bottom') hh = v.height - pt - y;
        if (w > 10 && hh > 10) { C.draft = v.rectToPdf({ x, y, w, h: hh }); L.drawOverlay(); }
      };
      const mmIn = k => ui.num((m[k] / L.MM).toFixed(1), val => { setM(k, val || 0); }, { min: 0 });
      const n = L.state.pages.length, nSel = L.selectedPages().length;
      const croppedCount = L.state.pages.filter(q => q.crop).length;
      return [
        ui.head('crop', 'Crop', 'Drag the frame’s edges, or draw a new one.'),
        ui.section('Margins (mm)',
          h('div', { class: 'grid2' }, ui.field('Top', mmIn('top')), ui.field('Bottom', mmIn('bottom')), ui.field('Left', mmIn('left')), ui.field('Right', mmIn('right')))),
        ui.section('Apply to',
          ui.select([{ value: 'this', label: 'This page' }, { value: 'selected', label: `Selected pages (${nSel})` }, { value: 'all', label: `All ${n} pages` }, { value: 'odd', label: 'Odd pages' }, { value: 'even', label: 'Even pages' }], C.scope, val => { C.scope = val; }),
          h('div', { style: { marginTop: '12px' } }, ui.btn('Crop', 'check', apply, 'primary block lg')),
          h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Other pages get the same margins. Press Enter to apply.')),
        ui.section('Automatic',
          h('div', { class: 'stack' },
            ui.btn('Auto-trim this page', 'wand', () => autoTrim(false), 'block'),
            ui.btn('Auto-trim all pages', 'wand', () => autoTrim(true), 'block')),
          h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Finds the printed area and trims the empty margin around it — ideal for scans.')),
        ui.section('Reset',
          h('div', { class: 'grid2' },
            ui.btn('This page', null, () => reset(false), p && p.crop ? '' : 'ghost'),
            ui.btn(`All (${croppedCount})`, null, () => reset(true), croppedCount ? '' : 'ghost')),
          h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Cropping is non-destructive: the hidden area is kept in the file and can be restored.')),
      ];
    },
  });
  L.on('page', () => { C.draft = null; if (L.state.blade === 'crop') L.renderInspector(); });
  L.on('change', () => { C.draft = null; });
})();
