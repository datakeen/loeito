/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Tables blade: finds ruled tables (vector or scanned), rebuilds merged cells, falls back to text columns, exports anywhere. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui, TG = L.tablegrid;
  // region / cols / grid geometry are display points at scale 1 (visible page frame)
  const T = { pageId: null, region: null, cols: null, grid: null, rul: null, source: 'auto', detect: 'auto', drag: null, draftR: null, from: null, to: null, header: true, repeat: false, edited: false, found: [], foundFor: null, how: '', busy: false };

  /* ——— Words with boldness ——— */
  async function wordsIn(page, region) {
    const proxy = await L.proxy(page), v1 = L.makeView(proxy, page, 1);
    const pdfW = (await L.pdfTextItems(page)).flatMap(L.splitWords), ocr = page.ocr?.words || [];
    const src = T.source === 'pdf' ? pdfW : T.source === 'ocr' || T.source === 'cells' ? (ocr.length ? ocr : pdfW) : (pdfW.length && pdfW.length >= ocr.length * 0.5 ? pdfW : ocr);
    const boldCache = new Map();
    const boldOf = id => {
      if (!id) return false; if (boldCache.has(id)) return boldCache.get(id);
      let b = false; try { if (proxy.commonObjs.has(id)) { const f = proxy.commonObjs.get(id); b = /bold|black|heavy|semibold|demi/i.test(f.name || '') || !!f.bold; } } catch {}
      boldCache.set(id, b); return b;
    };
    return src.map(w => ({ t: w.t, b: L.wordBox(w, v1), bold: boldOf(w.font) })).filter(({ b }) => {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      return cx >= region.x && cx <= region.x + region.w && cy >= region.y && cy <= region.y + region.h;
    });
  }

  /* ——— Text-column fallback (tables without ruled lines) ——— */
  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  function detectCols(boxes, region) {
    const mh = median(boxes.map(b => b.b.h)) || 8, x0 = Math.floor(region.x), n = Math.ceil(region.w) + 1, cov = new Uint16Array(n);
    for (const { b } of boxes) for (let x = Math.max(0, Math.floor(b.x - x0)); x <= Math.min(n - 1, Math.ceil(b.x + b.w - x0)); x++) cov[x]++;
    const minGap = Math.max(6, mh * 0.9), cols = [];
    let first = 0; while (first < n && !cov[first]) first++;
    let last = n - 1; while (last > 0 && !cov[last]) last--;
    let run = -1;
    for (let x = first; x <= last; x++) {
      if (!cov[x]) { if (run < 0) run = x; }
      else if (run >= 0) { if (x - run >= minGap) cols.push(x0 + (run + x) / 2); run = -1; }
    }
    return cols;
  }
  function buildRows(boxes, cols) {
    if (!boxes.length) return [];
    const mh = median(boxes.map(b => b.b.h)) || 8;
    const sorted = boxes.slice().sort((a, b) => (a.b.y + a.b.h / 2) - (b.b.y + b.b.h / 2)), lines = [];
    for (const it of sorted) {
      const cy = it.b.y + it.b.h / 2, ln = lines[lines.length - 1];
      if (ln && Math.abs(cy - ln.cy) < mh * 0.55) { ln.items.push(it); ln.cy = (ln.cy * (ln.items.length - 1) + cy) / ln.items.length; }
      else lines.push({ cy, items: [it] });
    }
    const edges = cols.slice().sort((a, b) => a - b);
    return lines.map(ln => {
      const cells = Array(edges.length + 1).fill(null).map(() => []);
      for (const it of ln.items.sort((a, b) => a.b.x - b.b.x)) { const cx = it.b.x + it.b.w / 2; let c = 0; while (c < edges.length && cx > edges[c]) c++; cells[c].push(it.t); }
      return cells.map(c => c.join(' '));
    });
  }

  /* ——— Analysis ——— */
  async function analysePage(page, region, { redetect = false, quiet = false } = {}) {
    const words = await wordsIn(page, region);
    let rul = null, how = '';
    if (T.detect !== 'text') {
      const vec = TG.clip(await TG.vectorRulings(page), region);
      if (TG.hasGrid(vec)) { rul = vec; how = 'ruled lines'; }
      else {
        const ras = await TG.rasterRulings(page, region);
        if (TG.hasGrid(ras)) { rul = ras; how = 'lines in the scan'; }
      }
    }
    let grid = rul ? TG.buildGrid(rul, words) : null;
    if (grid && (T.source === 'cells' || (T.source === 'auto' && rul && rul.raster))) { // read every cell on its own with OCR (automatic for scans)
      const t = L.task('Reading each cell');
      try {
        const texts = await L.ocrCells(page, grid.cells.map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h })), { task: t });
        grid.cells.forEach((c, i) => { if (texts[i] != null) c.text = texts[i]; });
        how += ', text read cell by cell';
      } finally { t.done(); }
    }
    if (!grid) {
      if (T.detect === 'grid' && !quiet) L.toast('No ruled grid found here — using text columns instead.', { icon: 'info' });
      if (redetect || !T.cols) T.cols = detectCols(words, region);
      grid = TG.fromRows(buildRows(words, T.cols), T.cols, region); rul = null; how = 'text columns';
    }
    return { grid, rul, how, words: words.length };
  }
  async function extract(redetect = false) {
    const p = L.page(); if (!p || !T.region) return;
    T.busy = true; L.renderInspector();
    try {
      const r = await analysePage(p, T.region, { redetect });
      T.grid = r.grid; T.rul = r.rul; T.how = r.how; T.edited = false;
      if (!r.words) L.toast('No text found in that area. If this is a scan, run Make Searchable first.', { icon: 'info', ms: 4800 });
    } catch (e) { L.error('Couldn’t read the table', e); }
    finally { T.busy = false; L.drawOverlay(); L.renderInspector(); }
  }
  async function findTables(announce) {
    const p = L.page(); if (!p) return;
    const key = L.pageSignature(p);
    if (T.foundFor !== key) {
      T.foundFor = key;
      const rul = await TG.vectorRulings(p);
      T.found = TG.findTables(rul);
    }
    if (announce) {
      if (!T.found.length) { // a scan? look at the pixels of the whole page
        const v = L.makeView(await L.proxy(p), p, 1), full = { x: 0, y: 0, w: v.width, h: v.height };
        const t = L.task('Looking for tables', { cancelable: false });
        try { T.found = TG.findTables(await TG.rasterRulings(p, full)); } finally { t.done(); }
      }
      if (T.found.length) { T.pageId = p.id; T.region = T.found[0]; T.cols = null; await extract(true); L.toast(T.found.length === 1 ? 'Found 1 table' : `Found ${T.found.length} tables — pick one below`, { kind: 'ok', icon: 'table' }); }
      else L.toast('No ruled tables found — drag a box around the table instead.', { icon: 'info', ms: 4200 });
    }
    L.drawOverlay(); L.renderInspector();
  }
  async function extractMulti() {
    const s = L.state, from = (T.from ?? s.cur + 1) - 1, to = (T.to ?? s.pages.length) - 1;
    const t = L.task('Reading the table across pages'); let all = null;
    try {
      for (let i = from; i <= to; i++) {
        if (t.canceled) break;
        t.set((i - from) / (to - from + 1), `Page ${i + 1}`);
        const r = await analysePage(s.pages[i], T.region, { quiet: true });
        all = TG.append(all, r.grid, T.header);
      }
      if (all) { T.grid = all; T.edited = false; L.renderInspector(); L.toast(`${all.nR} rows from ${to - from + 1} pages`, { kind: 'ok', icon: 'table' }); }
    } catch (e) { L.error('Couldn’t read every page', e); } finally { t.done(); }
  }

  /* ——— Export ——— */
  const fileBase = () => `${L.safeName(L.state.name)} — table p${L.state.cur + 1}`;
  async function saveXlsx() {
    const t = L.task('Preparing Excel workbook', { cancelable: false });
    try {
      const { data, styled } = await TG.xlsx(T.grid, { header: T.header, sheet: `Page ${L.state.cur + 1}` });
      await L.saveFile(new Blob([data]), fileBase() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx');
      if (!styled) L.toast('Saved without colors (the styling add-on couldn’t load).', { icon: 'info' });
    } catch (e) { L.error('Couldn’t create the Excel file', e); } finally { t.done(); }
  }
  async function openReview() {
    const box = h('div', { class: 'table-preview review', style: { maxHeight: '64vh' }, html: TG.html(T.grid, { header: T.header, editable: true }) });
    const res = await L.dialog({
      title: 'Review table', text: 'Click any cell to correct it. Merged cells stay merged on export.', wide: true, body: box,
      actions: [{ label: 'Cancel', value: null }, { label: 'Keep changes', primary: true, value: 'keep' }],
    });
    if (res !== 'keep') return;
    const byPos = new Map(T.grid.cells.map(c => [c.r + ':' + c.c, c]));
    L.$$('[data-r]', box).forEach(td => { const c = byPos.get(td.dataset.r + ':' + td.dataset.c); if (c) c.text = td.innerText.replace(/\n$/, '').trim(); });
    T.edited = true; L.renderInspector();
  }

  /* ——— Interaction ——— */
  function pointer(type, ev) {
    const view = L.viewer.view, k = view.scale, p = L.page();
    if (T.pageId !== p.id) { T.region = null; T.cols = null; T.grid = null; T.rul = null; T.pageId = p.id; }
    const R = T.region && { x: T.region.x * k, y: T.region.y * k, w: T.region.w * k, h: T.region.h * k };
    const inR = R && ev.sx >= R.x && ev.sx <= R.x + R.w && ev.sy >= R.y && ev.sy <= R.y + R.h;
    const textMode = T.grid && T.grid.mode === 'text';
    const colHit = textMode && inR ? (T.cols || []).findIndex(c => Math.abs(c * k - ev.sx) < 6) : -1;
    if (type === 'hover') { L.setCursor(colHit >= 0 ? 'move' : 'crosshair'); return; }
    if (type === 'dbl' && textMode) {
      if (colHit >= 0) T.cols.splice(colHit, 1); else if (inR) (T.cols ||= []).push(ev.sx / k);
      extract(false); return;
    }
    if (type === 'down') { T.drag = colHit >= 0 ? { mode: 'col', i: colHit } : { mode: 'new', s: [ev.sx, ev.sy] }; return; }
    if (type === 'move' && T.drag) {
      if (T.drag.mode === 'col') T.cols[T.drag.i] = L.clamp(ev.sx / k, T.region.x + 2, T.region.x + T.region.w - 2);
      else { const s = T.drag.s; T.draftR = { x: Math.min(s[0], ev.sx) / k, y: Math.min(s[1], ev.sy) / k, w: Math.abs(ev.sx - s[0]) / k, h: Math.abs(ev.sy - s[1]) / k }; }
      L.drawOverlay(); return;
    }
    if (type === 'up' && T.drag) {
      const d = T.drag; T.drag = null;
      if (d.mode === 'col') { extract(false); return; }
      const r = T.draftR; T.draftR = null;
      if (r && r.w > 8 && r.h > 8) { T.region = r; T.cols = null; extract(true); return; }
      // a click on a found table selects it
      const x = ev.sx / k, y = ev.sy / k, hit = T.found.find(f => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
      if (hit) { T.region = hit; T.cols = null; extract(true); } else L.drawOverlay();
    }
  }
  function draw({ svg, view, page }) {
    const k = view.scale, s = L.s, g = s('g', { 'pointer-events': 'none' });
    if (L.pageSignature(page) === T.foundFor) for (const f of T.found) if (!T.region || f !== T.region)
      g.append(s('rect', { x: f.x * k, y: f.y * k, width: f.w * k, height: f.h * k, fill: 'rgba(48,164,108,.05)', stroke: '#30a46c', 'stroke-width': 1, 'stroke-dasharray': '6 4', rx: 3 }));
    if (T.pageId === page.id) {
      const r = T.draftR || T.region;
      if (r) g.append(s('rect', { x: r.x * k, y: r.y * k, width: r.w * k, height: r.h * k, fill: 'rgba(48,164,108,.06)', stroke: '#30a46c', 'stroke-width': 1.5, rx: 2 }));
      if (!T.draftR && T.grid && T.grid.mode === 'grid' && T.grid.xs) {
        for (const c of T.grid.cells) {
          const merged = c.rs > 1 || c.cs > 1;
          g.append(s('rect', { x: c.x * k + 1, y: c.y * k + 1, width: Math.max(0, c.w * k - 2), height: Math.max(0, c.h * k - 2), fill: merged ? 'rgba(10,132,255,.10)' : 'none', stroke: merged ? '#0a84ff' : 'rgba(48,164,108,.75)', 'stroke-width': merged ? 1.2 : 0.8, rx: 1.5 }));
        }
      }
      if (!T.draftR && T.grid && T.grid.mode === 'text' && T.region) {
        const R = T.region;
        for (const c of T.cols || []) {
          const x = c * k;
          g.append(s('line', { x1: x, y1: R.y * k, x2: x, y2: (R.y + R.h) * k, stroke: '#30a46c', 'stroke-width': 1.25, 'stroke-dasharray': '5 3' }));
          g.append(s('rect', { x: x - 4, y: R.y * k - 12, width: 8, height: 12, rx: 3, fill: '#30a46c' }));
        }
      }
    }
    svg.append(g);
  }

  /* ——— Inspector ——— */
  function results() {
    const g = T.grid; if (!g) return null;
    if (!g.cells.some(c => c.text)) return ui.section('Preview', ui.callout('No text found in that area. If this page is a scan, run <b>Make Searchable</b> first.', 'warn', 'warn'));
    const merged = g.cells.filter(c => c.rs > 1 || c.cs > 1).length;
    const n = L.state.pages.length;
    return [
      ui.section(`Preview · ${g.nR} rows × ${g.nC} columns${T.edited ? ' · edited' : ''}`,
        ui.callout(`Read from <b>${T.how}</b>${g.mode === 'grid' ? ` · ${merged} merged cell${merged === 1 ? '' : 's'} kept` : ' · drag the dashed guides to adjust columns'}.`, '', g.mode === 'grid' ? 'check' : 'info'),
        h('div', { class: 'table-preview', style: { marginTop: '10px' }, html: TG.html(g, { header: T.header }) }),
        h('div', { class: 'row between', style: { marginTop: '8px' } },
          ui.check('First row is header', T.header, v => { T.header = v; L.renderInspector(); }),
          h('button', { class: 'btn ghost', onclick: openReview }, 'Review & edit…'))),
      ui.section('Export',
        h('div', { class: 'grid2' },
          ui.btn('Excel', 'table', saveXlsx, 'primary'),
          ui.btn('Copy', 'copy', () => TG.copyRich(g, T.header, T.repeat)),
          ui.btn('CSV', 'download', () => L.saveFile(new Blob([TG.csv(g, T.repeat)], { type: 'text/csv' }), fileBase() + '.csv', 'text/csv', 'csv')),
          ui.btn('Markdown', 'copy', () => L.copyText(TG.markdown(g)))),
        h('div', { style: { marginTop: '10px' } }, ui.check('Repeat merged values in CSV / copy', T.repeat, v => { T.repeat = v; })),
        h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Excel keeps merged cells, colors, borders and column widths. “Copy” pastes into Excel or Word with merges intact.')),
      ui.section('Table continues on other pages?',
        h('div', { class: 'grid2' },
          ui.field('From page', ui.num(T.from ?? L.state.cur + 1, v => { T.from = L.clamp(Math.round(v), 1, n); }, { min: 1, max: n })),
          ui.field('To page', ui.num(T.to ?? n, v => { T.to = L.clamp(Math.round(v), 1, n); }, { min: 1, max: n }))),
        h('div', { style: { marginTop: '10px' } }, ui.btn('Use same area on these pages', 'pages', extractMulti, 'block')),
        h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Repeated header rows are dropped automatically.')),
    ];
  }

  L.registerBlade({
    id: 'tables', label: 'Tables', icon: 'table', color: '#30a46c',
    desc: 'Pull tables — merged cells and all — into Excel, CSV or Word.',
    activate() { L.setCursor('crosshair'); findTables(false); },
    draw, pointer,
    inspector() {
      const onPage = T.foundFor === (L.page() && L.pageSignature(L.page())) ? T.found : [];
      return [
        ui.head('table', 'Extract Table', 'Drag a box around a table — or let Loeito find it.'),
        ui.section('Area',
          h('div', { class: 'grid2' },
            ui.btn('Find tables', 'wand', () => findTables(true), T.region ? '' : 'primary'),
            ui.btn('Whole page', 'fit', async () => { const p = L.page(), v = L.makeView(await L.proxy(p), p, 1); T.pageId = p.id; T.region = { x: 4, y: 4, w: v.width - 8, h: v.height - 8 }; T.cols = null; extract(true); })),
          onPage.length > 1 ? h('div', { class: 'row wrap', style: { marginTop: '10px', gap: '6px' } }, onPage.map((f, i) => h('button', {
            class: 'btn' + (T.region === f ? ' primary' : ''), style: { height: '26px' },
            onclick: () => { T.pageId = L.page().id; T.region = f; T.cols = null; extract(true); },
          }, `Table ${i + 1}`))) : null,
          h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', null, 'Detect cells by'),
            ui.seg([{ label: 'Automatic', value: 'auto' }, { label: 'Grid lines', value: 'grid' }, { label: 'Text columns', value: 'text' }], T.detect, v => { T.detect = v; if (T.region) extract(true); })),
          h('div', { class: 'field', style: { marginTop: '10px' } }, h('span', null, 'Read text from'),
            ui.seg([{ label: 'Auto', value: 'auto' }, { label: 'PDF text', value: 'pdf' }, { label: 'OCR', value: 'ocr' }, { label: 'Per cell', value: 'cells', title: 'OCR every cell separately — best for scans and photos' }], T.source, v => { T.source = v; if (T.region) extract(false); })),
          T.how && T.how.startsWith('lines in the scan') && (T.source === 'pdf' || T.source === 'ocr') ? h('div', { style: { marginTop: '10px' } }, ui.callout('This table comes from a scan. <b>Per cell</b> (or Auto) reads every cell on its own with OCR — usually much cleaner.', '', 'sparkles')) : null,
          T.busy ? h('p', { class: 'muted tiny', style: { margin: '10px 0 0' } }, 'Reading the table…') : null),
        results(),
      ];
    },
  });
  L.on('page', () => {
    if (L.state.blade !== 'tables') return;
    const p = L.page();
    findTables(false);
    if (T.region && T.pageId !== p.id) { T.pageId = p.id; extract(false); }
  });
})();
