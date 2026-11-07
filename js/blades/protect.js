/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Protect blade: share without leaking.
   Find & black out — words and patterns (CNIC, phone, email, accounts, dates, money), reviewed before anything is removed;
   removal is real on save (the page becomes a picture; the words you didn't black out stay searchable).
   Hidden information — an inspector for what travels unseen inside a PDF, and what Loeito removes when saving. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;
  const PATTERNS = {
    cnic: { label: 'CNIC numbers', re: /\b\d{5}[- ]?\d{7}[- ]?\d\b/g },
    phone: { label: 'Phone numbers', re: /(?:\+|00)?\d[\d ()-]{8,}\d/g },
    email: { label: 'Email addresses', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
    account: { label: 'Bank accounts & IBAN', re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?\b|\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{2,6}\b/g },
    date: { label: 'Dates', re: /\b\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)?\d{2}\b|\b\d{1,2}(?:st|nd|rd|th)?\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s(?:19|20)\d{2}\b/gi },
    money: { label: 'Money amounts', re: /(?:Rs\.?|PKR|USD|US\$|\$|€|£)\s?\d[\d,]*(?:\.\d+)?/gi },
  };
  const PR = (L.protectUI = { terms: '', pats: new Set(), caseSens: false, whole: true, results: null, busy: false, report: null });
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // A word's box in user space (axis-aligned, a hair larger so nothing peeks out).
  function wordRect(w) {
    const rad = (w.a || 0) * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad), px = -uy, py = ux;
    const pts = [[-0.25, 0], [-0.25, 1], [0.85, 0], [0.85, 1]].map(([v, u]) => [w.x + ux * w.w * u + px * w.h * v, w.y + uy * w.w * u + py * w.h * v]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = Math.max(0.6, w.h * 0.06);
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + 2 * pad, h: Math.max(...ys) - Math.min(...ys) + 2 * pad };
  }
  // Words of one match → one box per line.
  function boxesFor(ws) {
    const lines = [];
    for (const w of ws) {
      const r = wordRect(w), l = lines.find(b => Math.abs(b.cy - (r.y + r.h / 2)) < r.h * 0.5);
      if (l) { const x2 = Math.max(l.x + l.w, r.x + r.w), y2 = Math.max(l.y + l.h, r.y + r.h); l.x = Math.min(l.x, r.x); l.y = Math.min(l.y, r.y); l.w = x2 - l.x; l.h = y2 - l.y; }
      else lines.push({ ...r, cy: r.y + r.h / 2 });
    }
    return lines.map(({ cy, ...r }) => r);
  }
  async function find() {
    const S = L.state, terms = PR.terms.split(/\n|,|;/).map(t => t.trim()).filter(t => t.length > 1);
    const res = [];
    for (const t of terms) res.push(new RegExp(PR.whole ? `(?<![\\w])${esc(t)}(?![\\w])` : esc(t), PR.caseSens ? 'g' : 'gi'));
    for (const k of PR.pats) res.push(new RegExp(PATTERNS[k].re.source, PATTERNS[k].re.flags));
    if (!res.length) return L.toast('Type a word, or pick a kind of information to find', { icon: 'info' });
    PR.busy = true; L.renderInspector();
    const out = [], t = S.pages.length > 6 ? L.task('Looking through the pages') : null;
    try {
      for (let i = 0; i < S.pages.length; i++) {
        if (t) { if (t.canceled) break; t.set(i / S.pages.length, `Page ${i + 1} of ${S.pages.length}`); }
        const p = S.pages[i];
        const pdf = await L.pageWords(p, { prefer: 'pdf' }).catch(() => []), words = pdf.length ? pdf : p.ocr?.words || [];
        let str = ''; const starts = [];
        for (const w of words) { starts.push(str.length); str += w.t + ' '; }
        const seen = new Set();
        for (const re of res) {
          re.lastIndex = 0; let m;
          while ((m = re.exec(str))) {
            if (!m[0].trim()) { re.lastIndex++; continue; }
            const a = m.index, b = a + m[0].length, ws = words.filter((w, k) => starts[k] < b && starts[k] + w.t.length > a);
            const key = ws.map(w => words.indexOf(w)).join(','); if (!ws.length || seen.has(key)) continue; seen.add(key);
            out.push({ pageId: p.id, page: i, text: m[0].trim(), rects: boxesFor(ws), on: true });
            if (out.length > 2000) break;
          }
        }
      }
    } finally { t && t.done(); PR.busy = false; }
    PR.results = out;
    L.drawOverlay(); L.renderInspector();
    if (!out.length) L.toast('Nothing found. Scans need Make Searchable first.', { icon: 'info' });
  }
  function blackOut() {
    const S = L.state, chosen = (PR.results || []).filter(r => r.on); if (!chosen.length) return;
    L.mutate(`black out ${chosen.length}`, () => { for (const r of chosen) { const p = S.pages.find(x => x.id === r.pageId); if (p) for (const box of r.rects) p.ann.push({ id: L.uid('a'), type: 'redact', r: box }); } });
    L.toast(`${chosen.length} place${chosen.length > 1 ? 's' : ''} blacked out — removed for real when you save`, { kind: 'ok', icon: 'shield', ms: 5200 });
    PR.results = null; L.renderInspector();
  }

  /* ——— Hidden information ——— */
  L.inspectHidden = async (S = L.state) => {
    const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFString, PDFHexString } = PDFLib;
    const R = { comments: 0, links: 0, pageScripts: 0, docScripts: 0, attachments: [], pageAttachments: 0, layers: [], hiddenLayers: [], layerPages: new Set(), private: 0, thumbs: 0, bookmarks: 0, xmp: 0 };
    const N = PDFName.of, text = v => (v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : '');
    const COMMENTS = new Set(['/Text', '/FreeText', '/Highlight', '/Underline', '/StrikeOut', '/Squiggly', '/Ink', '/Stamp', '/Square', '/Circle', '/Line', '/Polygon', '/PolyLine', '/Caret', '/Sound', '/Redact']);
    for (const id of [...new Set(S.pages.map(p => p.src))]) {
      let doc; try { doc = await PDFDocument.load(L.sources[id].bytes, { ignoreEncryption: true, updateMetadata: false }); } catch { continue; }
      const ctx = doc.context, look = v => (v instanceof PDFRef ? ctx.lookup(v) : v), cat = doc.catalog;
      const xmp = look(cat.get(N('Metadata'))); if (xmp && xmp.contents) R.xmp += xmp.contents.length;
      const names = look(cat.get(N('Names')));
      const walk = (node, out) => { node = look(node); if (!(node instanceof PDFDict)) return; const arr = look(node.get(N('Names'))); if (arr instanceof PDFArray) for (let i = 0; i < arr.size(); i += 2) out.push(text(look(arr.get(i)))); const kids = look(node.get(N('Kids'))); if (kids instanceof PDFArray) for (let i = 0; i < kids.size(); i++) walk(kids.get(i), out); };
      if (names instanceof PDFDict) { walk(names.get(N('EmbeddedFiles')), R.attachments); const js = []; walk(names.get(N('JavaScript')), js); R.docScripts += js.length; }
      const oa = look(cat.get(N('OpenAction'))); if (oa instanceof PDFDict && String(oa.get(N('S'))) === '/JavaScript') R.docScripts++;
      if (cat.get(N('AA'))) R.docScripts++;
      if (cat.get(N('PieceInfo'))) R.private++;
      const ol = look(cat.get(N('Outlines'))); if (ol instanceof PDFDict) { let n = 0; const stack = [look(ol.get(N('First')))]; while (stack.length && n < 5000) { const it = stack.pop(); if (!(it instanceof PDFDict)) continue; n++; stack.push(look(it.get(N('Next'))), look(it.get(N('First')))); } R.bookmarks += n; }
      const ocp = look(cat.get(N('OCProperties')));
      if (ocp instanceof PDFDict) {
        const ocgs = look(ocp.get(N('OCGs'))), d = look(ocp.get(N('D'))), off = d instanceof PDFDict ? look(d.get(N('OFF'))) : null;
        const offSet = new Set(); if (off instanceof PDFArray) for (let i = 0; i < off.size(); i++) offSet.add(String(off.get(i)));
        if (ocgs instanceof PDFArray) for (let i = 0; i < ocgs.size(); i++) { const ref = ocgs.get(i), g = look(ref), nm = g instanceof PDFDict ? text(look(g.get(N('Name')))) || 'Layer' : 'Layer'; R.layers.push(nm); if (offSet.has(String(ref))) R.hiddenLayers.push(nm); }
        if (R.hiddenLayers.length) S.pages.filter(p => p.src === id).forEach(p => R.layerPages.add(p.id));
      }
      for (const p of S.pages.filter(x => x.src === id)) {
        let node; try { node = doc.getPage(p.index).node; } catch { continue; }
        if (node.get(N('Thumb'))) R.thumbs++;
        if (node.get(N('PieceInfo'))) R.private++;
        if (node.get(N('AA'))) R.pageScripts++;
        const an = look(node.get(N('Annots'))); if (!(an instanceof PDFArray)) continue;
        for (let i = 0; i < an.size(); i++) {
          const a = look(an.get(i)); if (!(a instanceof PDFDict)) continue;
          const sub = String(a.get(N('Subtype')));
          if (COMMENTS.has(sub)) R.comments++;
          else if (sub === '/FileAttachment') R.pageAttachments++;
          else if (sub === '/Link') { const act = look(a.get(N('A'))); const s = act instanceof PDFDict ? String(act.get(N('S'))) : ''; if (s === '/URI') R.links++; if (s === '/JavaScript') R.pageScripts++; }
        }
      }
    }
    const m = S.meta || {};
    R.details = [['Title', m.title], ['Author', m.author], ['Subject', m.subject], ['Keywords', m.keywords]].filter(([, v]) => v && String(v).trim());
    const all = L.forms ? L.forms.all(S) : [];
    R.fields = all.length; R.answers = all.filter(x => x.f.kind !== 'button' && x.f.value !== '' && x.f.value !== false && x.f.value != null).length;
    R.ocrPages = S.pages.filter(p => p.ocr).length;
    return R;
  };
  const CLEAN_KEYS = [['details', 'Document details'], ['comments', 'Comments & markups'], ['attachments', 'Attached files'], ['scripts', 'Scripts'], ['links', 'Web links'], ['private', 'Private app data'], ['thumbs', 'Page thumbnails']];
  const setClean = (k, v) => { const S = L.state, c = { ...(S.sanitize || {}) }; c[k] = v; S.sanitize = Object.values(c).some(Boolean) ? c : null; S.dirty = true; L.emit('docs'); L.renderInspector(); };
  async function inspect() {
    PR.busy = true; L.renderInspector();
    try { PR.report = await L.inspectHidden(); } catch (e) { L.error('Couldn’t inspect the document', e); }
    finally { PR.busy = false; L.renderInspector(); }
  }
  function reportView(R) {
    const S = L.state, c = S.sanitize || {};
    const row = (icon, title, detail, control) => h('div', { class: 'insp-row' }, L.icon(icon, 18), h('div', { class: 'grow' }, h('b', null, title), detail ? h('span', null, detail) : null), control || null);
    const keepBox = k => h('label', { class: 'switch', title: 'Remove when saving' }, h('input', { type: 'checkbox', checked: !!c[k], onchange: e => setClean(k, e.target.checked) }), h('span'));
    const auto = () => h('span', { class: 'pill ok', title: 'Loeito doesn’t carry this into the saved file' }, 'Not kept');
    const layerFlat = S.pages.filter(p => R.layerPages.has(p.id)).every(p => p.flatten);
    const rows = [
      row('tag', 'Document details', R.details.length ? R.details.map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(' · ') : 'None set', keepBox('details')),
      row('doc', 'Hidden metadata (XMP)', R.xmp ? `${L.fmtBytes(R.xmp)} in the original — Loeito’s save doesn’t carry it over` : 'None', auto()),
      row('comment', 'Comments & markups', R.comments ? `${R.comments} on the pages` : 'None', R.comments ? keepBox('comments') : auto()),
      row('clip', 'Attached files', [R.attachments.length ? `${R.attachments.length} attached to the document (${R.attachments.slice(0, 3).join(', ')}) — not kept` : '', R.pageAttachments ? `${R.pageAttachments} pinned to pages` : ''].filter(Boolean).join(' · ') || 'None', R.pageAttachments ? keepBox('attachments') : auto()),
      row('code', 'Scripts', [R.docScripts ? `${R.docScripts} document script(s) — not kept` : '', R.pageScripts ? `${R.pageScripts} on pages or links` : ''].filter(Boolean).join(' · ') || 'None', R.pageScripts ? keepBox('scripts') : auto()),
      row('link', 'Web links', R.links ? `${R.links} clickable link(s)` : 'None', R.links ? keepBox('links') : null),
      row('layers', 'Hidden layers', R.hiddenLayers.length ? `${R.hiddenLayers.join(', ')} — would become visible in a copy` : R.layers.length ? `${R.layers.length} layer(s), all visible` : 'None',
        R.hiddenLayers.length ? (layerFlat ? h('span', { class: 'pill ok' }, 'Flattened') : ui.btn('Flatten pages', null, () => { L.mutate('flatten layered pages', () => S.pages.forEach(p => { if (R.layerPages.has(p.id)) p.flatten = true; })); L.renderInspector(); }, 'small')) : null),
      row('gear', 'Private app data & thumbnails', R.private || R.thumbs ? `${R.private ? R.private + ' private data block(s)' : ''}${R.private && R.thumbs ? ' · ' : ''}${R.thumbs ? R.thumbs + ' thumbnail(s)' : ''}` : 'None', R.private || R.thumbs ? h('div', { class: 'row', style: { gap: '6px' } }, keepBox('private'), keepBox('thumbs')) : auto()),
      row('form', 'Form answers', R.fields ? `${R.answers} of ${R.fields} fields filled in` : 'No form', R.answers ? ui.btn('Clear', null, () => { L.mutate('clear answers', () => L.forms.all().forEach(({ f }) => { if (!f.calc && f.kind !== 'button') f.value = f.kind === 'check' ? false : ''; })); L.forms.recalc(); inspect(); }, 'small') : null),
      row('list', 'Bookmarks', R.bookmarks ? `${R.bookmarks} — not kept by Loeito 1.1 (coming in 1.2)` : 'None', null),
      row('ocr', 'Searchable text from OCR', R.ocrPages ? `${R.ocrPages} page(s) — invisible text Loeito added so search works; kept` : 'None', null),
    ];
    return h('div', { class: 'insp-list' }, rows);
  }

  /* ——— Password: lock with AES-256, choose what people may do, or remove a password ——— */
  const strength = pw => { let n = 0; if (pw.length >= 8) n++; if (pw.length >= 12) n++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++; if (/\d/.test(pw)) n++; if (/[^A-Za-z0-9]/.test(pw)) n++; return Math.min(4, n); };
  const PW = { open: '', confirm: '', owner: '', allow: new Set(['print', 'copy', 'forms']), show: false };
  function passwordSection() {
    const S = L.state, sec = S.security, wasLocked = S.pages.some(p => L.sources[p.src]?.encrypted);
    const crypto = L.server && L.server.crypto;
    if (!L.fs.on()) return ui.section('Password', ui.callout('Adding or removing a password needs the <b>Loeito desktop app</b>.', '', 'shield'));
    if (!crypto) return ui.section('Password', ui.callout('Passwords need two free Python packages. In a terminal run <b>py -m pip install pypdf cryptography</b>, then restart Loeito.', 'warn', 'warn'));
    const s = strength(PW.open), words = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
    const pwIn = (k, ph) => h('input', { class: 'input', type: PW.show ? 'text' : 'password', value: PW[k], placeholder: ph, autocomplete: 'new-password', oninput: e => { PW[k] = e.target.value; if (k === 'open') { const m = e.target.closest('.section').querySelector('.pw-meter'); m.dataset.s = strength(PW.open); m.querySelector('span').textContent = PW.open ? words[strength(PW.open)] : ''; } } });
    const perm = (k, label) => ui.check(label, PW.allow.has(k), v => { v ? PW.allow.add(k) : PW.allow.delete(k); });
    return ui.section('Password',
      h('div', { class: 'stack' },
        wasLocked ? ui.callout(sec ? 'This file was password-protected. It will be saved with the new protection below.' : sec === null ? '<b>The password will be removed</b> when you save.' : 'This file is password-protected. Saving keeps it protected unless you remove the password.', '', 'shield') : null,
        sec ? h('div', { class: 'callout', style: { background: 'var(--accent-soft)' } }, L.icon('shield'), h('div', null, h('b', null, 'Protected when saved'), ` · AES-256 · ${sec.open ? 'needs a password to open' : 'opens freely, changes are limited'} · allowed: ${(sec.allow || []).join(', ') || 'nothing'}`)) : null,
        ui.field('Password to open the file', pwIn('open', 'Leave empty to let anyone open it')),
        h('div', { class: 'pw-meter', 'data-s': s }, h('i'), h('i'), h('i'), h('i'), h('span', null, PW.open ? words[s] : '')),
        ui.field('Type it again', pwIn('confirm', 'The same password')),
        h('details', { class: 'more' }, h('summary', null, 'What people may do with it'),
          h('div', { class: 'stack', style: { marginTop: '8px' } },
            perm('print', 'Print'), perm('copy', 'Copy text and pictures'), perm('forms', 'Fill in forms and add comments'), perm('edit', 'Change pages and content'),
            ui.field('Owner password (needed to change these limits)', pwIn('owner', 'Recommended when limits are set')))),
        ui.check('Show passwords', PW.show, v => { PW.show = v; L.renderInspector(); }),
        h('div', { class: 'grid2' },
          ui.btn(sec ? 'Update protection' : 'Protect when saving', 'shield', () => {
            if (PW.open !== PW.confirm) return L.toast('The two passwords are different.', { kind: 'err' });
            if (!PW.open && !PW.owner) return L.toast('Type a password to open the file, or an owner password for the limits.', { kind: 'err' });
            if (PW.open && strength(PW.open) < 2 && !confirm('This password is easy to guess. Use it anyway?')) return;
            S.security = { open: PW.open, owner: PW.owner || (PW.open ? '' : ''), allow: [...PW.allow] }; S.dirty = true; L.emit('docs'); L.renderInspector();
            L.toast('The file will be protected each time you save it', { kind: 'ok', icon: 'shield' });
          }, 'primary'),
          sec || wasLocked ? ui.btn('Remove password', 'close', () => { S.security = null; S.dirty = true; L.emit('docs'); L.renderInspector(); L.toast('The password goes away when you save', { icon: 'shield' }); }) : h('span')),
        sec ? ui.btn('Save a protected copy…', 'folder', () => L.saveAs(), 'block') : null,
        h('p', { class: 'muted tiny', style: { margin: 0 } }, 'Write the password down somewhere safe — nobody, not even Loeito, can open the file without it.')));
  }

  L.registerBlade({
    id: 'protect', label: 'Protect', icon: 'shield', color: '#1d1d1f',
    desc: 'Black out private details for real, and remove hidden information before you share.',
    activate() { L.setCursor(''); },
    draw({ svg, view, page }) {
      if (!PR.results) return;
      const g = L.s('g', { 'pointer-events': 'none' });
      for (const r of PR.results) if (r.pageId === page.id && r.on) for (const b of r.rects) { const s = view.rectToScreen(b); g.append(L.s('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: 2, class: 'redact-hit' })); }
      svg.append(g);
    },
    inspector() {
      const S = L.state, res = PR.results, chosen = res ? res.filter(r => r.on).length : 0;
      const existing = S.pages.reduce((a, p) => a + p.ann.filter(x => x.type === 'redact').length, 0);
      const byPage = res ? [...new Set(res.map(r => r.page))].length : 0;
      return [
        ui.head('shield', 'Protect', 'Share without leaking: black out what’s private, remove what’s hidden.'),
        ui.section('Find & black out',
          h('div', { class: 'stack' },
            h('textarea', { class: 'input', rows: 2, value: PR.terms, placeholder: 'Names, numbers or phrases — one per line', oninput: e => { PR.terms = e.target.value; } }),
            h('div', { class: 'token-chips' }, Object.entries(PATTERNS).map(([k, p]) => h('button', { class: 'chip toggle' + (PR.pats.has(k) ? ' on' : ''), onclick: () => { PR.pats.has(k) ? PR.pats.delete(k) : PR.pats.add(k); L.renderInspector(); } }, p.label))),
            h('div', { class: 'row', style: { gap: '16px' } }, ui.check('Whole words', PR.whole, v => { PR.whole = v; }), ui.check('Match case', PR.caseSens, v => { PR.caseSens = v; })),
            ui.btn(PR.busy ? 'Looking…' : 'Find', 'search', find, 'block'),
            res && res.length ? h('div', { class: 'stack' },
              h('div', { class: 'row between' }, h('b', { style: { fontSize: '13px' } }, `${res.length} found on ${byPage} page${byPage > 1 ? 's' : ''}`),
                h('button', { class: 'linkish', onclick: () => { const all = res.every(r => r.on); res.forEach(r => { r.on = !all; }); L.drawOverlay(); L.renderInspector(); } }, res.every(r => r.on) ? 'None' : 'All')),
              h('div', { class: 'list', style: { maxHeight: '220px', overflow: 'auto' } }, res.slice(0, 300).map(r => h('label', { class: 'list-item' },
                h('input', { type: 'checkbox', checked: r.on, onchange: e => { r.on = e.target.checked; L.drawOverlay(); L.renderInspector(); } }),
                h('span', { class: 'grow mono', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }, onclick: e => { e.preventDefault(); L.go(r.page); } }, r.text),
                h('span', { class: 'muted tiny' }, `p${r.page + 1}`)))),
              h('div', { class: 'grid2' }, ui.btn(`Black out ${chosen}`, 'redact', blackOut, 'primary'), ui.btn('Clear', 'close', () => { PR.results = null; L.drawOverlay(); L.renderInspector(); }))) : null,
            existing ? ui.callout(`<b>${existing} black box${existing > 1 ? 'es' : ''}</b> in this document. When you save, those pages become pictures, so the covered text is gone for good; the rest stays searchable.`, '', 'shield') : null)),
        passwordSection(),
        ui.section('Hidden information',
          h('div', { class: 'stack' },
            h('p', { class: 'muted tiny', style: { margin: 0 } }, 'PDFs can carry things you don’t see: details about who made them, comments, attached files, scripts, hidden layers.'),
            ui.btn(PR.busy ? 'Inspecting…' : PR.report ? 'Inspect again' : 'Inspect this document', 'search', inspect, PR.report ? 'block' : 'block primary'),
            PR.report ? reportView(PR.report) : null,
            PR.report ? h('p', { class: 'muted tiny', style: { margin: 0 } }, S.sanitize ? `Switched on: removed every time this document is saved (${CLEAN_KEYS.filter(([k]) => S.sanitize[k]).map(([, l]) => l.toLowerCase()).join(', ')}).` : 'Switch items on to remove them every time this document is saved.') : null,
            ui.btn('Save a clean copy for sharing…', 'shield', () => L.saveAs({ clean: true }), 'block'))),
      ];
    },
  });
  L.on('docs', () => { if (L.state.blade !== 'protect') PR.report = null; });
  L.on('page', () => { if (L.state.blade === 'protect') L.drawOverlay(); });
})();
