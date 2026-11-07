/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Read blade: a calm, continuous reader — themes, focus mode, contents, read-aloud, plus the document's facts. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;
  let refs = {};

  function listenBox() {
    const box = h('div', { class: 'stack' });
    const paint = () => {
      const SP = L.speech, on = SP.on;
      const voices = L.voices().filter(v => /^en|^ur|^ar|^de|^fr|^es|^sv/i.test(v.lang) || v.voiceURI === SP.voice);
      box.replaceChildren(
        h('div', { class: 'grid3' },
          ui.btn(on ? 'Restart' : 'Play', 'play', () => L.speakFrom(L.state.cur), on ? '' : 'primary'),
          ui.btn(SP.paused ? 'Resume' : 'Pause', 'pause', () => L.pauseSpeaking(), on ? '' : 'ghost'),
          ui.btn('Stop', 'stop', () => L.stopSpeaking(), on ? '' : 'ghost')),
        voices.length ? ui.field('Voice', ui.select([{ value: '', label: 'System default' }, ...voices.map(v => ({ value: v.voiceURI, label: `${v.name} (${v.lang})` }))], SP.voice, v => L.setVoice(v))) : null,
        h('div', { class: 'field' }, h('span', null, `Speed · ${SP.rate.toFixed(2)}×`),
          h('input', { type: 'range', min: 0.6, max: 1.8, step: 0.05, value: SP.rate, oninput: e => { L.setSpeechRate(+e.target.value); e.target.previousSibling.textContent = `Speed · ${(+e.target.value).toFixed(2)}×`; } })));
    };
    paint();
    refs.paintListen = paint;
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => refs.paintListen && refs.paintListen();
    return box;
  }
  L.on('speech', () => { if (L.state.blade === 'view' && refs.paintListen) refs.paintListen(); });

  function contentsBox() {
    const box = h('div', { class: 'outline' }, h('button', { disabled: true }, 'Reading contents…'));
    L.readerOutline().then(items => {
      refs.outline = items;
      if (!items.length) { box.replaceWith(h('p', { class: 'muted', style: { margin: 0 } }, 'This PDF has no table of contents.')); return; }
      box.replaceChildren(...items.filter(it => it.page >= 0 || it.depth === 0).map(it => h('button', {
        style: { paddingLeft: 10 + it.depth * 14 + 'px' }, 'data-page': it.page, onclick: () => it.page >= 0 && L.go(it.page),
      }, h('span', null, it.title), h('span', { class: 'pg' }, it.page >= 0 ? it.page + 1 : ''))));
      markOutline();
    });
    refs.outlineBox = box;
    return box;
  }
  function markOutline() {
    if (!refs.outlineBox || !refs.outline) return;
    const cur = L.state.cur; let best = null;
    for (const b of refs.outlineBox.children) { const p = +b.dataset.page; if (p >= 0 && p <= cur) best = b; b.classList.remove('cur'); }
    best && best.classList.add('cur');
  }
  function pageFacts() {
    const s = L.state, page = L.page(), proxy = page && L.proxySync(page);
    const v = proxy && L.makeView(proxy, page, 1);
    const paper = v && Object.entries(L.PAPER).find(([, [w, hh]]) => (Math.abs(w - v.width) < 4 && Math.abs(hh - v.height) < 4) || (Math.abs(hh - v.width) < 4 && Math.abs(w - v.height) < 4));
    const textEl = h('dd', null, '…');
    if (page) L.pdfTextItems(page).then(items => {
      const n = items.reduce((a, it) => a + it.t.trim().length, 0);
      textEl.textContent = page.ocr ? 'Searchable (OCR)' : n > 20 ? `Has text (${n.toLocaleString()} chars)` : 'Image only — run OCR';
    });
    return h('dl', { class: 'kv' },
      h('dt', null, 'Page'), h('dd', null, `${s.cur + 1} of ${s.pages.length}`),
      h('dt', null, 'Size'), h('dd', null, v ? `${(v.width / L.MM).toFixed(0)} × ${(v.height / L.MM).toFixed(0)} mm${paper ? ' · ' + paper[0] : ''}` : '—'),
      h('dt', null, 'Text'), textEl,
      h('dt', null, 'File'), h('dd', null, L.fmtBytes(s.fileSize || 0)));
  }

  L.registerBlade({
    id: 'view', label: 'Read', icon: 'book', color: '#8e8e93',
    desc: 'A calm reader: continuous scrolling, selectable text, themes, focus mode, read-aloud.',
    activate() { L.setCursor(''); L.readerShow(true); },
    deactivate() { L.readerShow(false); refs = {}; },
    onPage() { if (refs.facts) refs.facts.replaceChildren(pageFacts()); markOutline(); },
    key(e) {
      if (e.target.closest('input,textarea,select')) return;
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) { L.toggleFocus(); return true; }
      if (e.key === 'Escape' && L.reader.focus) { L.toggleFocus(false); return true; }
    },
    inspector() {
      const R = L.reader;
      refs.facts = h('div', null, pageFacts());
      return [
        ui.head('book', 'Read', 'Scroll through the whole document. Select text to copy it.'),
        h('div', { class: 'section' },
          h('button', { class: 'btn primary block lg', onclick: () => L.toggleFocus(true) }, L.icon('focus'), 'Focus mode'),
          h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Just you and the page. Press F to enter, Esc to leave; ← → turn pages.')),
        ui.section('Appearance',
          h('div', { class: 'read-theme' }, [['paper', 'Paper', '#fff', '#111'], ['sepia', 'Sepia', '#f1e5c8', '#5b4636'], ['night', 'Night', '#1c1c1e', '#ddd']].map(([t, label, bg, fg]) =>
            h('button', { class: R.theme === t ? 'on' : '', style: { background: bg, color: fg }, onclick: () => { L.readerTheme(t); L.renderInspector(); } }, h('b', null, 'Aa'), label))),
          h('div', { class: 'grid2', style: { marginTop: '10px' } },
            ui.seg([{ value: 'single', icon: 'single', title: 'One page at a time' }, { value: 'spread', icon: 'spread', title: 'Two pages side by side' }], R.layout, v => L.readerLayout(v)),
            ui.seg([{ value: 'fit-width', label: 'Width', title: 'Fit width' }, { value: 'fit-page', label: 'Page', title: 'Fit whole page' }], typeof R.zoom === 'string' ? R.zoom : '', v => L.readerFit(v)))),
        ui.section('Listen', listenBox()),
        ui.section('Contents', contentsBox()),
        ui.section('This page', refs.facts),
        ui.section('Text',
          h('div', { class: 'stack' },
            ui.btn('Copy text of this page', 'copy', async () => L.copyText(await L.pageText(L.page())), 'block'),
            ui.btn('Export all text (.txt)', 'download', async () => {
              const t = L.task('Collecting text', { cancelable: false }), s = L.state;
              try { const text = await L.documentText(s.pages, s); await L.saveFile(new Blob([text], { type: 'text/plain' }), L.safeName(s.name) + '.txt', 'text/plain', 'txt'); }
              finally { t.done(); }
            }, 'block'),
            ui.btn('Name & details…', 'sparkles', () => L.openNameSheet(), 'block'))),
        ui.section('Shortcuts',
          h('dl', { class: 'kv tiny' },
            h('dt', null, 'Focus mode'), h('dd', null, 'F / Esc'), h('dt', null, 'Find'), h('dd', null, 'Ctrl F'),
            h('dt', null, 'Next / previous page'), h('dd', null, '→ ←'), h('dt', null, 'Scroll'), h('dd', null, 'Space / ↑ ↓'),
            h('dt', null, 'Zoom'), h('dd', null, 'Ctrl + / − / 0, Ctrl-wheel'), h('dt', null, 'Rotate'), h('dd', null, 'Ctrl L / Ctrl R'))),
      ];
    },
  });
})();
