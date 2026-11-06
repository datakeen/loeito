/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito files: where documents come from and where they go.
   Loeito's own Open / Save As sheet (places, back / forward / up, clickable path, new folder, filter, replace-or-keep-both),
   saving over the original after a short confirmation (with a safety copy of the old version), and every export.
   Uses the local server when Loeito was started with Start Loeito.cmd; otherwise Edge/Chrome file handles; otherwise a download. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;

  /* ——— Server file API ——— */
  const qs = o => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  async function api(route, opts = {}) {
    const res = await fetch('/api/fs/' + route, { ...opts, headers: { 'X-Loeito': '1' } });
    if (!res.ok) {
      let info = {}; try { info = await res.json(); } catch {}
      const e = new Error(info.error || res.statusText); e.status = res.status; e.info = info; throw e;
    }
    return res;
  }
  const FS = (L.fs = {
    on: () => !!(L.server && L.server.fs),
    places: () => api('places').then(r => r.json()),
    list: path => api('list?' + qs({ path })).then(r => r.json()),
    mkdir: (path, name) => api('mkdir?' + qs({ path, name }), { method: 'POST' }).then(r => r.json()),
    read: async path => new Uint8Array(await (await api('read?' + qs({ path }))).arrayBuffer()),
    write: (path, data, overwrite = false) => api('write?' + qs({ path, overwrite: overwrite ? 1 : 0 }), { method: 'POST', body: data instanceof Blob ? data : new Blob([data]) }).then(r => r.json()),
    reveal: path => api('reveal?' + qs({ path }), { method: 'POST' }).catch(e => L.error('Couldn’t show it in its folder', e)),
  });

  // Passwords: AES-256 through the local server (pypdf). Passwords travel in headers, never in the URL.
  const b64 = s => btoa(unescape(encodeURIComponent(s || '')));
  L.pdfCrypt = async (bytes, { encrypt = false, password = '', open = '', owner = '', allow = [] } = {}) => {
    if (!FS.on()) throw new Error('Passwords need Loeito started with “Start Loeito.cmd”.');
    const res = await fetch('/api/pdf/' + (encrypt ? 'encrypt' : 'decrypt'), { method: 'POST', body: new Blob([bytes]),
      headers: { 'X-Loeito': '1', 'X-Pdf-Password': b64(password), 'X-Open-Password': b64(open), 'X-Owner-Password': b64(owner), 'X-Allow': allow.join(',') } });
    if (!res.ok) { let m = res.statusText; try { m = (await res.json()).error || m; } catch {} throw new Error(m); }
    return new Uint8Array(await res.arrayBuffer());
  };

  /* ——— Windows paths ——— */
  const P = (L.path = {
    base: p => String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop(),
    dir: p => { const s = String(p).replace(/[\\/]+$/, ''), i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/')); return i < 0 ? s : i <= 2 ? s.slice(0, i + 1) : s.slice(0, i); },
    join: (d, n) => String(d).replace(/[\\/]+$/, '') + '\\' + n,
    stem: n => String(n).replace(/\.[a-z0-9]{1,5}$/i, ''),
    ext: n => (String(n).match(/\.([a-z0-9]{1,5})$/i) || [, ''])[1].toLowerCase(),
    same: (a, b) => String(a).toLowerCase().replace(/[\\/]+$/, '') === String(b).toLowerCase().replace(/[\\/]+$/, ''),
  });
  const BAD = /[\\/:*?"<>|]/;
  const OPENABLE = /\.(pdf|png|jpe?g|docx?|docm|rtf|odt|xlsx?|xlsm|ods|pptx?|odp)$/i;
  const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

  /* ——— Recent files & folders ——— */
  const remember = (key, item, max) => L.setPref(key, [item, ...L.pref(key, []).filter(x => !P.same(x.path, item.path))].slice(0, max));
  const F = (L.files = {
    remember(path) { remember('recentFiles', { path, name: P.base(path), t: Date.now() }, 12); remember('recentFolders', { path: P.dir(path), t: Date.now() }, 8); L.setPref('lastFolder', P.dir(path)); },
    forget(path) { L.setPref('recentFiles', L.pref('recentFiles', []).filter(x => !P.same(x.path, path))); },
    recentFiles: () => L.pref('recentFiles', []),
  });

  /* ——— The sheet ———
     mode 'save' → { path, folder, name, overwrite } · 'open' → { paths } · 'folder' → { folder } · or null when cancelled. */
  const when = ms => {
    const d = new Date(ms), now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const natural = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  let placesCache = null;

  F.sheet = async ({ mode = 'save', title, text, name = '', ext = 'pdf', folder, origin, extras, confirm } = {}) => {
    const places = placesCache ||= await FS.places();
    let cur = null, listing = null, back = [], fwd = [], filter = '', pick = new Set(), anchor = null, cursor = -1, rows = [], primary = null, result = null;
    const ctl = { setExt: e => { ext = e; extTag.textContent = '.' + ext; paintStatus(); } };

    const nameIn = h('input', { class: 'input fs-name', value: name, spellcheck: 'false', 'aria-label': 'File name', oninput: () => paintStatus() });
    const extTag = h('span', { class: 'fs-ext' }, '.' + ext);
    const status = h('div', { class: 'fs-status', 'aria-live': 'polite' });
    const crumbs = h('div', { class: 'fs-crumbs' });
    const listEl = h('div', { class: 'fs-list', role: 'listbox', tabindex: '0', 'aria-multiselectable': String(mode === 'open') });
    const side = h('nav', { class: 'fs-side', 'aria-label': 'Places' });
    const tbtn = (icon, tip, fn) => h('button', { class: 'icon-btn small', title: tip, 'aria-label': tip, onclick: fn }, L.icon(icon));
    const bBack = tbtn('left', 'Back (Alt ←)', () => step(-1)), bFwd = tbtn('right', 'Forward (Alt →)', () => step(1)), bUp = tbtn('up', 'Enclosing folder (Alt ↑)', () => listing?.parent && go(listing.parent));
    const filterIn = h('input', { class: 'input fs-filter', placeholder: 'Filter', 'aria-label': 'Filter this folder', oninput: e => { filter = e.target.value.trim().toLowerCase(); paintList(); } });
    const bNew = mode !== 'open' ? h('button', { class: 'btn fs-new', title: 'Make a new folder here', onclick: () => newFolder() }, L.icon('folderplus'), 'New folder') : null;

    async function go(path, push = true) {
      try {
        const l = await FS.list(path);
        if (push && cur && !P.same(cur, l.path)) { back.push(cur); fwd = []; }
        cur = l.path; listing = l; pick = new Set(); anchor = null; cursor = -1; filter = ''; filterIn.value = '';
        paint();
      } catch (e) { L.toast(e.message, { kind: 'err' }); if (!cur) go(places.home, false); }
    }
    function step(dir) {
      const from = dir < 0 ? back : fwd, to = dir < 0 ? fwd : back;
      if (!from.length) return;
      to.push(cur); const p = from.pop(); go(p, false);
    }
    function paint() { paintSide(); paintCrumbs(); paintList(); paintStatus(); bBack.disabled = !back.length; bFwd.disabled = !fwd.length; bUp.disabled = !listing?.parent; }

    function paintSide() {
      const item = (icon, label, path, sub) => h('button', { class: 'fs-place' + (cur && P.same(cur, path) ? ' on' : ''), title: path, onclick: () => go(path) },
        L.icon(icon), h('span', { class: 'grow' }, label, sub ? h('small', null, sub) : null));
      const group = (label, kids) => kids.length ? [h('div', { class: 'fs-group' }, label), ...kids] : [];
      const recents = L.pref('recentFolders', []).filter(r => !(origin && P.same(r.path, P.dir(origin)))).slice(0, 5);
      side.replaceChildren(
        ...(origin ? group('This document', [item('doc', 'Original folder', P.dir(origin), P.base(P.dir(origin)))]) : []),
        ...group('Places', places.places.map(p => item({ desktop: 'desktop', documents: 'doc', downloads: 'download' }[p.id] || 'folder', p.name, p.path))),
        ...group('This PC', places.drives.map(d => item('drive', d.name, d.path))),
        ...group('Recent', recents.map(r => item('clock', P.base(r.path) || r.path, r.path))),
        ...group('Loeito', [item('history', 'Safety copies', places.safety)]));
    }
    function paintCrumbs() {
      const parts = [], segs = cur.replace(/[\\/]+$/, '').split(/[\\/]/);
      let acc = '';
      segs.forEach((s, i) => { acc = i === 0 ? s + '\\' : P.join(acc, s); parts.push({ name: i === 0 ? (places.drives.find(d => P.same(d.path, acc))?.name || s) : s, path: acc }); });
      crumbs.replaceChildren(...parts.flatMap((p, i) => [i ? h('span', { class: 'fs-sep' }, '›') : null,
        h('button', { class: 'fs-crumb' + (i === parts.length - 1 ? ' last' : ''), title: p.path, onclick: () => go(p.path) }, p.name)]).filter(Boolean));
      crumbs.scrollLeft = 1e6;
    }
    const wanted = e => e.dir || (mode === 'open' ? OPENABLE.test(e.name) : P.ext(e.name) === ext);
    function paintList() {
      const ents = (listing?.entries || []).filter(e => !filter || e.name.toLowerCase().includes(filter))
        .filter(e => mode !== 'open' || e.dir || OPENABLE.test(e.name));
      rows = [...ents.filter(e => e.dir).sort(natural), ...ents.filter(e => !e.dir).sort(natural)];
      if (!rows.length) { listEl.replaceChildren(h('div', { class: 'fs-empty' }, filter ? 'Nothing matches.' : mode === 'open' ? 'No PDFs, images or Office files here.' : 'This folder is empty.')); return; }
      listEl.replaceChildren(...rows.map((e, i) => h('div', {
        class: 'fs-row' + (wanted(e) ? '' : ' dim') + (pick.has(e.name) ? ' on' : '') + (i === cursor ? ' cursor' : ''), role: 'option', 'aria-selected': String(pick.has(e.name)),
        onclick: ev => choose(i, ev), ondblclick: () => activate(e),
      }, L.icon(e.dir ? 'folder' : /\.pdf$/i.test(e.name) ? 'doc' : /\.(png|jpe?g)$/i.test(e.name) ? 'image' : 'text'),
      h('span', { class: 'fs-n' }, e.name), h('span', { class: 'fs-d' }, when(e.mtime)), h('span', { class: 'fs-s' }, e.dir ? '' : L.fmtBytes(e.size)))));
      listEl.querySelector('.cursor')?.scrollIntoView({ block: 'nearest' });
    }
    function choose(i, ev = {}) {
      const e = rows[i]; if (!e) return;
      cursor = i;
      if (mode === 'open' && !e.dir && (ev.ctrlKey || ev.metaKey)) { pick.has(e.name) ? pick.delete(e.name) : pick.add(e.name); anchor = i; }
      else if (mode === 'open' && !e.dir && ev.shiftKey && anchor != null) { pick = new Set(rows.slice(Math.min(anchor, i), Math.max(anchor, i) + 1).filter(r => !r.dir).map(r => r.name)); }
      else { pick = new Set([e.name]); anchor = i; }
      if (mode === 'save' && !e.dir && P.ext(e.name) === ext) nameIn.value = P.stem(e.name); // click a file to save over it
      paintList(); paintStatus();
    }
    function activate(e) {
      if (e.dir) return go(P.join(cur, e.name));
      if (mode === 'open') { pick = new Set([e.name]); primary.click(); }
      else if (mode === 'save' && P.ext(e.name) === ext) { nameIn.value = P.stem(e.name); paintStatus(); primary.click(); }
    }
    async function newFolder() {
      let base = 'New folder', n = 1;
      const names = new Set((listing?.entries || []).map(e => e.name.toLowerCase()));
      while (names.has((n > 1 ? `${base} (${n})` : base).toLowerCase())) n++;
      const inp = h('input', { class: 'input fs-newname', value: n > 1 ? `${base} (${n})` : base, 'aria-label': 'New folder name' });
      const row = h('div', { class: 'fs-row editing' }, L.icon('folder'), inp);
      listEl.prepend(row); inp.focus(); inp.select();
      let done = false;
      const commit = async ok => {
        if (done) return; done = true;
        const v = inp.value.trim();
        if (!ok || !v) return row.remove();
        try { const r = await FS.mkdir(cur, v); await go(r.path); L.toast(`Made “${v}”`, { kind: 'ok', icon: 'folderplus' }); }
        catch (e) { row.remove(); L.toast(e.message, { kind: 'err' }); }
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(true); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); commit(false); } });
      inp.addEventListener('blur', () => commit(true));
    }

    const fileName = () => nameIn.value.trim().replace(/\.+$/, '');
    const existing = () => fileName() && (listing?.entries || []).find(e => !e.dir && e.name.toLowerCase() === `${fileName()}.${ext}`.toLowerCase());
    function freeName() {
      const names = new Set((listing?.entries || []).map(e => e.name.toLowerCase()));
      const stem = fileName().replace(/ \(\d+\)$/, ''); let n = 2;
      while (names.has(`${stem} (${n}).${ext}`.toLowerCase())) n++;
      return `${stem} (${n})`;
    }
    function paintStatus() {
      if (!primary) return;
      status.className = 'fs-status'; status.replaceChildren();
      if (mode === 'save') {
        const nm = fileName();
        if (!nm) { primary.disabled = true; primary.textContent = 'Save'; return; }
        if (BAD.test(nm)) { primary.disabled = true; status.classList.add('bad'); status.append(L.icon('warn'), h('span', null, 'A name can’t contain \\ / : * ? " < > |')); return; }
        primary.disabled = false;
        const ex = existing();
        primary.textContent = ex ? 'Replace' : 'Save';
        if (ex) {
          status.classList.add('warn');
          const isOrigin = origin && P.same(P.join(cur, ex.name), origin);
          status.append(L.icon('info'), h('span', { class: 'grow' }, `“${ex.name}” already exists here${isOrigin ? ' — it’s the original' : ''}. Saving replaces it; Loeito keeps a safety copy.`),
            h('button', { class: 'btn small', onclick: () => { nameIn.value = freeName(); paintStatus(); } }, 'Keep both'));
        } else status.append(h('span', { class: 'muted' }, `Saves to ${P.base(cur) || cur}`));
      } else if (mode === 'open') {
        const n = [...pick].filter(nm => rows.find(r => r.name === nm && !r.dir)).length;
        primary.disabled = !n; primary.textContent = n > 1 ? `Open ${n}` : 'Open';
        status.append(h('span', { class: 'muted' }, n ? `${n} selected · each opens in its own tab` : 'Pick a file — Ctrl or Shift for several'));
      } else { primary.disabled = !cur; status.append(h('span', { class: 'muted' }, cur)); }
    }

    function onKey(e) {
      const typing = e.target.closest('input,textarea') && e.target !== listEl;
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); step(-1); return true; }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); step(1); return true; }
      if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); if (listing?.parent) go(listing.parent); return true; }
      if (e.target.closest('.fs-newname')) return true; // the new-folder field handles its own keys
      if (typing) return false;
      if (e.key === 'Backspace') { e.preventDefault(); if (listing?.parent) go(listing.parent); return true; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); choose(L.clamp(cursor + (e.key === 'ArrowDown' ? 1 : -1), 0, rows.length - 1), { shiftKey: e.shiftKey }); return true; }
      if (e.key === 'Enter' && rows[cursor]?.dir && (mode !== 'save' || document.activeElement === listEl)) { e.preventDefault(); go(P.join(cur, rows[cursor].name)); return true; }
      return false;
    }

    const body = h('div', { class: 'fs-sheet' },
      mode === 'save' ? h('div', { class: 'fs-namerow' }, h('label', { class: 'fs-label' }, 'Name'), h('div', { class: 'fs-namebox' }, nameIn, extTag)) : null,
      h('div', { class: 'fs-browser' }, side,
        h('div', { class: 'fs-main' }, h('div', { class: 'fs-bar' }, bBack, bFwd, bUp, crumbs, filterIn, bNew), listEl)),
      h('div', { class: 'fs-foot' }, status, mode === 'open' ? h('button', { class: 'linkish', onclick: () => { result = 'native'; L.closeDialog('native'); } }, 'Use the Windows dialog…') : null),
      extras ? h('div', { class: 'fs-extras' }, typeof extras === 'function' ? extras(ctl) : extras) : null);

    const go1 = await L.dialog({
      title: title || (mode === 'save' ? 'Save As' : mode === 'open' ? 'Open' : 'Choose a folder'), text, body, wide: 'xl', onKey,
      actions: [{ label: 'Cancel', value: null }, { label: confirm || (mode === 'save' ? 'Save' : mode === 'open' ? 'Open' : 'Choose this folder'), primary: true, value: 'ok', onClick: () => {
        if (mode === 'save') { const nm = fileName(); if (!nm || BAD.test(nm)) return false; result = { folder: cur, name: nm, path: P.join(cur, `${nm}.${ext}`), overwrite: !!existing() }; }
        else if (mode === 'open') { const paths = [...pick].filter(nm => rows.find(r => r.name === nm && !r.dir)).map(nm => P.join(cur, nm)); if (!paths.length) return false; result = { paths }; }
        else result = { folder: cur };
        L.setPref('lastFolder', cur);
      } }],
      onOpen: modal => {
        primary = modal.querySelector('.modal-foot .primary');
        const start = folder || L.pref('lastFolder', null) || (origin && P.dir(origin)) || places.places.find(p => p.id === 'documents')?.path || places.home;
        go(start, false);
        setTimeout(() => { if (mode === 'save') { nameIn.focus(); nameIn.select(); } else listEl.focus(); }, 40);
      },
    });
    if (go1 === 'native') return 'native';
    return go1 === 'ok' ? result : null;
  };

  /* ——— Writing ——— */
  async function writeAndTell(res, data, { quiet = false } = {}) {
    const out = await FS.write(res.path, data, res.overwrite);
    F.remember(out.path);
    if (!quiet) L.toast(`Saved “${P.base(out.path)}” · ${L.fmtBytes(out.size)}`, { kind: 'ok', ms: 5200, action: { label: 'Show in folder', fn: () => FS.reveal(out.path) } });
    return out;
  }
  F.writeAndTell = writeAndTell;
  // Save into a folder without replacing anything: "Name", then "Name (2)", "Name (3)"…
  F.writeFree = async (folder, stem, ext, data) => {
    for (let n = 1; n < 1000; n++) {
      try { const out = await FS.write(P.join(folder, `${n > 1 ? `${stem} (${n})` : stem}.${ext}`), data, false); F.remember(out.path); return out; }
      catch (e) { if (e.status !== 409) throw e; }
    }
    throw new Error('Too many files with that name');
  };

  // Every export (tables, maps, text, images…) goes through the same sheet when the server runs.
  const downloadSave = L.saveFile;
  L.saveFile = async (data, filename, mime, ext) => {
    if (!FS.on()) return downloadSave(data, filename, mime, ext);
    const origin = L.doc?.origin?.path;
    const res = await F.sheet({ mode: 'save', title: 'Export', name: P.stem(filename), ext: ext || P.ext(filename), origin, folder: L.pref('lastFolder', null) || (origin && P.dir(origin)) });
    if (!res) return null;
    try { await writeAndTell(res, data); return P.base(res.path); }
    catch (e) { L.error('Couldn’t save', e); return null; }
  };
  F.pickFolder = opts => (FS.on() ? F.sheet({ mode: 'folder', ...opts }) : Promise.resolve(null));

  /* ——— Opening ——— */
  F.openPaths = async (paths, opts = {}) => {
    const files = [];
    for (const p of paths) {
      try { const bytes = await FS.read(p), f = new File([bytes], P.base(p), { type: MIME[P.ext(p)] || '' }); f.loeitoPath = p; files.push(f); F.remember(p); }
      catch (e) { if (e.status === 404) F.forget(p); L.error(`Couldn’t open “${P.base(p)}”`, e); }
    }
    if (files.length) await L.openFiles(files, opts);
    L.emit('recent');
  };
  F.open = async ({ append = false } = {}) => {
    if (FS.on()) {
      const res = await F.sheet({ mode: 'open', title: append ? 'Add pages from…' : 'Open', origin: L.doc?.origin?.path });
      if (res === 'native') return nativeOpen(append);
      if (res) await F.openPaths(res.paths, { append });
      return;
    }
    return nativeOpen(append);
  };
  async function nativeOpen(append) {
    // Edge / Chrome: file handles let Loeito save back into the same file later
    if (window.showOpenFilePicker && window.top === window) {
      try {
        const hs = await showOpenFilePicker({ multiple: true, types: [{ description: 'PDFs, images and Office files', accept: { 'application/pdf': ['.pdf'], 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'application/octet-stream': ['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.rtf', '.odt'] } }] });
        const files = await Promise.all(hs.map(async hd => { const f = await hd.getFile(); f.loeitoHandle = hd; return f; }));
        return L.openFiles(files, { append: append && L.hasDoc() });
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    const inp = L.$('#file-input'); inp.value = '';
    inp.onchange = () => inp.files.length && L.openFiles(inp.files, { append: append && L.hasDoc() });
    inp.click();
  }
  // Where an opened file lives — what Save writes back to.
  F.originOf = (file, kind) => ({ kind, name: file.name, path: file.loeitoPath || null, handle: file.loeitoHandle || null });

  /* ——— Saving the document ——— */
  const canWriteBack = o => o && o.kind === 'pdf' && ((o.path && FS.on()) || o.handle);
  const outputDefaults = () => { const { compress, pageSize } = L.outputOptions(); return { ocrLayer: true, compress, pageSize, flattenForm: false, sanitize: L.state.sanitize || null }; };

  // Save (Ctrl S): back into the original file after a short confirmation; Enter = save to the original.
  L.save = async () => {
    if (!L.hasDoc()) return;
    const doc = L.doc, s = doc.state, o = doc.origin;
    if (!canWriteBack(o)) return L.saveAs();
    if (!doc.noAsk) {
      let dontAsk = false;
      const where = o.path ? P.base(P.dir(o.path)) || P.dir(o.path) : null;
      const choice = await L.dialog({
        title: 'Save changes to the original?', focusPrimary: true,
        text: `This updates “${o.name}”${where ? ` in ${where}` : ''}. Want to keep the original as it is? Save a copy instead.`,
        body: h('div', { class: 'stack' },
          o.path ? h('p', { class: 'muted tiny', style: { margin: 0 } }, 'Loeito keeps the previous version as a safety copy for 30 days.') : null,
          ui.check('Don’t ask again for this document', false, v => { dontAsk = v; })),
        actions: [{ label: 'Save a Copy Instead…', value: 'copy' }, { label: 'Save to Original', primary: true, value: 'save' }],
      });
      if (choice === 'copy') return L.saveAs();
      if (choice !== 'save') return;
      if (dontAsk) doc.noAsk = true;
    }
    if (o.handle && !o.path) { // the browser asks once for permission to write
      try { if ((await o.handle.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await o.handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return L.toast('Loeito wasn’t allowed to change the file — save a copy instead.', { kind: 'err' }); }
      catch (e) { return L.error('Couldn’t save', e); }
    }
    const t = L.task('Saving');
    try {
      const bytes = await L.buildPdf({ state: s, pages: s.pages, ...outputDefaults(), task: t });
      if (o.path) { const out = await FS.write(o.path, bytes, true); F.remember(out.path); }
      else { const w = await o.handle.createWritable(); await w.write(bytes); await w.close(); }
      s.dirty = false; L.emit('docs');
      L.toast(`Saved to the original · ${L.fmtBytes(bytes.length)}`, { kind: 'ok', ms: 5200, action: o.path ? { label: 'Show in folder', fn: () => FS.reveal(o.path) } : null });
    } catch (e) {
      if (e.message === 'Cancelled') return;
      t.done();
      const again = await L.dialog({ title: 'Couldn’t save to the original', text: e.message, actions: [{ label: 'Cancel', value: false }, { label: 'Save a Copy…', primary: true, value: true }] });
      if (again) L.saveAs();
      return;
    } finally { t.done(); }
  };

  // Save As: name, place, format and options in one sheet. A full PDF save makes the tab follow the new file.
  L.saveAs = async ({ clean = false } = {}) => {
    if (!L.hasDoc()) return;
    const doc = L.doc, s = doc.state;
    let fmt = 'pdf', scope = 'all', ocrLayer = true, imgFmt = 'png', dpi = 150, flatten = false, tidy = clean;
    const fieldCount = L.forms ? L.forms.all(s).length : 0;
    const ocrCount = s.pages.filter(p => p.ocr).length, redacted = s.pages.filter(p => p.ann.some(a => a.type === 'redact')).length;
    const summary = L.outputSummary(), nSel = s.sel.size;
    const extOf = () => (fmt === 'pdf' ? 'pdf' : fmt === 'text' ? 'txt' : (scope === 'sel' ? nSel : s.pages.length) > 1 ? 'zip' : imgFmt);
    let ctl = null;
    const opts = h('div', { class: 'stack' });
    const paintOpts = () => { ctl && ctl.setExt(extOf()); opts.replaceChildren(...(fmt === 'pdf' ? [
      ocrCount ? ui.check(`Include searchable text (${ocrCount} OCR page${ocrCount > 1 ? 's' : ''})`, ocrLayer, v => { ocrLayer = v; }) : null,
      fieldCount ? ui.field(`Form · ${fieldCount} field${fieldCount > 1 ? 's' : ''}`, ui.seg([{ value: 'fill', label: 'Keep fillable' }, { value: 'flat', label: 'Flatten answers into the page' }], flatten ? 'flat' : 'fill', v => { flatten = v === 'flat'; })) : null,
      ui.check('Clean for sharing — remove hidden data (details, comments, attachments, scripts…)', tidy, v => { tidy = v; }),
      summary ? ui.callout(`Optimize settings will apply: <b>${summary}</b>.`) : null,
      redacted ? ui.callout(`${redacted} page(s) with redactions are flattened so the covered content is really gone.`, 'warn', 'warn') : null,
    ] : fmt === 'images' ? [h('div', { class: 'grid2' },
      ui.field('Format', ui.select([{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPEG' }], imgFmt, v => { imgFmt = v; paintOpts(); })),
      ui.field('Resolution', ui.select([{ value: '72', label: '72 dpi — screen' }, { value: '150', label: '150 dpi — standard' }, { value: '300', label: '300 dpi — print' }], String(dpi), v => { dpi = +v; })))]
      : [h('p', { class: 'muted', style: { margin: 0 } }, 'Plain text in reading order — including text recognised by OCR.')]).filter(Boolean)); };
    const chips = h('div', { class: 'row wrap fs-chips' });
    const extras = c => {
      ctl = c; paintOpts();
      L.suggestNames().then(sug => chips.replaceChildren(...sug.slice(0, 4).map(x => h('button', { class: 'name-chip small', title: x.why, onclick: () => { const inp = L.$('.fs-name'); inp.value = x.name; inp.dispatchEvent(new Event('input')); } }, L.icon('sparkles', 13), x.name))));
      return h('div', { class: 'stack', style: { gap: '12px' } }, chips,
        h('div', { class: 'row wrap', style: { gap: '10px' } },
          ui.seg([{ label: 'PDF', value: 'pdf', icon: 'doc' }, { label: 'Images', value: 'images', icon: 'image' }, { label: 'Text', value: 'text', icon: 'text' }], fmt, v => { fmt = v; paintOpts(); }),
          nSel > 1 ? ui.seg([{ label: `All ${s.pages.length} pages`, value: 'all' }, { label: `${nSel} selected`, value: 'sel' }], scope, v => { scope = v; paintOpts(); }) : null),
        opts);
    };

    let target; // { path, overwrite } | { handle } | { download }
    if (FS.on()) {
      const origin = doc.origin?.path || null;
      const res = await F.sheet({ mode: 'save', title: clean ? 'Save a copy for sharing' : 'Save As', name: s.name, ext: 'pdf', origin, folder: origin ? P.dir(origin) : null, extras });
      if (!res) return;
      target = res;
    } else {
      // no local server: name and options here, then the browser's own save window (or a download)
      const nameIn = h('input', { class: 'input', value: s.name, style: { height: '36px', fontSize: '15px', fontWeight: 600 } });
      const ok = await L.dialog({ title: 'Save As', text: 'Tip: start Loeito with “Start Loeito.cmd” to pick folders right here.', body: h('div', { class: 'stack', style: { gap: '14px' } }, ui.field('Name', nameIn), extras({ setExt: () => {} })), actions: [{ label: 'Cancel', value: false }, { label: 'Save', primary: true, value: true }] });
      if (!ok) return;
      target = { name: L.safeName(nameIn.value), native: true };
    }
    const name = L.safeName(target.name);
    const pages = scope === 'sel' ? s.pages.filter(p => s.sel.has(p.id)) : s.pages;
    const t = L.task('Saving');
    try {
      let data, ext = extOf(), mime = { pdf: 'application/pdf', txt: 'text/plain', zip: 'application/zip', png: 'image/png', jpg: 'image/jpeg' }[ext];
      if (fmt === 'pdf') {
        const { compress, pageSize } = L.outputOptions();
        data = await L.buildPdf({ state: s, pages, ocrLayer, pageSize, compress, flattenForm: flatten, sanitize: tidy ? L.cleanDefaults() : s.sanitize || null, task: t });
      } else if (fmt === 'images') {
        const files = [];
        for (let i = 0; i < pages.length; i++) {
          if (t.cancelled) throw new Error('Cancelled');
          t.set(i / pages.length, `Page ${i + 1} of ${pages.length}`);
          files.push({ name: `${name} — page ${String(L.pageIndex(pages[i].id, s) + 1).padStart(3, '0')}.${imgFmt}`, data: await L.renderPageImage(pages[i], dpi, imgFmt, 0.9, s) });
        }
        if (files.length === 1) data = files[0].data;
        else { await L.loadScript(L.LIBS.jszip); const zip = new JSZip(); files.forEach(f => zip.file(f.name, f.data)); data = await zip.generateAsync({ type: 'blob' }); }
      } else { t.set(0.3, 'Collecting text'); data = new Blob([await L.documentText(pages, s)], { type: 'text/plain' }); }
      const whole = fmt === 'pdf' && scope === 'all' && !tidy;
      if (target.path) {
        const out = await writeAndTell(target, data);
        if (whole) { doc.origin = { kind: 'pdf', name: P.base(out.path), path: out.path, handle: null }; doc.noAsk = false; }
      } else if (window.showSaveFilePicker && window.top === window) {
        const handle = await showSaveFilePicker({ suggestedName: `${name}.${ext}`, types: [{ description: ext.toUpperCase() + ' file', accept: { [mime]: ['.' + ext] } }] }).catch(e => { if (e.name === 'AbortError') throw new Error('Cancelled'); throw e; });
        const w = await handle.createWritable(); await w.write(data); await w.close();
        if (whole) doc.origin = { kind: 'pdf', name: handle.name, path: null, handle };
        L.toast(`Saved “${handle.name}”`, { kind: 'ok' });
      } else { L.download(data, `${name}.${ext}`, mime); }
      if (whole) {
        if (name !== s.name) L.mutate('rename', () => { s.name = name; if (!s.meta.title) s.meta.title = name; }, { silent: true });
        s.dirty = false; L.emit('docs');
      }
    } catch (e) { if (e.message !== 'Cancelled') L.error('Couldn’t save', e); }
    finally { t.done(); }
  };
  L.openSave = L.save; // v1.0 name
})();
