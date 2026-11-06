/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Merge workspace: pick files (in click order), see them, reorder files and pages, move / copy / rotate pages
   between files, then one click merges, saves and opens the result. A full-window view with gentle motion. */
(() => {
  const L = window.Loeito, h = L.h;
  const M = (L.merge = { open: false, files: [], sel: new Set(), clip: null, undo: [], folder: null, name: '', busy: false });
  const page = (src, index, rot = 0) => { const p = L.newPage(src, index); p.rot = rot; return p; };
  const copyPage = p => ({ ...L.clonePage(p), id: L.uid('p') });
  const allPages = () => M.files.flatMap(f => f.pages);
  const fileOf = p => M.files.find(f => f.pages.includes(p));
  let root = null, hoverT = 0;

  // Sources used here must survive tabs being closed meanwhile.
  const collect = L.collectSources;
  L.collectSources = () => { if (!M.open) collect(); };

  /* ——— history (Ctrl Z inside the workspace) ——— */
  const snap = () => M.files.map(f => ({ f, open: f.open, pages: f.pages.map(p => ({ ...p })) }));
  const remember = () => { M.undo.push(snap()); if (M.undo.length > 80) M.undo.shift(); };
  function undo() {
    const s = M.undo.pop(); if (!s) return;
    M.files = s.map(x => Object.assign(x.f, { open: x.open, pages: x.pages }));
    M.sel.clear(); paint();
  }

  /* ——— picking & loading ——— */
  const pdfDate = d => { const m = String(d || '').match(/D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?/); return m ? new Date(+m[1], (+m[2] || 1) - 1, +m[3] || 1, +m[4] || 0, +m[5] || 0) : null; };
  async function pick() {
    if (L.fs.on()) {
      const res = await L.files.sheet({ mode: 'open', title: M.files.length ? 'Add files to merge' : 'Choose the files to merge', text: 'Click them in the order you want — Ctrl-click to pick several.' });
      if (res === 'native') return nativePick();
      if (!res) return [];
      const out = [];
      for (const p of res.paths) { try { const f = new File([await L.fs.read(p)], L.path.base(p), { type: /\.pdf$/i.test(p) ? 'application/pdf' : '' }); f.loeitoPath = p; out.push(f); L.files.remember(p); } catch (e) { L.error(`Couldn’t read “${L.path.base(p)}”`, e); } }
      return out;
    }
    return nativePick();
  }
  const nativePick = () => new Promise(res => {
    const inp = h('input', { type: 'file', multiple: true, accept: 'application/pdf,.pdf,image/png,image/jpeg,.doc,.docx,.rtf,.odt,.xls,.xlsx,.ods,.ppt,.pptx,.odp' });
    inp.onchange = () => res([...inp.files]); inp.click();
  });
  const OFFICE = /\.(docx?|docm|rtf|odt|xlsx?|xlsm|ods|pptx?|odp)$/i, IMG = /\.(png|jpe?g)$/i;
  // at: 'end' (default), 'start', or an index among the files
  async function add(files, { at = 'end' } = {}) {
    files = [...files].filter(f => /\.pdf$/i.test(f.name) || IMG.test(f.name) || /^image\/(png|jpe?g)$/.test(f.type) || OFFICE.test(f.name));
    if (!files.length) return L.toast('Merge takes PDFs, pictures, and Word, Excel or PowerPoint files.', { icon: 'info' });
    M.busy = true; paint();
    let pos = at === 'start' ? 0 : typeof at === 'number' ? at : M.files.length;
    const t = files.some(f => OFFICE.test(f.name)) ? L.task('Converting with Microsoft Office', { cancellable: false }) : null;
    for (const f of files) {
      try {
        let bytes, size = f.size;
        if (OFFICE.test(f.name)) { bytes = await L.convertOffice(f, t); if (!bytes) continue; } // needs Start Loeito.cmd + Microsoft Office
        else { bytes = await L.readFile(f); size = bytes.length; if (!/\.pdf$/i.test(f.name)) bytes = new Uint8Array(await L.imageToPdf(bytes, f.type || 'image/jpeg')); }
        const src = await L.addSource(bytes, f.name);
        let info = {}; try { info = (await src.doc.getMetadata()).info || {}; } catch {}
        const p1 = await src.doc.getPage(1), vp = p1.getViewport({ scale: 1 });
        remember();
        M.files.splice(pos++, 0, { id: L.uid('mf'), name: f.name, path: f.loeitoPath || null, size, info, paper: [vp.width, vp.height], open: false, fresh: true, kind: f.loeitoKind || (OFFICE.test(f.name) ? 'office' : ''), pages: Array.from({ length: src.count }, (_, k) => page(src.id, k)) });
      } catch (e) { L.error(`Couldn’t open “${f.name}”`, e); }
    }
    t && t.done();
    M.busy = false;
    if (!M.name) M.name = defaultName();
    paint();
  }
  const stem = n => n.replace(/\.[a-z0-9]{2,4}$/i, '');
  const defaultName = () => !M.files.length ? 'Merged' : M.files.length === 2 ? L.safeName(`${stem(M.files[0].name)} + ${stem(M.files[1].name)}`) : L.safeName(`${stem(M.files[0].name)} + ${M.files.length - 1} more`);

  /* ——— open / close ——— */
  // The open document, with every edit it has (order, rotation, crop, marks, fields, OCR), as a merge card.
  function docCard(doc) {
    const s = doc.state, p0 = s.pages[0], pr = p0 && L.proxySync(p0), v = pr ? L.makeView(pr, p0, 1) : { width: 595, height: 842 };
    const m = s.meta || {};
    return { id: L.uid('mf'), name: s.name + '.pdf', path: doc.origin?.path || null, size: s.fileSize || 0, info: { Title: m.title, Author: m.author }, paper: [v.width, v.height],
      open: true, fresh: true, kind: 'doc', docId: doc.id, edited: !!s.dirty, pages: s.pages.map(copyPage) };
  }
  function refreshFromTab(f) {
    const d = L.docs.find(x => x.id === f.docId); if (!d) return L.toast('That tab has been closed.', { kind: 'err' });
    remember(); Object.assign(f, { ...docCard(d), id: f.id, fresh: false }); paint(); L.toast('Updated from the open tab', { kind: 'ok', icon: 'pages' });
  }
  /* L.openMerge(files) · L.openMerge({ withCurrent: true }) — starts with the open document and asks for the files to add.
     A merge that was set aside comes back exactly as it was. */
  L.openMerge = async (opts) => {
    if (M.open && M.hidden) return resume(opts);
    if (M.open) return;
    Object.assign(M, { open: true, hidden: false, files: [], sel: new Set(), clip: null, fileClip: null, undo: [], folder: null, name: '' });
    show();
    const withCurrent = opts && opts.withCurrent && L.hasDoc();
    if (withCurrent) { M.files.push(docCard(L.doc)); paint(); }
    const files = Array.isArray(opts) ? opts : await pick();
    if (!M.open) return;
    if (files && files.length) await add(files);
    else paint();
  };
  function show() {
    root = h('div', { class: 'merge', role: 'dialog', 'aria-label': 'Merge PDFs' });
    document.body.append(root);
    document.addEventListener('keydown', onKey, true);
    L.$('#merge-dock')?.remove();
    paint();
  }
  // Back to Loeito: the merge waits (files, order, pages, name) in a small dock until you return.
  function setAside() {
    if (!M.open || M.hidden) return;
    M.hidden = true; hideInfo();
    document.removeEventListener('keydown', onKey, true);
    root.classList.add('leaving'); const r = root; setTimeout(() => r.remove(), 220); root = null;
    const n = allPages().length;
    document.body.append(h('div', { id: 'merge-dock', class: 'merge-dock', role: 'status' }, L.icon('merge', 18),
      h('span', null, h('b', null, 'Merge waiting'), ` · ${M.files.length} file${M.files.length === 1 ? '' : 's'} · ${n} page${n === 1 ? '' : 's'}`),
      h('button', { class: 'btn primary small', onclick: () => resume() }, 'Return to merge'),
      h('button', { class: 'icon-btn small', title: 'Discard this merge', onclick: discard }, L.icon('close'))));
  }
  function resume(opts) {
    M.hidden = false; show();
    if (opts && opts.withCurrent && L.hasDoc() && !M.files.some(f => f.docId === L.doc.id)) { remember(); M.files.push(docCard(L.doc)); paint(); L.toast(`Added “${L.state.name}” with its edits`, { kind: 'ok', icon: 'pages' }); }
  }
  async function discard() {
    if (M.files.length && !(await L.confirm('Discard this merge?', 'The files you arranged are not saved; your open documents stay as they are.', 'Discard', true))) return;
    L.$('#merge-dock')?.remove(); M.hidden = false;
    if (root) { root.remove(); root = null; document.removeEventListener('keydown', onKey, true); }
    M.open = false; M.files = []; hideInfo(); collect();
  }
  function close() { // after a successful merge
    if (!M.open) return;
    M.open = false; M.hidden = false; hideInfo();
    document.removeEventListener('keydown', onKey, true);
    if (root) { root.classList.add('leaving'); const r = root; setTimeout(() => r.remove(), 220); root = null; }
    L.$('#merge-dock')?.remove();
    M.files = []; collect();
  }

  /* ——— page operations ——— */
  const selected = () => allPages().filter(p => M.sel.has(p.id));
  function rotate(pages, by) {
    if (!pages.length) return; remember();
    pages.forEach(p => { p.rot = (p.rot + by + 360) % 360; });
    paint();
  }
  function remove(pages) {
    if (!pages.length) return; remember();
    const ids = new Set(pages.map(p => p.id));
    M.files.forEach(f => { f.pages = f.pages.filter(p => !ids.has(p.id)); });
    M.sel.clear(); paint();
  }
  // Put pages into file `to` before page `before` (null = at the end). copy: leave the originals where they are.
  function place(pages, to, before, copy) {
    if (!pages.length) return; remember();
    const moving = copy ? pages.map(copyPage) : pages;
    if (!copy) { const ids = new Set(pages.map(p => p.id)); M.files.forEach(f => { f.pages = f.pages.filter(p => !ids.has(p.id)); }); }
    let at = before ? to.pages.indexOf(before) : to.pages.length; if (at < 0) at = to.pages.length;
    to.pages.splice(at, 0, ...moving); to.open = true;
    M.sel = new Set(moving.map(p => p.id));
    paint(); flash(moving);
  }
  function cut() { const s = selected(); if (!s.length) return; M.clip = { pages: s.map(copyPage), cut: true }; remove(s); L.toast(`${s.length} page${s.length > 1 ? 's' : ''} cut — choose where to paste`, { icon: 'scissors' }); }
  function copy() { const s = selected(); if (!s.length) return; M.clip = { pages: s.map(copyPage), cut: false }; paint(); L.toast(`${s.length} page${s.length > 1 ? 's' : ''} copied — choose where to paste`, { icon: 'copy' }); }
  function paste(to, before) {
    if (!M.clip) return;
    place(M.clip.pages.map(copyPage), to, before, false);
    if (M.clip.cut) M.clip = null; paint();
  }
  const cloneFile = f => ({ ...f, id: L.uid('mf'), name: f.name, fresh: true, open: false, pages: f.pages.map(copyPage) });
  function duplicateFile(f) { remember(); M.files.splice(M.files.indexOf(f) + 1, 0, cloneFile(f)); paint(); L.toast('File duplicated', { icon: 'duplicate' }); }
  function copyFile(f) { M.fileClip = f; paint(); L.toast(`“${f.name}” copied — click “Paste file here” where it should go`, { icon: 'copy', ms: 4000 }); }
  function pasteFile(at) { if (!M.fileClip) return; remember(); M.files.splice(at, 0, cloneFile(M.fileClip)); paint(); }
  function moveFile(f, dir) { const i = M.files.indexOf(f), j = i + dir; if (j < 0 || j >= M.files.length) return; remember(); M.files.splice(i, 1); M.files.splice(j, 0, f); paint(); }
  function flash(pages) { requestAnimationFrame(() => pages.forEach(p => root?.querySelector(`[data-pid="${p.id}"]`)?.classList.add('landed'))); }

  /* ——— covers: a designed first or last page from Loeito's Covers, added as its own card ——— */
  async function addCover() {
    const first = M.files[0], i = first?.info || {};
    const d = { title: i.Title || (first ? stem(first.name) : ''), subtitle: '', author: i.Author || '', publisher: '', edition: String(new Date().getFullYear()), blurb: '', about: '', accent: '#2b5d8a' };
    let kind = 'front', id = 'classic';
    const designs = h('div');
    const paintDesigns = () => designs.replaceChildren(L.ui.field('Design', L.ui.select(L.COVER_DESIGNS[kind], id, v => { id = v; })));
    const f = (k, label, area) => L.ui.field(label, h(area ? 'textarea' : 'input', { class: 'input', rows: area ? 3 : null, value: d[k], oninput: e => { d[k] = e.target.value; } }));
    paintDesigns();
    const ok = await L.dialog({ title: 'Add a cover or last page', text: 'A designed page from Loeito’s Covers — it joins the merge as its own card.', body: h('div', { class: 'stack' },
      L.ui.seg([{ value: 'front', label: 'Front cover (at the start)', icon: 'cover' }, { value: 'back', label: 'Last page (at the end)', icon: 'book' }], kind, v => { kind = v; id = v === 'front' ? 'classic' : 'blurb'; paintDesigns(); }),
      designs, f('title', 'Title'), f('subtitle', 'Subtitle'), f('author', 'Author'), f('publisher', 'Publisher / institution'), f('blurb', 'Description (for a back cover)', true)),
      actions: [{ label: 'Cancel', value: false }, { label: 'Add', primary: true, value: true }] });
    if (!ok) return;
    const paper = first ? [Math.min(...first.paper), Math.max(...first.paper)] : [595.28, 841.89];
    const bytes = await L.coverPdf(kind, id, d, paper);
    const file = new File([bytes], `${kind === 'front' ? 'Cover' : 'Last page'} — ${L.COVER_DESIGNS[kind].find(x => x.value === id).label}.pdf`, { type: 'application/pdf' });
    file.loeitoKind = 'cover';
    await add([file], { at: kind === 'front' ? 'start' : 'end' });
  }

  /* ——— merging ——— */
  async function folderGuess() {
    if (M.folder) return M.folder;
    const first = M.files.find(f => f.path);
    return first ? L.path.dir(first.path) : L.pref('lastFolder', null);
  }
  async function chooseFolder() {
    if (!L.fs.on()) return L.toast('Your browser will ask where to save. Start Loeito with “Start Loeito.cmd” to pick a folder here.', { icon: 'info', ms: 5000 });
    const res = await L.files.pickFolder({ title: 'Save the merged file in…', folder: await folderGuess() });
    if (res) { M.folder = res.folder; paint(); }
  }
  async function doMerge() {
    const pages = allPages();
    if (M.files.length < 1 || !pages.length) return;
    const name = L.safeName(M.name || defaultName());
    M.busy = true; paint();
    const t = L.task('Merging');
    try {
      const S = L.freshState('view');
      S.pages = pages.map(copyPage); S.name = name; S.meta = { title: name, author: M.files[0].info.Author || '', subject: '', keywords: '' };
      const bytes = await L.buildPdf({ state: S, pages: S.pages, task: t });
      let file;
      if (L.fs.on()) {
        let folder = await folderGuess();
        if (!folder) { const pl = await L.fs.places(); folder = pl.places.find(p => p.id === 'documents')?.path || pl.home; }
        const out = await L.files.writeFree(folder, name, 'pdf', bytes);
        file = new File([bytes], L.path.base(out.path), { type: 'application/pdf' }); file.loeitoPath = out.path;
        M.savedTo = out.path;
      } else {
        await L.saveFile(bytes, name + '.pdf', 'application/pdf', 'pdf');
        file = new File([bytes], name + '.pdf', { type: 'application/pdf' });
      }
      t.done();
      await success(pages.length, bytes.length);
      const savedTo = M.savedTo; M.savedTo = null;
      close();
      await L.openFiles([file]);
      L.toast(`Merged ${pages.length} pages · ${L.fmtBytes(bytes.length)}`, { kind: 'ok', ms: 6000, action: savedTo ? { label: 'Show in folder', fn: () => L.fs.reveal(savedTo) } : null });
    } catch (e) { t.done(); M.busy = false; paint(); if (e.message !== 'Cancelled') L.error('Couldn’t merge', e); }
  }
  const success = (n, size) => new Promise(res => {
    if (!root) return res();
    root.append(h('div', { class: 'merge-done' }, h('div', { class: 'merge-check', html: '<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg>' }),
      h('b', null, 'Merged'), h('span', null, `${n} pages · ${L.fmtBytes(size)}`)));
    setTimeout(res, 900);
  });

  /* ——— hover details ——— */
  function showInfo(f, anchor) {
    hideInfo();
    const i = f.info, fmt = d => (d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
    const paper = Object.entries(L.PAPER).find(([, [w, hh]]) => (Math.abs(w - f.paper[0]) < 4 && Math.abs(hh - f.paper[1]) < 4) || (Math.abs(hh - f.paper[0]) < 4 && Math.abs(w - f.paper[1]) < 4));
    const rows = [['Title', i.Title], ['Author', i.Author], ['Created', fmt(pdfDate(i.CreationDate))], ['Modified', fmt(pdfDate(i.ModDate))], ['Made with', [i.Creator, i.Producer].filter(Boolean).join(' · ')],
      ['Paper', `${Math.round(f.paper[0] / L.MM)} × ${Math.round(f.paper[1] / L.MM)} mm${paper ? ' · ' + paper[0] : ''}`], ['Pages', String(f.pages.length)], ['File size', L.fmtBytes(f.size)], ['Folder', f.path ? L.path.dir(f.path) : '']].filter(r => r[1] && r[1] !== '—');
    const card = h('div', { class: 'merge-info' }, h('b', null, f.name), h('dl', null, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])));
    document.body.append(card);
    const r = anchor.getBoundingClientRect();
    const x = r.right + 12 + card.offsetWidth < innerWidth ? r.right + 12 : Math.max(8, r.left - card.offsetWidth - 12);
    card.style.left = x + 'px'; card.style.top = L.clamp(r.top, 8, innerHeight - card.offsetHeight - 8) + 'px';
  }
  function hideInfo() { clearTimeout(hoverT); document.querySelectorAll('.merge-info').forEach(e => e.remove()); }

  /* ——— drawing (with FLIP motion: things glide to their new places) ——— */
  function paint() {
    if (!root) return;
    const before = new Map([...root.querySelectorAll('[data-flip]')].map(el => [el.dataset.flip, el.getBoundingClientRect()]));
    const scroll = root.querySelector('.merge-body')?.scrollTop || 0;
    root.replaceChildren(header(), body(), selBar());
    root.querySelector('.merge-body').scrollTop = scroll;
    for (const el of root.querySelectorAll('[data-flip]')) {
      const b = before.get(el.dataset.flip); if (!b) continue;
      const a = el.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    M.files.forEach(f => { f.fresh = false; });
  }
  function header() {
    const total = allPages().length, folderLabel = M.folder || (M.files.find(f => f.path) ? L.path.dir(M.files.find(f => f.path).path) : null);
    return h('header', { class: 'merge-head' },
      h('div', { class: 'mh-title' }, L.icon('merge', 22), h('div', null, h('b', null, 'Merge PDFs'), h('span', null, M.files.length ? `${M.files.length} file${M.files.length > 1 ? 's' : ''} · ${total} page${total === 1 ? '' : 's'}` : 'Pick two or more files'))),
      h('div', { class: 'mh-out' },
        h('label', { class: 'mh-name' }, h('span', null, 'Save as'), h('input', { class: 'input', value: M.name, placeholder: 'Merged', oninput: e => { M.name = e.target.value; } }), h('i', null, '.pdf')),
        h('button', { class: 'mh-folder', title: folderLabel || 'Choose where to save', onclick: chooseFolder }, L.icon('folder', 16), h('span', null, L.fs.on() ? (folderLabel ? L.path.base(folderLabel) || folderLabel : 'Documents') : 'Ask when saving'), L.icon('down', 12))),
      h('div', { class: 'mh-actions' },
        h('button', { class: 'btn', onclick: async () => add(await pick()) }, L.icon('plus'), 'Add files'),
        h('button', { class: 'btn', title: 'Add a designed front cover or last page', onclick: addCover }, L.icon('cover'), 'Cover…'),
        h('button', { class: 'btn primary lg merge-go', disabled: M.busy || !total, onclick: doMerge }, L.icon('merge'), M.busy ? 'Working…' : 'Merge & Open'),
        h('button', { class: 'btn', title: 'Go back to Loeito — the merge waits for you (Esc)', onclick: setAside }, L.icon('left'), 'Back to Loeito'),
        h('button', { class: 'icon-btn', title: 'Discard this merge', onclick: discard }, L.icon('close'))));
  }
  function body() {
    const b = h('div', { class: 'merge-body' });
    b.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); b.classList.add('drop-files'); } });
    b.addEventListener('dragleave', e => { if (e.target === b) b.classList.remove('drop-files'); });
    b.addEventListener('drop', e => { if (e.dataTransfer.files.length) { e.preventDefault(); b.classList.remove('drop-files'); add(e.dataTransfer.files); } });
    if (!M.files.length) {
      b.append(h('div', { class: 'merge-empty' }, L.icon('merge', 48), h('b', null, M.busy ? 'Opening…' : 'Choose the files to merge'),
        h('span', null, 'Click them in the order you want, or drop them here.'), h('button', { class: 'btn primary lg', onclick: async () => add(await pick()) }, L.icon('plus'), 'Choose files')));
      return b;
    }
    const slot = at => h('button', { class: 'mfile-slot', onclick: () => pasteFile(at) }, L.icon('copy', 14), at === 0 ? 'Paste file at the start' : at === M.files.length ? 'Paste file at the end' : 'Paste file here');
    M.files.forEach((f, i) => { if (M.fileClip) b.append(slot(i)); b.append(fileCard(f, i)); });
    if (M.fileClip) b.append(slot(M.files.length));
    b.append(h('div', { class: 'merge-addrow' },
      h('button', { class: 'merge-addcard', onclick: async () => add(await pick()) }, L.icon('plus', 20), 'Add another file — PDF, picture, Word, Excel, PowerPoint'),
      h('button', { class: 'merge-addcard', onclick: addCover }, L.icon('cover', 20), 'Add a cover or last page')));
    if (M.fileClip) b.append(h('button', { class: 'linkish', style: { alignSelf: 'center' }, onclick: () => { M.fileClip = null; paint(); } }, 'Cancel file paste'));
    return b;
  }
  let drag = null; // { kind: 'file', f } | { kind: 'pages', pages }
  function fileCard(f, i) {
    const first = f.pages[0];
    const card = h('section', { class: 'mcard' + (f.open ? ' open' : '') + (f.fresh ? ' fresh' : ''), 'data-flip': f.id, style: { '--i': i } });
    const thumb = h('div', { class: 'mc-thumb' }, first ? thumbImg(first) : null);
    const head = h('div', { class: 'mc-head', draggable: 'true' },
      h('span', { class: 'mc-num' }, i + 1),
      h('span', { class: 'mc-grip', title: 'Drag to change the order' }, '⋮⋮'),
      thumb,
      h('div', { class: 'mc-meta' }, h('b', null, f.name, f.kind === 'doc' ? h('span', { class: 'pill ok', style: { marginLeft: '8px' }, title: 'Taken from your open tab, with all its edits' }, f.edited ? 'open tab · edited' : 'open tab') : null), h('span', null, `${f.pages.length} page${f.pages.length === 1 ? '' : 's'} · ${L.fmtBytes(f.size)}${f.info.Author ? ' · ' + f.info.Author : ''}`)),
      h('div', { class: 'mc-tools' },
        M.clip ? h('button', { class: 'btn small', title: 'Paste the copied pages at the start of this file', onclick: () => paste(f, f.pages[0] || null) }, 'Paste at start') : null,
        M.clip ? h('button', { class: 'btn small', title: 'Paste the copied pages at the end of this file', onclick: () => paste(f, null) }, 'Paste at end') : null,
        h('button', { class: 'icon-btn small', title: 'Move up', disabled: i === 0, onclick: () => moveFile(f, -1) }, L.icon('up')),
        h('button', { class: 'icon-btn small', title: 'Move down', disabled: i === M.files.length - 1, onclick: () => moveFile(f, 1) }, L.icon('down')),
        h('button', { class: 'icon-btn small', title: 'Rotate all pages of this file', onclick: () => rotate(f.pages, 90) }, L.icon('rotr')),
        f.kind === 'doc' ? h('button', { class: 'icon-btn small', title: 'Update from the open tab (takes its latest edits)', onclick: () => refreshFromTab(f) }, L.icon('rotr')) : null,
        h('button', { class: 'icon-btn small', title: 'Duplicate this file (adds a copy after it)', onclick: () => duplicateFile(f) }, L.icon('duplicate')),
        h('button', { class: 'icon-btn small' + (M.fileClip === f ? ' on' : ''), title: 'Copy this file, then paste it anywhere', onclick: () => copyFile(f) }, L.icon('copy')),
        h('button', { class: 'icon-btn small', title: 'Remove this file from the merge', onclick: () => { remember(); M.files = M.files.filter(x => x !== f); paint(); } }, L.icon('trash')),
        h('button', { class: 'mc-open', title: f.open ? 'Hide pages' : 'Show pages', onclick: () => { f.open = !f.open; paint(); } }, f.open ? 'Hide pages' : 'Show pages', L.icon(f.open ? 'up' : 'down', 13))));
    thumb.addEventListener('mouseenter', () => { hoverT = setTimeout(() => showInfo(f, card), 350); });
    head.querySelector('.mc-meta').addEventListener('mouseenter', () => { hoverT = setTimeout(() => showInfo(f, card), 350); });
    head.addEventListener('mouseleave', hideInfo);
    // reorder files by dragging the header
    head.addEventListener('dragstart', e => { if (e.target.closest('.mc-page')) return; drag = { kind: 'file', f }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-loeito-file', f.id); hideInfo(); requestAnimationFrame(() => card.classList.add('lifted')); });
    head.addEventListener('dragend', () => { card.classList.remove('lifted'); drag = null; clearMarks(); });
    card.addEventListener('dragover', e => {
      if (!drag) return; e.preventDefault();
      if (drag.kind === 'file') { const r = card.getBoundingClientRect(); clearMarks(); card.classList.add(e.clientY < r.top + r.height / 2 ? 'mark-before' : 'mark-after'); }
      else if (!e.target.closest('.mc-page')) { clearMarks(); card.classList.add('mark-into'); e.dataTransfer.dropEffect = e.ctrlKey || e.altKey ? 'copy' : 'move'; }
    });
    card.addEventListener('drop', e => {
      if (!drag) return; e.preventDefault();
      if (drag.kind === 'file') {
        const after = card.classList.contains('mark-after'), from = drag.f; clearMarks();
        if (from !== f) { remember(); M.files = M.files.filter(x => x !== from); M.files.splice(M.files.indexOf(f) + (after ? 1 : 0), 0, from); paint(); }
      } else if (!e.target.closest('.mc-page')) { clearMarks(); place(drag.pages, f, null, e.ctrlKey || e.altKey); }
      drag = null;
    });
    card.append(head);
    if (f.open) card.append(strip(f));
    return card;
  }
  function thumbImg(p) {
    const img = h('img', { alt: '', draggable: 'false', style: { transform: `rotate(${p.rot}deg)${p.rot % 180 ? ' scale(.72)' : ''}` } });
    L.thumb({ ...p, rot: 0 }).then(u => { if (u) img.src = u; });
    return img;
  }

  function strip(f) {
    const s = h('div', { class: 'mc-pages' });
    f.pages.forEach((p, k) => {
      if (M.clip) s.append(h('button', { class: 'mc-slot', title: 'Paste here', onclick: () => paste(f, p) }, '+'));
      const el = h('div', { class: 'mc-page' + (M.sel.has(p.id) ? ' on' : ''), draggable: 'true', 'data-flip': p.id, 'data-pid': p.id, tabindex: '0' },
        h('div', { class: 'mp-img' }, thumbImg(p)),
        h('span', { class: 'mp-num' }, k + 1),
        h('div', { class: 'mp-tools' },
          h('button', { title: 'Rotate left', onclick: e => { e.stopPropagation(); rotate([p], -90); } }, L.icon('rotl', 14)),
          h('button', { title: 'Rotate right', onclick: e => { e.stopPropagation(); rotate([p], 90); } }, L.icon('rotr', 14)),
          h('button', { title: 'Remove page', onclick: e => { e.stopPropagation(); remove([p]); } }, L.icon('trash', 14))));
      el.addEventListener('click', e => {
        const all = allPages();
        if (e.shiftKey && M.anchor) { const a = all.indexOf(M.anchor), b = all.indexOf(p); M.sel = new Set(all.slice(Math.min(a, b), Math.max(a, b) + 1).map(x => x.id)); }
        else if (e.ctrlKey || e.metaKey) { M.sel.has(p.id) ? M.sel.delete(p.id) : M.sel.add(p.id); M.anchor = p; }
        else { M.sel = M.sel.size === 1 && M.sel.has(p.id) ? new Set() : new Set([p.id]); M.anchor = p; }
        paint();
      });
      el.addEventListener('dragstart', e => {
        e.stopPropagation();
        const pages = M.sel.has(p.id) ? selected() : [p];
        drag = { kind: 'pages', pages }; e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('text/x-loeito-pages', String(pages.length));
        hideInfo(); requestAnimationFrame(() => pages.forEach(x => root.querySelector(`[data-pid="${x.id}"]`)?.classList.add('lifted')));
      });
      el.addEventListener('dragend', () => { drag = null; clearMarks(); root?.querySelectorAll('.lifted').forEach(x => x.classList.remove('lifted')); });
      el.addEventListener('dragover', e => {
        if (!drag || drag.kind !== 'pages') return; e.preventDefault(); e.stopPropagation();
        const r = el.getBoundingClientRect(); clearMarks(); el.classList.add(e.clientX < r.left + r.width / 2 ? 'mark-before' : 'mark-after');
        e.dataTransfer.dropEffect = e.ctrlKey || e.altKey ? 'copy' : 'move';
      });
      el.addEventListener('drop', e => {
        if (!drag || drag.kind !== 'pages') return; e.preventDefault(); e.stopPropagation();
        const after = el.classList.contains('mark-after'); clearMarks();
        const idx = f.pages.indexOf(p), target = after ? f.pages.slice(idx + 1).find(x => !drag.pages.includes(x)) || null : p;
        if (drag.pages.includes(p) && !(e.ctrlKey || e.altKey)) { drag = null; return; }
        place(drag.pages, f, target, e.ctrlKey || e.altKey); drag = null;
      });
      s.append(el);
    });
    if (M.clip) s.append(h('button', { class: 'mc-slot', title: 'Paste at the end', onclick: () => paste(f, null) }, '+'));
    if (!f.pages.length) s.append(h('div', { class: 'mc-emptypages' }, 'No pages — drop or paste pages here'));
    return s;
  }
  const clearMarks = () => root?.querySelectorAll('.mark-before,.mark-after,.mark-into').forEach(x => x.classList.remove('mark-before', 'mark-after', 'mark-into'));
  function selBar() {
    const n = M.sel.size;
    return h('div', { class: 'merge-bar' + (n || M.clip ? ' show' : '') },
      n ? h('span', { class: 'mb-count' }, `${n} page${n > 1 ? 's' : ''} selected`) : h('span', { class: 'mb-count' }, `${M.clip ? M.clip.pages.length : 0} on the clipboard — click a + or “Paste at…”`),
      n ? [
        h('button', { onclick: () => rotate(selected(), -90), title: 'Rotate left (Shift R)' }, L.icon('rotl', 16), 'Left'),
        h('button', { onclick: () => rotate(selected(), 90), title: 'Rotate right (R)' }, L.icon('rotr', 16), 'Right'),
        h('button', { onclick: cut, title: 'Cut (Ctrl X)' }, L.icon('scissors', 16), 'Cut'),
        h('button', { onclick: copy, title: 'Copy (Ctrl C)' }, L.icon('copy', 16), 'Copy'),
        h('button', { onclick: () => remove(selected()), title: 'Remove (Delete)' }, L.icon('trash', 16), 'Remove'),
        h('button', { onclick: () => { M.sel.clear(); paint(); }, title: 'Clear selection (Esc)' }, L.icon('close', 16))] : null,
      !n && M.clip ? h('button', { onclick: () => { M.clip = null; paint(); } }, 'Cancel') : null,
      h('span', { class: 'mb-hint' }, 'Drag pages to move · Ctrl-drag to copy'));
  }

  /* ——— keyboard ——— */
  function onKey(e) {
    if (!M.open || document.querySelector('#modal-root').children.length) return;
    if (e.target.closest && e.target.closest('input,textarea')) { if (e.key === 'Escape') e.target.blur(); return; }
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    const done = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'Escape') { done(); if (M.sel.size) { M.sel.clear(); paint(); } else if (M.clip) { M.clip = null; paint(); } else setAside(); return; }
    if (mod && k === 'z') { done(); undo(); return; }
    if (mod && k === 'a') { done(); M.sel = new Set(allPages().map(p => p.id)); M.files.forEach(f => { f.open = true; }); paint(); return; }
    if (mod && k === 'c') { done(); copy(); return; }
    if (mod && k === 'x') { done(); cut(); return; }
    if (mod && k === 'v') { done(); const last = selected().pop(); const f = last ? fileOf(last) : M.files[M.files.length - 1]; if (f) paste(f, last ? f.pages[f.pages.indexOf(last) + 1] || null : null); return; }
    if (mod && e.key === 'Enter') { done(); doMerge(); return; }
    if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) { done(); remove(selected()); return; }
    if (!mod && k === 'r') { done(); rotate(selected(), e.shiftKey ? -90 : 90); return; }
    e.stopPropagation(); // the document behind stays untouched
  }
})();
