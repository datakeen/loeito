/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito core: DOM helpers, icons, state, history, feedback (toasts, tasks, dialogs), file utilities. */
(() => {
  const L = (window.Loeito = window.Loeito || {});
  L.VERSION = '1.6.0'; L.CODENAME = 'Hantverk'; // keep in step with VERSION and CHANGELOG.md (see POLICY.md § 6)

  /* ——— Motion: a just-rotated page turns into place wherever it is shown (grid, sidebar, page, reader) ——— */
  L.spins = new Map(); // page id -> { delta, until }
  L.markSpin = (ids, delta) => { const until = performance.now() + 1500; ids.forEach(id => L.spins.set(id, { delta, until })); };
  L.spinIn = (el, id) => {
    const s = L.spins.get(id); if (!s || !el || !el.animate) return;
    if (performance.now() > s.until) { L.spins.delete(id); return; }
    el.animate([{ transform: `rotate(${-s.delta}deg) scale(.88)`, opacity: 0.55 }, { transform: 'none', opacity: 1 }], { duration: 440, easing: 'cubic-bezier(.2,.9,.25,1.12)' });
  };
  L.reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ——— Preferences (remembered on this computer) ——— */
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('lagom.') && localStorage.getItem('loeito.' + k.slice(6)) == null) localStorage.setItem('loeito.' + k.slice(6), localStorage.getItem(k)); } } catch {} // carry over settings saved by older versions
  L.pref = (k, d) => { try { const v = localStorage.getItem('loeito.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  L.setPref = (k, v) => { try { localStorage.setItem('loeito.' + k, JSON.stringify(v)); } catch {} };

  /* ——— DOM ——— */
  L.$ = (s, r = document) => r.querySelector(s);
  L.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'contentEditable', 'spellcheck', 'tabIndex']);
  L.h = function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (PROPS.has(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return el;
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  L.s = function s(tag, attrs, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return el;
  };

  /* ——— Icons: SF-Symbols-like line glyphs on a 24 grid ——— */
  const P = {
    logo: '',
    sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M9.5 4.5v15M5.8 8h1.6M5.8 11h1.6M5.8 14h1.6"/>',
    eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    pages: '<rect x="4" y="3.5" width="7" height="8.5" rx="1.5"/><rect x="13" y="3.5" width="7" height="8.5" rx="1.5"/><rect x="4" y="14" width="7" height="6.5" rx="1.5"/><rect x="13" y="14" width="7" height="6.5" rx="1.5"/>',
    edit: '<path d="M14.5 5.5l4 4M4.5 19.5l1-4.5L16 4.5a1.4 1.4 0 012 0l1.5 1.5a1.4 1.4 0 010 2L9 18.5z"/>',
    crop: '<path d="M6.5 2.5v13a2 2 0 002 2h13M2.5 6.5h13a2 2 0 012 2v13"/>',
    ocr: '<path d="M3.5 8V5.5a2 2 0 012-2H8M16 3.5h2.5a2 2 0 012 2V8M20.5 16v2.5a2 2 0 01-2 2H16M8 20.5H5.5a2 2 0 01-2-2V16"/><path d="M8 9h8M8 12h8M8 15h5"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10M15 9.5v10"/>',
    chart: '<path d="M3.5 3.5v17h17"/><path d="M7 15.5l4-5 3.5 3 5-7"/><circle cx="7" cy="15.5" r="1" fill="currentColor"/><circle cx="11" cy="10.5" r="1" fill="currentColor"/><circle cx="14.5" cy="13.5" r="1" fill="currentColor"/><circle cx="19.5" cy="6.5" r="1" fill="currentColor"/>',
    compress: '<path d="M9.5 3.5v6h-6M14.5 3.5v6h6M9.5 20.5v-6h-6M14.5 20.5v-6h6"/>',
    stamp: '<path d="M5 20.5h14M6 17.5h12a1 1 0 001-1v-2a2 2 0 00-2-2h-2.5l-.7-3.6A3 3 0 0015 6a3 3 0 10-6 0 3 3 0 00.2 2.9L8.5 12.5H7a2 2 0 00-2 2v2a1 1 0 001 1z"/>',
    save: '<path d="M12 3.5v11M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v6a2 2 0 002 2h10a2 2 0 002-2v-6"/>',
    undo: '<path d="M9 7.5L4.5 12 9 16.5"/><path d="M4.5 12h10a5 5 0 010 10H12"/>',
    redo: '<path d="M15 7.5l4.5 4.5-4.5 4.5"/><path d="M19.5 12h-10a5 5 0 000 10H12"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    left: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    right: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    down: '<path d="M5.5 9.5L12 16l6.5-6.5"/>',
    rotl: '<path d="M4.5 9.5A8 8 0 1112 20"/><path d="M4 4.5v5h5"/>',
    rotr: '<path d="M19.5 9.5A8 8 0 1012 20"/><path d="M20 4.5v5h-5"/>',
    rot180: '<path d="M4 12a8 8 0 0114.5-4.6M20 12a8 8 0 01-14.5 4.6"/><path d="M19 3.5v4h-4M5 20.5v-4h4"/>',
    trash: '<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5l1-13M10 10.5v6M14 10.5v6"/>',
    duplicate: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 00-2.5-2.5H6A2.5 2.5 0 003.5 6v7A2.5 2.5 0 006 15.5h2.5"/>',
    docplus: '<path d="M13.5 3.5H7a2 2 0 00-2 2v13a2 2 0 002 2h10a2 2 0 002-2V9z"/><path d="M13.5 3.5V9H19M12 12v6M9 15h6"/>',
    scissors: '<circle cx="6" cy="7" r="2.8"/><circle cx="6" cy="17" r="2.8"/><path d="M8.3 8.6L20 18M8.3 15.4L20 6"/>',
    extract: '<path d="M13.5 3.5H7a2 2 0 00-2 2v13a2 2 0 002 2h4"/><path d="M13.5 3.5V9H19v3"/><path d="M15 17.5h6.5M18.5 14.5l3 3-3 3"/>',
    merge: '<path d="M6 3.5v4a4 4 0 004 4h4a4 4 0 014 4v5"/><path d="M18 3.5v4a4 4 0 01-4 4"/><path d="M15 17.5l3 3 3-3"/>',
    wand: '<path d="M4 20l11-11M13 7l2-2 4 4-2 2"/><path d="M18 2.5v3M16.5 4h3M20.5 13v2.5M19.2 14.2h2.6M8 3v2M7 4h2"/>',
    cursor: '<path d="M6 3.5l12 7.5-5.3 1.4 3.3 6.1-2.4 1.3-3.3-6.1L6 17.5z"/>',
    textedit: '<path d="M4 6.5V4.5h11v2M9.5 4.5v13M7.5 17.5h4"/><path d="M17 9.5v11M15.3 9.5h3.4M15.3 20.5h3.4"/>',
    type: '<path d="M5 7V4.5h14V7M12 4.5v15M9 19.5h6"/>',
    highlight: '<path d="M9 14.5l-2.5 5h5.5l1-2"/><path d="M8.5 13l6.8-9.3a1.5 1.5 0 012.1-.3l2 1.5a1.5 1.5 0 01.3 2.1L12.9 16.3z"/><path d="M3.5 21h17" opacity=".5"/>',
    whiteout: '<rect x="3.5" y="6.5" width="17" height="11" rx="2"/><path d="M7 10h6M7 13.5h10" opacity=".35"/>',
    redact: '<rect x="3.5" y="6.5" width="17" height="11" rx="2" fill="currentColor"/>',
    pen: '<path d="M3.5 18c3-1 4-5 7-6s3 4 6 3 3.5-4 4-6"/>',
    rect: '<rect x="4" y="5.5" width="16" height="13" rx="1.5"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>',
    line: '<path d="M5 19L19 5"/>',
    arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
    signature: '<path d="M3 17c2-6 4-10 5.5-10S8 15 7 18s4-9 6-9-1 7 1 7 3-3 4-3 1 2 3 2"/><path d="M3 21h18" opacity=".5"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M3.5 17l5-4.5 4 3.5 3-2.5 5 4"/>',
    sparkles: '<path d="M11 3.5l1.6 4.4 4.4 1.6-4.4 1.6L11 15.5 9.4 11.1 5 9.5l4.4-1.6zM18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.4"/>',
    warn: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17v.3"/>',
    download: '<path d="M12 3.5v12M7.5 11l4.5 4.5 4.5-4.5M4.5 20.5h15"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 00-2.5-2.5H6A2.5 2.5 0 003.5 6v7A2.5 2.5 0 006 15.5h2.5"/>',
    target: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0C18.5 15 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
    polyline: '<path d="M4 18l5-9 5 6 6-10"/><circle cx="4" cy="18" r="1.4" fill="currentColor"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="14" cy="15" r="1.4" fill="currentColor"/><circle cx="20" cy="5" r="1.4" fill="currentColor"/>',
    polygon: '<path d="M12 3.5l8 6-3 10H7l-3-10z"/>',
    dropper: '<path d="M14 5.5l4.5 4.5M16.5 3.5a2.1 2.1 0 013 3L17 9l-2-2zM15 7L5.5 16.5 4.5 20l3.5-1L17.5 9.5"/>',
    hash: '<path d="M9 4l-2 16M17 4l-2 16M4.5 9h16M3.5 15h16"/>',
    water: '<path d="M4 7.5c3-3 6 3 8 0s5-3 8 0" /><path d="M4 12c3-3 6 3 8 0s5-3 8 0" opacity=".6"/><path d="M4 16.5c3-3 6 3 8 0s5-3 8 0" opacity=".3"/>',
    doc: '<path d="M13.5 3.5H7a2 2 0 00-2 2v13a2 2 0 002 2h10a2 2 0 002-2V9z"/><path d="M13.5 3.5V9H19M8.5 13h7M8.5 16.5h5"/>',
    upload: '<path d="M12 15.5v-12M7.5 8L12 3.5 16.5 8"/><path d="M4 14v4.5a2 2 0 002 2h12a2 2 0 002-2V14"/>',
    resize: '<rect x="3.5" y="9.5" width="11" height="11" rx="2"/><path d="M13.5 3.5h7v7M20.5 3.5l-7 7"/>',
    fit: '<path d="M4 9V5.5A1.5 1.5 0 015.5 4H9M15 4h3.5A1.5 1.5 0 0120 5.5V9M20 15v3.5a1.5 1.5 0 01-1.5 1.5H15M9 20H5.5A1.5 1.5 0 014 18.5V15"/>',
    trace: '<path d="M3.5 17c3 0 4-9 7-9s3 6 5 6 2.5-4 5-4"/><path d="M3.5 21h17" opacity=".4"/>',
    hand: '<path d="M8 13V6.5a1.5 1.5 0 013 0V11m0-5.5v-1a1.5 1.5 0 013 0V11m0-5a1.5 1.5 0 013 0v7.5c0 4-2.5 7-6.5 7-3 0-4.5-1.5-6-4l-2-3.5a1.5 1.5 0 012.5-1.6L8 13"/>',
    text: '<path d="M4 6h16M4 10.5h16M4 15h16M4 19.5h10"/>',
    book: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13.5C7 18 10 18.5 12 20c2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5V20"/>',
    focus: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="2.5"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1" fill="currentColor"/>',
    spread: '<rect x="3" y="5" width="8" height="14" rx="1.5"/><rect x="13" y="5" width="8" height="14" rx="1.5"/>',
    single: '<rect x="7" y="4" width="10" height="16" rx="1.5"/>',
    form: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M7.5 8h4M7.5 12h9M7.5 16h9"/><rect x="13.5" y="6.5" width="3" height="3" rx=".6"/>',
    radio: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
    ibeam: '<path d="M9 4.5c1.8 0 3 .9 3 2.6v9.8c0 1.7-1.2 2.6-3 2.6M15 4.5c-1.8 0-3 .9-3 2.6v9.8c0 1.7 1.2 2.6 3 2.6M10 12h4"/>',
    folder: '<path d="M3.5 7.5a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/>',
    folderplus: '<path d="M3.5 7.5a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/><path d="M12 10.5v5.5M9.25 13.25h5.5"/>',
    up: '<path d="M12 19.5V5M6.5 10.5L12 5l5.5 5.5"/>',
    desktop: '<rect x="3.5" y="4.5" width="17" height="11.5" rx="2"/><path d="M9 20h6M12 16v4"/>',
    drive: '<rect x="3.5" y="13" width="17" height="6.5" rx="2"/><path d="M5.5 13L8 5.5h8l2.5 7.5M16.5 16.3h.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    history: '<path d="M4.5 12a7.5 7.5 0 102.2-5.3"/><path d="M4 4.5v4h4"/><path d="M12 8v4.5l3 1.5"/>',
    shield: '<path d="M12 3.5l7.5 3v5.5c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V6.5z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 014.8.8c0 1.7-2.4 2.1-2.4 3.7M12 16.8v.3"/>',
    cover: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M8.5 8h7M8.5 11h5M5 16.5h14"/>',
    template: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9h17M9 9v11.5"/>',
    alignL: '<path d="M4.5 3.5v17"/><rect x="7.5" y="6" width="11" height="4.5" rx="1"/><rect x="7.5" y="13.5" width="7" height="4.5" rx="1"/>',
    alignC: '<path d="M12 3.5v17"/><rect x="5.5" y="6" width="13" height="4.5" rx="1"/><rect x="8" y="13.5" width="8" height="4.5" rx="1"/>',
    alignR: '<path d="M19.5 3.5v17"/><rect x="5.5" y="6" width="11" height="4.5" rx="1"/><rect x="9.5" y="13.5" width="7" height="4.5" rx="1"/>',
    alignT: '<path d="M3.5 4.5h17"/><rect x="6" y="7.5" width="4.5" height="11" rx="1"/><rect x="13.5" y="7.5" width="4.5" height="7" rx="1"/>',
    alignM: '<path d="M3.5 12h17"/><rect x="6" y="5.5" width="4.5" height="13" rx="1"/><rect x="13.5" y="8" width="4.5" height="8" rx="1"/>',
    alignB: '<path d="M3.5 19.5h17"/><rect x="6" y="5.5" width="4.5" height="11" rx="1"/><rect x="13.5" y="9.5" width="4.5" height="7" rx="1"/>',
    distH: '<path d="M3.5 4v16M20.5 4v16"/><rect x="9.5" y="7" width="5" height="10" rx="1"/>',
    distV: '<path d="M4 3.5h16M4 20.5h16"/><rect x="7" y="9.5" width="10" height="5" rx="1"/>',
    eyeoff: '<path d="M3.5 3.5l17 17M10.6 6.1c.5-.1.9-.1 1.4-.1 6 0 9.5 6 9.5 6a17 17 0 01-3.1 3.8M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.4-1.1"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    code: '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5"/>',
    pie: '<path d="M12 3.5a8.5 8.5 0 108.5 8.5H12z"/><path d="M14.5 3.8a8.5 8.5 0 015.7 5.7h-5.7z"/>',
    layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
    clip: '<path d="M20 11.5l-7.8 7.8a5 5 0 01-7-7L13 4.5a3.4 3.4 0 014.8 4.8l-7.8 7.8a1.7 1.7 0 01-2.4-2.4l7.2-7.2"/>',
    comment: '<path d="M4.5 5.5h15v10h-8l-4 3.5v-3.5h-3z"/>',
    tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.4"/>',
    external: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v4.5a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 014 18.5v-10A1.5 1.5 0 015.5 7H10"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6"/>',
  };
  P.logo = null;
  L.icon = (name, size) => {
    if (name === 'logo') return L.logo(size);
    const t = document.createElement('template');
    t.innerHTML = `<svg viewBox="0 0 24 24" ${size ? `width="${size}" height="${size}"` : ''} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
    return t.content.firstChild;
  };
  L.logo = (size = 28) => { // two pages joined by a seam (desktop/build/icon.svg)
    const t = document.createElement('template');
    t.innerHTML = `<svg viewBox="0 0 256 256" width="${size}" height="${size}" aria-hidden="true"><polygon points="92,20 184,20 226,62 226,198 92,198" fill="#a9d1f4"/><polygon points="184,20 226,62 184,62" fill="#2f72bd"/><polygon points="30,74 164,74 164,236 72,236 30,194" fill="#a9d1f4"/><polygon points="30,194 72,194 72,236" fill="#2f72bd"/><polygon points="92,74 164,74 164,198 92,198" fill="#5e9fe3"/><polygon points="92,74 118,74 118,108 164,148 164,198 138,198 138,164 92,124" fill="#1f5596"/><g stroke="#fff" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"><line x1="105" y1="80" x2="105" y2="112"/><line x1="151" y1="160" x2="151" y2="194"/></g></svg>`;
    return t.content.firstChild;
  };


  /* ——— Events ——— */
  const bus = {};
  L.on = (ev, fn) => ((bus[ev] ||= []).push(fn), fn);
  L.off = (ev, fn) => { bus[ev] = (bus[ev] || []).filter(f => f !== fn); };
  L.emit = (ev, data) => (bus[ev] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error(ev, e); } });

  /* ——— State ——— */
  let seq = 0;
  L.uid = (p = 'id') => `${p}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  /* Documents. Every open tab is a doc: { id, state, undo[], redo[], view }.
     `L.state` always points at the active doc's state, so tools simply read L.state.
     PDF sources are shared by all docs (pages can be copied between tabs). */
  L.sources = {}; // id -> { id, name, bytes, doc (pdf.js), proxies, text }
  L.freshState = (blade = 'view') => ({
    sources: L.sources,
    pages: [],       // [{ id, src, index, rot, crop, ann:[], ocr, dig }]
    cur: 0,
    sel: new Set(),
    name: '',
    meta: { title: '', author: '', subject: '', keywords: '' },
    stamps: { numbers: null, header: null, footer: null, watermark: null, _v: 2 },
    blade,
    dirty: false,
    fileSize: 0,
  });
  L.docs = [];
  L.doc = null;
  L.state = L.freshState();
  L.newDoc = () => ({ id: L.uid('doc'), state: L.freshState(L.state.blade), undo: [], redo: [], view: { zoom: 'fit-page', top: 0, left: 0 } });
  L.docOf = st => L.docs.find(d => d.state === st) || null;
  // Run fn with `doc` temporarily active (synchronously) — lets a finished background task write into its own tab.
  L.inDoc = (doc, fn) => {
    if (!doc || doc === L.doc) return fn();
    const prevDoc = L.doc, prevState = L.state;
    L.doc = doc; L.state = doc.state; doc.state.blade = prevState.blade;
    try { return fn(); } finally { L.doc = prevDoc; L.state = prevState; }
  };
  L.page = (i = L.state.cur) => L.state.pages[i];
  L.pageIndex = (id, st = L.state) => st.pages.findIndex(p => p.id === id);
  L.hasDoc = () => L.state.pages.length > 0;
  L.selectedPages = () => {
    const s = L.state;
    const sel = s.pages.filter(p => s.sel.has(p.id));
    return sel.length ? sel : (s.pages[s.cur] ? [s.pages[s.cur]] : []);
  };

  /* ——— History (per document) ——— */
  const deep = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
  L.deep = deep;
  const clonePage = p => ({ ...p, crop: p.crop ? { ...p.crop } : null, ann: deep(p.ann), dig: deep(p.dig), fields: deep(p.fields) }); // ocr is immutable, shared
  L.clonePage = clonePage;
  const snapshot = () => ({ pages: L.state.pages.map(clonePage), stamps: deep(L.state.stamps), name: L.state.name, meta: { ...L.state.meta }, cur: L.state.cur, formScript: L.state.formScript || '' });
  const stacks = () => L.doc || { undo: [], redo: [] };
  function restore(snap) {
    const s = L.state;
    s.pages = snap.pages; s.stamps = snap.stamps; s.name = snap.name; s.meta = snap.meta; s.formScript = snap.formScript || '';
    s.cur = Math.min(Math.max(0, snap.cur), s.pages.length - 1);
    s.sel = new Set([...s.sel].filter(id => s.pages.some(p => p.id === id)));
    s.dirty = true;
    L.emit('change', { restore: true });
  }
  L.checkpoint = label => {
    const h = stacks();
    h.undo.push({ label, snap: snapshot() });
    if (h.undo.length > 120) h.undo.shift();
    h.redo.length = 0;
    L.emit('history');
  };
  L.mutate = (label, fn, opts = {}) => {
    L.checkpoint(label);
    const r = fn();
    L.state.dirty = true;
    if (!opts.silent) L.emit('change', { label });
    return r;
  };
  L.undo = () => {
    const h = stacks(), e = h.undo.pop(); if (!e) return;
    h.redo.push({ label: e.label, snap: snapshot() });
    restore(e.snap); L.emit('history'); L.toast(`Undid ${e.label}`, { icon: 'undo' });
  };
  L.redo = () => {
    const h = stacks(), e = h.redo.pop(); if (!e) return;
    h.undo.push({ label: e.label, snap: snapshot() });
    restore(e.snap); L.emit('history'); L.toast(`Redid ${e.label}`, { icon: 'redo' });
  };
  L.canUndo = () => stacks().undo.length > 0;
  L.canRedo = () => stacks().redo.length > 0;
  L.resetHistory = () => { const h = stacks(); h.undo.length = 0; h.redo.length = 0; L.emit('history'); };
  // Sources no page (current or in any undo/redo snapshot of any tab) refers to are released.
  L.collectSources = () => {
    const used = new Set();
    const mark = pages => pages.forEach(p => used.add(p.src));
    for (const d of L.docs) { mark(d.state.pages); [...d.undo, ...d.redo].forEach(e => mark(e.snap.pages)); }
    for (const id of Object.keys(L.sources)) if (!used.has(id)) { try { L.sources[id].doc.destroy(); } catch {} delete L.sources[id]; }
  };

  /* ——— Feedback ——— */
  L.toast = (msg, opts = {}) => {
    const root = L.$('#hud-root');
    const el = L.h('div', { class: 'toast ' + (opts.kind || '') },
      L.icon(opts.icon || (opts.kind === 'err' ? 'warn' : opts.kind === 'ok' ? 'check' : 'info')),
      L.h('span', null, msg),
      opts.action ? L.h('button', { class: 'act', style: { background: 'none', border: 0 }, onclick: () => { opts.action.fn(); el.remove(); } }, opts.action.label) : null);
    root.append(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, opts.ms || 2600);
    return el;
  };
  L.error = (msg, err) => { console.error(msg, err); L.toast(msg + (err && err.message ? ` — ${err.message}` : ''), { kind: 'err', ms: 5200 }); };

  // Long-running work: a quiet HUD with a progress bar and Cancel.
  L.task = (title, { cancellable = true } = {}) => {
    const bar = L.h('div', { style: { width: '0%' } });
    const sub = L.h('div', { class: 't-sub' }, 'Starting…');
    const t = { cancelled: false };
    const el = L.h('div', { class: 'toast task' },
      L.h('div', { class: 't-row' }, L.h('span', null, title), cancellable ? L.h('button', { onclick: () => { t.cancelled = true; sub.textContent = 'Cancelling…'; } }, 'Cancel') : null),
      L.h('div', { class: 'progress' }, bar), sub);
    L.$('#hud-root').append(el);
    t.set = (frac, text) => { if (frac != null) bar.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%'; if (text) sub.textContent = text; };
    t.done = () => el.remove();
    return t;
  };

  // Modal sheet. actions: [{label, primary, danger, value, onClick}] ; resolves with action value (or null on dismiss)
  // wide: true | 'xl' · onKey(e) → true when the sheet handled the key itself · focusPrimary: Enter-ready default button
  L.dialog = ({ title, text, body, actions = [{ label: 'OK', primary: true, value: true }], wide = false, onOpen, onKey: sheetKey, focusPrimary = false }) => new Promise(resolve => {
    const root = L.$('#modal-root');
    let done = false;
    const close = v => { if (done) return; done = true; back.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const foot = L.h('div', { class: 'modal-foot' }, actions.map(a => L.h('button', {
      class: 'btn ' + (a.primary ? 'primary' : '') + (a.danger ? ' danger' : ''),
      onclick: async () => { if (a.onClick) { const r = await a.onClick(); if (r === false) return; } close(a.value ?? a.label); },
    }, a.icon ? L.icon(a.icon) : null, a.label)));
    const modal = L.h('div', { class: 'modal' + (wide === 'xl' ? ' wide xl' : wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' },
      L.h('div', { class: 'modal-head' }, L.h('h3', null, title), text ? L.h('p', null, text) : null),
      body ? L.h('div', { class: 'modal-body' }, body) : null, foot);
    const back = L.h('div', { class: 'modal-backdrop', onmousedown: e => { if (e.target === back) close(null); } }, modal);
    const onKey = e => {
      if (!back.isConnected || back !== root.lastElementChild) return; // only the top-most sheet answers
      if (sheetKey && sheetKey(e) === true) return; // the sheet (or one of its fields) handles this key
      if (e.key === 'Escape') { e.stopPropagation(); close(null); }
      if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') { const p = actions.find(a => a.primary); if (p) { e.preventDefault(); e.stopPropagation(); foot.querySelector('.primary').click(); } }
    };
    document.addEventListener('keydown', onKey, true);
    root.append(back);
    L.closeDialog = close;
    onOpen && onOpen(modal, close);
    const f = focusPrimary ? foot.querySelector('.primary') : modal.querySelector('input,textarea,select'); if (f) setTimeout(() => f.focus(), 30);
  });
  // A small pop-up menu under a button. items: [{ label, icon, kbd, fn, disabled }] or 'sep'
  L.menu = (anchor, items) => {
    L.$('.pop-menu')?.remove();
    const m = L.h('div', { class: 'pop-menu', role: 'menu' }, items.filter(Boolean).map(it => it === 'sep' ? L.h('hr') : L.h('button', {
      role: 'menuitem', disabled: !!it.disabled, onclick: () => { m.remove(); it.fn(); },
    }, it.icon ? L.icon(it.icon) : L.h('span', { class: 'ic-sp' }), L.h('span', { class: 'grow' }, it.label), it.kbd ? L.h('kbd', null, it.kbd) : null)));
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = r.bottom + 6 + 'px';
    m.style.left = L.clamp(r.right - m.offsetWidth, 8, innerWidth - m.offsetWidth - 8) + 'px';
    const off = e => { if (e.type === 'keydown' ? e.key === 'Escape' : !m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); document.removeEventListener('keydown', off, true); } };
    setTimeout(() => { document.addEventListener('pointerdown', off, true); document.addEventListener('keydown', off, true); });
    m.querySelector('button:not([disabled])')?.focus();
    return m;
  };
  L.confirm = (title, text, label = 'Continue', danger = false) =>
    L.dialog({ title, text, actions: [{ label: 'Cancel', value: false }, { label, primary: !danger, danger, value: true }] });

  /* ——— Files ——— */
  L.fmtBytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB` : `${(n / 1048576).toFixed(n < 10485760 ? 2 : 1)} MB`;
  L.readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result)); r.onerror = rej; r.readAsArrayBuffer(f); });
  L.safeName = s => (s || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150) || 'Untitled';
  L.download = (data, filename, mime = 'application/octet-stream') => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = L.h('a', { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  // Prefer a real "Save As…" sheet where the browser offers one (Chrome / Edge); fall back to a download.
  L.saveFile = async (data, filename, mime, ext) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    if (window.showSaveFilePicker && window.top === window) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: ext.toUpperCase() + ' file', accept: { [mime]: ['.' + ext] } }] });
        const w = await handle.createWritable(); await w.write(blob); await w.close();
        return handle.name;
      } catch (e) { if (e.name === 'AbortError') return null; }
    }
    L.download(blob, filename, mime);
    return filename;
  };
  L.copyText = async text => {
    try { await navigator.clipboard.writeText(text); L.toast('Copied to clipboard', { kind: 'ok' }); }
    catch { const t = L.h('textarea', { value: text, style: { position: 'fixed', opacity: 0 } }); document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); L.toast('Copied to clipboard', { kind: 'ok' }); }
  };
  const loaded = {};
  L.loadScript = src => loaded[src] ||= new Promise((res, rej) => {
    const s = L.h('script', { src }); s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src.split('/').pop() + ' — are you online?')); };
    document.head.append(s);
  });
  L.LIBS = {
    tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    xlsxStyle: 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js', // SheetJS + cell styles (fills, borders, bold)
  };

  /* ——— Small utilities ——— */
  L.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  L.sleep = ms => new Promise(r => setTimeout(r, ms));
  L.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  L.MM = 72 / 25.4;
  L.hexToRgb = hex => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  // Standard PDF fonts only speak WinAnsi; map common typography and drop what can't be encoded.
  L.winAnsi = s => String(s ?? '')
    .replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"').replace(/[–—]/g, '-')
    .replace(/…/g, '...').replace(/[  -​]/g, ' ').replace(/\r/g, '')
    .replace(/[^\n\x20-\x7E¡-ÿ€•]/g, '');
  // Parse "1-3, 5, 8-" into zero-based page indices.
  L.parseRanges = (str, n) => {
    const out = [];
    for (const part of String(str).split(/[,;\s]+/).filter(Boolean)) {
      const m = part.match(/^(\d*)\s*[-–]\s*(\d*)$/);
      if (m) { const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : n; for (let i = a; i <= b; i++) if (i >= 1 && i <= n) out.push(i - 1); }
      else if (/^\d+$/.test(part)) { const i = +part; if (i >= 1 && i <= n) out.push(i - 1); }
    }
    return out;
  };
  // Inspector building blocks
  L.ui = {
    section: (label, ...kids) => L.h('div', { class: 'section' }, label ? L.h('span', { class: 'label' }, label) : null, ...kids),
    field: (label, input) => L.h('label', { class: 'field' }, L.h('span', null, label), input),
    seg: (options, value, onChange) => {
      const el = L.h('div', { class: 'segmented' });
      for (const o of options) el.append(L.h('button', {
        class: o.value === value ? 'on' : '', title: o.title || '',
        onclick: () => { L.$$('button', el).forEach(b => b.classList.remove('on')); btnMap.get(o.value).classList.add('on'); onChange(o.value); },
      }, o.icon ? L.icon(o.icon) : null, o.label || null));
      const btnMap = new Map(options.map((o, i) => [o.value, el.children[i]]));
      return el;
    },
    btn: (label, icon, onclick, cls = '') => L.h('button', { class: 'btn ' + cls, onclick }, icon ? L.icon(icon) : null, label),
    callout: (html, kind = '', icon = 'info') => L.h('div', { class: 'callout ' + kind }, L.icon(icon), L.h('div', { html })),
    select: (options, value, onChange) => L.h('select', { class: 'input', onchange: e => onChange(e.target.value) },
      options.map(o => L.h('option', { value: o.value ?? o, selected: (o.value ?? o) === value }, o.label ?? o))),
    num: (value, onChange, attrs = {}) => L.h('input', { class: 'input num', type: 'number', value, step: 'any', ...attrs, onchange: e => onChange(parseFloat(e.target.value)) }),
    check: (label, value, onChange) => L.h('label', { class: 'check' }, L.h('input', { type: 'checkbox', checked: !!value, onchange: e => onChange(e.target.checked) }), L.h('span', null, label)),
    head: (icon, title, text) => L.h('div', { class: 'insp-head' }, L.h('h2', null, L.icon(icon), title), text ? L.h('p', null, text) : null),
  };
  L.COLORS = ['#1d1d1f', '#e5484d', '#f76b15', '#ffc53d', '#30a46c', '#0090ff', '#8e4ec6', '#ffffff'];
  L.swatches = (value, onChange, colors = L.COLORS) => {
    const el = L.h('div', { class: 'swatches' });
    const paint = v => L.$$('.swatch', el).forEach(b => b.classList.toggle('on', b.dataset.c === v));
    for (const c of colors) el.append(L.h('button', { class: 'swatch', 'data-c': c, style: { background: c }, title: c, onclick: () => { paint(c); onChange(c); } }));
    el.append(L.h('label', { class: 'swatch custom', title: 'Custom colour' }, L.h('input', { type: 'color', value, oninput: e => { paint(null); onChange(e.target.value); } })));
    paint(value);
    return el;
  };
})();
