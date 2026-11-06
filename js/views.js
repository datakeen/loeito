// Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE)
/* Ways to look at the page in every tool: full window, full screen, scrolling on into the next page, and snapshots. */
(() => {
  const L = window.Loeito, h = L.h;

  /* ——— Full window: hide the page list and the document tabs, keep the tool panel ——— */
  L.toggleFullWindow = on => {
    on = on ?? !document.body.classList.contains('full-window');
    document.body.classList.toggle('full-window', on);
    L.toast(on ? 'Full window — press Ctrl Shift F or Esc to come back' : 'Normal window', { icon: 'focus', ms: 2200 });
    setTimeout(() => L.render && L.render(), 60); // fit-page / fit-width use the new space
  };
  /* ——— Full screen: the whole monitor ——— */
  L.toggleFullScreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setTimeout(() => L.render && L.render(), 200);
    } catch { L.toast('Full screen is not allowed here', { kind: 'err' }); }
  };

  /* ——— Scroll on into the next page: in every tool, the mouse wheel continues past the end of a page ——— */
  let flipAt = 0, push = 0;
  const flow = () => L.pref('pageFlow', true);
  function wheel(e) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || !flow() || !L.hasDoc() || (L.readerActive && L.readerActive())) return;
    const st = L.$('#stage'), s = L.state, dy = e.deltaY;
    if (!dy || !s.pages || s.pages.length < 2) return;
    const atEnd = st.scrollTop + st.clientHeight >= st.scrollHeight - 2, atTop = st.scrollTop <= 1;
    const dir = dy > 0 && atEnd ? 1 : dy < 0 && atTop ? -1 : 0;
    if (!dir) { push = 0; return; }
    const next = s.cur + dir;
    if (next < 0 || next >= s.pages.length) return;
    push += Math.abs(dy); // a small extra push at the edge, so a page never flips by accident
    if (push < 120 || Date.now() - flipAt < 450) return;
    push = 0; flipAt = Date.now();
    L.go(next);
    setTimeout(() => { st.scrollTop = dir > 0 ? 0 : st.scrollHeight; }, 80);
  }

  /* ——— Snapshot: drag a box on the page (or click for the whole page) → copy or save as a picture ——— */
  L.startSnapshot = () => {
    if (!L.hasDoc() || !L.page()) return L.toast('Open a document first', { icon: 'info' });
    if (L.readerActive && L.readerActive()) L.setBlade('pages'), L.setBlade('view');
    const sheet = L.$('#sheet'); if (!sheet) return;
    L.$('.snap-layer')?.remove();
    const layer = h('div', { class: 'snap-layer', title: 'Drag a box — or click for the whole page. Esc cancels.' });
    const box = h('div', { class: 'snap-box' }); layer.append(box);
    sheet.append(layer);
    L.toast('Snapshot: drag a box on the page, or click for the whole page', { icon: 'camera', ms: 3500 });
    let p0 = null;
    const pt = e => { const r = layer.getBoundingClientRect(); return [L.clamp(e.clientX - r.left, 0, r.width), L.clamp(e.clientY - r.top, 0, r.height)]; };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); done(); } };
    const done = () => { layer.remove(); document.removeEventListener('keydown', esc, true); };
    document.addEventListener('keydown', esc, true);
    layer.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { layer.setPointerCapture(e.pointerId); } catch {} p0 = pt(e); Object.assign(box.style, { left: p0[0] + 'px', top: p0[1] + 'px', width: 0, height: 0, display: 'block' }); });
    layer.addEventListener('pointermove', e => { if (!p0) return; const p = pt(e); Object.assign(box.style, { left: Math.min(p0[0], p[0]) + 'px', top: Math.min(p0[1], p[1]) + 'px', width: Math.abs(p[0] - p0[0]) + 'px', height: Math.abs(p[1] - p0[1]) + 'px' }); });
    layer.addEventListener('pointerup', async e => {
      if (!p0) return;
      const p = pt(e), W = layer.clientWidth, H = layer.clientHeight;
      let r = { x: Math.min(p0[0], p[0]) / W, y: Math.min(p0[1], p[1]) / H, w: Math.abs(p[0] - p0[0]) / W, h: Math.abs(p[1] - p0[1]) / H };
      if (r.w * W < 6 || r.h * H < 6) r = { x: 0, y: 0, w: 1, h: 1 }; // a click: the whole page
      p0 = null; done();
      await capture(r);
    });
  };
  async function capture(r) {
    const page = L.page(), b = L.blade(), full = !!(b && b.fullPage && b.fullPage(page));
    const t = L.toast('Taking the snapshot…', { icon: 'camera', ms: 60000 });
    try {
      const big = document.createElement('canvas');
      const proxy = await L.proxy(page), base = L.makeView(proxy, page, 1, { full });
      const scale = Math.min(4, 3000 / Math.max(base.width, base.height)) ; // sharp: about 3000 px on the long side
      await L.renderInto(big, page, scale, { full, dpr: 1, intent: 'print' });
      const cut = document.createElement('canvas');
      cut.width = Math.max(1, Math.round(r.w * big.width)); cut.height = Math.max(1, Math.round(r.h * big.height));
      cut.getContext('2d').drawImage(big, Math.round(r.x * big.width), Math.round(r.y * big.height), cut.width, cut.height, 0, 0, cut.width, cut.height);
      const blob = await new Promise(res => cut.toBlob(res, 'image/png'));
      t && t.remove && t.remove();
      show(blob, cut);
    } catch (err) { t && t.remove && t.remove(); L.toast('Could not take the snapshot: ' + (err.message || err), { kind: 'err' }); }
  }
  function show(blob, cut) {
    const url = URL.createObjectURL(blob);
    const name = `${(L.state.name || 'page').replace(/\.pdf$/i, '')} – page ${L.state.cur + 1}.png`;
    const close = () => { back.remove(); URL.revokeObjectURL(url); };
    const copy = async () => {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); L.toast('Picture copied — paste it anywhere (Ctrl V)', { kind: 'ok' }); close(); }
      catch { L.toast('Copying pictures is not allowed here — use Save as PNG', { kind: 'err' }); }
    };
    const back = h('div', { class: 'snap-back', onmousedown: e => { if (e.target === back) close(); } },
      h('div', { class: 'snap-sheet', role: 'dialog', 'aria-label': 'Snapshot' },
        h('div', { class: 'snap-head' }, L.icon('camera', 18), h('b', null, 'Snapshot'), h('span', { class: 'muted tiny' }, `${cut.width} × ${cut.height} px`)),
        h('div', { class: 'snap-img' }, h('img', { src: url, alt: 'Snapshot' })),
        h('div', { class: 'snap-actions' },
          h('button', { class: 'btn', onclick: close }, 'Close'),
          h('button', { class: 'btn', onclick: () => { L.download(blob, name, 'image/png'); close(); } }, L.icon('save', 15), ' Save as PNG'),
          h('button', { class: 'btn primary', onclick: copy }, L.icon('copy', 15), ' Copy'))));
    document.body.append(back);
    back.querySelector('.btn.primary').focus();
    back.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  /* ——— the View part of the zoom menu ——— */
  L.viewMenuItems = closeMenu => {
    const item = (t, k, fn) => h('button', { onclick: () => { closeMenu(); fn(); } }, h('span', null, t), k ? h('kbd', null, k) : null);
    const flowBtn = h('button', { onclick: e => { e.stopPropagation(); L.setPref('pageFlow', !flow()); flowBtn.firstChild.textContent = (flow() ? '✓ ' : '   ') + 'Scroll on to the next page'; } },
      h('span', null, (flow() ? '✓ ' : '   ') + 'Scroll on to the next page'));
    return [h('hr'),
      item('Full window', 'Ctrl Shift F', () => L.toggleFullWindow()),
      item('Full screen', 'F11', () => L.toggleFullScreen()),
      item('Continuous reading', '', () => { L.setBlade('view'); L.readerShow && L.readerShow(true); }),
      flowBtn,
      item('Snapshot…', 'Ctrl Shift C', () => L.startSnapshot())];
  };

  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && e.shiftKey && k === 'f') { e.preventDefault(); L.toggleFullWindow(); }
    else if (mod && e.shiftKey && k === 'c') { e.preventDefault(); L.startSnapshot(); }
    else if (e.key === 'F11') { e.preventDefault(); L.toggleFullScreen(); }
    else if (e.key === 'Escape' && document.body.classList.contains('full-window') && !document.querySelector('.palette, .snap-back, .sheet-back, .modal')) L.toggleFullWindow(false);
  });
  window.addEventListener('load', () => { const st = L.$('#stage'); st && st.addEventListener('wheel', wheel, { passive: true }); });
})();
