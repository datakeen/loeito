/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito form detection: finds the blanks of a flat form (made in Word, Excel, or scanned) and proposes fields.
   Works in display points (scale 1) like the table engine, and returns ready-made fields in PDF space. */
(() => {
  const L = window.Loeito, TG = L.tablegrid;
  const FD = (L.formdetect = {});
  const BOXES = '☐□❑❒▢◻⬜☑☒✓';
  const PLACEHOLDER = /^(click or tap here to enter text|click or tap to enter a date|choose an item|click here to enter text|click here to enter a date)\.?$/i;

  /* ——— helpers ——— */
  const lineOf = b => b.y + b.h / 2;
  const iou = (a, b) => { const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); const i = x * y; return i / Math.min(a.w * a.h, b.w * b.h); };
  const cleanLabel = s => String(s || '').trim().replace(/[\s_.…:·\-–—]+$/g, '').replace(/^\s*(\(?[a-z0-9]{1,3}[.)]|[•\-–])\s+/i, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  // What a label suggests about the answer
  FD.infer = (label, h = 16) => {
    const t = String(label || '').toLowerCase();
    if (/\bsign(ature|ed)?\b/.test(t)) return { kind: 'sign' };
    if (/e-?mail/.test(t)) return { format: 'email' };
    if (/cnic|\bnic\b|national id|id card/.test(t)) return { format: 'cnic' };
    if (/\b(date|dob|d\.o\.b|dated|born on)\b/.test(t)) return { format: 'date' };
    if (/phone|mobile|cell\b|contact (no|number)|tel\b|whats ?app/.test(t)) return { format: 'phone' };
    if (/amount|price|cost|fee|salary|charges|rate\b|\brs\b|pkr|total amount|budget/.test(t)) return { format: 'currency', decimals: 2 };
    if (/\btotal\b|\bsum\b|grand total/.test(t)) return { format: 'number', decimals: 2 };
    if (/qty|quantity|no\.? of|number of|credit hours?|\bch(s)?\b|marks|age\b|strength|count|units?\b|hours?\b|days?\b/.test(t)) return { format: 'number', decimals: 0 };
    if (h >= 30 || /address|remarks|comments?|description|reason|purpose|details|justification/.test(t)) return { kind: h >= 26 ? 'para' : 'text' };
    return {};
  };

  // Text with display boxes (scale 1). PDF text when there is enough of it, otherwise OCR.
  async function wordsOf(page, v) {
    const items = await L.pdfTextItems(page), ocr = page.ocr?.words || [];
    const pdfChars = items.reduce((a, it) => a + it.t.replace(/\s/g, '').length, 0);
    const scan = (await TG.vectorRulings(page)).imageCover > 0.6 || pdfChars < 30;
    // On a scan, Loeito's own OCR (positions measured on this page) beats a scanner app's hidden text layer.
    const useOcr = !!ocr.length && (scan || pdfChars < 30);
    const words = (useOcr ? ocr : items.flatMap(L.splitWords)).map(w => ({ t: w.t, b: L.wordBox(w, v) }));
    return { items: useOcr ? [] : items, words, scanned: scan };
  }
  // Character advances inside a text item, measured with a similar font and scaled to the item's real width.
  const mctx = document.createElement('canvas').getContext('2d');
  function charStarts(it) {
    const fam = (it.style && it.style.fontFamily) || 'sans-serif';
    mctx.font = `100px ${/serif/i.test(fam) && !/sans/i.test(fam) ? 'Times New Roman, serif' : /mono/i.test(fam) ? 'Courier New, monospace' : 'Arial, sans-serif'}`;
    const ws = [...it.t].map(ch => mctx.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) || 1, k = it.w / tot;
    const starts = []; let acc = 0; for (const w of ws) { starts.push(acc * k); acc += w; } starts.push(acc * k);
    return starts;
  }
  // display rect of a span [i0, i1) of a text item; dy/hh in multiples of the font size relative to the baseline
  function spanRect(it, starts, i0, i1, v, up = 0.95, down = 0.25) {
    const r = it.a * Math.PI / 180, ux = Math.cos(r), uy = Math.sin(r), px = -uy, py = ux;
    const p = (s, k) => v.toScreen([it.x + ux * s + px * it.h * k, it.y + uy * s + py * it.h * k]);
    const pts = [p(starts[i0], -down), p(starts[i1], -down), p(starts[i0], up), p(starts[i1], up)];
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  // Name for a field at display rect sr: words just left of it on the same line, else just above it.
  function labelNear(words, sr) {
    const cy = sr.y + sr.h / 2;
    const left = words.filter(w => w.b.x + w.b.w <= sr.x + 3 && Math.abs(lineOf(w.b) - cy) < Math.max(6, sr.h * 0.6) && sr.x - (w.b.x + w.b.w) < 240).sort((a, b) => b.b.x - a.b.x);
    const run = []; let edge = sr.x;
    for (const w of left) { if (edge - (w.b.x + w.b.w) > (run.length ? 14 : 120)) break; run.unshift(w); edge = w.b.x; }
    if (run.length) return cleanLabel(run.map(w => w.t).join(' '));
    const above = words.filter(w => w.b.y + w.b.h <= sr.y + 2 && sr.y - (w.b.y + w.b.h) < 16 && w.b.x < sr.x + sr.w && w.b.x + w.b.w > sr.x - 4).sort((a, b) => b.b.y - a.b.y);
    if (above.length) { const ly = lineOf(above[0].b); return cleanLabel(above.filter(w => Math.abs(lineOf(w.b) - ly) < 4).sort((a, b) => a.b.x - b.b.x).map(w => w.t).join(' ')); }
    return '';
  }
  FD.labelFor = async (page, rUser) => {
    const proxy = await L.proxy(page), v = L.makeView(proxy, page, 1), { words } = await wordsOf(page, v);
    return labelNear(words, v.rectToScreen(rUser));
  };

  // Small hollow squares drawn in a scan (checkboxes).
  async function rasterBoxes(page, v, words) {
    const k = 3, c = document.createElement('canvas');
    await L.renderInto(c, page, k, { dpr: 1, annotations: false, readback: true });
    const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, ink = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) ink[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114 < 175 ? 1 : 0;
    const seen = new Uint8Array(W * H), stack = new Int32Array(W * H), out = [];
    const lo = 6 * k, hi = 20 * k;
    for (let q = 0; q < W * H; q++) {
      if (!ink[q] || seen[q]) continue;
      let sp = 0, n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; stack[sp++] = q; seen[q] = 1;
      while (sp) {
        const t = stack[--sp], tx = t % W, ty = (t / W) | 0; n++;
        if (tx < x0) x0 = tx; if (tx > x1) x1 = tx; if (ty < y0) y0 = ty; if (ty > y1) y1 = ty;
        if (n > hi * hi * 2) break;
        if (tx > 0 && ink[t - 1] && !seen[t - 1]) { seen[t - 1] = 1; stack[sp++] = t - 1; }
        if (tx < W - 1 && ink[t + 1] && !seen[t + 1]) { seen[t + 1] = 1; stack[sp++] = t + 1; }
        if (ty > 0 && ink[t - W] && !seen[t - W]) { seen[t - W] = 1; stack[sp++] = t - W; }
        if (ty < H - 1 && ink[t + W] && !seen[t + W]) { seen[t + W] = 1; stack[sp++] = t + W; }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      if (bw < lo || bh < lo || bw > hi || bh > hi || Math.abs(bw - bh) > Math.max(bw, bh) * 0.25) continue;
      // a box has four straight, fully inked sides (round or open letters like O, D, C don't)
      const along = (fixed, from, to, horiz) => { let hit = 0; for (let i = from; i <= to; i++) { let any = 0; for (let d2 = 0; d2 <= 2; d2++) { const x = horiz ? i : fixed + (fixed === x0 ? d2 : -d2), y = horiz ? fixed + (fixed === y0 ? d2 : -d2) : i; if (ink[y * W + x]) any = 1; } hit += any; } return hit / (to - from + 1); };
      if (along(y0, x0, x1, true) < 0.78 || along(y1, x0, x1, true) < 0.78 || along(x0, y0, y1, false) < 0.78 || along(x1, y0, y1, false) < 0.78) continue;
      // hollow: ink along the edges, paper inside
      let inner = 0, innerN = 0;
      for (let y = y0 + Math.round(bh * 0.25); y <= y1 - Math.round(bh * 0.25); y++) for (let x = x0 + Math.round(bw * 0.25); x <= x1 - Math.round(bw * 0.25); x++) { innerN++; if (ink[y * W + x]) inner++; }
      const box = { x: x0 / k, y: y0 / k, w: bw / k, h: bh / k }, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      // a letter inside a longer word (OCR often reads a ☐ itself as "[]" or "O" — that word is box-sized, so it doesn't count)
      if (words.some(w => cx > w.b.x && cx < w.b.x + w.b.w && cy > w.b.y && cy < w.b.y + w.b.h && w.b.w > box.w * 2.2)) continue;
      if (innerN && inner / innerN < 0.12 && n > (bw + bh) * 1.2) out.push(box);
    }
    return out;
  }

  /* ——— the detector ——— */
  FD.detect = async (page, { onStep } = {}) => {
    const step = s => onStep && onStep(s);
    const proxy = await L.proxy(page), v = L.makeView(proxy, page, 1);
    const { items, words, scanned } = await wordsOf(page, v);
    const sug = []; // { kind, sr, name, ...props, src }
    const add = (kind, sr, extra) => sug.push({ kind, sr, ...extra });

    // 1 · Word content-control placeholders ("Click or tap here to enter text.")
    step('Looking for placeholders');
    for (const it of items) if (PLACEHOLDER.test(it.t.trim())) {
      const sr = L.wordBox({ ...it, w: it.w }, v), t = it.t.toLowerCase();
      add(/date/.test(t) ? 'text' : /choose an item/.test(t) ? 'dropdown' : 'text', { x: sr.x - 1, y: sr.y - 1, w: Math.max(sr.w + 2, 90), h: Math.max(sr.h + 2, 14) }, { src: 'placeholder', format: /date/.test(t) ? 'date' : 'none' });
    }

    // 2 · underscores "Name: ________" and 3 · checkbox glyphs "☐ Male"
    step('Reading blanks and boxes');
    for (const it of items) {
      const t = it.t; if (!/_{3,}/.test(t)) continue;
      const starts = charStarts(it);
      // underscore runs; runs split only by "/" "-" "." (e.g. __/__/____) become one field
      const runs = []; const re = /_{3,}/g; let m;
      while ((m = re.exec(t))) runs.push([m.index, m.index + m[0].length]);
      for (let i = 1; i < runs.length; i++) if (/^[\s/\-.]{1,3}$/.test(t.slice(runs[i - 1][1], runs[i][0]))) { runs[i - 1][1] = runs[i][1]; runs.splice(i--, 1); }
      let prevEnd = 0;
      for (const [a, b] of runs) {
        const sr = spanRect(it, starts, a, b, v, 0.95, 0.2);
        const own = cleanLabel(t.slice(prevEnd, a).replace(/[☐□❑❒▢◻⬜].*$/, ''));
        const label = own || labelNear(words, sr);
        const dateLike = /\//.test(t.slice(a, b));
        add('text', { x: sr.x, y: sr.y, w: sr.w, h: Math.max(sr.h, 13) }, { src: 'underscore', name: label, ...(dateLike ? { format: 'date' } : {}) });
        prevEnd = b;
      }
    }
    // Boxes on one line: "Gender:  ☐ Male  ☐ Female" → one single-choice group; otherwise independent checkboxes.
    async function addBoxRows(boxes, textWords, src) {
      const rows = [];
      for (const g of boxes.slice().sort((a, b) => lineOf(a) - lineOf(b) || a.x - b.x)) { const r = rows[rows.length - 1]; if (r && Math.abs(lineOf(g) - r.cy) < 5) r.bs.push(g); else rows.push({ cy: lineOf(g), bs: [g] }); }
      for (const row of rows) {
        const bs = row.bs.sort((a, b) => a.x - b.x);
        const onLine = textWords.filter(w => Math.abs(lineOf(w.b) - row.cy) < 6).map(w => {
          const box = bs.find(b => w.b.x < b.x + b.w && w.b.x + w.b.w > b.x); if (!box) return w;
          const rest = w.t.replace(/^[\[\]|()☐□O0DQJjoI1l]{1,3}(?=[A-Z])/, '');
          return w.b.x + w.b.w > box.x + box.w * 2.5 && rest !== w.t ? { t: rest, b: { ...w.b, x: box.x + box.w } } : null;
        }).filter(Boolean).sort((a, b) => a.b.x - b.b.x);
        const before = onLine.filter(w => w.b.x + w.b.w <= bs[0].x + 1), rawLabel = before.map(w => w.t).join(' ').trim();
        const opts = bs.map((b, k) => cleanLabel(onLine.filter(w => w.b.x >= b.x + b.w - 1 && (k + 1 >= bs.length || w.b.x + w.b.w <= bs[k + 1].x + 1)).map(w => w.t).join(' ').replace(/_{3,}.*$/, '')));
        if (scanned && L.ocrCells && opts.some(o => !o)) { // OCR missed an option label: read the strip right of that box
          const miss = bs.map((b, k) => (opts[k] ? null : { k, r: { x: b.x + b.w + 1, y: b.y - 4, w: Math.min(140, (k + 1 < bs.length ? bs[k + 1].x - 4 : b.x + 150) - (b.x + b.w + 1)), h: b.h + 8 } })).filter(Boolean).filter(m => m.r.w > 8);
          const got = miss.length ? await L.ocrCells(page, miss.map(m => m.r)) : [];
          miss.forEach((m, i) => { opts[m.k] = cleanLabel((got[i] || '').split('\n')[0]); });
        }
        const lineLabel = cleanLabel(rawLabel), asRadio = bs.length >= 2 && /:$/.test(rawLabel);
        bs.forEach((b, k) => {
          if (asRadio) add('radio', b, { src, group: lineLabel, exportValue: opts[k] || `Option ${k + 1}`, name: lineLabel });
          else add('check', b, { src, name: opts[k] ? (lineLabel && bs.length > 1 ? `${lineLabel} - ${opts[k]}` : opts[k]) : lineLabel || 'Checkbox', exportValue: 'Yes' });
        });
      }
    }
    // 3 · checkbox glyphs, grouped by line: "Gender:  ☐ Male  ☐ Female" → one choice group
    const glyphs = [];
    for (const it of items) {
      if (![...it.t].some(ch => BOXES.includes(ch))) continue;
      const starts = charStarts(it);
      [...it.t].forEach((ch, i) => {
        if (!BOXES.includes(ch)) return;
        const g = spanRect(it, starts, i, i + 1, v, 0.78, 0.08), side = Math.max(7, Math.min(g.w, g.h, 16));
        glyphs.push({ x: g.x + (g.w - side) / 2, y: g.y + (g.h - side) / 2, w: side, h: side });
      });
    }
    const textWords = words.filter(w => ![...w.t].every(ch => BOXES.includes(ch)));
    await addBoxRows(glyphs, textWords, 'glyph');

    // On a scan "empty" means no ink — OCR can miss faint or stamped text, so look at the pixels themselves.
    let inkIn = null;
    if (scanned) {
      const k = 2, c = document.createElement('canvas');
      await L.renderInto(c, page, k, { dpr: 1, annotations: false, readback: true });
      const W = c.width, d = c.getContext('2d').getImageData(0, 0, W, c.height).data;
      inkIn = r => { // share of dark pixels inside r (display pt), keeping 3 pt clear of the borders
        const x0 = Math.max(0, Math.round((r.x + 3) * k)), y0 = Math.max(0, Math.round((r.y + 3) * k)), x1 = Math.min(W - 1, Math.round((r.x + r.w - 3) * k)), y1 = Math.min(c.height - 1, Math.round((r.y + r.h - 3) * k));
        const dk = (x, y) => d[(y * W + x) * 4] * 0.3 + d[(y * W + x) * 4 + 1] * 0.59 + d[(y * W + x) * 4 + 2] * 0.11 < 140;
        let on = 0, n = 0;
        for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) { n++; if (dk(x, y) && (dk(x - 1, y) + dk(x + 1, y) + dk(x, y - 1) + dk(x, y + 1)) >= 2) on++; } // specks are isolated
        return n ? on / n : 0;
      };
    }

    // 4 · tables: empty cells next to labels (Word / Excel forms, ruled scans)
    step('Finding tables');
    let rul = await TG.vectorRulings(page);
    if (!TG.hasGrid(rul) && scanned) rul = await TG.rasterRulings(page, { x: 0, y: 0, w: v.width, h: v.height });
    const tables = TG.findTables(rul), inTable = sr => tables.some(t => sr.x + sr.w / 2 > t.x && sr.x + sr.w / 2 < t.x + t.w && sr.y + sr.h / 2 > t.y && sr.y + sr.h / 2 < t.y + t.h);
    let tableNo = 0;
    for (const reg of tables) {
      const clip = TG.clip(rul, reg), inside = words.filter(w => { const cx = w.b.x + w.b.w / 2, cy = lineOf(w.b); return cx > reg.x && cx < reg.x + reg.w && cy > reg.y && cy < reg.y + reg.h; });
      const g = TG.buildGrid(clip, inkIn ? [] : inside); if (!g) continue;
      tableNo++;
      if (inkIn) { // a scan: whole-page OCR turns cell borders and specks into junk words, so judge by ink and read cells one by one
        const inked = g.cells.filter(c => inkIn(c) > 0.01);
        step(`Reading ${inked.length} table cells`);
        const texts = inked.length && L.ocrCells ? await L.ocrCells(page, inked.map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h }))) : [];
        inked.forEach((c, i) => { c.text = texts[i] || '·'; });
      }
      const at = (r, c) => g.cells.find(x => r >= x.r && r < x.r + x.rs && c >= x.c && c < x.c + x.cs);
      const bottomCovered = cell => { const y = cell.y + cell.h; let cov = 0; for (const s of clip.H) if (Math.abs(s.y - y) < 3) cov += Math.max(0, Math.min(cell.x + cell.w, s.x1) - Math.max(cell.x, s.x0)); return cov >= cell.w * 0.6; };
      for (const cell of g.cells) {
        if (cell.text || cell.w < 16 || cell.h < 9 || !bottomCovered(cell)) continue;
        const leftCell = cell.c > 0 ? at(cell.r, cell.c - 1) : null, header = cell.r > 0 ? at(0, cell.c) : null, rowHead = cell.c > 0 ? at(cell.r, 0) : null;
        const txt = c => (c && c.text && c.text !== '·' ? cleanLabel(c.text.replace(/\n/g, ' ')) : '');
        let leftText = txt(leftCell), rowText = rowHead !== leftCell ? txt(rowHead) : '';
        const headText = header !== cell ? txt(header) : '';
        // on a scan, row numbers are read from tiny digits; the row's position is the reliable number
        if (inkIn && headText) { const num = t => t && t.length <= 3 && /^[\w#.\[\]]+$/.test(t); if (num(leftText) && leftCell && leftCell.c === 0) leftText = String(cell.r); if (num(rowText)) rowText = String(cell.r); }
        let name = '';
        const numericLeft = /^\d+$/.test(leftText), leftIsRowLabel = leftCell && leftCell.c === 0 && at(0, 0) && at(0, 0).text;
        if (leftText && !numericLeft) name = headText && leftIsRowLabel ? `${headText} ${leftText}` : leftText; // "Total | [ ]" or "Name | [ ]"
        else if (headText) name = `${headText} ${rowText || (numericLeft ? leftText : cell.r)}`;                  // grid of entries: "Quantity 3"
        else if (leftText) name = leftText;
        if (!name) name = labelNear(words, { x: cell.x, y: cell.y, w: cell.w, h: Math.min(cell.h, 14) }); // heading just above the box
        if (!name) continue;
        const pad = 1.5, sr = { x: cell.x + pad, y: cell.y + pad, w: cell.w - 2 * pad, h: cell.h - 2 * pad };
        add('text', sr, { src: 'cell', name, table: { n: tableNo, r: cell.r, c: cell.c, header: headText, row: rowText || leftText }, typeHint: headText || name });
      }
    }

    // 5 · lone lines to write on ("Approved by: ________" drawn as a line)
    step('Checking lines');
    const lone = [];
    for (const s of [...rul.H, ...(rul.lonelyH || [])].sort((a, b) => a.y - b.y || a.x0 - b.x0)) { // join pieces of one writing line
      const m = lone.find(l => Math.abs(l.y - s.y) <= 2 && s.x0 - l.x1 <= 12 && s.x1 >= l.x0 - 12);
      if (m) { m.x0 = Math.min(m.x0, s.x0); m.x1 = Math.max(m.x1, s.x1); } else lone.push({ ...s });
    }
    for (const s of lone) {
      const len = s.x1 - s.x0; if (len < 36) continue;
      if (tables.some(t => s.y >= t.y - 4 && s.y <= t.y + t.h + 4 && s.x0 < t.x + t.w && s.x1 > t.x)) continue; // a table border
      const sr = { x: s.x0, y: s.y - 15, w: len, h: 14 };
      // text sitting on (or cut by) the line: an underline, or the baseline of a soft scan — not a blank
      const over = words.filter(w => w.b.y < s.y + 1 && w.b.y + w.b.h > s.y - 4 && w.b.x < s.x1 && w.b.x + w.b.w > s.x0).reduce((a, w) => a + Math.min(w.b.w, s.x1 - w.b.x), 0);
      if (over > len * 0.4) continue; // an underline under text, not a blank
      if (inkIn && inkIn({ x: sr.x - 3, y: sr.y - 3, w: sr.w + 6, h: sr.h + 1 }) > 0.01) continue; // already written on
      const name = labelNear(words, sr); if (!name) continue; // decorative rules have no label
      add('text', sr, { src: 'line', name });
    }

    // 6 · small squares drawn as boxes (vector) and hollow squares in scans
    step('Looking for check boxes');
    const squares = [...(rul.squares || [])];
    if (scanned) squares.push(...(await rasterBoxes(page, v, words)));
    await addBoxRows(squares, words, 'square');

    // 7 · "Label:" followed by empty space on the line
    step('Reading labels');
    const lines = [];
    for (const w of words.slice().sort((a, b) => lineOf(a.b) - lineOf(b.b))) { const l = lines[lines.length - 1]; if (l && Math.abs(lineOf(w.b) - l.cy) < w.b.h * 0.5) l.ws.push(w); else lines.push({ cy: lineOf(w.b), ws: [w] }); }
    const rightEdge = Math.min(v.width - 30, Math.max(...words.map(w => w.b.x + w.b.w), v.width * 0.6));
    for (const l of lines) {
      const ws = l.ws.sort((a, b) => a.b.x - b.b.x);
      ws.forEach((w, i) => {
        if (!/:$/.test(w.t) || /^https?:/.test(w.t)) return;
        const next = ws[i + 1], end = next ? next.b.x - 6 : rightEdge, start = w.b.x + w.b.w + 5;
        if (end - start < 60) return;
        const sr = { x: start, y: w.b.y - 2, w: Math.min(end - start, 260), h: Math.max(13, w.b.h + 4) };
        if (inTable(sr) || (inkIn && inkIn(sr) > 0.01)) return;
        const labelWs = []; for (let j = i; j >= 0; j--) { if (j < i && ws[j + 1].b.x - (ws[j].b.x + ws[j].b.w) > 12) break; labelWs.unshift(ws[j]); }
        add('text', sr, { src: 'colon', name: cleanLabel(labelWs.map(x => x.t).join(' ')) });
      });
    }

    // ——— tidy: drop overlaps (earlier sources win), existing fields win, name & type everything ———
    step('Naming fields');
    const existing = (page.fields || []).map(f => v.rectToScreen(f.r));
    const kept = [];
    for (const s of sug) {
      if (s.sr.w < 5 || s.sr.h < 5) continue;
      if (existing.some(e => iou(e, s.sr) > 0.3) || kept.some(k => iou(k.sr, s.sr) > 0.3 && !(k.kind === 'radio' && s.kind === 'radio' && k.sr.x !== s.sr.x))) continue;
      kept.push(s);
    }
    const used = new Set(L.forms.all().map(x => x.f.name)), uniq = n => { let b = n || 'Field', k = 2, x = b; while (used.has(x)) x = `${b} ${k++}`; used.add(x); return x; };
    let blank = 0;
    const fields = kept.map(s => {
      const label = s.name || (s.kind === 'check' ? 'Checkbox' : `Field ${++blank}`);
      const inferred = FD.infer(s.typeHint || label, s.sr.h);
      const kind = s.kind === 'text' ? (inferred.kind || 'text') : s.kind;
      const extra = { name: kind === 'radio' ? s.group : uniq(label), style: 'plain', format: s.format && s.format !== 'none' ? s.format : inferred.format || 'none', decimals: inferred.decimals ?? 2, group: s.group || '', exportValue: s.exportValue || '' };
      if (kind === 'dropdown') extra.options = ['Option 1', 'Option 2'];
      const f = L.forms.make(kind, v.rectToPdf(s.sr), extra);
      f._table = s.table; f._src = s.src;
      return f;
    });
    // automatic totals: "Total …" sums the matching column or the fields named after it
    for (const f of fields) {
      if (!/\btotal\b/i.test(f.name) || !L.forms.numeric(f)) continue;
      const base = f.name.replace(/\btotal\b/i, '').replace(/[:\s]+/g, ' ').trim().toLowerCase();
      let of = [];
      if (f._table) of = fields.filter(g => g !== f && g._table && g._table.n === f._table.n && g._table.c === f._table.c && g._table.r < f._table.r && L.forms.numeric(g)).map(g => g.name);
      if (!of.length && base) of = fields.filter(g => g !== f && L.forms.numeric(g) && g.name.toLowerCase().startsWith(base)).map(g => g.name);
      if (of.length) f.calc = { op: 'SUM', of };
    }
    // Amount = Quantity × Price in the same table row
    for (const f of fields) {
      if (!f._table || !/amount/i.test(f._table.header || '')) continue;
      const row = fields.filter(g => g._table && g._table.n === f._table.n && g._table.r === f._table.r);
      const q = row.find(g => /qty|quantity/i.test(g._table.header || '')), p = row.find(g => /price|rate/i.test(g._table.header || ''));
      if (q && p) f.calc = { op: 'PRD', of: [q.name, p.name] };
    }
    FD.last = kept.map((s, i) => ({ src: s.src, name: fields[i] && fields[i].name, sr: s.sr })); // for troubleshooting
    fields.forEach(f => { delete f._table; delete f._src; });
    return { fields, scanned, sources: kept.reduce((a, s) => ((a[s.src] = (a[s.src] || 0) + 1), a), {}) };
  };
})();
