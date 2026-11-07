/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito app shell: opening files, toolbar, welcome, keyboard, drag & drop, wiring events to the views. */
(() => {
  const L = window.Loeito, h = L.h;
  let pendingBlade = null;

  /* ——— Opening & adding files ——— */
  const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  const isImg = f => /^image\/(png|jpe?g)$/.test(f.type) || /\.(png|jpe?g)$/i.test(f.name);
  const isOffice = f => /\.(docx?|docm|rtf|odt|xlsx?|xlsm|ods|pptx?|odp)$/i.test(f.name);
  // The desktop app (or the local server) converts Office files with Microsoft Office or LibreOffice on this computer.
  L.server = null;
  L.serverReady = (location.protocol.startsWith('http') ? fetch('/api/status').then(r => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null)).then(s => (L.server = s));
  L.convertOffice = (f, t) => convertOffice(f, t);
  async function convertOffice(f, t) {
    const srv = await L.serverReady;
    if (!srv || !srv.office) {
      const desktop = srv && srv.desktop;
      await L.dialog({ title: `Open “${f.name}”`,
        text: srv ? 'To open Word, Excel, PowerPoint and OpenDocument files, Loeito uses Microsoft Office or the free LibreOffice on this computer — neither was found.'
          : 'The browser version can’t open Word, Excel or PowerPoint files yet. The Loeito desktop app can, using Microsoft Office or the free LibreOffice on your computer.',
        body: L.h('div', { class: 'stack', style: { gap: '8px' } },
          L.h('p', { class: 'muted', style: { margin: 0 } }, srv ? (desktop ? 'Install LibreOffice (libreoffice.org, free), then try again.' : 'Install Microsoft Office or LibreOffice (libreoffice.org, free), then start Loeito again.')
            : 'Get the desktop app from the Download page, and install LibreOffice (free, libreoffice.org) if you don’t have Microsoft Office.'),
          L.h('p', { class: 'muted', style: { margin: 0 } }, 'For now: in Word, Excel or LibreOffice choose File → Save As → PDF, then open that PDF here. Loeito finds the form fields for you.')),
        actions: [{ label: 'OK', primary: true }] });
      return null;
    }
    t && t.set(0.2, `Converting ${f.name}…`);
    const res = await fetch(`/api/convert?name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'X-Loeito': '1' }, body: await L.readFile(f) });
    if (!res.ok) { let msg = res.statusText; try { msg = (await res.json()).error || msg; } catch {} throw new Error(msg); }
    return new Uint8Array(await res.arrayBuffer());
  }
  // Opening never disturbs an open document: each file gets its own tab.
  // `append` instead inserts the files' pages into the active document (Add files / drop on the page list).
  L.openFiles = async (files, { append = false, beforeId = null } = {}) => {
    files = [...files].filter(f => isPdf(f) || isImg(f) || isOffice(f));
    if (!files.length) return L.toast('Loeito opens PDFs, images, and Word / Excel / PowerPoint files.', { kind: 'err' });
    append = append && L.hasDoc();
    const t = files.length > 1 || files[0].size > 8e6 || files.some(isOffice) ? L.task('Opening', { cancelable: false }) : null;
    const loaded = []; // [{ file, pages, size, pdfDoc }]
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]; t && t.set(i / files.length, f.name);
        try {
          let bytes, office = false;
          if (isOffice(f)) { bytes = await convertOffice(f, t); if (!bytes) continue; office = true; }
          else bytes = await L.readFile(f);
          const size = bytes.length;
          if (isImg(f)) bytes = new Uint8Array(await L.imageToPdf(bytes, f.type || (/png$/i.test(f.name) ? 'image/png' : 'image/jpeg')));
          const src = await L.addSource(bytes, office ? f.name.replace(/\.[a-z]+$/i, '.pdf') : f.name);
          const pages = Array.from({ length: src.count }, (_, k) => L.newPage(src.id, k));
          const formFields = isPdf(f) && L.forms ? await L.forms.importFromPdf(src.id, pages) : 0; // an existing fillable form
          loaded.push({ file: f, size, pdfDoc: isPdf(f) || office ? src.doc : null, pages, office, formFields });
        } catch (e) { L.error(`Couldn’t open “${f.name}”`, e); }
      }
    } finally { t && t.done(); }
    if (!loaded.length) return;
    if (append) {
      const s = L.state, added = loaded.flatMap(x => x.pages);
      L.mutate(`add ${added.length} page${added.length > 1 ? 's' : ''}`, () => {
        let at = beforeId ? L.pageIndex(beforeId) : s.pages.length; if (at < 0) at = s.pages.length;
        s.pages.splice(at, 0, ...added); s.cur = at; s.fileSize += loaded.reduce((a, x) => a + x.size, 0);
      });
      L.toast(`Added ${added.length} page${added.length > 1 ? 's' : ''}`, { kind: 'ok' });
      return;
    }
    // Several images dropped together become one document; PDFs each get a tab.
    const groups = loaded.every(x => !x.pdfDoc) && loaded.length > 1 ? [loaded] : loaded.map(x => [x]);
    let last = null;
    for (const g of groups) {
      const doc = L.newDoc(), s = doc.state;
      s.pages = g.flatMap(x => x.pages);
      s.name = L.safeName(g.length > 1 ? 'Images' : g[0].file.name.replace(/\.[a-z0-9]{2,4}$/i, ''));
      s.fileSize = g.reduce((a, x) => a + x.size, 0);
      if (g[0].pdfDoc) try { const { info } = await g[0].pdfDoc.getMetadata(); s.meta = { title: info.Title || '', author: info.Author || '', subject: info.Subject || '', keywords: info.Keywords || '', creator: info.Creator || '', lang: info.Language || '' }; } catch {}
      await L.proxy(s.pages[0]);
      // where it came from — what Save writes back to (a converted Office file is never overwritten with a PDF)
      if (g.length === 1 && L.files) doc.origin = L.files.originOf(g[0].file, g[0].office ? 'converted' : isImg(g[0].file) ? 'image' : 'pdf');
      L.docs.push(doc); last = doc;
      setTimeout(() => L.emit('opened', doc), 400);
      if (g[0].formFields) L.toast(`This PDF is a fillable form — ${g[0].formFields} fields. Fill it in or change it in Forms.`, { icon: 'form', ms: 7000, action: { label: 'Open Forms', fn: () => { L.switchDoc(doc); L.setBlade('forms'); } } });
      if (g[0].office) L.toast(`Converted “${g[0].file.name}” with Microsoft Office. Turn its blanks into fillable fields?`, { icon: 'form', ms: 9000, action: { label: 'Find fields', fn: () => { L.switchDoc(doc); L.setBlade('forms'); L.formsUI.detectNow(); } } });
    }
    document.body.classList.add('has-doc');
    L.switchDoc(last);
    if (pendingBlade) { L.setBlade(pendingBlade); pendingBlade = null; }
    if (groups.length > 1) L.toast(`Opened ${groups.length} documents in tabs`, { kind: 'ok' });
  };
  L.pickFiles = (append = false) => L.files.open({ append: append && L.hasDoc() });

  /* ——— Chrome ——— */
  function buildToolbar() {
    L.$('#btn-sidebar').append(L.icon('sidebar'));
    L.$('#brand-mark').append(L.logo(28));
    L.$('#btn-undo').append(L.icon('undo')); L.$('#btn-redo').append(L.icon('redo'));
    L.$('#btn-search').append(L.icon('search')); L.$('#search-ic').append(L.icon('search'));
    L.$('#btn-help').append(L.icon('help')); L.$('#btn-help').onclick = e => L.openHelp(e.currentTarget);
    L.$('#btn-save .ic').append(L.icon('save'));
    L.$('#btn-add-files').append(L.icon('plus'));
    L.$('#btn-prev').append(L.icon('left')); L.$('#btn-next').append(L.icon('right'));
    L.$('#btn-zoom-in').append(L.icon('plus')); L.$('#btn-zoom-out').append(L.icon('minus'));
    for (const [t, ic] of [['select', 'cursor'], ['text', 'ibeam'], ['hand', 'hand']]) L.$(`#hud-tools [data-tool="${t}"]`).append(L.icon(ic));
    const nav = L.$('#blades');
    for (const b of L.blades) nav.append(h('button', { class: 'blade', 'data-blade': b.id, title: b.desc, onclick: () => { if (L.hasDoc()) L.setBlade(b.id); else { pendingBlade = b.id; L.pickFiles(false); } } }, L.icon(b.icon), h('span', null, b.label)));
    L.$('#btn-sidebar').onclick = () => { const ws = L.$('#workspace'); if (ws.classList.contains('grid-nosb')) return L.showSidebarAnyway(); ws.classList.toggle('no-sidebar'); };
    L.$('#doc-title').onclick = () => (L.hasDoc() ? L.openNameSheet() : L.pickFiles());
    L.$('#btn-undo').onclick = L.undo; L.$('#btn-redo').onclick = L.redo;
    L.$('#btn-search').onclick = () => (L.$('#search-pop').hidden ? L.openSearch() : L.closeSearch());
    L.$('#btn-save').onclick = () => L.save();
    L.$('#btn-save-more').append(L.icon('down', 14));
    L.$('#btn-save-more').onclick = e => {
      const o = L.doc?.origin;
      L.menu(e.currentTarget, [
        { label: 'Save', icon: 'save', kbd: 'Ctrl S', fn: () => L.save() },
        { label: 'Save As…', icon: 'folder', kbd: 'Ctrl ⇧ S', fn: () => L.saveAs() },
        { label: 'Save a copy for sharing…', icon: 'shield', fn: () => L.saveAs({ clean: true }) },
        o && o.path && L.fs.on() ? { label: 'Show in folder', icon: 'external', fn: () => L.fs.reveal(o.path) } : null,
        'sep',
        { label: 'Open…', icon: 'upload', kbd: 'Ctrl O', fn: () => L.pickFiles(false) },
        { label: 'Merge with other files…', icon: 'merge', fn: () => L.openMerge({ withCurrent: true }) },
      ]);
    };
    L.$('#btn-add-files').onclick = () => L.pickFiles(true);
    L.$('#btn-prev').onclick = () => L.go(L.state.cur - 1);
    L.$('#btn-next').onclick = () => L.go(L.state.cur + 1);
    L.$('#btn-zoom-in').onclick = () => L.zoomStep(1);
    L.$('#btn-zoom-out').onclick = () => L.zoomStep(-1);
    L.$('#zoom-label').onclick = () => L.zoomMenu();
    const pin = L.$('#page-input');
    pin.addEventListener('change', () => { const n = parseInt(pin.value, 10); if (n) L.go(n - 1); pin.value = L.state.cur + 1; });
    pin.addEventListener('keydown', e => { if (e.key === 'Enter') pin.blur(); e.stopPropagation(); });
  }
  function buildWelcome() {
    L.$('#hero-mark').append(L.logo(84));
    L.$('#dz-icon').append(L.icon('upload'));
    const dz = L.$('#dropzone');
    dz.onclick = () => L.pickFiles(false);
    dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); L.pickFiles(false); } };
    const grid = L.$('#blade-grid');
    grid.before(h('button', { class: 'wfind', type: 'button', onclick: () => L.openPalette() }, L.icon('search', 16), h('span', null, 'Search tools and commands…'), h('kbd', null, 'Ctrl K')));
    grid.addEventListener('keydown', e => {
      const cards = [...grid.querySelectorAll('.bcard')], i = cards.indexOf(document.activeElement);
      if (i < 0 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const j = { ArrowLeft: i - 1, ArrowRight: i + 1, ArrowUp: i - cols, ArrowDown: i + cols, Home: 0, End: cards.length - 1 }[e.key];
      if (cards[j]) { e.preventDefault(); cards[j].focus(); }
    });
    grid.append(h('button', { class: 'bcard merge-card', style: { border: 0, font: 'inherit', textAlign: 'left' }, onclick: () => L.openMerge() },
      h('span', { class: 'bi', style: { background: '#0071e3' } }, L.icon('merge')), h('b', null, 'Merge PDFs'), h('span', null, 'Pick files, arrange pages, one click to merge, save and open.')));
    for (const b of L.blades.filter(b => b.id !== 'view')) {
      grid.append(h('button', { class: 'bcard', style: { border: 0, font: 'inherit', textAlign: 'left' }, onclick: () => { pendingBlade = b.id; L.pickFiles(false); } },
        h('span', { class: 'bi', style: { background: b.color } }, L.icon(b.icon)), h('b', null, b.label === 'Searchable' ? 'Make Searchable' : b.label), h('span', null, b.desc)));
    }
    grid.append(h('button', { class: 'bcard', style: { border: 0, font: 'inherit', textAlign: 'left' }, onclick: () => { pendingBlade = 'view'; L.pickFiles(false); } },
      h('span', { class: 'bi', style: { background: '#ff375f' } }, L.icon('sparkles')), h('b', null, 'Smart Name'), h('span', null, 'Suggests a clear, findable file name from the content.')));
    grid.append(h('button', { class: 'bcard', style: { border: 0, font: 'inherit', textAlign: 'left' }, onclick: () => L.openFormTemplates() },
      h('span', { class: 'bi', style: { background: '#30a46c' } }, L.icon('template')), h('b', null, 'Form templates'), h('span', null, 'Ten ready forms — registration, invoice, leave, survey… Make one your own.')));
  }
  // Recently opened files (needs the local server to reopen them by path).
  function paintRecent() {
    const box = L.$('#recent'), list = L.fs.on() ? L.files.recentFiles().slice(0, 6) : [];
    box.hidden = !list.length;
    const ago = t => { const d = (Date.now() - t) / 864e5; return d < 1 ? 'Today' : d < 2 ? 'Yesterday' : new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
    box.replaceChildren(h('div', { class: 'recent-head' }, 'Recent'), ...list.map(r => h('button', { class: 'recent-item', title: r.path, onclick: () => L.files.openPaths([r.path]) },
      L.icon('doc'), h('span', { class: 'grow' }, h('b', null, r.name), h('small', null, L.path.dir(r.path))), h('span', { class: 'muted tiny' }, ago(r.t)))));
  }
  function updateChrome() {
    const s = L.state, has = L.hasDoc();
    L.$('#doc-name').textContent = has ? s.name : 'Loeito';
    L.$('#doc-sub').textContent = has ? `${s.pages.length} page${s.pages.length === 1 ? '' : 's'}${s.dirty ? ' · Edited' : ''}` : '';
    document.title = has ? `${s.name}${s.dirty ? ' •' : ''} — Loeito` : 'Loeito — PDF, just right';
    L.$$('.blade').forEach(b => { b.classList.toggle('active', has && b.dataset.blade === s.blade); b.classList.toggle('idle', !has); b.disabled = false; });
    L.$('#btn-save').disabled = !has; L.$('#btn-search').disabled = !has;
    L.$('#btn-undo').disabled = !L.canUndo(); L.$('#btn-redo').disabled = !L.canRedo();
    L.$('#page-input').value = has ? s.cur + 1 : '';
    L.$('#page-total').textContent = `/ ${s.pages.length}`;
    L.$('#btn-prev').disabled = s.cur <= 0; L.$('#btn-next').disabled = s.cur >= s.pages.length - 1;
  }

  /* ——— Event wiring ——— */
  L.on('change', () => { if (!L.hasDoc()) return; L.renderThumbs(); L.render(); L.renderInspector(); updateChrome(); });
  L.on('page', () => { L.renderThumbs(); L.render(); const b = L.blade(); if (b && b.onPage) b.onPage(); else L.renderInspector(); updateChrome(); L.scrollThumbIntoView(); });
  L.on('select', () => { L.renderThumbs(); });
  L.on('blade', () => { updateChrome(); L.renderInspector(); L.render(); });
  L.on('history', updateChrome);
  L.on('docs', () => { updateChrome(); if (L.hasDoc() && L.state.blade === 'pages') L.renderInspector(); });
  L.on('cleared', () => { L.$('#thumbs').replaceChildren(); L.$('#inspector').replaceChildren(); L.$('#grid-view').hidden = true; L.$('#sheet').hidden = false; L.$('#stage-hud').hidden = false; document.body.classList.remove('has-doc'); updateChrome(); });

  /* ——— Keyboard ——— */
  function onKey(e) {
    if (L.$('#modal-root').children.length) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), typing = !!e.target.closest('input,textarea,[contenteditable="true"]');
    if (mod && k === 'o') { e.preventDefault(); return L.pickFiles(false); }
    if (e.key === '?' && !typing && !mod) { e.preventDefault(); return L.showShortcuts(); }
    if (!L.hasDoc()) return;
    if (mod && k === 's') { e.preventDefault(); return e.shiftKey ? L.saveAs() : L.save(); }
    if (mod && k === 'f') { e.preventDefault(); return L.openSearch(); }
    if (mod && !typing && (k === 'z' || k === 'y')) { e.preventDefault(); return (k === 'y' || e.shiftKey) ? L.redo() : L.undo(); }
    if (mod && (k === '=' || k === '+')) { e.preventDefault(); return L.zoomStep(1); }
    if (mod && k === '-') { e.preventDefault(); return L.zoomStep(-1); }
    if (mod && k === '0') { e.preventDefault(); const z = L.viewer.zoom === 'fit-width' ? 'fit-page' : 'fit-width'; return L.readerActive && L.readerActive() ? L.readerFit(z) : L.setZoom(z); }
    if (e.key === ' ' && !typing && !mod && !(L.readerActive && L.readerActive())) { e.preventDefault(); if (!e.repeat) L.setSpacePan(true); return; }
    if (mod && (k === 'r' || k === 'l') && !e.shiftKey) { e.preventDefault(); return L.rotateSelected(k === 'r' ? 90 : -90); }
    if (mod && k === '\\') { e.preventDefault(); return L.$('#workspace').classList.toggle('no-sidebar'); }
    if (e.key === 'Escape' && !L.$('#search-pop').hidden) { e.preventDefault(); return L.closeSearch(); }
    const b = L.blade();
    if (b && b.key && b.key(e)) { e.preventDefault(); return; }
    if (typing || mod) return;
    if (e.key.toLowerCase() === 'f' && !e.altKey) { e.preventDefault(); return L.toggleFocus(); }
    const tool = { v: 'select', t: 'text', h: 'hand' }[e.key.toLowerCase()];
    if (tool && !e.altKey) { e.preventDefault(); return L.setTool(tool); }
    if (L.readerActive && L.readerActive()) { // the reader scrolls natively; ← → turn whole pages
      if (e.key === 'ArrowRight') { e.preventDefault(); L.go(L.state.cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); L.go(L.state.cur - 1); }
      if (e.key === 'Home') { e.preventDefault(); L.go(0); } if (e.key === 'End') { e.preventDefault(); L.go(L.state.pages.length - 1); }
      return;
    }
    if (['ArrowRight', 'PageDown', 'ArrowDown'].includes(e.key) && !(e.key === 'ArrowDown' && stageScrollable())) { e.preventDefault(); L.go(L.state.cur + 1); }
    if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key) && !(e.key === 'ArrowUp' && stageScrollable())) { e.preventDefault(); L.go(L.state.cur - 1); }
    if (e.key === 'Home') L.go(0); if (e.key === 'End') L.go(L.state.pages.length - 1);
  }
  const stageScrollable = () => { const s = L.$('#stage'); return s.scrollHeight > s.clientHeight + 4; };

  /* ——— Drag & drop files ——— */
  function wireDrop() {
    let depth = 0;
    const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
    window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; depth++; L.$('#dropzone').classList.add('over'); });
    window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (--depth <= 0) { depth = 0; L.$('#dropzone').classList.remove('over'); } });
    window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', async e => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; L.$('#dropzone').classList.remove('over');
      // onto the page list / grid → insert into this document; anywhere else → open in a new tab
      const into = e.target.closest && e.target.closest('#thumbs, #grid-view');
      const thumb = e.target.closest && e.target.closest('.thumb, .gcard');
      // Edge / Chrome hand over a file handle too, so Save can write back into the dropped file (asked only during the drop)
      const files = [...e.dataTransfer.files];
      const handles = [...e.dataTransfer.items].filter(it => it.kind === 'file').map(it => (it.getAsFileSystemHandle ? it.getAsFileSystemHandle().catch(() => null) : null));
      (await Promise.all(handles)).forEach((hd, i) => { if (hd && hd.kind === 'file' && files[i]) files[i].loeitoHandle = hd; });
      L.openFiles(files, { append: !!into && L.hasDoc(), beforeId: thumb ? thumb.dataset.id : null });
    });
  }

  /* ——— Boot ——— */
  function boot() {
    buildToolbar(); buildWelcome(); L.initViewer(); L.initReader(); wireDrop();
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', e => { if (e.key === ' ') L.setSpacePan(false); });
    window.addEventListener('blur', () => L.setSpacePan(false));
    window.addEventListener('beforeunload', e => { if (L.docs.some(d => d.state.dirty)) { e.preventDefault(); e.returnValue = ''; } });
    updateChrome();
    L.serverReady.then(paintRecent); L.on('recent', paintRecent); L.on('cleared', paintRecent);
    if (!window.PDFLib || !window.pdfjsLib) L.toast('Loeito needs an internet connection the first time it starts (to load its PDF engine).', { kind: 'err', ms: 9000 });
  }
  boot();
})();
