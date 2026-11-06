/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Make Searchable blade: OCR with Tesseract, written back as an invisible text layer so the page looks untouched. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;
  const LANGS = [
    ['eng', 'English'], ['fra', 'French'], ['deu', 'German'], ['spa', 'Spanish'], ['ita', 'Italian'], ['por', 'Portuguese'], ['nld', 'Dutch'],
    ['swe', 'Swedish'], ['dan', 'Danish'], ['nor', 'Norwegian'], ['fin', 'Finnish'], ['pol', 'Polish'], ['tur', 'Turkish'], ['ind', 'Indonesian'],
    ['urd', 'Urdu*'], ['ara', 'Arabic*'], ['hin', 'Hindi*'], ['rus', 'Russian*'], ['chi_sim', 'Chinese (Simplified)*'],
  ];
  const O = { lang: 'eng', lang2: '', scope: 'needed', quality: 'accurate', showWords: false, running: null, last: null };
  const hasText = new Map(); // pageKey -> bool
  const keyOf = p => p.src + ':' + p.index;
  async function pageHasText(p) {
    const k = keyOf(p); if (hasText.has(k)) return hasText.get(k);
    const items = await L.pdfTextItems(p); const n = items.reduce((a, it) => a + it.t.replace(/\s/g, '').length, 0);
    hasText.set(k, n > 25); return n > 25;
  }
  async function targets() {
    const s = L.state;
    if (O.scope === 'this') return [L.page()];
    if (O.scope === 'selected') return L.selectedPages();
    if (O.scope === 'all') return s.pages.slice();
    const out = []; for (const p of s.pages) if (!p.ocr && !(await pageHasText(p))) out.push(p);
    return out;
  }

  function extractWords(data, view) {
    const raw = [];
    for (const b of data.blocks || []) for (const par of b.paragraphs || []) for (const line of par.lines || []) for (const w of line.words || []) raw.push({ w, line });
    if (!raw.length && data.words) for (const w of data.words) raw.push({ w, line: w.line || { bbox: w.bbox, baseline: w.baseline } });
    const out = [];
    for (const { w, line } of raw) {
      const t = (w.text || '').trim(); if (!t || w.confidence < 15) continue;
      const bb = w.bbox, lb = line.bbox || bb, bl = line.baseline && line.baseline.has_baseline !== false ? line.baseline : null;
      const baseAt = x => bl && bl.x1 !== bl.x0 ? bl.y0 + (bl.y1 - bl.y0) * (x - bl.x0) / (bl.x1 - bl.x0) : bb.y1 - (bb.y1 - bb.y0) * 0.18;
      const b0 = baseAt(bb.x0), b1 = baseAt(bb.x1);
      const sizePx = L.clamp(((b0 + b1) / 2 - lb.y0) / 0.74, 4, 400);
      const p0 = view.toPdf([bb.x0, b0]), p1 = view.toPdf([bb.x1, b1]);
      const a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI;
      out.push({ t, x: +p0[0].toFixed(2), y: +p0[1].toFixed(2), a: +a.toFixed(2), w: +Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(2), h: +(sizePx / view.scale).toFixed(2), c: Math.round(w.confidence) });
    }
    return out;
  }

  async function run() {
    if (O.running) return;
    const list = await targets();
    if (!list.length) {
      L.toast(O.scope === 'needed' ? 'Every page already has text — choose “All pages” to OCR anyway.' : 'No pages to process.', { icon: 'info', ms: 4200 });
      return;
    }
    const withText = []; for (const p of list) if (await pageHasText(p)) withText.push(p);
    if (withText.length && O.scope !== 'needed') {
      const ok = await L.confirm('Some pages already have text', `${withText.length} of ${list.length} page(s) already contain selectable text. Adding OCR there may duplicate search results.`, 'OCR anyway');
      if (!ok) return;
    }
    const t = L.task('Making searchable'); O.running = t; L.renderInspector();
    const S = L.state; // results go to the tab this run started in, even if you switch tabs meanwhile
    const lang = [O.lang, O.lang2].filter(Boolean).join('+');
    let worker, done = 0;
    try {
      t.set(0.01, 'Loading the text recogniser…');
      await L.loadScript(L.LIBS.tesseract);
      let cur = 0;
      worker = await Tesseract.createWorker(lang, 1, {
        logger: m => {
          if (m.status === 'recognizing text') t.set((cur + m.progress) / list.length, `Reading page ${cur + 1} of ${list.length} · ${Math.round(m.progress * 100)}%`);
          else if (/loading|initializ/i.test(m.status)) t.set(0.02, m.status.replace(/^\w/, c => c.toUpperCase()) + '…');
        },
      });
      await worker.setParameters({ preserve_interword_spaces: '1' });
      L.checkpoint('make searchable');
      const dpi = O.quality === 'accurate' ? 300 : 200;
      for (cur = 0; cur < list.length; cur++) {
        if (t.cancelled) break;
        const p = list[cur], proxy = await L.proxy(p);
        const base = L.makeView(proxy, p, 1, { full: true });
        const scale = Math.min(dpi / 72, 4200 / Math.max(base.width, base.height));
        const c = document.createElement('canvas');
        const view = await L.renderInto(c, p, scale, { full: true, dpr: 1, annotations: false, intent: 'print' });
        const { data } = await worker.recognize(c, {}, { blocks: true, text: true });
        const words = extractWords(data, view);
        const idx = L.pageIndex(p.id, S);
        if (idx >= 0) {
          S.pages[idx] = { ...S.pages[idx], ocr: { lang, words, text: data.text || '', conf: Math.round(data.confidence || 0), at: Date.now() } };
          S.dirty = true;
          done++;
          if (S === L.state) L.emit('change', { label: 'ocr', quiet: true }); else L.emit('docs');
        }
      }
      L.invalidateSearch();
      O.last = { done, total: list.length, lang };
      L.toast(t.cancelled ? `Stopped — ${done} page(s) made searchable` : `${done} page${done === 1 ? '' : 's'} now searchable`, { kind: 'ok', icon: 'ocr' });
    } catch (e) { L.error('Text recognition failed', e); }
    finally { t.done(); O.running = null; if (worker) worker.terminate(); L.renderInspector(); }
  }

  /* Cell-by-cell OCR for tables: each cell is cropped, its border lines are wiped, and it is read on its own,
     so a busy page layout (stamps, scanner streaks) can't mix lines from neighbouring cells. */
  let cellWorker = null, cellLang = null, idleT = 0;
  L.ocrCells = async (page, rects, { task } = {}) => {
    await L.loadScript(L.LIBS.tesseract);
    const lang = [O.lang, O.lang2].filter(Boolean).join('+');
    clearTimeout(idleT);
    if (!cellWorker || cellLang !== lang) { if (cellWorker) await cellWorker.terminate(); task && task.set(0.02, 'Loading the text recogniser…'); cellWorker = await Tesseract.createWorker(lang, 1); cellLang = lang; }
    await cellWorker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '0' });
    const k = 300 / 72, src = document.createElement('canvas');
    await L.renderInto(src, page, k, { dpr: 1, annotations: false, intent: 'print', readback: true });
    const sctx = src.getContext('2d'), out = [];
    // paper level of this page: only near-paper greys are whitened, so soft (blurred) letter edges survive
    let paper = 245; { const pd = sctx.getImageData(0, 0, src.width, src.height).data, hist = new Uint32Array(256); let n = 0; for (let j = 0; j < pd.length; j += 4 * 13) { hist[Math.round(pd[j] * 0.299 + pd[j + 1] * 0.587 + pd[j + 2] * 0.114)]++; n++; } let a = 0; for (let v = 0; v < 256; v++) { a += hist[v]; if (a >= n * 0.6) { paper = v; break; } } }
    const whiten = L.clamp(paper - 30, 170, 225);
    for (let i = 0; i < rects.length; i++) {
      if (task && task.cancelled) break;
      task && task.set(0.05 + 0.95 * i / rects.length, `Reading cell ${i + 1} of ${rects.length}`);
      const r = rects[i], inset = 2.2;
      const x = Math.max(0, Math.round((r.x + inset) * k)), y = Math.max(0, Math.round((r.y + inset) * k));
      const w = Math.min(src.width - x, Math.round((r.w - 2 * inset) * k)), hh = Math.min(src.height - y, Math.round((r.h - 2 * inset) * k));
      if (w < 6 || hh < 6) { out.push(''); continue; }
      const id = sctx.getImageData(x, y, w, hh), d = id.data, dark = (i2) => d[i2] * 0.299 + d[i2 + 1] * 0.587 + d[i2 + 2] * 0.114 < 140;
      // wipe leftover border lines — only near the crop edges, where a slightly crooked border can still show
      // (letter stems in a short cell can fill most of a column, so the middle is never touched)
      const edge = Math.max(4, Math.round(1.6 * k));
      for (let yy = 0; yy < hh; yy++) { if (yy >= edge && yy < hh - edge) continue; let n = 0; for (let xx = 0; xx < w; xx++) if (dark((yy * w + xx) * 4)) n++; if (n > w * 0.55) for (let xx = 0; xx < w; xx++) d.fill(255, (yy * w + xx) * 4, (yy * w + xx) * 4 + 3); }
      for (let xx = 0; xx < w; xx++) { if (xx >= edge && xx < w - edge) continue; let n = 0; for (let yy = 0; yy < hh; yy++) if (dark((yy * w + xx) * 4)) n++; if (n > hh * 0.55) for (let yy = 0; yy < hh; yy++) d.fill(255, (yy * w + xx) * 4, (yy * w + xx) * 4 + 3); }
      // find ink blobs (to drop specks); light greys — paper tint, scanner streaks — are whitened, letter edges keep their grey
      const bw = new Uint8Array(w * hh), lumAt = j => d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114;
      for (let j = 0, q = 0; q < bw.length; j += 4, q++) bw[q] = lumAt(j) < 140 ? 1 : 0;
      // drop specks: ink blobs smaller than ~0.6 pt across
      const minBlob = Math.max(6, Math.round((0.6 * k) ** 2)), seen = new Uint8Array(w * hh), stack = [];
      let ink = 0;
      for (let q = 0; q < bw.length; q++) {
        if (!bw[q] || seen[q]) continue;
        const blob = []; stack.push(q); seen[q] = 1;
        while (stack.length) {
          const t = stack.pop(); blob.push(t); const tx = t % w, ty = (t / w) | 0;
          for (const n of [tx > 0 ? t - 1 : -1, tx < w - 1 ? t + 1 : -1, ty > 0 ? t - w : -1, ty < hh - 1 ? t + w : -1]) if (n >= 0 && bw[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
        }
        if (blob.length < minBlob) for (const t of blob) bw[t] = 0; else ink += blob.length;
      }
      if (ink < minBlob * 2) { out.push(''); continue; } // empty cell
      const pad = 16, c = document.createElement('canvas'); c.width = w + pad * 2; c.height = hh + pad * 2;
      const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
      const speck = new Uint8Array(w * hh); for (let q = 0; q < bw.length; q++) speck[q] = seen[q] && !bw[q] && lumAt(q * 4) < 140 ? 1 : 0;
      for (let q = 0; q < bw.length; q++) { const l = lumAt(q * 4); if (speck[q] || l > whiten) { d[q * 4] = d[q * 4 + 1] = d[q * 4 + 2] = 255; } d[q * 4 + 3] = 255; }
      cx.putImageData(id, pad, pad);
      const clean = t => String(t || '').split('\n').map(l => l.replace(/^[\s|!'‘’"`.,:;_~\-—]+|[\s|!'‘’"`,;_~\-—]+$/g, '').replace(/\s*[—–]?\.{3,}\s*/g, ' ').replace(/\s{2,}/g, ' ')).filter(l => /[\p{L}\p{N}]/u.test(l)).join('\n');
      // Scanner specks come back as junk "words": very low confidence, or doubtful AND junk-shaped
      // (1–2 letters that aren't a word, or odd symbols such as "Ri!" or "1]").
      const SHORT = new Set(['a', 'to', 'of', 'in', 'on', 'at', 'by', 'or', 'an', 'as', 'is', 'it', 'no', 'be', 'do', 'if', 'up', 'we', 'he', 'so', 'am', 'id', 'ok', 'ms', 'mr', 'dr', 'st', 'nd', 'rd', 'th', 'ch', 'cr', 'hr', 'km', 'kg', 'mm', 'cm', 'rs', 'pk', 'bs', 'ma', 'mba', 'phd']);
      const junky = t => (/^[A-Za-z]{1,2}$/.test(t) && !SHORT.has(t.toLowerCase())) || /[^\w()\/\-.,:;%&'"#+@°]/.test(t.replace(/^[(\[]|[)\].,;:]$/g, ''));
      const confident = data => {
        const lines = [];
        for (const bl of data.blocks || []) for (const pa of bl.paragraphs || []) for (const ln of pa.lines || []) {
          const ws = ln.words || [], wordy = ws.filter(w => /[\p{L}\p{N}]/u.test(w.text));
          const keep = ws.filter(w => !/[\p{L}\p{N}]/u.test(w.text) ? w.confidence >= 40 && /^[\/&+\-–:%#]$/.test(w.text) // lone "/", "&", "-"…
            : w.confidence >= 65 || (w.confidence >= 30 && !junky(w.text)) || (w.confidence >= 15 && /^[(\[]?[A-Za-z][a-z]{3,}[)\].,;:]?$/.test(w.text)) || (wordy.length === 1 && w.confidence >= 30));
          if (keep.length) lines.push(keep.map(w => w.text).join(' '));
        }
        return lines.length ? lines.join('\n') : data.text;
      };
      let text = clean(confident((await cellWorker.recognize(c, {}, { blocks: true, text: true })).data));
      // ink but no text: try reading it as one line, then as a single character (e.g. a lone "1")
      for (const psm of ['7', '10']) {
        if (text) break;
        await cellWorker.setParameters({ tessedit_pageseg_mode: psm });
        text = clean((await cellWorker.recognize(c)).data.text);
        await cellWorker.setParameters({ tessedit_pageseg_mode: '6' });
      }
      out.push(text);
    }
    idleT = setTimeout(() => { if (cellWorker) { cellWorker.terminate(); cellWorker = null; } }, 120000);
    return out;
  };

  function draw({ svg, view, page }) {
    if (!O.showWords || !page.ocr) return;
    const g = L.s('g', { 'pointer-events': 'none' });
    for (const w of page.ocr.words) {
      const b = L.wordBox(w, view), weak = w.c < 70;
      g.append(L.s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: weak ? 'rgba(255,149,0,.18)' : 'rgba(10,132,255,.12)', stroke: weak ? '#ff9500' : '#0a84ff', 'stroke-width': 0.6, rx: 1.5 }));
    }
    svg.append(g);
  }

  L.registerBlade({
    id: 'ocr', label: 'Searchable', icon: 'ocr', color: '#0a84ff',
    desc: 'Turn scans into searchable, copyable text — layout untouched.',
    activate() { L.setCursor(''); }, draw,
    inspector() {
      const s = L.state, p = L.page(), ocrd = s.pages.filter(q => q.ocr);
      const status = h('div', { class: 'callout' }, L.icon('info'), h('div', null, 'Checking this page…'));
      if (p) pageHasText(p).then(has => {
        status.replaceChildren(L.icon(p.ocr ? 'check' : has ? 'info' : 'warn'), h('div', {
          html: p.ocr ? `<b>This page is searchable.</b> ${p.ocr.words.length.toLocaleString()} words recognised, ${p.ocr.conf}% average confidence.`
            : has ? '<b>This page already has text.</b> It’s searchable as it is.' : '<b>This page is an image.</b> Its words can’t be searched or copied yet.',
        }));
      });
      const nonLatin = /\*$/.test((LANGS.find(l => l[0] === O.lang) || [])[1] || '');
      return [
        ui.head('ocr', 'Make Searchable', 'Recognises the words on scanned pages and tucks an invisible text layer beneath them.'),
        h('div', { class: 'section' }, status),
        ui.section('Language',
          h('div', { class: 'grid2' },
            ui.select(LANGS.map(([v, l]) => ({ value: v, label: l })), O.lang, v => { O.lang = v; L.renderInspector(); }),
            ui.select([{ value: '', label: '+ none' }, ...LANGS.filter(l => l[0] !== O.lang).map(([v, l]) => ({ value: v, label: '+ ' + l }))], O.lang2, v => { O.lang2 = v; })),
          nonLatin ? h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, '* Recognised text can be copied and exported. The invisible PDF layer currently supports Latin-script languages.') : null),
        ui.section('Pages',
          ui.select([{ value: 'needed', label: 'Pages without text' }, { value: 'all', label: `All ${s.pages.length} pages` }, { value: 'this', label: 'This page' }, { value: 'selected', label: 'Selected pages' }], O.scope, v => { O.scope = v; }),
          h('div', { style: { marginTop: '10px' } }, ui.seg([{ label: 'Accurate · 300 dpi', value: 'accurate' }, { label: 'Fast · 200 dpi', value: 'fast' }], O.quality, v => { O.quality = v; })),
          h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn primary block lg', disabled: !!O.running, onclick: run }, L.icon('ocr'), O.running ? 'Working…' : 'Make Searchable')),
          h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Runs on this computer. The first run downloads the language model (~10 MB).')),
        ocrd.length ? ui.section('Results',
          h('div', { class: 'grid2' },
            h('div', { class: 'stat' }, h('span', { class: 'v' }, ocrd.length), h('span', { class: 'k' }, 'pages searchable')),
            h('div', { class: 'stat' }, h('span', { class: 'v' }, ocrd.reduce((a, q) => a + q.ocr.words.length, 0).toLocaleString()), h('span', { class: 'k' }, 'words found'))),
          h('div', { style: { marginTop: '12px' } }, ui.check('Show recognised words on the page', O.showWords, v => { O.showWords = v; L.drawOverlay(); })),
          h('div', { class: 'stack', style: { marginTop: '12px' } },
            p && p.ocr ? ui.btn('Copy this page’s text', 'copy', () => L.copyText(L.wordsToText(p.ocr.words, p)), 'block') : null,
            ui.btn('Export recognised text (.txt)', 'download', async () => {
              const text = ocrd.map(q => `——— Page ${L.pageIndex(q.id) + 1} ———\n` + L.wordsToText(q.ocr.words, q)).join('\n\n');
              await L.saveFile(new Blob([text], { type: 'text/plain' }), L.safeName(s.name) + ' — text.txt', 'text/plain', 'txt');
            }, 'block'),
            ui.btn('Remove OCR text', 'trash', () => L.mutate('remove OCR', () => { s.pages = s.pages.map(q => ({ ...q, ocr: null })); }), 'ghost block'))) : null,
        ui.section(null, ui.callout('Save the document to keep the text layer. Search (Ctrl F), Tables and Edit text all use it straight away.')),
      ];
    },
  });
  L.on('page', () => { if (L.state.blade === 'ocr') L.renderInspector(); });
})();
