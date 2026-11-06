/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Smart naming, document details and the Save sheet. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;

  const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via', 'with']);
  // Short all-caps words that are ordinary English, not acronyms.
  const COMMON = new Set(('a an and as at be but by for from in into is it of on or per the to via with no not all any are was has had its our out new old one two six ten act law laws plan farm zone part page rule rules city land area plot sale road date year high low main east west each upon over under than that this they then them what when who why how may can shall will must were been also both such only same some most more less used use made make also bye laws rate fee fees tax term form note list item unit case file')
    .split(' '));
  const isAcronym = w => { const b = w.replace(/[^A-Za-z]/g, ''); return /^[A-Z]{2,4}$/.test(b) && !COMMON.has(b.toLowerCase()); };
  L.titleCase = s => {
    const words = String(s).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
    return words.map((w, i) => {
      if (isAcronym(w)) return w;
      const lw = w.toLowerCase();
      if (i > 0 && i < words.length - 1 && SMALL.has(lw)) return lw;
      return lw.replace(/(^|[-–(/"'])([a-z])/g, (m, a, b) => a + b.toUpperCase());
    }).join(' ');
  };
  const prettyFile = n => L.titleCase(String(n || '').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_.]+/g, ' '));
  const prettyMeta = t => L.titleCase(String(t || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2').replace(/[_]+/g, ' '));
  // "Capital Development Authority" → "CDA"
  const ORG_END = 'Authority|Ministry|Department|University|Corporation|Commission|Board|Council|Agency|Institute|Directorate|Company|Bank';
  const ORG = new RegExp(`\\b((?:[A-Z][A-Za-z&]+[ \\t]+){1,4}(?:${ORG_END}|${ORG_END.toUpperCase()}))\\b`, 'g');
  // The most frequently named organisation, e.g. "Capital Development Authority" → "CDA" (ignores "Published by Authority").
  const orgAcronym = text => {
    const counts = {};
    for (const m of text.matchAll(ORG)) {
      const words = m[1].trim().split(/[ \t]+/), i = words.findIndex(w => SMALL.has(w.toLowerCase()) || /^(published|issued|printed)$/i.test(w));
      const name = (i >= 0 ? words.slice(i + 1) : words).join(' ').toLowerCase();
      if (name.split(' ').length >= 2) counts[name] = (counts[name] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]; if (!top) return null;
    const a = top[0].split(' ').map(w => w[0].toUpperCase()).join('');
    return a.length >= 2 && a.length <= 6 ? a : null;
  };
  // A line is trustworthy when most of its words recur elsewhere in the text (OCR garbage rarely does).
  const plausible = (line, text) => {
    const words = line.toLowerCase().match(/[a-z]{3,}/g) || []; if (!words.length) return false;
    const hay = text.toLowerCase(); let ok = 0;
    for (const w of words) { const i = hay.indexOf(w); if (i >= 0 && hay.indexOf(w, i + w.length) >= 0) ok++; else if (/^(the|and|for|with|under|of)$/.test(w)) ok++; }
    return ok / words.length >= 0.5;
  };
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function findDate(text) {
    const m1 = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+((?:19|20)\d\d)\b/i);
    if (m1) return [+m1[3], MONTHS.indexOf(m1[1].slice(0, 3).toLowerCase()) + 1, +m1[2]];
    const m2 = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?,?\s+((?:19|20)\d\d)\b/i);
    if (m2) return [+m2[3], MONTHS.indexOf(m2[2].slice(0, 3).toLowerCase()) + 1, +m2[1]];
    const m3 = text.match(/\b((?:19|20)\d\d)-(\d{2})-(\d{2})\b/); if (m3) return [+m3[1], +m3[2], +m3[3]];
    return null;
  }
  const iso = d => d && `${d[0]}-${String(d[1]).padStart(2, '0')}-${String(d[2]).padStart(2, '0')}`;
  const clip = (s, n = 72) => {
    s = s.trim(); if (s.length <= n) return s;
    let cut = s.slice(0, n); cut = cut.slice(0, cut.lastIndexOf(' ') > 30 ? cut.lastIndexOf(' ') : n);
    if ((cut.match(/\(/g) || []).length > (cut.match(/\)/g) || []).length) cut = cut.slice(0, cut.lastIndexOf('('));
    for (let i = 0; i < 3; i++) cut = cut.trim().replace(/[,;:\-–—&]+$/, '').replace(/\s+(and|or|of|for|the|under|in|to|with|by|framed)$/i, '');
    return cut.trim();
  };

  L.suggestNames = async () => {
    const s = L.state, out = [], seen = new Set();
    const add = (name, why) => { name = L.safeName(name); const k = name.toLowerCase(); if (name.length > 2 && !seen.has(k)) { seen.add(k); out.push({ name, why }); } };
    const firstSrc = Object.values(s.sources)[0];
    let info = {};
    try { info = (await firstSrc.doc.getMetadata()).info || {}; } catch {}
    // headline: the largest text on page 1 (PDF text or OCR)
    let headline = '', text = '';
    const p0 = s.pages[0];
    if (p0) {
      const words = await L.pageWords(p0);
      text = L.wordsToText(words, p0) + '\n' + (s.pages[1] ? await L.pageText(s.pages[1]) : '');
      const lines = L.wordsToText(words, p0).split('\n');
      const proxy = L.proxySync(p0), v = L.makeView(proxy, p0, 1, { full: true });
      const sized = lines.map(line => {
        const ws = words.filter(w => line.includes(w.t)); const hs = ws.map(w => L.wordBox(w, v).h);
        return { line, size: hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : 0 };
      }).filter(x => /[A-Za-z]{3}/.test(x.line) && x.line.length > 6 && x.line.length < 120 && !/^(page|\d+)\b/i.test(x.line));
      sized.sort((a, b) => b.size - a.size);
      const good = sized.find(x => plausible(x.line, text));
      if (good) headline = good.line;
      // An explicit "Subject:" / "Re:" / "Title:" line wins, including its continuation lines.
      const p1 = lines.join(' ');
      const subj = p1.match(/\b(?:subject|re|title|topic)\s*[:.\-—–]+\s*(.{12,240}?)(?:\.\s|$)/i);
      if (subj) add(clip(L.titleCase(subj[1].replace(/[-—–]+\s*$/, '')), 90), 'Subject line on page 1');
      // Otherwise a line that names the kind of document
      const kind = lines.find(l => /\b(regulations?|bylaws?|by-laws?|act|ordinance|report|policy|guidelines?|manual|thesis|proposal|agreement|contract|minutes|specifications?|notification)\b/i.test(l) && l.length < 110 && l.trim().split(/\s+/).length >= 3 && plausible(l, text));
      if (kind) add(clip(L.titleCase(kind)), 'Describes the document type');
    }
    const date = findDate(text) || (info.CreationDate ? (m => m && [+m[1], +m[2], +m[3]])(String(info.CreationDate).match(/D:(\d{4})(\d{2})(\d{2})/)) : null);
    const acr = orgAcronym(text.split('\n').slice(0, 40).join('\n')) || (() => { const c = {}; for (const m of text.matchAll(/\b[A-Z]{2,4}\b/g)) if (isAcronym(m[0]) && !/^(II|III|IV|VI|VII|VIII|IX|XI|XII)$/.test(m[0])) c[m[0]] = (c[m[0]] || 0) + 1; const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return top && top[1] >= 2 ? top[0] : null; })();
    const fromFile = prettyFile(firstSrc?.name);
    const fromMeta = info.Title && /[A-Za-z]{3}/.test(info.Title) ? prettyMeta(info.Title) : '';
    const best = out[0]?.name || fromMeta || (headline ? clip(L.titleCase(headline)) : '') || fromFile;
    if (fromMeta) add(clip(fromMeta), 'From the document’s own title');
    if (headline) add(clip(L.titleCase(headline)), 'Largest heading on page 1');
    if (date) add(`${iso(date)} — ${best}`, 'Date first — sorts chronologically');
    const yr = date && !best.includes(String(date[0])) ? ` (${date[0]})` : '';
    if (acr && !best.toUpperCase().includes(acr)) add(`${acr} — ${best}${yr}`, `Organisation “${acr}” named on page 1`);
    else if (yr) add(best + yr, 'With the year');
    add(fromFile, 'Original file name, tidied');
    return out.slice(0, 6);
  };

  /* ——— Document properties: name, details stored in the PDF, a health check and one-click tidy-up ——— */
  const LANGS = [['', 'Not set'], ['en-GB', 'English (UK)'], ['en-US', 'English (US)'], ['ur-PK', 'Urdu'], ['ar', 'Arabic'], ['de-DE', 'German'], ['fr-FR', 'French'], ['es-ES', 'Spanish'], ['zh-CN', 'Chinese'], ['sv-SE', 'Swedish'], ['nl-NL', 'Dutch']];
  const tidyText = t => String(t || '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tidyTitle = t => { t = tidyText(t).replace(/\.(pdf|docx?|xlsx?)$/i, ''); return t === t.toUpperCase() && /[A-Z]{4}/.test(t) ? L.titleCase(t.toLowerCase()) : t; };
  const tidyKeywords = k => [...new Set(String(k || '').split(/[,;|\n]+/).map(x => tidyText(x)).filter(Boolean).map(x => x.toLowerCase()))].join(', ');
  const toDateInput = d => (d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : '');
  // What a careful librarian would point out about the details.
  function checkMeta(m, name) {
    const out = [];
    if (!tidyText(m.title)) out.push({ level: 'warn', text: 'No title — viewers and search engines show the file name instead.', fix: x => { x.title = tidyTitle(name); } });
    else if (tidyTitle(m.title) !== m.title) out.push({ level: 'info', text: 'Title has extra spaces, underscores, a file extension or is ALL CAPS.', fix: x => { x.title = tidyTitle(x.title); } });
    if (!tidyText(m.author)) out.push({ level: 'info', text: 'No author — add who made or owns the document.' });
    if (m.keywords && tidyKeywords(m.keywords) !== m.keywords) out.push({ level: 'info', text: 'Keywords are mixed or repeated — they read best as “one, two, three”.', fix: x => { x.keywords = tidyKeywords(x.keywords); } });
    if (!m.lang) out.push({ level: 'info', text: 'No language — screen readers and spell-checkers need it.', fix: x => { x.lang = navigator.language || 'en-GB'; } });
    if (m.subject && m.subject.length > 250) out.push({ level: 'info', text: 'The subject is very long — keep it to a sentence or two.' });
    if (m.title && !m.displayTitle) out.push({ level: 'info', text: 'Viewers show the file name in their title bar — they can show the title instead.', fix: x => { x.displayTitle = true; } });
    return out;
  }
  L.openNameSheet = async () => {
    if (!L.hasDoc()) return;
    const s = L.state, m = { creator: '', lang: '', created: null, custom: [], displayTitle: false, ...s.meta, custom: [...(s.meta.custom || [])] };
    const src = Object.values(s.sources).find(x => x.id === s.pages[0].src);
    const nameIn = h('input', { class: 'input', value: s.name, style: { height: '36px', fontSize: '15px', fontWeight: 600 } });
    const list = h('div', { class: 'stack' }, h('p', { class: 'muted', style: { margin: 0 } }, 'Reading the document…'));
    const form = h('div', { class: 'stack' }), checks = h('div', { class: 'stack' }), original = h('dl', { class: 'kv tiny' });
    const input = (k, label, ph = '') => ui.field(label, h('input', { class: 'input', value: m[k] || '', placeholder: ph, oninput: e => { m[k] = e.target.value; paintChecks(); } }));
    function paintForm() {
      form.replaceChildren(
        h('div', { class: 'grid2' }, input('title', 'Title'), input('author', 'Author', 'Who made or owns it')),
        input('subject', 'Subject', 'One sentence about the document'),
        input('keywords', 'Keywords', 'e.g. bylaws, zoning, Islamabad'),
        h('div', { class: 'grid3' },
          ui.field('Language', ui.select(LANGS.map(([value, label]) => ({ value, label })), m.lang || '', v => { m.lang = v; paintChecks(); })),
          ui.field('Created', h('input', { class: 'input', type: 'date', value: toDateInput(m.created ? new Date(m.created) : null), onchange: e => { m.created = e.target.value ? new Date(e.target.value + 'T12:00').toISOString() : null; } })),
          input('creator', 'Made with', 'e.g. Microsoft Word')),
        ui.check('Show the title (not the file name) in viewers’ title bars', m.displayTitle, v => { m.displayTitle = v; paintChecks(); }),
        h('div', { class: 'stack' }, h('span', { class: 'label' }, 'Your own fields'),
          ...m.custom.map((c, i) => h('div', { class: 'row', style: { gap: '6px' } },
            h('input', { class: 'input', value: c.k, placeholder: 'Name, e.g. Project', oninput: e => { c.k = e.target.value; } }),
            h('input', { class: 'input', value: c.v, placeholder: 'Value', oninput: e => { c.v = e.target.value; } }),
            h('button', { class: 'icon-btn small', title: 'Remove', onclick: () => { m.custom.splice(i, 1); paintForm(); } }, L.icon('trash')))),
          h('button', { class: 'linkish', style: { alignSelf: 'flex-start' }, onclick: () => { m.custom.push({ k: '', v: '' }); paintForm(); } }, '+ Add a field')));
      paintChecks();
    }
    function paintChecks() {
      const issues = checkMeta(m, nameIn.value || s.name), fixable = issues.filter(i => i.fix);
      checks.replaceChildren(
        issues.length ? h('div', { class: 'insp-list' }, issues.map(i => h('div', { class: 'insp-row' }, L.icon(i.level === 'warn' ? 'warn' : 'info', 16), h('div', { class: 'grow' }, h('span', null, i.text)),
          i.fix ? h('button', { class: 'btn small', onclick: () => { i.fix(m); paintForm(); } }, 'Fix') : null)))
          : h('div', { class: 'callout' }, L.icon('check'), h('div', null, 'The details look complete and tidy.')),
        fixable.length > 1 ? ui.btn(`Tidy up everything (${fixable.length})`, 'sparkles', () => { fixable.forEach(i => i.fix(m)); paintForm(); }, 'block') : null);
    }
    src?.doc.getMetadata().then(({ info }) => {
      const d = x => { const r = String(x || '').match(/D:(\d{4})(\d{2})(\d{2})/); return r ? `${r[3]}/${r[2]}/${r[1]}` : '—'; };
      original.replaceChildren(...[['Title', info.Title], ['Author', info.Author], ['Made with', [info.Creator, info.Producer].filter(Boolean).join(' · ')], ['Created', d(info.CreationDate)], ['Modified', d(info.ModDate)], ['PDF version', info.PDFFormatVersion], ['Protected', info.IsEncrypted ? 'Yes (password)' : 'No']]
        .filter(r => r[1]).flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
      if (!m.created && info.CreationDate) { const r = String(info.CreationDate).match(/D:(\d{4})(\d{2})(\d{2})/); if (r) { m.created = new Date(+r[1], +r[2] - 1, +r[3], 12).toISOString(); paintForm(); } }
      if (!m.creator && info.Creator) { m.creator = info.Creator; paintForm(); }
    }).catch(() => {});
    paintForm();
    const body = h('div', { class: 'stack', style: { gap: '14px' } },
      ui.field('File name', nameIn),
      h('div', null, h('span', { class: 'label', style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' } }, L.icon('sparkles', 14), 'Suggestions'), list),
      h('div', null, h('span', { class: 'label', style: { display: 'block', marginBottom: '8px' } }, 'Details saved inside the PDF'), form),
      h('div', null, h('span', { class: 'label', style: { display: 'block', marginBottom: '8px' } }, 'Check'), checks),
      h('details', { class: 'more' }, h('summary', null, 'What the original file says'), original));
    L.suggestNames().then(sug => {
      list.replaceChildren(...sug.map(x => h('button', { class: 'name-chip', onclick: e => { nameIn.value = x.name; L.$$('.name-chip', list).forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); paintChecks(); } }, h('b', null, x.name), h('span', null, x.why))));
      if (!sug.length) list.replaceChildren(h('p', { class: 'muted' }, 'No suggestions — this document has little readable text. Try Make Searchable first.'));
    });
    const ok = await L.dialog({ title: 'Document properties', text: 'Name, details stored in the PDF, and a quick check that they are complete and tidy.', body, wide: true, actions: [{ label: 'Cancel', value: false }, { label: 'Done', primary: true, value: true }] });
    if (!ok) return;
    const name = L.safeName(nameIn.value);
    m.custom = m.custom.filter(c => tidyText(c.k));
    L.mutate('document properties', () => { s.name = name; s.meta = { ...m, title: m.title || name }; });
  };

  // Saving lives in files.js (Save, Save As, exports).
})();
