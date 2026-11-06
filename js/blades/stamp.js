/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Stamp blade: page numbers (incl. Bates), header and footer with left / centre / right text, watermark —
   each on all, odd, even or chosen pages, skipping the first or last pages. Previewed live, written on save. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;
  const st = () => L.normStamps(L.state);
  const cfgOf = kind => st()[kind] || L.deep(L.STAMP_DEF[kind]);
  const edit = (kind, patch, label = 'stamp') => L.mutate(label, () => { const s = st(); s[kind] = { ...cfgOf(kind), ...patch }; });
  const editRule = (kind, patch) => edit(kind, { pages: { ...cfgOf(kind).pages, ...patch } }, 'stamp pages');
  const toggle = (kind, on) => L.mutate(on ? `add ${kind}` : `remove ${kind}`, () => { const s = st(); s[kind] = { ...cfgOf(kind), on }; });
  let lastInput = null; // where a token chip inserts
  const POS = [['tl', '↖'], ['tc', '↑'], ['tr', '↗'], ['bl', '↙'], ['bc', '↓'], ['br', '↘']];
  const TOKENS = [['{name}', 'Document name'], ['{title}', 'Title'], ['{author}', 'Author'], ['{date}', 'Today’s date'], ['{n}', 'Page number'], ['{N}', 'Last page number'], ['{page}', 'Physical page'], ['{pages}', 'Page count']];

  // "1, 3–5, 9" for a list of page indices
  const runs = idx => { const out = []; for (const i of idx) { const r = out[out.length - 1]; if (r && i === r[1] + 1) r[1] = i; else out.push([i, i]); } return out.map(([a, b]) => (a === b ? `${a + 1}` : `${a + 1}–${b + 1}`)).join(', '); };

  function card(kind, title, icon, body) {
    const cfg = st()[kind], on = !!(cfg && cfg.on);
    return h('div', { class: 'section' },
      h('div', { class: 'row between' }, h('div', { class: 'row' }, L.icon(icon, 18), h('b', null, title)),
        h('label', { class: 'switch', title: on ? 'Turn off' : 'Turn on' }, h('input', { type: 'checkbox', checked: on, onchange: e => toggle(kind, e.target.checked) }), h('span'))),
      on ? h('div', { class: 'stack', style: { marginTop: '12px' } }, body(cfgOf(kind))) : null);
  }
  function stepper(value, max, onChange) {
    const inp = h('input', { class: 'input num', type: 'number', min: 0, max, value, onchange: e => onChange(L.clamp(Math.round(+e.target.value || 0), 0, max)) });
    return h('div', { class: 'stepper' },
      h('button', { class: 'icon-btn small', title: 'Fewer', onclick: () => onChange(L.clamp(value - 1, 0, max)) }, L.icon('minus')), inp,
      h('button', { class: 'icon-btn small', title: 'More', onclick: () => onChange(L.clamp(value + 1, 0, max)) }, L.icon('plus')));
  }
  // Which pages a stamp goes on.
  /* ——— By hand: drag any number, header or footer on the page; then say where the new spot applies ——— */
  const KIND = key => key.split(':')[0];
  const nudgeOf = (key, pid) => { const n = (st().nudges || {})[key]; return (n && ((n.pages && n.pages[pid]) || n.all)) || { dx: 0, dy: 0 }; };
  function applyNudge(key, d, scope, pageIds) {
    L.mutate('move stamp', () => {
      const s = st(); s.nudges = { ...(s.nudges || {}) };
      const n = { all: s.nudges[key]?.all || null, pages: { ...(s.nudges[key]?.pages || {}) } };
      if (scope === 'all') { n.all = d; for (const id of Object.keys(n.pages)) delete n.pages[id]; }
      else for (const id of pageIds) n.pages[id] = d;
      s.nudges[key] = n;
    });
  }
  let drag = null;
  async function chooseScope(ev, key, d, page) {
    const S = L.state, others = await sameSize(page);
    const anchor = h('span', { style: { position: 'fixed', left: ev.clientX + 'px', top: ev.clientY + 'px', width: '1px', height: '1px' } });
    document.body.append(anchor);
    const done = (scope, ids) => { L.stampLive = null; applyNudge(key, d, scope, ids || []); anchor.remove(); L.toast(scope === 'all' ? 'Moved on every page it appears on' : `Moved on ${ids.length} page${ids.length > 1 ? 's' : ''}`, { kind: 'ok', icon: 'stamp' }); };
    const m = L.menu(anchor, [
      { label: 'Move it on all pages', icon: 'pages', kbd: 'Enter', fn: () => done('all') },
      { label: 'Only on this page', icon: 'doc', fn: () => done('page', [page.id]) },
      others.length > 1 ? { label: `On pages of this size & orientation (${others.length})`, icon: 'fit', fn: () => done('page', others) } : null,
      { label: 'On pages…', icon: 'list', fn: async () => {
        const inp = h('input', { class: 'input', placeholder: 'e.g. 2-10, 15' });
        const ok = await L.dialog({ title: 'Move it on these pages', body: inp, actions: [{ label: 'Cancel', value: false }, { label: 'Move', primary: true, value: true }] });
        if (!ok) { L.stampLive = null; anchor.remove(); L.drawOverlay(); return; }
        done('page', L.parseRanges(inp.value, S.pages.length).map(i => S.pages[i].id));
      } },
      'sep',
      { label: 'Cancel', icon: 'close', fn: () => { L.stampLive = null; anchor.remove(); L.drawOverlay(); } },
    ]);
    m.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); m.querySelector('button').click(); } });
  }
  // pages that share this page's paper size and orientation (as shown)
  async function sameSize(page) {
    const S = L.state, key = async p => { const v = L.makeView(await L.proxy(p), p, 1); return `${Math.round(v.width)}x${Math.round(v.height)}`; };
    const k0 = await key(page), out = [];
    for (const p of S.pages) if (await key(p) === k0) out.push(p.id);
    return out;
  }
  function pointer(type, ev) {
    const view = L.viewer.view, page = L.page(); if (!view || !page) return;
    if (type === 'down') {
      const hit = L.stampBoxes(page, view).reverse().find(b => ev.sx >= b.x - 5 && ev.sx <= b.x + b.w + 5 && ev.sy >= b.y - 5 && ev.sy <= b.y + b.h + 5);
      if (!hit) return;
      drag = { key: hit.key, s: [ev.sx, ev.sy], base: nudgeOf(hit.key, page.id), moved: false };
      if (hit.item.pages?.mirror && L.pageIndex(page.id) % 2 === 1) drag.base = { dx: -drag.base.dx, dy: drag.base.dy };
      return;
    }
    if (type === 'hover') {
      const hit = L.stampBoxes(page, view).some(b => ev.sx >= b.x - 5 && ev.sx <= b.x + b.w + 5 && ev.sy >= b.y - 5 && ev.sy <= b.y + b.h + 5);
      L.setCursor(hit ? 'move' : ''); return;
    }
    if (type === 'move' && drag) {
      const k = view.scale;
      drag.moved = drag.moved || Math.hypot(ev.sx - drag.s[0], ev.sy - drag.s[1]) > 3;
      L.stampLive = { key: drag.key, pageId: page.id, dx: drag.base.dx + (ev.sx - drag.s[0]) / k, dy: drag.base.dy + (ev.sy - drag.s[1]) / k };
      L.drawOverlay(); return;
    }
    if (type === 'up' && drag) {
      const d = drag; drag = null;
      if (!d.moved) { L.stampLive = null; return; }
      const even = L.pageIndex(page.id) % 2 === 1, item = cfgOf(KIND(d.key));
      const live = { dx: L.stampLive.dx, dy: L.stampLive.dy };
      if (item.pages?.mirror && even) live.dx = -live.dx; // stored as the odd-page offset
      chooseScope(ev.e, d.key, live, page);
    }
  }
  function draw({ svg, view, page }) { // dotted outlines show what can be picked up
    const g = L.s('g', { 'pointer-events': 'none' });
    for (const b of L.stampBoxes(page, view)) g.append(L.s('rect', { x: b.x - 4, y: b.y - 3, width: b.w + 8, height: b.h + 6, rx: 4, class: 'stamp-handle' + (L.stampLive && L.stampLive.key === b.key ? ' live' : '') }));
    svg.append(g);
  }
  // Page sizes in this document: one chip per size & orientation, which picks those pages for the stamp
  const sizeCache = new Map();
  function sizeGroups(kind) {
    const box = h('div', { class: 'token-chips' });
    const S = L.state, key = S.pages.map(p => p.id).join();
    const paint = groups => {
      if (groups.length < 2) { box.replaceWith(h('span')); return; }
      box.replaceChildren(h('span', { class: 'muted tiny', style: { width: '100%' } }, 'This document mixes page sizes — pick a group:'),
        ...groups.map(g => h('button', { class: 'chip toggle', title: 'Put this stamp only on these pages', onclick: () => editRule(kind, { set: 'range', range: runs(g.idx) }) }, `${g.label} · ${g.idx.length}`)));
    };
    if (sizeCache.has(key)) setTimeout(() => paint(sizeCache.get(key)));
    else (async () => {
      const map = new Map();
      for (let i = 0; i < S.pages.length; i++) {
        const v = L.makeView(await L.proxy(S.pages[i]), S.pages[i], 1), w = v.width / L.MM, hh = v.height / L.MM;
        const paper = Object.entries(L.PAPER).find(([, [a, b]]) => (Math.abs(a - v.width) < 6 && Math.abs(b - v.height) < 6) || (Math.abs(b - v.width) < 6 && Math.abs(a - v.height) < 6));
        const label = `${paper ? paper[0] : `${Math.round(w)}×${Math.round(hh)} mm`} ${w > hh ? 'landscape' : 'portrait'}`;
        if (!map.has(label)) map.set(label, []); map.get(label).push(i);
      }
      const groups = [...map].map(([label, idx]) => ({ label, idx })); sizeCache.set(key, groups); paint(groups);
    })();
    return box;
  }
  function placeRow(kind, c, keys) {
    const moved = keys.some(k => (st().nudges || {})[k]);
    return h('div', { class: 'stack' },
      ui.check('Scale with the page (small pages get smaller text, big pages bigger)', c.fit, v => edit(kind, { fit: v })),
      h('p', { class: 'muted tiny', style: { margin: 0 } }, 'Tip: drag it on the page to place it by hand. Positions keep their distance from the page edge, so they sit right on every size and orientation.'),
      moved ? ui.btn('Back to the standard position', 'undo', () => L.mutate('reset stamp position', () => { const s = st(); s.nudges = { ...(s.nudges || {}) }; keys.forEach(k => delete s.nudges[k]); }), 'small') : null);
  }

  function pagesRule(kind, { mirror = true } = {}) {
    const r = cfgOf(kind).pages, total = L.state.pages.length, hits = L.rulePages(r, total);
    return h('div', { class: 'rule-box' },
      h('div', { class: 'row between' }, h('span', { class: 'label', style: { margin: 0 } }, 'On pages'),
        h('span', { class: 'muted tiny', title: runs(hits) }, hits.length === total ? `all ${total}` : hits.length ? `${hits.length} of ${total} · ${runs(hits).slice(0, 28)}${runs(hits).length > 28 ? '…' : ''}` : 'none')),
      ui.seg([{ value: 'all', label: 'All' }, { value: 'odd', label: 'Odd' }, { value: 'even', label: 'Even' }, { value: 'range', label: 'Choose' }], r.set, v => editRule(kind, { set: v })),
      r.set === 'range' ? h('input', { class: 'input', value: r.range, placeholder: 'e.g. 3-10, 15', onchange: e => editRule(kind, { range: e.target.value }) }) : null,
      h('div', { class: 'grid2' },
        ui.field('Skip first', stepper(r.skipFirst || 0, total, v => editRule(kind, { skipFirst: v }))),
        ui.field('Skip last', stepper(r.skipLast || 0, total, v => editRule(kind, { skipLast: v })))),
      mirror ? ui.check('Mirror left ↔ right on even pages (book layout)', r.mirror, v => editRule(kind, { mirror: v })) : null,
      sizeGroups(kind));
  }
  function fontRow(kind, c, colors = ['#1d1d1f', '#6e6e73', '#0071e3', '#e5484d']) {
    return h('div', { class: 'stack' },
      h('div', { class: 'row', style: { gap: '8px' } },
        ui.seg([{ value: 'Helvetica', label: 'Sans', title: 'Helvetica' }, { value: 'Times', label: 'Serif', title: 'Times' }, { value: 'Courier', label: 'Mono', title: 'Courier' }], c.font || 'Helvetica', v => edit(kind, { font: v })),
        h('button', { class: 'tool bold-toggle' + (c.bold ? ' on' : ''), title: 'Bold', onclick: () => edit(kind, { bold: !c.bold }) }, 'B'),
        h('label', { class: 'mini-num', title: 'Size (pt)' }, ui.num(c.size, v => v > 0 && edit(kind, { size: v }), { min: 4, max: 200 }), h('span', null, 'pt'))),
      L.swatches(c.color, v => edit(kind, { color: v }), colors));
  }
  function tokenChips() {
    return h('div', { class: 'token-chips' }, TOKENS.map(([t, tip]) => h('button', {
      class: 'chip', title: tip, onmousedown: e => e.preventDefault(),
      onclick: () => {
        const inp = lastInput && lastInput.isConnected ? lastInput : null; if (!inp) return L.toast('Click into Left, Centre or Right first', { icon: 'info' });
        const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a;
        inp.value = inp.value.slice(0, a) + t + inp.value.slice(b); inp.dispatchEvent(new Event('change'));
      },
    }, t)));
  }
  function slots(kind, c) {
    const slot = (key, label) => h('label', { class: 'field' }, h('span', null, label),
      h('input', { class: 'input', value: c[key] || '', onfocus: e => { lastInput = e.target; }, onchange: e => edit(kind, { [key]: e.target.value }) }));
    return [
      h('div', { class: 'grid3 slots' }, slot('left', 'Left'), slot('center', 'Centre'), slot('right', 'Right')),
      tokenChips(),
      fontRow(kind, c),
      h('div', { class: 'row between' },
        ui.check(kind === 'header' ? 'Thin line under the header' : 'Thin line above the footer', c.rule, v => edit(kind, { rule: v })),
        h('label', { class: 'mini-num', title: 'Distance from the page edge' }, ui.num(c.margin, v => edit(kind, { margin: Math.max(0, v || 0) }), { min: 0, max: 144 }), h('span', null, 'pt from edge'))),
      placeRow(kind, c, ['l', 'c', 'r'].map(s => `${kind}:${s}`)),
      pagesRule(kind),
    ];
  }

  /* ——— Bates: one numbered collection across every open document ——— */
  function continueAcross() {
    const base = cfgOf('numbers'); let next = +base.start || 1; const rows = [];
    for (const d of L.docs.filter(x => x.state.pages.length)) L.inDoc(d, () => {
      const S = d.state, nb = { ...L.deep(base), on: true, start: next };
      L.mutate('number across documents', () => { L.normStamps(S).numbers = nb; }, { silent: true });
      const hits = L.rulePages(nb.pages, S.pages.length);
      if (hits.length) rows.push({ name: S.name, first: L.stampText(L.numberFormat(nb), hits[0], S.pages.length, S), last: L.stampText(L.numberFormat(nb), hits[hits.length - 1], S.pages.length, S) });
      next += nb.restart ? hits.length : S.pages.length;
    });
    L.emit('change');
    L.dialog({ title: 'Numbered as one collection', text: `${rows.length} documents, in tab order. Save them all when you’re ready.`,
      body: h('div', { class: 'list' }, rows.map(r => h('div', { class: 'list-item' }, L.icon('doc', 15), h('span', { class: 'grow' }, r.name), h('span', { class: 'muted tiny mono' }, `${r.first} – ${r.last}`)))),
      actions: [{ label: 'Done', value: false }, { label: 'Save all to a folder…', primary: true, value: true }] }).then(v => v && saveAll());
  }
  async function saveAll() {
    const docs = L.docs.filter(d => d.state.pages.length);
    const nameFor = d => {
      const nb = L.normStamps(d.state).numbers, S = d.state, hits = nb && nb.on ? L.rulePages(nb.pages, S.pages.length) : [];
      return L.safeName(nb && nb.on && nb.style === 'bates' && hits.length ? `${L.stampText(L.numberFormat(nb), hits[0], S.pages.length, S)} — ${S.name}` : S.name);
    };
    let folder = null;
    if (L.fs.on()) { const res = await L.files.pickFolder({ title: 'Save all to a folder', text: `${docs.length} document${docs.length > 1 ? 's' : ''}, each as its own PDF with its stamps.`, origin: L.doc.origin?.path }); if (!res) return; folder = res.folder; }
    const t = L.task('Saving documents'); let n = 0, lastPath = null;
    try {
      for (const d of docs) {
        if (t.cancelled) break;
        t.set(n / docs.length, d.state.name);
        const bytes = await L.buildPdf({ state: d.state, pages: d.state.pages, ocrLayer: true });
        if (folder) lastPath = (await L.files.writeFree(folder, nameFor(d), 'pdf', bytes)).path; else L.download(bytes, nameFor(d) + '.pdf', 'application/pdf');
        n++;
      }
    } catch (e) { L.error('Couldn’t save all', e); }
    finally { t.done(); }
    if (n) L.toast(`Saved ${n} document${n > 1 ? 's' : ''}${folder ? ` to ${L.path.base(folder)}` : ''}`, { kind: 'ok', ms: 5200, action: lastPath ? { label: 'Show in folder', fn: () => L.fs.reveal(lastPath) } : null });
  }

  L.registerBlade({
    id: 'stamp', label: 'Stamp', icon: 'stamp', color: '#bf5af2',
    desc: 'Page numbers, Bates numbers, headers, footers and watermarks — on all, odd, even or chosen pages.',
    activate() { L.setCursor(''); L.normStamps(L.state); },
    deactivate() { L.stampLive = null; drag = null; },
    pointer, draw,
    inspector() {
      const docs = L.docs.filter(d => d.state.pages.length).length;
      return [
        ui.head('stamp', 'Stamp', 'On many pages at once. Previewed live; written when you save.'),
        card('numbers', 'Page numbers', 'hash', c => [
          ui.field('Style', ui.select(L.NUMBER_STYLES, c.style || 'custom', v => edit('numbers', { style: v, ...(v === 'custom' ? { fmt: L.numberFormat(c) } : {}) }))),
          c.style === 'bates' ? h('div', { class: 'grid3' },
            ui.field('Prefix', h('input', { class: 'input', value: c.prefix, onchange: e => edit('numbers', { prefix: e.target.value }) })),
            ui.field('Digits', ui.num(c.digits, v => edit('numbers', { digits: L.clamp(Math.round(v) || 6, 1, 12) }), { min: 1, max: 12 })),
            ui.field('Suffix', h('input', { class: 'input', value: c.suffix, onchange: e => edit('numbers', { suffix: e.target.value }) }))) : null,
          c.style === 'custom' ? ui.field('Format — {n} number · {N} last · {n:i} roman · {n:6} six digits', h('input', { class: 'input', value: c.fmt, onchange: e => edit('numbers', { fmt: e.target.value }) })) : null,
          h('div', { class: 'field' }, h('span', null, 'Position'), h('div', { class: 'grid3' }, POS.map(([p, g]) => h('button', { class: 'tool' + (c.pos === p ? ' on' : ''), style: { padding: '5px 2px', fontSize: '14px' }, onclick: () => edit('numbers', { pos: p }) }, g)))),
          h('div', { class: 'grid2', style: { alignItems: 'end' } },
            ui.field('First number', ui.num(c.start, v => edit('numbers', { start: Math.round(v) || 1 }))),
            ui.field('Count from', ui.select([{ value: 'first', label: 'First numbered page' }, { value: 'cover', label: 'The very first page' }], c.restart ? 'first' : 'cover', v => edit('numbers', { restart: v === 'first' })))),
          fontRow('numbers', c),
          placeRow('numbers', c, ['numbers']),
          pagesRule('numbers'),
          c.style === 'bates' ? h('div', { class: 'stack callout-ish' },
            h('b', null, 'A whole collection'),
            h('p', { class: 'muted tiny', style: { margin: 0 } }, docs > 1 ? `${docs} documents are open. Number them as one series, in tab order — each continues where the previous one ends.` : 'Open more documents (Ctrl O) to number a whole collection in one go.'),
            docs > 1 ? ui.btn('Continue across all open documents', 'hash', continueAcross, 'block') : null,
            ui.btn(docs > 1 ? 'Save all to a folder…' : 'Save to a folder…', 'folder', saveAll, 'block')) : null,
        ]),
        card('header', 'Header', 'text', c => slots('header', c)),
        card('footer', 'Footer', 'text', c => slots('footer', c)),
        card('watermark', 'Watermark', 'water', c => [
          ui.field('Text', h('input', { class: 'input', value: c.text, onchange: e => edit('watermark', { text: e.target.value }) })),
          h('div', { class: 'grid2' }, ui.field('Size', ui.num(c.size, v => v > 0 && edit('watermark', { size: v }))), ui.field('Angle', ui.num(c.angle, v => edit('watermark', { angle: v || 0 })))),
          h('div', { class: 'field' }, h('span', null, 'Strength'), h('input', { type: 'range', min: 0.04, max: 0.6, step: 0.02, value: c.opacity, onchange: e => edit('watermark', { opacity: +e.target.value }) })),
          L.swatches(c.color, v => edit('watermark', { color: v }), ['#e5484d', '#1d1d1f', '#0071e3', '#30a46c']),
          placeRow('watermark', c, ['watermark']),
          pagesRule('watermark', { mirror: false }),
        ]),
      ];
    },
  });
})();
