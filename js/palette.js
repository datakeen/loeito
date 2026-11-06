/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Command palette (Ctrl K): type a few letters of anything Loeito can do, press Enter. */
(() => {
  const L = window.Loeito, h = L.h;
  const need = fn => () => (L.hasDoc() ? fn() : L.toast('Open a document first (Ctrl O)', { icon: 'info' }));
  function commands() {
    const list = [
      { t: 'Open a file', k: 'Ctrl O', i: 'upload', f: () => L.pickFiles(false) },
      { t: 'Save', k: 'Ctrl S', i: 'save', f: need(() => L.save()) },
      { t: 'Save As…', k: 'Ctrl Shift S', i: 'folder', f: need(() => L.saveAs()) },
      { t: 'Save a copy for sharing (clean)', i: 'shield', f: need(() => L.saveAs({ clean: true })) },
      { t: 'Merge PDFs', i: 'merge', f: () => L.openMerge(L.hasDoc() ? { withCurrent: true } : undefined) },
      { t: 'Document properties & metadata', i: 'tag', f: need(() => L.openNameSheet()) },
      { t: 'Password-protect or unlock', i: 'shield', f: need(() => L.setBlade('protect')) },
      { t: 'Find in document', k: 'Ctrl F', i: 'search', f: need(() => L.openSearch()) },
      { t: 'Rotate page right', k: 'Ctrl R', i: 'rotr', f: need(() => L.rotateSelected(90)) },
      { t: 'Rotate page left', k: 'Ctrl L', i: 'rotl', f: need(() => L.rotateSelected(-90)) },
      { t: 'Focus mode', k: 'F', i: 'focus', f: need(() => L.toggleFocus(true)) },
      { t: 'Start a form from a template', i: 'template', f: () => L.openFormTemplates() },
      { t: 'Show / hide the page list', k: 'Ctrl \\', i: 'sidebar', f: () => L.$('#btn-sidebar').click() },
      { t: 'Keyboard shortcuts', k: '?', i: 'type', f: () => L.showShortcuts() },
      { t: 'Tutorials', i: 'play', f: () => L.showTutorials() },
      { t: 'What’s new', i: 'sparkles', f: () => L.whatsNew() },
      { t: 'Undo', k: 'Ctrl Z', i: 'undo', f: () => L.undo() },
      { t: 'Redo', k: 'Ctrl Shift Z', i: 'redo', f: () => L.redo() },
    ];
    for (const b of L.blades) list.push({ t: `${b.label} — ${b.desc}`, i: b.icon, f: need(() => L.setBlade(b.id)) });
    for (const d of L.docs) if (d !== L.doc) list.push({ t: `Switch to “${d.state.name}”`, i: 'doc', f: () => L.switchDoc(d) });
    return list;
  }
  // fuzzy: every typed letter must appear in order; earlier and word-start hits score better
  const score = (q, t) => {
    q = q.toLowerCase(); t = t.toLowerCase(); let i = 0, s = 0, last = -1;
    for (const ch of q) { const j = t.indexOf(ch, last + 1); if (j < 0) return -1; s += (j === last + 1 ? 3 : 0) + (j === 0 || t[j - 1] === ' ' ? 4 : 0) - j * 0.01; last = j; i++; }
    return s;
  };
  L.openPalette = () => {
    if (L.$('.palette')) return;
    const all = commands(); let hits = all, cur = 0;
    const input = h('input', { class: 'palette-in', placeholder: 'What would you like to do?', 'aria-label': 'Command' });
    const listEl = h('div', { class: 'palette-list', role: 'listbox' });
    const back = h('div', { class: 'palette-back', onmousedown: e => { if (e.target === back) close(); } }, h('div', { class: 'palette', role: 'dialog' }, h('div', { class: 'palette-row' }, L.icon('search', 18), input), listEl));
    const close = () => { back.remove(); document.removeEventListener('keydown', key, true); };
    const run = c => { close(); setTimeout(() => c.f(), 10); };
    const paint = () => {
      listEl.replaceChildren(...hits.slice(0, 12).map((c, i) => h('button', { class: 'palette-item' + (i === cur ? ' on' : ''), role: 'option', onmouseenter: () => { cur = i; paint(); }, onclick: () => run(c) },
        L.icon(c.i || 'right', 16), h('span', { class: 'grow' }, c.t), c.k ? h('kbd', null, c.k) : null)));
      if (!hits.length) listEl.append(h('div', { class: 'palette-empty' }, 'Nothing found — try another word.'));
    };
    input.addEventListener('input', () => {
      const q = input.value.trim();
      hits = q ? all.map(c => ({ c, s: score(q, c.t) })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s).map(x => x.c) : all;
      cur = 0; paint();
    });
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); cur = L.clamp(cur + (e.key === 'ArrowDown' ? 1 : -1), 0, Math.max(0, Math.min(hits.length, 12) - 1)); paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (hits[cur]) run(hits[cur]); }
    };
    document.addEventListener('keydown', key, true);
    document.body.append(back); paint(); setTimeout(() => input.focus(), 20);
  };
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !L.$('#modal-root').children.length) { e.preventDefault(); L.openPalette(); }
  });
})();
