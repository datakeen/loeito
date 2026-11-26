/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Rulers and guides, as in design apps: turn rulers on and off (Ctrl Alt R, the View menu or Ctrl K),
   drag a guide out of a ruler, move it, drag it back onto the ruler to remove it. Measured from the page's top-left corner. */
(() => {
  const L = window.Loeito, h = L.h;
  const SIZE = 20;
  const UNITS = { mm: { per: 72 / 25.4, label: 'Millimeters' }, cm: { per: 72 / 2.54, label: 'Centimeters' }, in: { per: 72, label: 'Inches' }, pt: { per: 1, label: 'Points' } };
  const R = (L.rulers = { on: () => L.pref('rulers', false), unit: () => (UNITS[L.pref('rulerUnit', 'mm')] ? L.pref('rulerUnit', 'mm') : 'mm') });
  let top, left, corner, layer, mouse = null;
  const guides = () => (L.state.guides ||= { v: [], h: [] }); // page points from the page's top-left corner; kept with the document, not written into the PDF

  function build() {
    const wrap = L.$('#stage-wrap');
    top = h('canvas', { class: 'ruler ruler-top', title: 'Drag down to make a guide · right-click for units' });
    left = h('canvas', { class: 'ruler ruler-left', title: 'Drag right to make a guide · right-click for units' });
    corner = h('button', { class: 'ruler-corner', title: 'Ruler units', 'aria-label': 'Ruler units', onclick: e => unitMenu(e.currentTarget) }, R.unit());
    layer = h('div', { class: 'guide-layer' });
    wrap.append(layer, top, left, corner);
    top.addEventListener('pointerdown', e => startDrag(e, 'h'));
    left.addEventListener('pointerdown', e => startDrag(e, 'v'));
    for (const c of [top, left]) c.addEventListener('contextmenu', e => { e.preventDefault(); unitMenu(corner); });
    for (const sc of [L.$('#stage'), L.$('#reader')]) {
      sc.addEventListener('scroll', () => R.draw(), { passive: true });
      sc.addEventListener('pointermove', e => { mouse = [e.clientX, e.clientY]; if (R.on()) R.draw(); }, { passive: true });
    }
    new ResizeObserver(() => R.draw()).observe(wrap);
  }
  function unitMenu(at) {
    L.menu(at, [...Object.entries(UNITS).map(([k, u]) => ({ label: (R.unit() === k ? '✓ ' : '') + u.label, fn: () => { L.setPref('rulerUnit', k); corner.textContent = k; R.draw(); } })),
      'sep', { label: 'Clear all guides', icon: 'close', fn: () => R.clearGuides() }, { label: 'Hide rulers', kbd: 'Ctrl Alt R', fn: () => R.toggle(false) }]);
  }

  // Page geometry on screen: where the page's top-left is, and screen pixels per page point.
  // In continuous reading it is the page under the pointer, or the one nearest the middle.
  function geo() {
    if (!L.hasDoc()) return null;
    let el = null, view = null;
    if (L.readerActive && L.readerActive()) {
      const pages = L.$$('#reader-pages .rpage').filter(p => p._view), mid = mouse ? mouse[1] : innerHeight / 2;
      const dist = p => { const r = p.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid)); };
      el = pages.sort((a, b) => dist(a) - dist(b))[0]; view = el && el._view;
    } else { el = L.$('#sheet'); view = L.viewer && L.viewer.view; if (el.offsetParent === null) el = null; }
    if (!el || !view) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, k: r.width / (view.width / view.scale), w: r.width, hgt: r.height };
  }

  function drawRuler(c, horiz, g) {
    const dpr = devicePixelRatio || 1, rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr);
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    x.fillStyle = css.getPropertyValue('--surface').trim() || '#fff'; x.fillRect(0, 0, rect.width, rect.height);
    x.strokeStyle = css.getPropertyValue('--sep-strong').trim() || '#ccc'; x.fillStyle = css.getPropertyValue('--text-2').trim() || '#666';
    x.font = '9.5px system-ui, sans-serif'; x.lineWidth = 1;
    if (!g) return;
    const u = UNITS[R.unit()], pxPerUnit = g.k * u.per, origin = horiz ? g.x - rect.left : g.y - rect.top, len = horiz ? rect.width : rect.height;
    // pick a tick step that leaves about 50 px between labels
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
    const major = steps.find(s => s * pxPerUnit >= 50) || 1000, minor = major / (String(major).startsWith('25') ? 5 : major >= 1 && String(major)[0] === '2' ? 4 : 10);
    // the page itself is shown a little lighter on the ruler
    x.save(); x.fillStyle = css.getPropertyValue('--surface-2').trim() || '#f3f3f3';
    if (horiz) x.fillRect(origin, 0, g.w, rect.height); else x.fillRect(0, origin, rect.width, g.hgt); x.restore();
    const from = Math.floor(-origin / pxPerUnit / minor) * minor, to = (len - origin) / pxPerUnit;
    x.beginPath();
    for (let v = from; v <= to; v += minor) {
      const p = Math.round(origin + v * pxPerUnit) + 0.5, isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
      const tick = isMajor ? SIZE : Math.abs(v / (major / 2) - Math.round(v / (major / 2))) < 1e-6 ? SIZE * 0.45 : SIZE * 0.25;
      if (horiz) { x.moveTo(p, SIZE); x.lineTo(p, SIZE - tick); } else { x.moveTo(SIZE, p); x.lineTo(SIZE - tick, p); }
      if (isMajor) {
        const t = String(+v.toFixed(2));
        if (horiz) x.fillText(t, p + 3, 9);
        else { x.save(); x.translate(9, p + 3); x.rotate(-Math.PI / 2); x.textAlign = 'right'; x.fillText(t, 0, 0); x.restore(); }
      }
    }
    x.stroke();
    if (mouse) { // where the pointer is
      x.strokeStyle = css.getPropertyValue('--accent').trim() || '#0a84ff'; x.beginPath();
      const p = Math.round((horiz ? mouse[0] - rect.left : mouse[1] - rect.top)) + 0.5;
      if (horiz) { x.moveTo(p, 0); x.lineTo(p, SIZE); } else { x.moveTo(0, p); x.lineTo(SIZE, p); }
      x.stroke();
    }
  }
  function drawRulers() { const g = geo(); drawRuler(top, true, g); drawRuler(left, false, g); }

  function drawGuides() {
    const g = geo(); layer.replaceChildren();
    if (!g || !R.on() && !guides().v.length && !guides().h.length) return;
    const box = layer.getBoundingClientRect();
    const line = (axis, i, val) => {
      const el = h('div', { class: 'guide guide-' + axis, title: 'Drag to move · drag onto the ruler to remove · double-click to remove' });
      if (axis === 'v') el.style.left = (g.x - box.left + val * g.k) + 'px'; else el.style.top = (g.y - box.top + val * g.k) + 'px';
      el.addEventListener('pointerdown', e => startDrag(e, axis, i));
      el.addEventListener('dblclick', () => { guides()[axis].splice(i, 1); R.draw(); });
      layer.append(el);
    };
    guides().v.forEach((v, i) => line('v', i, v)); guides().h.forEach((v, i) => line('h', i, v));
  }

  // Drag out of a ruler (new guide) or drag an existing guide. Dropping it back on the ruler removes it.
  function startDrag(e, axis, index = -1) {
    if (e.button !== 0 || !geo()) return;
    e.preventDefault(); e.stopPropagation();
    const ghost = h('div', { class: 'guide guide-' + axis + ' dragging' }), tip = h('div', { class: 'guide-tip' });
    layer.append(ghost, tip);
    const box = layer.getBoundingClientRect();
    let val = null;
    const move = ev => {
      const g = geo(); if (!g) return;
      const raw = axis === 'v' ? (ev.clientX - g.x) / g.k : (ev.clientY - g.y) / g.k;
      val = ev.shiftKey ? Math.round(raw / UNITS[R.unit()].per) * UNITS[R.unit()].per : raw; // Shift snaps to whole units
      const overRuler = axis === 'v' ? ev.clientX - box.left < SIZE : ev.clientY - box.top < SIZE;
      ghost.classList.toggle('remove', overRuler);
      if (axis === 'v') ghost.style.left = (g.x - box.left + val * g.k) + 'px'; else ghost.style.top = (g.y - box.top + val * g.k) + 'px';
      tip.textContent = overRuler ? 'Release to remove' : `${+(val / UNITS[R.unit()].per).toFixed(R.unit() === 'pt' ? 0 : 1)} ${R.unit()}`;
      tip.style.left = (ev.clientX - box.left + 12) + 'px'; tip.style.top = (ev.clientY - box.top + 12) + 'px';
      if (index >= 0) layer.querySelectorAll('.guide:not(.dragging)')[axis === 'v' ? index : guides().v.length + index]?.classList.add('hidden');
    };
    const up = ev => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      const overRuler = ghost.classList.contains('remove');
      ghost.remove(); tip.remove();
      if (val == null && index < 0) return R.draw();
      {
        const list = guides()[axis];
        if (index >= 0) { if (overRuler) list.splice(index, 1); else if (val != null) list[index] = val; }
        else if (!overRuler) list.push(val);
      }
      R.draw();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
    move(e);
  }

  R.draw = () => {
    if (!top) return;
    const on = R.on();
    L.$('#stage-wrap').classList.toggle('rulers-on', on);
    if (on) drawRulers();
    drawGuides();
  };
  R.toggle = (want = !R.on()) => {
    L.setPref('rulers', want); R.draw();
    L.toast(want ? 'Rulers on. Drag from a ruler to make a guide.' : 'Rulers off', { icon: 'crop', ms: 2400 });
    setTimeout(R.draw, 60); // the page moves a little when the rulers take their space
  };
  R.clearGuides = () => { if (!guides().v.length && !guides().h.length) return; L.state.guides = { v: [], h: [] }; R.draw(); };

  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'r') { e.preventDefault(); R.toggle(); }
  });
  window.addEventListener('load', () => {
    build();
    const draw0 = L.drawOverlay;
    L.drawOverlay = (...a) => { const r = draw0(...a); R.draw(); return r; };
    L.on && L.on('docs', () => R.draw());
    R.draw();
  });
})();
