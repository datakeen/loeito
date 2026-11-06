/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Optimize blade: shrink file size, change paper size, export pages as images. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;
  const PRESETS = {
    none: { label: 'Original', sub: 'No recompression', opts: null },
    lossless: { label: 'Tidy', sub: 'Lossless clean-up', opts: { quality: 1, maxDpi: 100000 } },
    balanced: { label: 'Balanced', sub: '150 dpi · good quality', opts: { quality: 0.72, maxDpi: 150 } },
    small: { label: 'Smallest', sub: '96 dpi · email-friendly', opts: { quality: 0.55, maxDpi: 96 } },
  };
  // Shared output settings (also used by Save)
  L.output = { preset: 'none', gray: false, strip: false, paper: 'original', custom: [210, 297], margin: 0, orient: 'auto' };
  L.outputOptions = () => {
    const o = L.output, p = PRESETS[o.preset];
    const compress = p.opts ? { ...p.opts, gray: o.gray, strip: o.strip } : (o.gray || o.strip ? { quality: 0.8, maxDpi: 100000, gray: o.gray, strip: o.strip } : null);
    let pageSize = null;
    if (o.paper !== 'original') { const [w, hh] = o.paper === 'custom' ? o.custom.map(v => v * L.MM) : L.PAPER[o.paper]; pageSize = { w, h: hh, margin: o.margin * L.MM, orient: o.orient }; }
    return { compress, pageSize };
  };
  L.outputSummary = () => {
    const o = L.output, bits = [];
    if (o.preset !== 'none') bits.push(PRESETS[o.preset].label.toLowerCase() + ' compression');
    if (o.gray) bits.push('greyscale');
    if (o.paper !== 'original') bits.push(o.paper === 'custom' ? `${o.custom[0]}×${o.custom[1]} mm` : o.paper);
    return bits.join(' · ');
  };
  const R = { result: null, running: false, img: { fmt: 'png', dpi: 150, scope: 'all' } };

  async function analyse(save) {
    if (R.running) return;
    R.running = true; L.renderInspector();
    const t = L.task(save ? 'Optimising' : 'Measuring'), S = L.state;
    try {
      const { compress, pageSize } = L.outputOptions();
      const built = await L.buildPdf({ state: S, pageSize, task: { get cancelled() { return t.cancelled; }, set: (f, s) => t.set(f * 0.5, s) } });
      let bytes = built, stats = null;
      if (compress) { const r = await L.compressPdf(built, compress, t); bytes = r.bytes; stats = r.stats; }
      R.result = { size: bytes.length, before: S.fileSize, stats, key: JSON.stringify(L.output) };
      if (save) await L.saveFile(bytes, L.safeName(S.name) + '.pdf', 'application/pdf', 'pdf');
    } catch (e) { if (e.message !== 'Cancelled') L.error('Optimisation failed', e); }
    finally { t.done(); R.running = false; L.renderInspector(); }
  }
  async function exportImages() {
    const pages = R.img.scope === 'all' ? L.state.pages : L.selectedPages(), S = L.state;
    const t = L.task('Exporting images'); const files = [];
    try {
      for (let i = 0; i < pages.length; i++) {
        if (t.cancelled) throw new Error('Cancelled');
        t.set(i / pages.length, `Page ${i + 1} of ${pages.length}`);
        const blob = await L.renderPageImage(pages[i], R.img.dpi, R.img.fmt, 0.9, S);
        files.push({ name: `${L.safeName(S.name)} — page ${String(L.pageIndex(pages[i].id, S) + 1).padStart(3, '0')}.${R.img.fmt}`, data: blob, mime: R.img.fmt === 'jpg' ? 'image/jpeg' : 'image/png' });
      }
      await L.zipAndSave(files, `${L.safeName(S.name)} — images.zip`);
    } catch (e) { if (e.message !== 'Cancelled') L.error('Image export failed', e); } finally { t.done(); }
  }

  /* ——— What's using space ——— */
  const CAT = [['images', 'Images', '#0a84ff'], ['fonts', 'Fonts', '#bf5af2'], ['content', 'Page drawings & text', '#30a46c'], ['meta', 'Metadata', '#ff9f0a'], ['attachments', 'Attached files', '#ff375f'], ['structure', 'File structure', '#8e8e93'], ['other', 'Other (colour profiles, maps…)', '#c7c7cc']];
  async function audit() {
    R.auditing = true; L.renderInspector();
    try { R.audit = await L.spaceAudit(); R.audit.doc = L.doc; } catch (e) { L.error('Couldn’t look inside the file', e); }
    finally { R.auditing = false; L.renderInspector(); }
  }
  function auditView(A) {
    const pct = v => (A.total ? v / A.total * 100 : 0), rows = CAT.filter(([k]) => A.cats[k] > 0);
    const imgShare = pct(A.cats.images), fontShare = pct(A.cats.fonts);
    const bilevel = A.images.filter(i => /CCITT|JBIG2/.test(i.filter)).reduce((a, i) => a + i.size, 0) / Math.max(1, A.images.reduce((a, i) => a + i.size, 0));
    const tip = imgShare > 55 && bilevel > 0.6 ? 'Images are most of this file, but they are black-and-white scans already packed very tightly (fax / JBIG2 compression) — re-encoding won’t gain much. Cropping margins or removing pages will.'
      : imgShare > 55 ? 'Images are most of this file. “Balanced” or “Smallest” above re-encodes them at a lower resolution — usually the biggest win.'
      : fontShare > 35 ? 'Fonts are a large share. Exporting again from the original program with “embed only the characters used” (font subsetting) helps most.'
      : pct(A.cats.structure) > 35 ? 'Much of the size is file structure (often many small objects or old revisions). Saving a copy rebuilds the file more compactly.'
      : 'Space is spread evenly; compression settings above will make a moderate difference.';
    return h('div', { class: 'stack' },
      h('div', { class: 'row between' }, h('b', { style: { fontSize: '15px' } }, L.fmtBytes(A.total)), h('span', { class: 'muted tiny' }, `${A.pages} page${A.pages > 1 ? 's' : ''} · ${L.fmtBytes(A.total / Math.max(1, A.pages))} per page`)),
      h('div', { class: 'space-bar', role: 'img', 'aria-label': rows.map(([k, l]) => `${l} ${Math.round(pct(A.cats[k]))}%`).join(', ') },
        rows.map(([k, l, c]) => h('span', { title: `${l}: ${L.fmtBytes(A.cats[k])}`, style: { width: Math.max(0.6, pct(A.cats[k])) + '%', background: c } }))),
      h('div', { class: 'space-legend' }, rows.map(([k, l, c]) => h('div', null, h('i', { style: { background: c } }), h('span', { class: 'grow' }, l), h('b', null, L.fmtBytes(A.cats[k])), h('small', null, `${Math.round(pct(A.cats[k]))}%`)))),
      A.images.length ? h('details', { class: 'more' }, h('summary', null, `Largest images · ${A.images.length}`),
        h('div', { class: 'list', style: { marginTop: '8px' } }, A.images.slice(0, 8).map(im => h('div', { class: 'list-item' }, L.icon('image', 15),
          h('span', { class: 'grow tiny' }, `${im.w} × ${im.h} px · ${im.filter.replace('Decode', '')} · ${im.cs || '—'}${im.ppi ? ` · ≈${im.ppi} ppi at page width` : ''}`), h('b', { class: 'tiny' }, L.fmtBytes(im.size)))))) : null,
      A.fonts.length ? h('details', { class: 'more' }, h('summary', null, `Embedded fonts · ${A.fonts.length}`),
        h('div', { class: 'list', style: { marginTop: '8px' } }, A.fonts.slice(0, 10).map(f => h('div', { class: 'list-item' }, L.icon('type', 15),
          h('span', { class: 'grow tiny' }, f.name), f.subset ? h('span', { class: 'pill ok', title: 'Only the letters used are embedded' }, 'subset') : null, h('b', { class: 'tiny' }, L.fmtBytes(f.size)))))) : null,
      ui.callout(tip, '', 'info'));
  }

  L.registerBlade({
    id: 'compress', label: 'Optimize', icon: 'compress', color: '#64d2ff',
    desc: 'Shrink file size, change paper size, or save pages as images.',
    activate() { L.setCursor(''); },
    inspector() {
      const o = L.output, set = (k, v) => { o[k] = v; L.renderInspector(); };
      const stale = R.result && R.result.key !== JSON.stringify(o);
      const saved = R.result && R.result.before ? 1 - R.result.size / R.result.before : 0;
      return [
        ui.head('compress', 'Optimize', 'Smaller files and standard paper sizes — without losing what matters.'),
        ui.section('What’s using space',
          R.audit && R.audit.doc === L.doc ? auditView(R.audit) : h('p', { class: 'muted tiny', style: { margin: '0 0 10px' } }, 'See where the bytes go — images, fonts, page drawings, metadata — before choosing how to shrink it.'),
          ui.btn(R.auditing ? 'Looking…' : R.audit && R.audit.doc === L.doc ? 'Look again' : 'Look inside', 'pie', audit, 'block' + (R.audit && R.audit.doc === L.doc ? '' : ' primary'))),
        ui.section('File size',
          h('div', { class: 'stack' }, Object.entries(PRESETS).map(([k, p]) => h('button', { class: 'name-chip' + (o.preset === k ? ' on' : ''), onclick: () => set('preset', k) }, h('b', null, p.label), h('span', null, p.sub)))),
          h('div', { class: 'stack', style: { marginTop: '12px' } },
            ui.check('Convert colour images to greyscale', o.gray, v => set('gray', v)),
            ui.check('Remove hidden metadata', o.strip, v => set('strip', v)))),
        ui.section('Paper size',
          h('div', { class: 'grid2' },
            ui.field('Size', ui.select([{ value: 'original', label: 'Keep original' }, ...Object.keys(L.PAPER).map(k => ({ value: k, label: k })), { value: 'custom', label: 'Custom…' }], o.paper, v => set('paper', v))),
            ui.field('Orientation', ui.select([{ value: 'auto', label: 'Match page' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }], o.orient, v => set('orient', v)))),
          o.paper === 'custom' ? h('div', { class: 'grid2', style: { marginTop: '8px' } },
            ui.field('Width (mm)', ui.num(o.custom[0], v => { o.custom[0] = v || 210; })), ui.field('Height (mm)', ui.num(o.custom[1], v => { o.custom[1] = v || 297; }))) : null,
          o.paper !== 'original' ? h('div', { style: { marginTop: '8px' } }, ui.field('Margin (mm)', ui.num(o.margin, v => { o.margin = Math.max(0, v || 0); }, { min: 0 }))) : null,
          h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Every page is scaled to fit the new sheet, centred, without distortion.')),
        ui.section('Result',
          R.result && !stale ? h('div', { class: 'grid2' },
            h('div', { class: 'stat' }, h('span', { class: 'v' }, L.fmtBytes(R.result.size)), h('span', { class: 'k' }, 'new size')),
            h('div', { class: 'stat' }, h('span', { class: 'v', style: { color: saved > 0.02 ? 'var(--ok)' : '' } }, saved > 0 ? `−${Math.round(saved * 100)}%` : '±0%'), h('span', { class: 'k' }, `from ${L.fmtBytes(R.result.before)}`))) : null,
          R.result && !stale && R.result.stats && R.result.stats.images && !R.result.stats.recompressed ? h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'The images in this file are already compactly encoded (e.g. black-and-white fax compression), so there’s little left to squeeze.') : null,
          h('div', { class: 'grid2', style: { marginTop: R.result && !stale ? '12px' : 0 } },
            ui.btn(R.running ? 'Working…' : 'Measure', 'search', () => analyse(false)),
            ui.btn('Save copy', 'save', () => analyse(true), 'primary')),
          h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'These settings are also used by the main Save button.')),
        ui.section('Save pages as images',
          h('div', { class: 'grid3' },
            ui.field('Format', ui.select([{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPEG' }], R.img.fmt, v => { R.img.fmt = v; })),
            ui.field('Quality', ui.select([{ value: '72', label: '72 dpi' }, { value: '150', label: '150 dpi' }, { value: '300', label: '300 dpi' }], String(R.img.dpi), v => { R.img.dpi = +v; })),
            ui.field('Pages', ui.select([{ value: 'all', label: 'All' }, { value: 'sel', label: 'Selected' }], R.img.scope, v => { R.img.scope = v; }))),
          h('div', { style: { marginTop: '10px' } }, ui.btn('Export images', 'image', exportImages, 'block'))),
      ];
    },
  });
})();
