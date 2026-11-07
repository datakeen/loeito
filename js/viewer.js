/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito viewer: blade registry, stage rendering + overlay, pointer routing, loupe, page sidebar, search. */
(() => {
  const L = window.Loeito, h = L.h;

  /* ——— Blades (tools) ——— */
  L.blades = [];
  L.registerBlade = b => { L.blades.push(b); };
  L.blade = () => L.blades.find(b => b.id === L.state.blade);
  L.setBlade = id => {
    if (!L.hasDoc() && id !== 'view') return;
    const prev = L.blade();
    if (prev && prev.id === id) { L.renderInspector(); return; }
    prev?.deactivate?.();
    L.state.blade = id;
    L.blade()?.activate?.();
    L.emit('blade', id);
  };
  L.renderInspector = () => {
    const insp = L.$('#inspector');
    const b = L.blade();
    const st = insp.scrollTop;
    insp.replaceChildren();
    if (b && L.hasDoc()) insp.append(...[].concat(b.inspector()).flat(Infinity).filter(Boolean));
    insp.scrollTop = st;
  };

  /* ——— Stage ——— */
  const V = (L.viewer = { zoom: 'fit-page', view: null, renderToken: 0, task: null, hits: null, liveRatio: 1 });
  const stage = () => L.$('#stage');
  const fitScale = base => {
    const s = stage(); const aw = Math.max(200, s.clientWidth - 64), ah = Math.max(200, s.clientHeight - 120);
    if (V.zoom === 'fit-width') return Math.min(aw / base.width, 4);
    if (V.zoom === 'fit-page') return Math.min(aw / base.width, ah / base.height);
    return V.zoom;
  };
  L.render = async () => {
    const page = L.page();
    if (!page || (L.readerActive && L.readerActive())) return; // the reader draws its own pages
    const token = ++V.renderToken;
    try {
      const proxy = await L.proxy(page);
      const b = L.blade();
      const full = !!(b && b.fullPage && b.fullPage(page));
      const base = L.makeView(proxy, page, 1, { full });
      const scale = fitScale(base);
      if (V.task) { try { V.task.cancel(); } catch {} }
      const off = document.createElement('canvas');
      const view = await L.renderInto(off, page, scale, { full, annotations: false, readback: true, intent: 'display', onTask: t => (V.task = t) });
      if (token !== V.renderToken) return;
      const old = L.$('#page-canvas');
      off.id = 'page-canvas';
      off.style.width = view.width + 'px'; off.style.height = view.height + 'px';
      old.replaceWith(off);
      if (V.page !== page) off.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' }); // a new page fades in
      L.spinIn(L.$('#sheet'), page.id);
      const sheet = L.$('#sheet');
      sheet.style.width = view.width + 'px'; sheet.style.height = view.height + 'px';
      V.view = view; V.page = page; V.proxy = proxy; V.liveRatio = 1;
      if (V.restoreScroll) { const st = L.$('#stage'); st.scrollTop = V.restoreScroll.top; st.scrollLeft = V.restoreScroll.left; V.restoreScroll = null; }
      sheet.classList.remove('zooming');
      L.drawOverlay();
      L.$('#zoom-label').textContent = Math.round(scale * 100) + '%';
      // selectable text (PDF text and OCR words) between the page image and the tool overlay
      L.buildTextLayer(page, view).then(tl => {
        if (token !== V.renderToken) return;
        tl.id = 'text-layer';
        const old = L.$('#text-layer'); old ? old.replaceWith(tl) : L.$('#overlay').before(tl);
      });
    } catch (e) {
      if (e && e.name === 'RenderingCancelledException') return;
      console.error(e);
    }
  };
  L.drawOverlay = () => {
    const svg = L.$('#overlay'), page = L.page(), view = V.view;
    if (!view || !page || V.page !== page) { if (page && V.page !== page) L.render(); return; }
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${view.width} ${view.height}`);
    const b = L.blade();
    if (!(b && b.ownsAnnotations)) { const g = L.s('g', { 'pointer-events': 'none' }); page.ann.forEach(a => g.append(L.annToSvg(a, view))); svg.append(g); }
    if (!(b && b.ownsFields) && page.fields && page.fields.length && L.forms) { const g = L.s('g', { 'pointer-events': 'none' }); page.fields.forEach(f => g.append(L.forms.toSvg(f, view))); svg.append(g); }
    if (!(b && b.ownsFields)) L.$('#html-layer').querySelectorAll('.ff-input,.ff-check,.ff-sign,.ff-button').forEach(e => e.remove());
    svg.append(L.stampsToSvg(page, view));
    if (V.hits && V.hits.pageId === page.id) {
      const g = L.s('g', { 'pointer-events': 'none' });
      V.hits.words.forEach(w => { const r = L.wordBox(w, view); g.append(L.s('rect', { x: r.x - 2, y: r.y - 1, width: r.w + 4, height: r.h + 2, rx: 3, fill: '#ffd60a', 'fill-opacity': 0.45, style: 'mix-blend-mode:multiply' })); });
      svg.append(g);
    }
    b && b.draw && b.draw({ svg, html: L.$('#html-layer'), view, page });
  };
  L.go = i => {
    const s = L.state; if (!s.pages.length) return;
    i = L.clamp(i, 0, s.pages.length - 1);
    if (i === s.cur && V.page === s.pages[i]) return;
    s.cur = i;
    const target = s.pages[i];
    L.proxy(target).then(() => { if (L.page() === target) L.emit('page', i); });
  };
  L.setZoom = z => { V.zoom = z; L.render(); };

  /* ——— Calm zoom ———
     Wheel / pinch zoom is proportional to the gesture (small trackpad deltas → small steps) and anchored
     under the cursor. The page is stretched instantly for feedback, then re-rendered sharp once you pause. */
  const LADDER = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 8];
  L.ladderStep = (cur, dir) => dir > 0 ? (LADDER.find(z => z > cur * 1.02) ?? 8) : ([...LADDER].reverse().find(z => z < cur / 1.02) ?? 0.25);
  /* Zoom speed: Auto is brisk for reading and fine inside precision tools (blades marked `precise`);
     Shift always zooms finely. Per wheel notch: Fine ≈ 4 %, Normal ≈ 20 %, Fast ≈ 40 %. */
  const SPEED = { fine: { k: 0.0004, max: 1.06, label: 'Fine' }, normal: { k: 0.0018, max: 1.3, label: 'Normal' }, fast: { k: 0.0036, max: 1.5, label: 'Fast' } };
  L.zoomSpeed = e => {
    if (e && e.shiftKey) return 'fine';
    const s = L.pref('zoomSpeed', 'auto');
    return SPEED[s] ? s : L.blade()?.precise ? 'fine' : 'normal';
  };
  L.wheelFactor = e => {
    const raw = e.deltaY || e.deltaX; // Shift turns the wheel sideways in Chromium
    const d = e.deltaMode === 1 ? raw * 16 : e.deltaMode === 2 ? raw * 400 : raw;
    const sp = SPEED[L.zoomSpeed(e)];
    return L.clamp(Math.exp(-d * sp.k), 1 / sp.max, sp.max);
  };
  let hudT = 0;
  L.zoomHud = (scale, e) => {
    let el = L.$('#zoom-hud');
    if (!el) { el = h('div', { id: 'zoom-hud', class: 'zoom-hud', 'aria-live': 'polite' }); L.$('#stage-wrap').append(el); }
    const sp = e && e.type === 'wheel' ? SPEED[L.zoomSpeed(e)].label + (e.shiftKey ? ' · Shift' : '') : '';
    el.replaceChildren(...[h('b', null, Math.round(scale * 100) + '%'), sp && h('span', null, sp)].filter(Boolean));
    el.classList.add('on'); clearTimeout(hudT); hudT = setTimeout(() => el.classList.remove('on'), 900);
  };
  L.currentScale = () => (V.view ? V.view.scale * (V.liveRatio || 1) : 1);
  L.zoomTo = (scale, anchor) => {
    scale = L.clamp(+scale, 0.1, 8);
    L.zoomHud(scale, anchor);
    if (L.readerZoom && L.readerActive && L.readerActive()) return L.readerZoom(scale, anchor);
    if (!V.view) { V.zoom = scale; return L.render(); }
    L.$('#sheet').classList.add('zooming');
    const st = stage(), sheet = L.$('#sheet'), sr = st.getBoundingClientRect(), r0 = sheet.getBoundingClientRect();
    const ax = anchor ? anchor.clientX : sr.left + st.clientWidth / 2, ay = anchor ? anchor.clientY : sr.top + st.clientHeight / 2;
    const fx = (ax - r0.left) / r0.width, fy = (ay - r0.top) / r0.height;
    V.zoom = scale; V.liveRatio = scale / V.view.scale;
    const w = V.view.width * V.liveRatio, hh = V.view.height * V.liveRatio;
    sheet.style.width = w + 'px'; sheet.style.height = hh + 'px';
    const c = L.$('#page-canvas'); c.style.width = w + 'px'; c.style.height = hh + 'px';
    const r1 = sheet.getBoundingClientRect();
    st.scrollLeft += r1.left + fx * r1.width - ax; st.scrollTop += r1.top + fy * r1.height - ay;
    L.$('#zoom-label').textContent = Math.round(scale * 100) + '%';
    clearTimeout(V.zoomTimer); V.zoomTimer = setTimeout(() => { L.render(); }, 170);
  };
  L.zoomBy = f => L.zoomTo(L.currentScale() * f);
  L.zoomStep = dir => L.zoomTo(L.ladderStep(L.currentScale(), dir));
  function zoomMenu() {
    const old = L.$('.zoom-menu'); if (old) { old.remove(); return; }
    const pick = z => { menu.remove(); typeof z === 'string' ? (L.readerActive && L.readerActive() ? L.readerFit(z) : L.setZoom(z)) : L.zoomTo(z); };
    const speed = L.pref('zoomSpeed', 'auto');
    const seg = h('div', { class: 'zm-seg', role: 'radiogroup', 'aria-label': 'Zoom speed' }, [
      ['auto', 'Auto', 'Brisk for reading, fine in Digitize and Crop'], ['fine', 'Fine', 'Small steps for precise work'],
      ['normal', 'Normal', 'Comfortable steps for reading'], ['fast', 'Fast', 'Big steps']].map(([v, t, tip]) =>
      h('button', { class: v === speed ? 'on' : '', title: tip, role: 'radio', 'aria-checked': String(v === speed), onclick: e => {
        e.stopPropagation(); L.setPref('zoomSpeed', v);
        L.$$('button', seg).forEach(b => { const on = b === e.currentTarget; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
      } }, t)));
    const menu = h('div', { class: 'zoom-menu', role: 'menu' },
      [['Fit width', 'fit-width'], ['Fit page', 'fit-page'], ['Actual size', 1]].map(([t, z]) => h('button', { onclick: () => pick(z) }, t)),
      h('hr'),
      [0.5, 0.75, 1.25, 1.5, 2, 3, 4].map(z => h('button', { onclick: () => pick(z) }, Math.round(z * 100) + '%')),
      L.viewMenuItems ? L.viewMenuItems(() => menu.remove()) : null,
      h('hr'),
      h('div', { class: 'zm-speed' }, h('span', null, 'Zoom speed'), seg, h('p', null, 'Hold Shift while zooming for fine control.')));
    L.$('#stage-wrap').append(menu);
    setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', off, true); } }, true));
  }
  L.zoomMenu = zoomMenu;

  /* ——— Pointer tools ———
     Select: the active tool acts; over text the I-beam selects it; empty paper drags like a hand.
     Text: select text anywhere, even inside tools. Hand: always moves the page (open hand, closed while dragging).
     Space = temporary hand; dragging the gray backdrop always moves the page. */
  V.tool = 'select'; V.hand = false; V.space = false;
  const wrap = () => L.$('#stage-wrap');
  const paintPan = () => wrap().classList.toggle('pan-ready', V.hand || V.space);
  L.setTool = t => {
    V.tool = t; V.hand = t === 'hand';
    L.$$('#hud-tools button').forEach(b => { const on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    for (const m of ['select', 'text', 'hand']) wrap().classList.toggle('pm-' + m, m === t);
    if (t !== 'select') hideSelBar();
    paintPan();
  };
  L.setHand = on => L.setTool(on ? 'hand' : 'select');
  L.setSpacePan = on => { V.space = on; paintPan(); };
  // Should a primary-button drag move the page? (`bladeActs`: the active tool handles the pointer itself)
  L.wantsPan = (e, bladeActs) => (e.target.closest('#grid-view') && !V.hand && !V.space) ? false // the page grid handles its own presses
    : V.hand || V.space || !e.target.closest('.sheet, .rpage')
    || (V.tool === 'select' && !bladeActs && !e.target.closest('.textLayer span, .html-layer > *'));
  L.wirePan = (scroller, wantsPan) => {
    let pan = null;
    scroller.addEventListener('pointerdown', e => {
      if (!(e.button === 1 || (e.button === 0 && wantsPan(e)))) return;
      e.preventDefault(); e.stopPropagation();
      pan = { x: e.clientX, y: e.clientY, l: scroller.scrollLeft, t: scroller.scrollTop, id: e.pointerId };
      try { scroller.setPointerCapture(e.pointerId); } catch {}
      scroller.classList.add('panning');
    }, true);
    scroller.addEventListener('pointermove', e => { if (!pan) return; scroller.scrollLeft = pan.l - (e.clientX - pan.x); scroller.scrollTop = pan.t - (e.clientY - pan.y); }, true);
    const end = () => { if (!pan) return; pan = null; scroller.classList.remove('panning'); };
    scroller.addEventListener('pointerup', end, true); scroller.addEventListener('pointercancel', end, true);
  };

  /* ——— Pointer routing ——— */
  function stagePoint(e) {
    const r = L.$('#sheet').getBoundingClientRect(), k = V.view ? V.view.width / r.width : 1; // stays exact during a live zoom
    const sx = (e.clientX - r.left) * k, sy = (e.clientY - r.top) * k;
    return { sx, sy, pt: V.view ? V.view.toPdf([sx, sy]) : [0, 0], e, view: V.view, page: L.page() };
  }
  function initPointer() {
    const svg = L.$('#overlay'); let down = false;
    svg.addEventListener('pointerdown', e => {
      if (e.button === 1) return;
      const b = L.blade(); if (!b || !b.pointer || !V.view) return;
      down = true; svg.setPointerCapture(e.pointerId);
      b.pointer('down', stagePoint(e));
    });
    svg.addEventListener('pointermove', e => { const b = L.blade(); if (b && b.pointer && V.view) b.pointer(down ? 'move' : 'hover', stagePoint(e)); });
    const up = e => { if (!down) return; down = false; const b = L.blade(); if (b && b.pointer && V.view) b.pointer('up', stagePoint(e)); };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('pointerleave', () => { const b = L.blade(); b && b.pointer && b.pointer('leave', {}); L.loupe(false); });
    svg.addEventListener('dblclick', e => { const b = L.blade(); b && b.pointer && V.view && b.pointer('dbl', stagePoint(e)); });
    svg.addEventListener('contextmenu', e => { const b = L.blade(); if (b && b.pointer && V.view && b.pointer('context', stagePoint(e)) === true) e.preventDefault(); });
    L.$('#stage').addEventListener('wheel', e => {
      if (!(e.ctrlKey || e.metaKey) || !L.hasDoc()) return;
      e.preventDefault(); L.zoomTo(L.currentScale() * L.wheelFactor(e), e);
    }, { passive: false });
    L.wirePan(stage(), e => { const b = L.blade(); return L.wantsPan(e, !!(b && b.pointer) && V.tool === 'select'); });
  }
  L.setCursor = c => { const s = stage(); [...s.classList].filter(k => k.startsWith('tool-')).forEach(k => s.classList.remove(k)); if (c) s.classList.add('tool-' + c); };

  // Precision loupe: magnifies the rendered page under the cursor.
  L.loupe = (on, e, sx, sy) => {
    const lc = L.$('#loupe');
    if (!on || !V.view) { lc.hidden = true; return; }
    const src = L.$('#page-canvas'), dpr = src.width / V.view.width, ctx = lc.getContext('2d');
    const z = 4, size = lc.width, half = size / 2 / z;
    lc.hidden = false;
    lc.style.left = Math.min(window.innerWidth - size - 8, e.clientX + 24) + 'px';
    lc.style.top = Math.max(8, e.clientY - size - 24) + 'px';
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(src, (sx - half) * dpr, (sy - half) * dpr, half * 2 * dpr, half * 2 * dpr, 0, 0, size, size);
    ctx.strokeStyle = 'rgba(0,113,227,.9)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size / 2 - 6); ctx.moveTo(size / 2, size / 2 + 6); ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2); ctx.lineTo(size / 2 - 6, size / 2); ctx.moveTo(size / 2 + 6, size / 2); ctx.lineTo(size, size / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(size / 2, size / 2, 2, 0, Math.PI * 2); ctx.stroke();
  };
  // Color of the rendered page at a screen point.
  L.pixelAt = (sx, sy) => {
    const c = L.$('#page-canvas'), dpr = c.width / V.view.width;
    const d = c.getContext('2d').getImageData(Math.round(sx * dpr), Math.round(sy * dpr), 1, 1).data;
    return [d[0], d[1], d[2]];
  };

  /* ——— Page operations shared by sidebar and grid ——— */
  L.movePages = (ids, beforeId) => {
    const s = L.state, moving = s.pages.filter(p => ids.includes(p.id));
    if (!moving.length) return;
    L.mutate(moving.length > 1 ? `move ${moving.length} pages` : 'move page', () => {
      const curId = s.pages[s.cur].id;
      const rest = s.pages.filter(p => !ids.includes(p.id));
      let at = beforeId ? rest.findIndex(p => p.id === beforeId) : rest.length;
      if (at < 0) at = rest.length;
      rest.splice(at, 0, ...moving);
      s.pages = rest; s.cur = L.pageIndex(curId);
    });
  };
  L.clickSelect = (page, e) => {
    const s = L.state, i = L.pageIndex(page.id);
    if (e.shiftKey && s.anchor != null) {
      const a = L.pageIndex(s.anchor), [lo, hi] = a < i ? [a, i] : [i, a];
      s.sel = new Set(s.pages.slice(lo, hi + 1).map(p => p.id));
    } else if (e.metaKey || e.ctrlKey) {
      s.sel.has(page.id) ? s.sel.delete(page.id) : s.sel.add(page.id); s.anchor = page.id;
    } else { s.sel = new Set([page.id]); s.anchor = page.id; }
    L.go(i); L.emit('select');
  };
  // HTML5 drag-reorder wiring for a container of cards with data-id.
  L.wireReorder = (container, selector) => {
    let dragIds = null;
    container.addEventListener('dragstart', e => {
      const card = e.target.closest(selector); if (!card) return;
      const id = card.dataset.id, s = L.state;
      dragIds = s.sel.has(id) && s.sel.size > 1 ? s.pages.filter(p => s.sel.has(p.id)).map(p => p.id) : [id];
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-loeito-pages', dragIds.join(','));
      requestAnimationFrame(() => dragIds.forEach(d => container.querySelector(`[data-id="${d}"]`)?.classList.add('dragging')));
    });
    container.addEventListener('dragend', () => { dragIds = null; L.$$('.dragging,.drop-before', container).forEach(el => el.classList.remove('dragging', 'drop-before')); });
    container.addEventListener('dragover', e => {
      if (!dragIds) return; e.preventDefault();
      L.$$('.drop-before', container).forEach(el => el.classList.remove('drop-before'));
      const card = e.target.closest(selector); if (!card) return;
      const r = card.getBoundingClientRect(), vertical = selector === '.thumb';
      const after = vertical ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
      const target = after ? card.nextElementSibling : card;
      if (target && target.matches(selector)) target.classList.add('drop-before');
      container.dataset.dropBefore = target && target.matches(selector) ? target.dataset.id : '';
    });
    container.addEventListener('drop', e => {
      if (!dragIds) return; e.preventDefault(); e.stopPropagation();
      const before = container.dataset.dropBefore || null;
      if (!(before && dragIds.includes(before))) L.movePages(dragIds, before);
      dragIds = null;
    });
  };

  /* ——— Sidebar thumbnails ——— */
  const thumbEls = new Map();
  const io = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) { const el = en.target; io.unobserve(el); L.fillThumb(el); }
  }, { root: null, rootMargin: '400px' });
  L.fillThumb = async el => {
    const page = L.state.pages.find(p => p.id === el.dataset.id); if (!page) return;
    const sig = L.pageSignature(page); if (el.dataset.sig === sig) return;
    el.dataset.sig = sig;
    const url = await L.thumb(page);
    if (!url || el.dataset.sig !== sig) return;
    const holder = el.querySelector('.ph, img');
    const img = h('img', { src: url, alt: '', draggable: 'false' });
    holder.replaceWith(img);
    L.spinIn(img, page.id);
  };
  L.observeThumb = el => io.observe(el);
  L.renderThumbs = () => {
    const box = L.$('#thumbs'), s = L.state;
    const keep = new Set(s.pages.map(p => p.id));
    for (const [id, el] of thumbEls) if (!keep.has(id)) { el.remove(); thumbEls.delete(id); }
    s.pages.forEach((p, i) => {
      let el = thumbEls.get(p.id);
      if (!el) {
        el = h('div', { class: 'thumb', 'data-id': p.id, draggable: 'true' },
          h('div', { class: 'tframe' }, h('div', { class: 'ph' }), h('div', { class: 'badges' })), h('span', { class: 'num' }));
        el.addEventListener('click', e => L.clickSelect(L.state.pages.find(q => q.id === p.id), e));
        thumbEls.set(p.id, el);
      }
      if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
      el.querySelector('.num').textContent = i + 1;
      el.classList.toggle('current', i === s.cur);
      el.classList.toggle('selected', s.sel.has(p.id) && s.sel.size > 0);
      const badges = el.querySelector('.badges'); badges.replaceChildren();
      if (p.ocr) badges.append(h('span', { class: 'badge ok', title: 'Searchable (OCR text added)' }, 'OCR'));
      if (el.dataset.sig !== L.pageSignature(p)) { if (el.querySelector('img')) L.fillThumb(el); else io.observe(el); }
    });
    L.$('#sidebar-count').textContent = s.pages.length === 1 ? '1 page' : `${s.pages.length} pages`;
  };
  L.scrollThumbIntoView = () => { const el = thumbEls.get(L.page()?.id); el && el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };

  /* ——— Search ——— */
  const textIndex = new Map(); // pageId|sig -> {str, starts, words}
  async function pageIndexFor(p) {
    const key = p.id + '|' + p.src + p.index + '|' + (p.ocr ? p.ocr.words.length : 0);
    if (textIndex.has(key)) return textIndex.get(key);
    const pdf = (await L.pdfTextItems(p)).length ? await L.pageWords(p, { prefer: 'pdf' }) : [];
    const words = pdf.concat(p.ocr ? p.ocr.words : []);
    let str = '', starts = [];
    for (const w of words) { starts.push(str.length); str += w.t + ' '; }
    const v = { str: str.toLowerCase(), raw: str, starts, words };
    textIndex.set(key, v); return v;
  }
  let searchRun = 0, results = [], active = -1;
  async function runSearch(q) {
    const run = ++searchRun, list = L.$('#search-results'); results = []; active = -1;
    list.replaceChildren(); L.$('#search-count').textContent = '';
    V.hits = null; L.drawOverlay();
    q = q.trim().toLowerCase(); if (q.length < 2) return;
    const pages = L.state.pages;
    for (let i = 0; i < pages.length; i++) {
      const idx = await pageIndexFor(pages[i]); if (run !== searchRun) return;
      let at = idx.str.indexOf(q);
      while (at >= 0) {
        const end = at + q.length, ws = [];
        idx.starts.forEach((s, k) => { if (s < end && s + idx.words[k].t.length > at) ws.push(idx.words[k]); });
        const res = { pageId: pages[i].id, words: ws };
        results.push(res);
        const a = Math.max(0, at - 40), snip = idx.raw.slice(a, end + 50);
        const el = h('div', { class: 'sres', onclick: () => pick(results.indexOf(res)) },
          h('div', { class: 'pg' }, `Page ${i + 1}`),
          h('div', { class: 'snip' }, (a > 0 ? '…' : '') + snip.slice(0, at - a), h('mark', null, snip.slice(at - a, at - a + q.length)), snip.slice(at - a + q.length) + '…'));
        list.append(el);
        at = idx.str.indexOf(q, end);
        if (results.length > 400) break;
      }
      L.$('#search-count').textContent = `${results.length}`;
    }
    L.$('#search-count').textContent = results.length ? `${results.length} found` : 'No matches';
    if (results.length) pick(0);
  }
  function pick(i) {
    if (!results.length) return;
    active = (i + results.length) % results.length;
    const r = results[active];
    L.$$('.sres').forEach((el, k) => el.classList.toggle('on', k === active));
    L.$$('.sres')[active]?.scrollIntoView({ block: 'nearest' });
    V.hits = r;
    const idx = L.pageIndex(r.pageId);
    L.emit('hits');
    if (L.readerActive && L.readerActive()) return;
    if (idx !== L.state.cur) L.go(idx); else L.drawOverlay();
  }
  L.openSearch = () => {
    if (!L.hasDoc()) return;
    const pop = L.$('#search-pop'); pop.hidden = false; L.$('#btn-search').classList.add('on');
    const inp = L.$('#search-input'); inp.focus(); inp.select();
  };
  L.closeSearch = () => { L.$('#search-pop').hidden = true; L.$('#btn-search').classList.remove('on'); V.hits = null; L.emit('hits'); L.drawOverlay(); };
  L.invalidateSearch = () => textIndex.clear();

  /* ——— Selected text: a small bar with the likely next steps ——— */
  let selBar = null;
  function hideSelBar() { if (selBar) { selBar.remove(); selBar = null; } }
  function selectionInfo() {
    const sel = getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0), n = range.commonAncestorContainer, el = n.nodeType === 1 ? n : n.parentElement;
    if (!el || !(el.closest('.textLayer') || el.matches('.reader-pages, .rpage') || el.closest('.rpage'))) return null;
    const text = sel.toString().replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
    const rects = [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 2);
    return text && rects.length ? { text, rects } : null;
  }
  // Fragments of one line become one band.
  function lineBands(rects) {
    const out = [];
    for (const r of [...rects].sort((a, b) => a.top - b.top || a.left - b.left)) {
      const o = out.find(b => Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 0.5 * Math.min(b.bottom - b.top, r.height) && r.left - b.right < r.height * 1.5);
      if (o) { o.left = Math.min(o.left, r.left); o.right = Math.max(o.right, r.right); o.top = Math.min(o.top, r.top); o.bottom = Math.max(o.bottom, r.bottom); }
      else out.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
    return out;
  }
  function highlightSelection(info) {
    const S = L.state, byPage = new Map();
    const targets = L.readerActive && L.readerActive()
      ? L.$$('#reader-pages .rpage').filter(el => el._view).map(el => ({ el, page: S.pages.find(p => p.id === el.dataset.id), view: el._view }))
      : [{ el: L.$('#sheet'), page: L.page(), view: V.view }];
    for (const r of lineBands(info.rects)) for (const t of targets) {
      const b = t.el.getBoundingClientRect();
      if (!t.page || !t.view || r.bottom < b.top || r.top > b.bottom || r.right < b.left || r.left > b.right) continue;
      const k = t.view.width / b.width;
      const a = t.view.toPdf([(r.left - b.left) * k, (r.top - b.top) * k]), c = t.view.toPdf([(r.right - b.left) * k, (r.bottom - b.top) * k]);
      const box = { x: Math.min(a[0], c[0]), y: Math.min(a[1], c[1]), w: Math.abs(c[0] - a[0]), h: Math.abs(c[1] - a[1]) };
      if (!byPage.has(t.page)) byPage.set(t.page, []);
      byPage.get(t.page).push(box);
    }
    if (!byPage.size) return;
    L.mutate('highlight', () => byPage.forEach((boxes, p) => boxes.forEach(r => p.ann.push({ id: L.uid('a'), type: 'highlight', r, color: '#ffd60a', opacity: 0.4 }))));
    getSelection().removeAllRanges();
    L.toast('Highlighted — change or remove it in Edit', { icon: 'highlight' });
  }
  function showSelBar() {
    hideSelBar();
    if (V.tool === 'hand') return;
    const info = selectionInfo(); if (!info) return;
    const first = info.rects[0], last = info.rects[info.rects.length - 1];
    const act = (label, icon, fn, tip) => h('button', { title: tip, onmousedown: e => e.preventDefault(), onclick: () => { fn(); hideSelBar(); } }, L.icon(icon), label);
    selBar = h('div', { class: 'sel-bar', role: 'toolbar', 'aria-label': 'Selected text' },
      act('Copy', 'copy', () => L.copyText(info.text), 'Copy the selected text (Ctrl C)'),
      act('Highlight', 'highlight', () => highlightSelection(info), 'Mark it yellow — saved in the PDF'),
      act('Find', 'search', () => { L.openSearch(); const inp = L.$('#search-input'); inp.value = info.text.slice(0, 80); inp.dispatchEvent(new Event('input')); }, 'Find every place this appears'),
      window.speechSynthesis ? act('Speak', 'play', () => { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(info.text); u.rate = L.speech ? L.speech.rate : 1; speechSynthesis.speak(u); }, 'Read the selection aloud') : null);
    document.body.append(selBar);
    const bw = selBar.offsetWidth, bh = selBar.offsetHeight;
    const above = first.top - bh - 10 > 60;
    const x = L.clamp((above ? first.left : last.right) - bw / 2 + (above ? Math.min(first.width, 200) / 2 : 0), 8, innerWidth - bw - 8);
    selBar.style.left = x + 'px';
    selBar.style.top = (above ? first.top - bh - 10 : Math.min(innerHeight - bh - 8, last.bottom + 10)) + 'px';
  }
  L.hideSelBar = hideSelBar;

  L.initViewer = () => {
    initPointer();
    L.$$('#hud-tools button').forEach(b => { b.onclick = () => L.setTool(b.dataset.tool); });
    L.setTool('select');
    const bare = () => { const b = L.blade(); wrap().classList.toggle('bare', !(b && b.pointer)); };
    L.on('blade', bare); bare();
    document.addEventListener('mouseup', e => { if (!(selBar && selBar.contains(e.target))) setTimeout(showSelBar, 0); });
    document.addEventListener('keyup', e => { if (e.shiftKey || e.key === 'Shift') showSelBar(); });
    document.addEventListener('selectionchange', () => { if (selBar && getSelection().isCollapsed) hideSelBar(); });
    for (const sc of [stage(), L.$('#reader')]) sc.addEventListener('scroll', hideSelBar, { passive: true });
    L.wireReorder(L.$('#thumbs'), '.thumb');
    const inp = L.$('#search-input');
    inp.addEventListener('input', L.debounce(() => runSearch(inp.value), 220));
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); pick(active + (e.shiftKey ? -1 : 1)); }
      if (e.key === 'Escape') { e.preventDefault(); L.closeSearch(); }
    });
    new ResizeObserver(L.debounce(() => { if (L.hasDoc() && typeof V.zoom === 'string') L.render(); }, 120)).observe(L.$('#stage'));
  };
})();
