/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Edit blade: change existing text, add text, highlight, white-out, redact, draw, shapes, signatures and images. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;

  const TOOLS = [
    { id: 'select', label: 'Select', icon: 'cursor', hint: 'Click an edit to select it. Drag to move, drag the corner to resize, Delete to remove. Double-click text to retype it.' },
    { id: 'retype', label: 'Edit text', icon: 'textedit', hint: 'Click any existing line of text to rewrite it. Loeito covers the old line with matching paper colour and types your version on top.' },
    { id: 'text', label: 'Text', icon: 'type', hint: 'Click where you want to type. Press Esc or click away when done.' },
    { id: 'highlight', label: 'Highlight', icon: 'highlight', hint: 'Drag across text to highlight it.' },
    { id: 'whiteout', label: 'White-out', icon: 'whiteout', hint: 'Drag over anything to hide it. The fill matches the paper colour automatically.' },
    { id: 'redact', label: 'Redact', icon: 'redact', hint: 'Drag over sensitive content. On save, redacted pages are flattened to images so the hidden text is truly gone.' },
    { id: 'pen', label: 'Draw', icon: 'pen', hint: 'Draw freely with the mouse, pen or finger.' },
    { id: 'rect', label: 'Box', icon: 'rect', hint: 'Drag to draw a box.' },
    { id: 'ellipse', label: 'Circle', icon: 'ellipse', hint: 'Drag to draw a circle or ellipse. Hold Shift for a perfect circle.' },
    { id: 'line', label: 'Line', icon: 'line', hint: 'Drag to draw a line. Hold Shift to snap to 45°.' },
    { id: 'arrow', label: 'Arrow', icon: 'arrow', hint: 'Drag to draw an arrow. Hold Shift to snap to 45°.' },
    { id: 'signature', label: 'Sign', icon: 'signature', hint: 'Create or choose a signature, then click on the page to place it.' },
    { id: 'image', label: 'Image', icon: 'image', hint: 'Choose a picture, then click on the page to place it.' },
  ];
  const E = (L.edit = {
    tool: 'select', selId: null, draft: null, drag: null, pending: null, editor: null,
    style: {
      text: { color: '#1d1d1f', size: 12, font: 'Helvetica', bold: false },
      highlight: { color: '#ffd60a', opacity: 0.4 },
      whiteout: { color: '#ffffff', match: true },
      pen: { color: '#0090ff', width: 2 },
      shape: { color: '#e5484d', width: 2 },
    },
  });
  const styleKey = t => (['rect', 'ellipse', 'line', 'arrow'].includes(t) ? 'shape' : t === 'retype' ? 'text' : t);
  const cursorFor = t => ({ select: '', text: 'text', retype: 'text', signature: 'crosshair', image: 'crosshair' }[t] ?? 'crosshair');
  const page = () => L.page();
  const selAnn = () => page()?.ann.find(a => a.id === E.selId);

  function setTool(t) {
    commitEditor();
    E.tool = t; E.draft = null; if (t !== 'select') E.selId = null;
    L.setCursor(cursorFor(t));
    if (t === 'signature') openSignature();
    if (t === 'image') pickImage();
    L.renderInspector(); L.drawOverlay();
  }

  // Sample the paper colour around a screen rect (median of the border pixels).
  function paperColor(sr) {
    try {
      const c = L.$('#page-canvas'), dpr = c.width / L.viewer.view.width, cx = c.getContext('2d');
      const x = Math.max(0, Math.floor((sr.x - 3) * dpr)), y = Math.max(0, Math.floor((sr.y - 3) * dpr));
      const w = Math.min(c.width - x, Math.ceil((sr.w + 6) * dpr)), hh = Math.min(c.height - y, Math.ceil((sr.h + 6) * dpr));
      if (w < 2 || hh < 2) return '#ffffff';
      const d = cx.getImageData(x, y, w, hh).data, lum = [];
      const push = (i, j) => { const k = (j * w + i) * 4; lum.push([d[k] + d[k + 1] + d[k + 2], d[k], d[k + 1], d[k + 2]]); };
      for (let i = 0; i < w; i += 2) { push(i, 0); push(i, hh - 1); }
      for (let j = 0; j < hh; j += 2) { push(0, j); push(w - 1, j); }
      lum.sort((a, b) => b[0] - a[0]);
      const m = lum[Math.floor(lum.length * 0.25)]; // bright quartile: paper, not ink
      return '#' + [m[1], m[2], m[3]].map(v => v.toString(16).padStart(2, '0')).join('');
    } catch { return '#ffffff'; }
  }

  /* ——— Text editor overlay ——— */
  function openEditor(a, selectAll = false) {
    commitEditor();
    const view = L.viewer.view; if (!view) return;
    const P = view.toScreen([a.x, a.y]), su = view.vec(L.annFrame(a).u), deg = Math.atan2(su[1], su[0]) * 180 / Math.PI, k = view.scale;
    const ta = h('textarea', { class: 'ann-editor', spellcheck: 'false', value: a.text });
    Object.assign(ta.style, { left: P[0] + 'px', top: P[1] + 'px', transform: `rotate(${deg}deg)`, fontSize: a.size * k + 'px', fontFamily: L.FONTS[a.font].css, fontWeight: a.bold ? 700 : 400, color: a.color });
    const fit = () => { const sz = L.textSize({ ...a, text: ta.value || ' ' }); ta.style.width = (sz.w * k + a.size * k) + 'px'; ta.style.height = (sz.h * k + 4) + 'px'; };
    ta.addEventListener('input', () => { a.text = ta.value; fit(); });
    ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); commitEditor(); } });
    ta.addEventListener('blur', () => setTimeout(() => { if (E.editor && E.editor.ta === ta) commitEditor(); }, 0));
    L.$('#html-layer').append(ta); fit();
    E.editor = { ta, id: a.id };
    E.selId = a.id; L.drawOverlay(); L.renderInspector();
    requestAnimationFrame(() => { ta.focus(); selectAll ? ta.select() : ta.setSelectionRange(ta.value.length, ta.value.length); });
  }
  function commitEditor() {
    const ed = E.editor; if (!ed) return;
    E.editor = null; ed.ta.remove();
    const p = page(), a = p && p.ann.find(x => x.id === ed.id);
    if (a && !a.text.trim()) { p.ann = p.ann.filter(x => x !== a); const w = p.ann.find(x => x.id === a.coverId); if (w && a.coverId) p.ann = p.ann.filter(x => x !== w); E.selId = null; }
    L.state.dirty = true; L.emit('change', { label: 'text' });
  }

  /* ——— Signature & image ——— */
  const SIG_KEY = 'loeito.signatures';
  const loadSigs = () => { try { return JSON.parse(localStorage.getItem(SIG_KEY) || '[]'); } catch { return []; } };
  const saveSigs = list => { try { localStorage.setItem(SIG_KEY, JSON.stringify(list.slice(0, 6))); } catch {} };
  function trimCanvas(c) {
    const cx = c.getContext('2d'), d = cx.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const pad = 6, o = document.createElement('canvas'); o.width = x1 - x0 + pad * 2; o.height = y1 - y0 + pad * 2;
    o.getContext('2d').drawImage(c, x0 - pad, y0 - pad, o.width, o.height, 0, 0, o.width, o.height);
    return o;
  }
  async function openSignature(onReady) {
    let mode = 'draw', color = '#1d1d1f';
    const pad = h('canvas', { class: 'sigpad', width: 920, height: 340 });
    const typed = h('input', { class: 'input', placeholder: 'Type your name', style: { height: '40px', fontSize: '16px' } });
    const fontSel = ui.select([{ value: 'Homemade Apple', label: 'Handwritten' }, { value: 'Caveat', label: 'Casual' }], 'Homemade Apple', () => drawTyped());
    const typedPreview = h('canvas', { class: 'sigpad', width: 920, height: 340 });
    const drawTyped = () => {
      const c = typedPreview, cx = c.getContext('2d'); cx.clearRect(0, 0, c.width, c.height);
      const f = fontSel.value, size = f === 'Caveat' ? 120 : 76;
      cx.fillStyle = color; cx.font = `${size}px "${f}"`; cx.textBaseline = 'middle';
      cx.fillText(typed.value, 30, c.height / 2, c.width - 60);
    };
    typed.addEventListener('input', drawTyped);
    // smooth pen
    let drawing = false, last = null;
    const ctx = pad.getContext('2d'); ctx.lineCap = ctx.lineJoin = 'round';
    const pt = e => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) * pad.width / r.width, (e.clientY - r.top) * pad.height / r.height, e.pressure || 0.5]; };
    pad.addEventListener('pointerdown', e => { drawing = true; pad.setPointerCapture(e.pointerId); last = pt(e); });
    pad.addEventListener('pointermove', e => {
      if (!drawing) return; const p = pt(e);
      ctx.strokeStyle = color; ctx.lineWidth = 3.2 + p[2] * 3;
      ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.quadraticCurveTo(last[0], last[1], (last[0] + p[0]) / 2, (last[1] + p[1]) / 2); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p;
    });
    pad.addEventListener('pointerup', () => { drawing = false; });
    const upload = h('input', { type: 'file', accept: 'image/png,image/jpeg', class: 'input', style: { paddingTop: '3px' } });
    const saved = loadSigs();
    let chosen = null;
    const savedRow = saved.length ? h('div', { class: 'stack', style: { marginTop: '14px' } }, h('span', { class: 'label' }, 'Saved'),
      h('div', { class: 'sig-saved' }, saved.map(src => h('button', { title: 'Use this signature', onclick: () => { chosen = src; L.closeDialog('use'); } }, h('img', { src }))))) : null;
    const panes = { draw: h('div', null, pad, h('div', { class: 'row between', style: { marginTop: '8px' } }, L.swatches(color, c => { color = c; drawTyped(); }, ['#1d1d1f', '#0040a8', '#0090ff']), h('button', { class: 'btn ghost', onclick: () => ctx.clearRect(0, 0, pad.width, pad.height) }, 'Clear'))),
      type: h('div', { class: 'stack' }, h('div', { class: 'grid2' }, typed, fontSel), typedPreview), upload: h('div', { class: 'stack' }, upload, h('p', { class: 'muted tiny' }, 'A photo or scan of your signature on white paper works best — the background is removed automatically.')) };
    const holder = h('div', { style: { marginTop: '12px' } }, panes.draw);
    const body = h('div', null, ui.seg([{ label: 'Draw', value: 'draw' }, { label: 'Type', value: 'type' }, { label: 'Image', value: 'upload' }], mode, v => { mode = v; holder.replaceChildren(panes[v]); }), holder, savedRow,
      h('label', { class: 'check', style: { marginTop: '12px' } }, h('input', { type: 'checkbox', checked: true, id: 'sig-remember' }), h('span', null, 'Remember on this computer')));
    const res = await L.dialog({ title: 'Signature', text: 'Draw, type or upload — then click the page to place it.', body, actions: [{ label: 'Cancel', value: null }, { label: 'Use signature', primary: true, value: 'use' }] });
    if (!res) { if (onReady) return; E.tool = 'select'; L.setCursor(''); L.renderInspector(); return; }
    let src = chosen;
    if (!src) {
      let c;
      if (mode === 'draw') c = trimCanvas(pad);
      else if (mode === 'type') { drawTyped(); c = trimCanvas(typedPreview); }
      else if (upload.files[0]) c = trimCanvas(await knockOutWhite(upload.files[0]));
      if (!c) { L.toast('Nothing to place yet — draw or type a signature first.', { kind: 'err' }); E.tool = 'select'; L.renderInspector(); return; }
      src = c.toDataURL('image/png');
      if (document.getElementById('sig-remember')?.checked !== false) saveSigs([src, ...saved.filter(s => s !== src)]);
    }
    const im = await loadImg(src);
    if (onReady) return onReady({ src, ar: im.height / im.width });
    E.pending = { src, ar: im.height / im.width, w: 140, kind: 'signature' };
    L.toast('Click on the page to place your signature', { icon: 'signature' });
  }
  async function knockOutWhite(file) {
    const im = await loadImg(URL.createObjectURL(file));
    const k = Math.min(1, 1400 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    const cx = c.getContext('2d'); cx.drawImage(im, 0, 0, c.width, c.height);
    const id = cx.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; d[i + 3] = l > 200 ? 0 : l > 150 ? Math.round((200 - l) / 50 * 255) : 255; }
    cx.putImageData(id, 0, 0); return c;
  }
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  function pickImage() {
    const inp = h('input', { type: 'file', accept: 'image/png,image/jpeg' });
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const im = await loadImg(URL.createObjectURL(f));
      const k = Math.min(1, 2200 / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const src = f.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
      const v = L.viewer.view;
      E.pending = { src, ar: c.height / c.width, w: Math.min(c.width * 0.75, (v ? v.width / v.scale : 400) * 0.5), kind: 'image' };
      L.toast('Click on the page to place the image', { icon: 'image' });
    };
    inp.click();
  }

  /* ——— Hit testing ——— */
  function hitTest(sx, sy) {
    const p = page(), view = L.viewer.view;
    for (let i = p.ann.length - 1; i >= 0; i--) {
      const b = L.annScreenBox(p.ann[i], view);
      if (sx >= b.x - 4 && sx <= b.x + b.w + 4 && sy >= b.y - 4 && sy <= b.y + b.h + 4) return p.ann[i];
    }
    return null;
  }
  const resizable = a => a && (a.r || a.type === 'image' || a.p1);
  function handleAt(sx, sy) {
    const a = selAnn(), view = L.viewer.view; if (!resizable(a)) return null;
    if (a.p1) {
      for (const k of ['p1', 'p2']) { const q = view.toScreen(a[k]); if (Math.hypot(q[0] - sx, q[1] - sy) < 8) return k; }
      return null;
    }
    const b = L.annScreenBox(a, view);
    return Math.hypot(b.x + b.w - sx, b.y + b.h - sy) < 9 ? 'br' : null;
  }
  async function retypeAt(sx, sy) {
    const p = page(), view = L.viewer.view;
    const items = (await L.pdfTextItems(p)).concat(p.ocr ? groupLines(p.ocr.words) : []);
    let best = null;
    for (const it of items) { const b = L.wordBox(it, view); if (sx >= b.x - 2 && sx <= b.x + b.w + 2 && sy >= b.y - 2 && sy <= b.y + b.h + 2) { if (!best || b.w * b.h < best.b.w * best.b.h) best = { it, b }; } }
    if (!best) { L.toast('No text found there — use the Text tool to add new text.', { icon: 'info' }); return; }
    const it = best.it, rad = it.a * Math.PI / 180, up = [-Math.sin(rad), Math.cos(rad)];
    const fam = (it.style && it.style.fontFamily) || '', fname = String(it.font || '') + ' ' + fam;
    const font = /serif/i.test(fam) && !/sans/i.test(fam) || /times|roman|serif/i.test(fname) && !/sans/i.test(fname) ? 'Times' : /mono|courier/i.test(fname) ? 'Courier' : 'Helvetica';
    const size = Math.round(it.h * 10) / 10;
    const coverScreen = { x: best.b.x - 1.5, y: best.b.y - 1.5, w: best.b.w + 3, h: best.b.h + 3 };
    const cover = { id: L.uid('a'), type: 'whiteout', r: view.rectToPdf(coverScreen), color: paperColor(coverScreen) };
    const t = { id: L.uid('a'), type: 'text', x: it.x + up[0] * size * 0.8, y: it.y + up[1] * size * 0.8, a: Math.round(it.a), text: it.t.trim(), size, font, bold: /bold|black|heavy/i.test(fname), color: '#111111', coverId: cover.id };
    L.mutate('edit text', () => { p.ann.push(cover, t); }, { silent: true });
    L.emit('change', { label: 'edit text' });
    openEditor(t, true);
  }
  // OCR words → line runs (so "Edit text" works on scanned pages too)
  function groupLines(words) {
    const out = []; let cur = null;
    for (const w of words) {
      if (cur && Math.abs(w.a - cur.a) < 1 && Math.abs((w.y - cur.y) * Math.cos(cur.a * Math.PI / 180)) < cur.h * 0.4 && (w.x - (cur.x + cur.w)) < cur.h * 1.5 && w.x > cur.x) {
        cur.w = w.x + w.w - cur.x; cur.t += ' ' + w.t; cur.h = Math.max(cur.h, w.h);
      } else { cur = { ...w }; out.push(cur); }
    }
    return out;
  }

  /* ——— Pointer ——— */
  const snap45 = (p0, p1) => { const dx = p1[0] - p0[0], dy = p1[1] - p0[1], a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), r = Math.hypot(dx, dy); return [p0[0] + r * Math.cos(a), p0[1] + r * Math.sin(a)]; };
  function pointer(type, ev) {
    const view = L.viewer.view, p = page();
    if (type === 'leave') return;
    if (type === 'dbl') { const a = hitTest(ev.sx, ev.sy); if (a && a.type === 'text') openEditor(a); return; }
    if (E.pending && type === 'down') {
      const pd = E.pending, ang = view.uprightAngle(), w = pd.w, hh = pd.w * pd.ar;
      const { u, d } = L.annFrame({ a: ang });
      const a = { id: L.uid('a'), type: 'image', kind: pd.kind, src: pd.src, w, h: hh, a: ang, x: ev.pt[0] - u[0] * w / 2 - d[0] * hh / 2, y: ev.pt[1] - u[1] * w / 2 - d[1] * hh / 2 };
      L.mutate(pd.kind === 'signature' ? 'place signature' : 'place image', () => p.ann.push(a));
      E.pending = null; E.tool = 'select'; E.selId = a.id; L.setCursor(''); L.renderInspector(); L.drawOverlay();
      return;
    }
    const t = E.tool;
    if (type === 'down') {
      commitEditor();
      if (t === 'select') {
        const hd = handleAt(ev.sx, ev.sy);
        if (hd) { E.drag = { kind: 'resize', handle: hd, start: ev.pt, orig: JSON.parse(JSON.stringify(selAnn())), moved: false }; return; }
        const a = hitTest(ev.sx, ev.sy);
        E.selId = a ? a.id : null;
        if (a) E.drag = { kind: 'move', start: ev.pt, orig: JSON.parse(JSON.stringify(a)), moved: false };
        L.renderInspector(); L.drawOverlay(); return;
      }
      if (t === 'retype') { retypeAt(ev.sx, ev.sy); return; }
      if (t === 'text') {
        const st = E.style.text, ang = view.uprightAngle();
        const a = { id: L.uid('a'), type: 'text', x: ev.pt[0], y: ev.pt[1], a: ang, text: '', ...st };
        const { d } = L.annFrame(a); a.x -= d[0] * st.size * 0.6; a.y -= d[1] * st.size * 0.6; // centre the caret on the click
        L.mutate('add text', () => p.ann.push(a), { silent: true });
        openEditor(a); return;
      }
      if (t === 'pen') { E.draft = { type: 'ink', pts: [ev.pt], ...E.style.pen, id: L.uid('a') }; return; }
      E.draft = { type: t, start: ev.pt, cur: ev.pt, shift: ev.e.shiftKey };
      return;
    }
    if (type === 'move') {
      if (E.drag) {
        const a = selAnn(); if (!a) return;
        const dx = ev.pt[0] - E.drag.start[0], dy = ev.pt[1] - E.drag.start[1];
        if (!E.drag.moved) { if (Math.hypot(...view.vec([dx, dy])) < 2) return; L.checkpoint(E.drag.kind === 'move' ? 'move' : 'resize'); E.drag.moved = true; }
        const o = E.drag.orig;
        if (E.drag.kind === 'move') {
          if (o.r) a.r = { ...o.r, x: o.r.x + dx, y: o.r.y + dy };
          else if (o.pts) a.pts = o.pts.map(q => [q[0] + dx, q[1] + dy]);
          else if (o.p1) { a.p1 = [o.p1[0] + dx, o.p1[1] + dy]; a.p2 = [o.p2[0] + dx, o.p2[1] + dy]; }
          else { a.x = o.x + dx; a.y = o.y + dy; }
        } else if (o.p1) a[E.drag.handle] = ev.pt;
        else if (o.r) {
          const s0 = view.rectToScreen(o.r), q = view.toScreen(ev.pt);
          a.r = view.rectToPdf({ x: s0.x, y: s0.y, w: Math.max(4, q[0] - s0.x), h: Math.max(4, q[1] - s0.y) });
        } else if (o.type === 'image') {
          const P = view.toScreen([o.x, o.y]), q = view.toScreen(ev.pt), su = view.vec(L.annFrame(o).u), len = Math.hypot(...su);
          const proj = ((q[0] - P[0]) * su[0] + (q[1] - P[1]) * su[1]) / len / view.scale;
          a.w = Math.max(8, proj); a.h = a.w * o.h / o.w;
        }
        L.drawOverlay(); return;
      }
      if (E.draft) {
        if (E.draft.type === 'ink') { const last = E.draft.pts[E.draft.pts.length - 1]; if (Math.hypot(...view.vec([ev.pt[0] - last[0], ev.pt[1] - last[1]])) > 1.5) E.draft.pts.push(ev.pt); }
        else { E.draft.cur = ev.pt; E.draft.shift = ev.e.shiftKey; }
        L.drawOverlay();
      }
      return;
    }
    if (type === 'up') {
      if (E.drag) { const moved = E.drag.moved; E.drag = null; if (moved) { L.state.dirty = true; L.emit('change', { label: 'move' }); } return; }
      const d = E.draft; E.draft = null; if (!d) return;
      if (d.type === 'ink') { if (d.pts.length > 1) { d.pts = d.pts.map(q => [+q[0].toFixed(2), +q[1].toFixed(2)]); L.mutate('drawing', () => p.ann.push(d)); } else L.drawOverlay(); return; }
      const a = shapeFromDraft(d, view);
      if (!a) { L.drawOverlay(); return; }
      L.mutate(TOOLS.find(x => x.id === d.type).label.toLowerCase(), () => p.ann.push(a));
      if (['rect', 'ellipse', 'line', 'arrow'].includes(d.type)) { E.selId = a.id; L.renderInspector(); }
    }
  }
  function shapeFromDraft(d, view) {
    let p2 = d.cur;
    if ((d.type === 'line' || d.type === 'arrow') && d.shift) p2 = snap45(d.start, p2);
    const a0 = view.toScreen(d.start), b0 = view.toScreen(p2);
    if (Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) < 3) return null;
    const id = L.uid('a');
    if (d.type === 'line' || d.type === 'arrow') return { id, type: d.type, p1: d.start, p2, ...E.style.shape };
    let sr = { x: Math.min(a0[0], b0[0]), y: Math.min(a0[1], b0[1]), w: Math.abs(a0[0] - b0[0]), h: Math.abs(a0[1] - b0[1]) };
    if (d.type === 'ellipse' && d.shift) { const m = Math.max(sr.w, sr.h); sr = { x: a0[0] < b0[0] ? a0[0] : a0[0] - m, y: a0[1] < b0[1] ? a0[1] : a0[1] - m, w: m, h: m }; }
    const r = view.rectToPdf(sr);
    if (d.type === 'highlight') return { id, type: 'highlight', r, ...E.style.highlight };
    if (d.type === 'whiteout') return { id, type: 'whiteout', r, color: E.style.whiteout.match ? paperColor(sr) : E.style.whiteout.color };
    if (d.type === 'redact') return { id, type: 'redact', r };
    return { id, type: d.type, r, ...E.style.shape };
  }

  /* ——— Overlay ——— */
  function draw({ svg, view, page: p }) {
    const g = L.s('g', { 'pointer-events': 'none' });
    for (const a of p.ann) {
      if (E.editor && E.editor.id === a.id) continue;
      g.append(L.annToSvg(a, view));
      if (a.type === 'redact') { const b = view.rectToScreen(a.r); g.append(L.s('path', { d: `M${b.x},${b.y}L${b.x + b.w},${b.y + b.h}M${b.x + b.w},${b.y}L${b.x},${b.y + b.h}`, stroke: '#ff453a', 'stroke-width': 1, opacity: 0.7 })); }
    }
    svg.append(g);
    const d = E.draft;
    if (d) {
      if (d.type === 'ink') svg.append(L.annToSvg(d, view));
      else { const a = shapeFromDraft(d, view); if (a) { const el = L.annToSvg(a, view); el.setAttribute('opacity', '0.8'); svg.append(el); } }
    }
    const a = selAnn();
    if (a && !(E.editor && E.editor.id === a.id)) {
      const b = L.annScreenBox(a, view);
      svg.append(L.s('rect', { x: b.x - 3, y: b.y - 3, width: b.w + 6, height: b.h + 6, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.25, 'stroke-dasharray': '4 3', 'pointer-events': 'none', rx: 2 }));
      if (a.p1) for (const k of ['p1', 'p2']) { const q = view.toScreen(a[k]); svg.append(L.s('circle', { cx: q[0], cy: q[1], r: 5, fill: '#fff', stroke: 'var(--accent)', 'stroke-width': 1.5 })); }
      else if (resizable(a)) svg.append(L.s('circle', { cx: b.x + b.w, cy: b.y + b.h, r: 5.5, fill: '#fff', stroke: 'var(--accent)', 'stroke-width': 1.5 }));
    }
  }

  /* ——— Inspector ——— */
  function styleControls() {
    const a = selAnn(), key = a ? styleKey(a.type === 'ink' ? 'pen' : a.type) : styleKey(E.tool);
    if (a && (a.type === 'image' || a.type === 'redact')) return null;
    const st = E.style[key]; if (!st) return null;
    const set = (k, v) => {
      st[k] = v;
      const cur = selAnn();
      if (cur) { L.mutate('style', () => { if (k === 'match') return; cur[k] = v; }); if (E.editor && E.editor.id === cur.id) openEditor(cur); }
    };
    const kids = [];
    const val = k => (a && a[k] !== undefined ? a[k] : st[k]);
    if (key === 'whiteout') {
      kids.push(ui.check('Match paper colour automatically', st.match, v => { st.match = v; L.renderInspector(); }));
      if (!st.match) kids.push(h('div', { style: { marginTop: '10px' } }, L.swatches(val('color'), v => set('color', v), ['#ffffff', '#f6f1e7', '#eeeeee', '#1d1d1f'])));
    } else {
      kids.push(L.swatches(val('color'), v => set('color', v), key === 'highlight' ? ['#ffd60a', '#a5f3a1', '#7fd3ff', '#ffa8d9', '#ffb86b'] : L.COLORS));
    }
    if (key === 'text') {
      kids.push(h('div', { class: 'grid2', style: { marginTop: '12px' } },
        ui.field('Font', ui.select(Object.keys(L.FONTS), val('font'), v => set('font', v))),
        ui.field('Size', ui.num(val('size'), v => v > 0 && set('size', v), { min: 4, max: 200 }))),
        h('div', { style: { marginTop: '10px' } }, ui.check('Bold', val('bold'), v => set('bold', v))));
    }
    if (key === 'pen' || key === 'shape') kids.push(h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', null, 'Thickness'), h('input', { type: 'range', min: 0.5, max: 12, step: 0.5, value: val('width'), onchange: e => set('width', +e.target.value) })));
    if (key === 'highlight') kids.push(h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', null, 'Strength'), h('input', { type: 'range', min: 0.15, max: 0.8, step: 0.05, value: val('opacity'), onchange: e => set('opacity', +e.target.value) })));
    return ui.section(a ? 'Selected item' : 'Style', ...kids);
  }

  L.registerBlade({
    id: 'edit', label: 'Edit', icon: 'edit', color: '#ff9f0a', ownsAnnotations: true,
    desc: 'Fix text, add notes, highlight, white-out, redact, sign.',
    activate() { L.setCursor(cursorFor(E.tool)); L.pdfTextItems(L.page()); }, // warm the text cache so "Edit text" responds instantly
    deactivate() { commitEditor(); E.selId = null; E.pending = null; E.draft = null; },
    draw, pointer,
    key(e) {
      if (e.target.closest('input,textarea')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selAnn()) { const id = E.selId; L.mutate('delete', () => { const p = page(); p.ann = p.ann.filter(a => a.id !== id); }); E.selId = null; L.renderInspector(); return true; }
      if (e.key === 'Escape') { E.pending = null; E.draft = null; E.selId = null; setTool('select'); return true; }
      const map = { v: 'select', t: 'text', h: 'highlight', d: 'pen', w: 'whiteout' };
      if (!e.ctrlKey && !e.metaKey && map[e.key]) { setTool(map[e.key]); return true; }
    },
    inspector() {
      const tool = TOOLS.find(t => t.id === E.tool), a = selAnn();
      return [
        ui.head('edit', 'Edit', 'Make changes directly on the page.'),
        h('div', { class: 'section' }, h('div', { class: 'toolgrid' }, TOOLS.map(t => h('button', { class: 'tool' + (t.id === E.tool ? ' on' : ''), title: t.label, onclick: () => setTool(t.id) }, L.icon(t.icon), t.label)))),
        h('div', { class: 'section' }, ui.callout(tool.hint, E.tool === 'redact' ? 'warn' : '', E.tool === 'redact' ? 'warn' : 'info')),
        styleControls(),
        a ? ui.section(null, h('div', { class: 'grid2' },
          ui.btn('Duplicate', 'duplicate', () => { const c = { ...JSON.parse(JSON.stringify(a)), id: L.uid('a') }; const off = 10; if (c.r) { c.r.x += off; c.r.y -= off; } else if (c.pts) c.pts = c.pts.map(q => [q[0] + off, q[1] - off]); else if (c.p1) { c.p1 = [c.p1[0] + off, c.p1[1] - off]; c.p2 = [c.p2[0] + off, c.p2[1] - off]; } else { c.x += off; c.y -= off; } L.mutate('duplicate', () => page().ann.push(c)); E.selId = c.id; L.renderInspector(); }),
          ui.btn('Delete', 'trash', () => { const id = a.id; L.mutate('delete', () => { const p = page(); p.ann = p.ann.filter(x => x.id !== id); }); E.selId = null; L.renderInspector(); }, 'danger'))) : null,
        page().ann.length ? ui.section('On this page', h('p', { class: 'muted', style: { margin: 0 } }, `${page().ann.length} edit${page().ann.length > 1 ? 's' : ''}. `),
          h('button', { class: 'btn ghost', style: { marginTop: '6px', paddingLeft: 0 }, onclick: async () => { if (await L.confirm('Remove all edits on this page?', 'You can undo this.', 'Remove', true)) { L.mutate('clear edits', () => { page().ann = []; }); E.selId = null; L.renderInspector(); } } }, 'Remove all edits on this page')) : null,
      ];
    },
  });
  // Forms › Fill in: sign into a signature field — the signature is fitted inside the field's box
  L.signInto = (page, r) => openSignature(({ src, ar }) => {
    const fit = Math.min(r.w / 1, r.h / ar), w = Math.min(r.w, fit), hh = w * ar;
    const a = { id: L.uid('a'), type: 'image', kind: 'signature', src, w, h: hh, a: 0, x: r.x + (r.w - w) / 2, y: r.y + r.h - (r.h - hh) / 2 };
    L.mutate('sign', () => page.ann.push(a));
  });
  L.on('page', () => { commitEditor(); E.selId = null; if (L.state.blade === 'edit') { L.pdfTextItems(L.page()); L.renderInspector(); } });
})();
