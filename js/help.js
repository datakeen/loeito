/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Help: what's new, the user and reference manuals (rendered from docs/*.md), keyboard shortcuts, about Loeito. */
(() => {
  const L = window.Loeito, h = L.h;

  // A small, safe Markdown renderer for Loeito's own documents (headings, lists, tables, emphasis, code, links, quotes).
  const inline = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(“"])\*([^*\s][^*]*)\*(?=[\s).,;:”"]|$)/g, '$1<i>$2</i>').replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => (/^(https?:|mailto:)/.test(u) ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : `<span class="ref">${t}</span>`));
  L.markdown = md => {
    const lines = md.replace(/\r/g, '').split('\n'), out = [];
    for (let i = 0; i < lines.length;) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)/))) { const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); i++; continue; }
      if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^\|/.test(l)) {
        const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
        const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const body = rows.filter(r => !/^\|[\s:|-]+\|$/.test(r));
        out.push('<table><thead><tr>' + cells(body[0]).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
          body.slice(1).map(r => '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
        continue;
      }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        const ordered = /^\s*\d+\./.test(l), items = [];
        while (i < lines.length && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
          if (/^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push({ depth: lines[i].match(/^\s*/)[0].length, text: lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '') });
          else items[items.length - 1].text += ' ' + lines[i].trim();
          i++;
        }
        const tag = ordered ? 'ol' : 'ul';
        out.push(`<${tag}>` + items.map(it => `<li${it.depth ? ' class="sub"' : ''}>${inline(it.text)}</li>`).join('') + `</${tag}>`);
        continue;
      }
      if (/^>\s?/.test(l)) { const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`); continue; }
      const para = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||\s*([-*]|\d+\.)\s|>|---)/.test(lines[i])) para.push(lines[i++]);
      out.push(`<p>${inline(para.join(' '))}</p>`);
    }
    return out.join('\n');
  };

  async function readDoc(path) {
    try { const r = await fetch(path, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.statusText); return await r.text(); }
    catch { return null; }
  }
  async function showDoc(path, title) {
    const md = await readDoc(path);
    const body = md ? h('article', { class: 'manual', html: L.markdown(md) })
      : h('div', { class: 'stack' }, h('p', null, `Open “Loeito/${path}” in any text editor or browser to read it.`), h('p', { class: 'muted tiny' }, 'Loeito can show it here when it’s started with “Start Loeito.cmd”.'));
    const toc = md ? h('nav', { class: 'manual-toc' }, [...body.querySelectorAll('h2')].map((el, k) => { el.id = 'm' + k; return h('button', { onclick: () => el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, el.textContent); })) : null;
    await L.dialog({ title, wide: 'xl', body: md ? h('div', { class: 'manual-wrap' }, toc, body) : body, actions: [{ label: 'Done', primary: true, value: true }] });
  }
  L.whatsNew = async () => {
    const md = await readDoc('CHANGELOG.md');
    const section = md ? md.split(/\n(?=## )/).find(s => s.startsWith('## ' + L.VERSION)) : null;
    L.setPref('seenVersion', L.VERSION);
    await L.dialog({ title: `What’s new in Loeito ${L.VERSION}`, text: `“${L.CODENAME}” — Swedish for craftsmanship.`, wide: true,
      body: section ? h('article', { class: 'manual compact', html: L.markdown(section.replace(/^## .*\n/, '')) }) : h('p', null, 'See CHANGELOG.md in the Loeito folder.'),
      actions: [{ label: 'User manual', value: 'manual' }, { label: 'Got it', primary: true, value: true }] }).then(v => v === 'manual' && showDoc('docs/User Manual.md', 'Loeito User Manual'));
  };
  const KEYS = [
    ['Files', [['Do anything (command palette)', 'Ctrl K'], ['Open', 'Ctrl O'], ['Save (to the original)', 'Ctrl S'], ['Save As…', 'Ctrl Shift S'], ['Find', 'Ctrl F'], ['Undo / Redo', 'Ctrl Z / Ctrl Shift Z']]],
    ['Viewing', [['Zoom in / out', 'Ctrl + / Ctrl −, Ctrl-wheel'], ['Fine zoom', 'Shift while zooming'], ['Fit width ↔ fit page', 'Ctrl 0'], ['Next / previous page', '→ ←'], ['Focus mode', 'F · Esc to leave'], ['Full window', 'Ctrl Shift F'], ['Full screen', 'F11'], ['Snapshot of a page area', 'Ctrl Shift C'], ['Scroll on to the next page', 'wheel past the page end'], ['Show / hide pages', 'Ctrl \\']]],
    ['Pointer', [['Select', 'V'], ['Text', 'T'], ['Hand', 'H · or hold Space'], ['Move the page', 'drag the gray backdrop']]],
    ['Pages & forms', [['Rotate', 'Ctrl L / Ctrl R'], ['Delete selected', 'Delete'], ['Duplicate field', 'Ctrl D'], ['Nudge field', 'Arrows · Shift = 10 pt'], ['Make key field', 'Alt-click'], ['Move without snapping', 'hold Alt while dragging']]],
  ];
  function shortcuts() {
    L.dialog({ title: 'Keyboard shortcuts', wide: true, body: h('div', { class: 'keys' }, KEYS.map(([group, rows]) => h('div', null, h('h4', null, group),
      h('dl', null, rows.map(([what, k]) => [h('dt', null, what), h('dd', null, k.split(' · ').map((part, i) => [i ? ' · ' : '', h('kbd', null, part)]))]))))),
      actions: [{ label: 'Done', primary: true, value: true }] });
  }
  async function about() {
    const md = await readDoc('docs/About.md');
    L.dialog({ title: '', body: h('div', { class: 'about' }, L.logo(72), h('h2', null, 'Loeito'), h('p', { class: 'ver' }, `Version ${L.VERSION} “${L.CODENAME}”`),
      md ? h('article', { class: 'manual compact about-text', html: L.markdown(md.replace(/^# .*\n/, '').replace(/^\*\*Loeito — PDF, just right\.\*\*.*\n/m, '')) })
        : h('p', null, 'PDF, just right — every everyday PDF task, privately on your computer.')),
    actions: [{ label: 'What’s new', value: 'new' }, { label: 'OK', primary: true, value: true }] }).then(v => v === 'new' && L.whatsNew());
  }
  const TUTORIALS = ['01 Merge PDFs', '02 Open and save', '03 Reading', '04 Pages', '05 Edit', '06 Crop', '07 Make searchable', '08 Tables', '09 Digitize', '10 Optimize', '11 Stamp', '12 Covers', '13 Forms', '14 Protect', '15 Document properties'];
  L.showTutorial = name => showDoc(`docs/tutorials/${name}.md`, 'Tutorial · ' + name.replace(/^\d+ /, ''));
  function tutorials() {
    L.dialog({ title: 'Tutorials', text: 'Short, hands-on walk-throughs — one for each part of Loeito.', wide: true,
      body: h('div', { class: 'tut-grid' }, TUTORIALS.map(t => h('button', { class: 'tut-card', onclick: () => { L.closeDialog(null); L.showTutorial(t); } }, h('span', null, t.slice(0, 2)), h('b', null, t.slice(3))))),
      actions: [{ label: 'Done', primary: true, value: true }] });
  }
  L.showTutorials = tutorials;
  L.openHelp = btn => L.menu(btn, [
    { label: 'Help', icon: 'help', fn: () => showDoc('docs/Help.md', 'Loeito Help') },
    { label: 'Tutorials', icon: 'play', fn: tutorials },
    { label: `What’s new in ${L.VERSION}`, icon: 'sparkles', fn: L.whatsNew },
    { label: 'User manual', icon: 'book', fn: () => showDoc('docs/User Manual.md', 'Loeito User Manual') },
    { label: 'Reference manual', icon: 'code', fn: () => showDoc('docs/Reference Manual.md', 'Loeito Reference Manual') },
    { label: 'Keyboard shortcuts', icon: 'type', kbd: '?', fn: shortcuts },
    'sep',
    { label: 'About Loeito', icon: 'info', fn: about },
  ]);
  L.showShortcuts = shortcuts;
  // after an update, offer the release notes once
  L.serverReady && L.serverReady.then(() => {
    const seen = L.pref('seenVersion', null);
    if (seen !== L.VERSION) setTimeout(() => L.toast(`Loeito ${L.VERSION} is here — Save to the original, covers, form templates, Protect and more.`, { icon: 'sparkles', ms: 9000, action: { label: 'What’s new', fn: L.whatsNew } }), 1200);
    if (!seen) L.setPref('seenVersion', L.VERSION);
  });
})();
