/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito reader: continuous scrolling, selectable text, themes, focus mode, contents, read-aloud, resume position. */
(() => {
  const L = window.Loeito, h = L.h;
  const pref = (k, d) => { try { return localStorage.getItem('loeito.read.' + k) ?? d; } catch { return d; } };
  const savePref = (k, v) => { try { localStorage.setItem('loeito.read.' + k, v); } catch {} };
  const R = (L.reader = { on: false, zoom: 'fit-width', scale: 1, theme: pref('theme', 'paper'), layout: pref('layout', 'single'), focus: false, fromScroll: false, words: new Map() });
  const root = () => L.$('#reader'), list = () => L.$('#reader-pages');
  L.readerActive = () => R.on;

  /* ——— Layout ——— */
  const els = new Map(); // pageId -> element
  const base = p => { const pr = L.proxySync(p); return pr ? L.makeView(pr, p, 1) : { width: 612, height: 792 }; };
  function fitScale() {
    const r = root(), aw = Math.max(240, r.clientWidth - 64), ah = Math.max(240, r.clientHeight - 48);
    const sizes = L.state.pages.map(base), spread = R.layout === 'spread';
    const maxW = Math.max(...sizes.map(s => s.width)) * (spread ? 2 : 1) + (spread ? 16 : 0), maxH = Math.max(...sizes.map(s => s.height));
    if (R.zoom === 'fit-page') return Math.min(aw / maxW, ah / maxH);
    if (R.zoom === 'fit-width') return Math.min(aw / maxW, spread ? 2.5 : 1.9); // a comfortable column, never a billboard
    return R.zoom;
  }
  function layout() {
    if (!R.on) return;
    const s = L.state, box = list();
    R.scale = fitScale();
    box.classList.toggle('spread', R.layout === 'spread');
    const keep = new Set(s.pages.map(p => p.id));
    for (const [id, el] of els) if (!keep.has(id)) { io.unobserve(el); el.remove(); els.delete(id); }
    s.pages.forEach((p, i) => {
      let el = els.get(p.id);
      if (!el) {
        el = h('div', { class: 'rpage', 'data-id': p.id }, h('div', { class: 'rph' }), L.s('svg', { class: 'rhits' }));
        els.set(p.id, el); io.observe(el);
      }
      if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
      const b = base(p);
      el.style.width = b.width * R.scale + 'px'; el.style.height = b.height * R.scale + 'px';
      el.dataset.n = i + 1;
    });
    L.$('#zoom-label').textContent = Math.round(R.scale * 100) + '%';
    queueVisible();
  }

  /* ——— Lazy rendering ——— */
  const near = new Set();
  // observes page boxes inside the reader's own scroll area, pre-rendering ~2 screens ahead and behind
  let io = { observe() {}, unobserve() {} };
  const makeObserver = () => new IntersectionObserver(entries => {
    for (const en of entries) {
      if (en.isIntersecting) near.add(en.target); else { near.delete(en.target); release(en.target); }
    }
    queueVisible();
  }, { root: root(), rootMargin: '1400px 0px' });
  function release(el) {
    const c = el.querySelector('canvas'); if (c) { c.width = 0; c.remove(); }
    el.querySelector('.textLayer')?.remove(); el.dataset.key = '';
  }
  let busy = 0;
  const queueVisible = L.debounce(() => pump(), 60);
  function pump() {
    if (!R.on) return;
    const mid = root().getBoundingClientRect().top + root().clientHeight / 2;
    const todo = [...near].filter(el => el.dataset.key !== keyFor(el)).sort((a, b) => Math.abs(a.getBoundingClientRect().top - mid) - Math.abs(b.getBoundingClientRect().top - mid));
    while (busy < 2 && todo.length) { const el = todo.shift(); busy++; renderPage(el).finally(() => { busy--; pump(); }); }
  }
  const pageOf = el => L.state.pages.find(p => p.id === el.dataset.id);
  const keyFor = el => { const p = pageOf(el); return p ? `${L.pageSignature(p)}@${R.scale.toFixed(3)}@${JSON.stringify(L.state.stamps)}@${p.ocr ? p.ocr.words.length : 0}` : ''; };
  async function renderPage(el) {
    const p = pageOf(el); if (!p) return;
    const key = keyFor(el); el.dataset.key = key;
    const c = document.createElement('canvas');
    let view;
    try { view = await L.renderInto(c, p, R.scale, { stamps: true, intent: 'display' }); } catch { el.dataset.key = ''; return; }
    if (el.dataset.key !== key || !R.on) return;
    const old = el.querySelector('canvas'); old ? old.replaceWith(c) : el.prepend(c);
    L.spinIn(el, p.id);
    el.querySelector('.rph')?.remove();
    el._view = view;
    buildTextLayer(el, p, view);
    drawHits(el);
  }
  async function buildTextLayer(el, p, view) {
    const tl = await L.buildTextLayer(p, view);
    R.words.set(p.id, tl.words);
    if (!el.isConnected || !R.on) return;
    el.querySelector('.textLayer')?.remove(); el.append(tl);
  }

  /* ——— Current page follows scrolling ——— */
  let raf = 0;
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; if (!R.on) return;
      const r = root().getBoundingClientRect(), line = r.top + r.height * 0.35;
      let best = null, bd = Infinity;
      for (const el of list().children) { const b = el.getBoundingClientRect(); const d = b.top <= line && b.bottom >= line ? 0 : Math.min(Math.abs(b.top - line), Math.abs(b.bottom - line)); if (d < bd) { bd = d; best = el; } if (b.top > r.bottom) break; }
      const i = best ? L.pageIndex(best.dataset.id) : -1;
      if (i >= 0 && i !== L.state.cur) { R.fromScroll = true; L.state.cur = i; L.emit('page', i); }
      updateFocusHud(); savePos();
    });
  }
  function scrollToPage(i, smooth = true) {
    const el = els.get(L.state.pages[i]?.id); if (!el) return;
    root().scrollTo({ top: el.offsetTop - 16, behavior: smooth ? 'smooth' : 'auto' });
  }
  L.on('page', i => { if (!R.on) return; if (R.fromScroll) { R.fromScroll = false; return; } scrollToPage(i); });

  /* ——— Zoom (anchored) ——— */
  L.readerZoom = (scale, anchor) => {
    const r = root(), rr = r.getBoundingClientRect();
    const ay = anchor ? anchor.clientY : rr.top + r.clientHeight / 2, ax = anchor ? anchor.clientX : rr.left + r.clientWidth / 2;
    const target = [...list().children].find(el => { const b = el.getBoundingClientRect(); return b.top <= ay && b.bottom >= ay; }) || els.get(L.page().id);
    const tb = target.getBoundingClientRect(), fy = (ay - tb.top) / tb.height, fx = (ax - tb.left) / tb.width;
    R.zoom = L.clamp(scale, 0.15, 6); layout();
    const nb = target.getBoundingClientRect();
    r.scrollTop += nb.top + fy * nb.height - ay; r.scrollLeft += nb.left + fx * nb.width - ax;
  };
  L.readerFit = z => { const i = L.state.cur; R.zoom = z; layout(); scrollToPage(i, false); };

  /* ——— Search hits ——— */
  function drawHits(el) {
    const svg = el.querySelector('.rhits'); if (!svg) return;
    svg.replaceChildren();
    const hits = L.viewer.hits; if (!hits || hits.pageId !== el.dataset.id || !el._view) return;
    svg.setAttribute('viewBox', `0 0 ${el._view.width} ${el._view.height}`);
    for (const w of hits.words) { const b = L.wordBox(w, el._view); svg.append(L.s('rect', { x: b.x - 2, y: b.y - 1, width: b.w + 4, height: b.h + 2, rx: 3, fill: '#ffd60a', 'fill-opacity': 0.5 })); }
  }
  L.on('hits', () => { if (!R.on) return; els.forEach(drawHits); const i = L.pageIndex(L.viewer.hits?.pageId); if (i >= 0) { R.fromScroll = false; scrollToPage(i); } });

  /* ——— Activate / deactivate ——— */
  L.readerShow = async on => {
    R.on = on;
    root().hidden = !on; L.$('#stage').hidden = on;
    if (!on) { stopSpeaking(); setFocus(false); L.render(); return; }
    await Promise.all(L.state.pages.map(p => L.proxy(p)));
    if (!R.on) return;
    for (const el of els.values()) release(el);
    layout(); scrollToPage(L.state.cur, false);
    root().focus({ preventScroll: true });
  };
  L.on('change', e => { if (!R.on) return; layout(); if (e && e.switched) { for (const el of els.values()) release(el); scrollToPage(L.state.cur, false); } });
  L.on('cleared', () => { for (const el of els.values()) { io.unobserve(el); el.remove(); } els.clear(); });

  /* ——— Themes & layout ——— */
  L.readerTheme = t => { R.theme = t; savePref('theme', t); applyTheme(); };
  L.readerLayout = l => { const i = L.state.cur; R.layout = l; savePref('layout', l); layout(); scrollToPage(i, false); };
  const applyTheme = () => { const el = root(); ['paper', 'sepia', 'night'].forEach(t => el.classList.toggle('theme-' + t, R.theme === t)); document.body.classList.toggle('night-read', R.theme === 'night' && R.focus); };

  /* ——— Focus mode ——— */
  function setFocus(on) {
    if (R.focus === on) return;
    R.focus = on;
    document.body.classList.toggle('focus', on); applyTheme();
    if (on) { try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch {} poke(); }
    else if (document.fullscreenElement) { try { document.exitFullscreen(); } catch {} }
    setTimeout(() => { layout(); scrollToPage(L.state.cur, false); }, 60);
    updateFocusHud();
  }
  L.toggleFocus = async on => {
    on = on ?? !R.focus;
    if (on && L.state.blade !== 'view') L.setBlade('view');
    if (on && !R.on) await L.readerShow(true);
    setFocus(on);
  };
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && R.focus) setFocus(false); });
  let pokeT = 0;
  function poke() { document.body.classList.add('focus-ui'); clearTimeout(pokeT); pokeT = setTimeout(() => document.body.classList.remove('focus-ui'), 2400); }
  document.addEventListener('mousemove', () => { if (R.focus) poke(); });
  function minutesLeft() {
    const s = L.state, known = s.pages.filter(p => R.words.has(p.id)).map(p => R.words.get(p.id));
    const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 250;
    let rest = 0; for (let i = s.cur; i < s.pages.length; i++) rest += R.words.get(s.pages[i].id) ?? avg;
    return Math.max(1, Math.round(rest / 230));
  }
  function updateFocusHud() {
    if (!R.focus) return;
    const s = L.state, el = els.get(s.pages[s.cur]?.id), r = root();
    let frac = 0; if (el) { const b = el.getBoundingClientRect(), rr = r.getBoundingClientRect(); frac = L.clamp((rr.top + rr.height * 0.35 - b.top) / b.height, 0, 1); }
    L.$('#focus-progress').style.width = ((s.cur + frac) / s.pages.length * 100).toFixed(2) + '%';
    L.$('#focus-info').textContent = `Page ${s.cur + 1} of ${s.pages.length} · about ${minutesLeft()} min left`;
  }

  /* ——— Contents (PDF outline) ——— */
  const outlines = new Map();
  L.readerOutline = async () => {
    const s = L.state, p0 = s.pages[0]; if (!p0) return [];
    const src = L.sources[p0.src];
    if (!outlines.has(src.id)) outlines.set(src.id, (async () => {
      const ol = await src.doc.getOutline().catch(() => null); if (!ol || !ol.length) return [];
      const resolve = async (items, depth) => {
        const out = [];
        for (const it of items.slice(0, 400)) {
          let idx = -1;
          try {
            let dest = it.dest; if (typeof dest === 'string') dest = await src.doc.getDestination(dest);
            if (Array.isArray(dest)) idx = typeof dest[0] === 'object' ? await src.doc.getPageIndex(dest[0]) : dest[0];
          } catch {}
          out.push({ title: it.title, srcIndex: idx, depth });
          if (it.items && it.items.length && depth < 3) out.push(...(await resolve(it.items, depth + 1)));
        }
        return out;
      };
      return resolve(ol, 0);
    })());
    const items = await outlines.get(src.id);
    return items.map(it => ({ ...it, page: s.pages.findIndex(p => p.src === src.id && p.index === it.srcIndex) }));
  };

  /* ——— Read aloud ——— */
  const SP = (L.speech = { on: false, paused: false, rate: +pref('rate', '1'), voice: pref('voice', ''), token: 0 });
  L.voices = () => (window.speechSynthesis ? speechSynthesis.getVoices() : []);
  const cleanForSpeech = t => t.replace(/-\n(\w)/g, '$1').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const chunks = t => (t.match(/[^.!?;:]+[.!?;:]*\s*/g) || [t]).reduce((a, s) => { const last = a[a.length - 1]; if (last && last.length + s.length < 220) a[a.length - 1] = last + s; else a.push(s); return a; }, []).filter(x => x.trim());
  const say = (text, token) => new Promise(res => {
    if (token !== SP.token) return res(false);
    const u = new SpeechSynthesisUtterance(text);
    const v = L.voices().find(x => x.voiceURI === SP.voice); if (v) u.voice = v;
    u.rate = SP.rate; u.onend = () => res(true); u.onerror = () => res(false);
    speechSynthesis.speak(u);
  });
  L.speakFrom = async i => {
    if (!window.speechSynthesis) return L.toast('This browser can’t read aloud.', { kind: 'err' });
    stopSpeaking(); const token = ++SP.token; SP.on = true; SP.paused = false; L.emit('speech');
    const st = L.state;
    for (let k = i; k < st.pages.length && token === SP.token; k++) {
      if (st === L.state && k !== L.state.cur) L.go(k);
      const text = cleanForSpeech(await L.pageText(st.pages[k]));
      if (!text) continue;
      for (const c of chunks(text)) { if (token !== SP.token) break; await say(c, token); }
    }
    if (token === SP.token) { SP.on = false; L.emit('speech'); }
  };
  function stopSpeaking() { SP.token++; SP.on = false; SP.paused = false; try { speechSynthesis.cancel(); } catch {} L.emit('speech'); }
  L.stopSpeaking = stopSpeaking;
  L.pauseSpeaking = () => { if (!SP.on) return; if (SP.paused) { speechSynthesis.resume(); SP.paused = false; } else { speechSynthesis.pause(); SP.paused = true; } L.emit('speech'); };
  L.setSpeechRate = r => { SP.rate = r; savePref('rate', r); };
  L.setVoice = v => { SP.voice = v; savePref('voice', v); };

  /* ——— Remember where you stopped ——— */
  const posKey = () => 'loeito.pos.' + L.state.name + '|' + L.state.pages.length;
  const savePos = L.debounce(() => { if (L.hasDoc()) try { localStorage.setItem(posKey(), String(L.state.cur)); } catch {} }, 600);
  L.on('page', () => savePos());
  L.on('opened', doc => {
    let n = 0; try { n = +localStorage.getItem('loeito.pos.' + doc.state.name + '|' + doc.state.pages.length) || 0; } catch {}
    if (n > 0 && n < doc.state.pages.length) L.toast(`Welcome back — you stopped at page ${n + 1}`, { icon: 'book', ms: 7000, action: { label: 'Continue', fn: () => { if (L.doc === doc) L.go(n); } } });
  });

  /* ——— Wiring ——— */
  L.initReader = () => {
    const r = root();
    io = makeObserver();
    r.addEventListener('scroll', () => { onScroll(); queueVisible(); }, { passive: true });
    r.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); L.readerZoom(R.scale * L.wheelFactor(e), e); }, { passive: false });
    L.wirePan(r, e => L.wantsPan(e, false));
    new ResizeObserver(L.debounce(() => { if (R.on && typeof R.zoom === 'string') { const i = L.state.cur; layout(); scrollToPage(i, false); } }, 150)).observe(r);
    L.$('#focus-exit').append(L.icon('close'));
    L.$('#focus-exit').onclick = () => L.toggleFocus(false);
    L.$$('#focus-themes button').forEach(b => { b.onclick = () => L.readerTheme(b.dataset.t); });
    applyTheme();
  };
})();
