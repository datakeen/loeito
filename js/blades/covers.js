/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Covers blade: finished front covers and last pages for PDF books, reports and theses.
   Pick a design, type the details, add it as the first or last page. Drawn as vector PDF with the standard
   fonts (Times, Helvetica), so the text stays sharp and selectable. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;
  const P = () => PDFLib;

  /* ——— drawing helpers (PDF space: y grows upward) ——— */
  const rgbOf = (hex, a = 0, toward = 1) => { const [r, g, b] = L.hexToRgb(hex); return P().rgb(r + (toward - r) * a, g + (toward - g) * a, b + (toward - b) * a); };
  const tint = (hex, a) => rgbOf(hex, a, 1), shade = (hex, a) => rgbOf(hex, a, 0);
  const W = s => L.winAnsi(s || '').replace(/\n+/g, ' ').trim();
  function wrap(str, font, size, maxW, tracking = 0) {
    const words = W(str).split(/\s+/).filter(Boolean), lines = []; let cur = '';
    const width = s => font.widthOfTextAtSize(s, size) + tracking * Math.max(0, s.length - 1);
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (width(t) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
    if (cur) lines.push(cur);
    return lines;
  }
  // Largest size (≤ max) at which the text fits in maxLines lines of maxW.
  function fit(str, font, max, min, maxW, maxLines, tracking = 0) {
    for (let s = max; s >= min; s -= 0.5) { const lines = wrap(str, font, s, maxW, tracking * s); if (lines.length <= maxLines && lines.every(l => font.widthOfTextAtSize(l, s) <= maxW)) return { size: s, lines }; }
    return { size: min, lines: wrap(str, font, min, maxW).slice(0, maxLines) };
  }
  function line(pg, str, { x, y, size, font, color, align = 'left', tracking = 0, opacity = 1 }) {
    str = W(str); if (!str) return 0;
    const tc = tracking * size, w = font.widthOfTextAtSize(str, size) + tc * (str.length - 1);
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    if (tc) pg.pushOperators(P().setCharacterSpacing(tc));
    pg.drawText(str, { x: x0, y, size, font, color, opacity });
    if (tc) pg.pushOperators(P().setCharacterSpacing(0));
    return w;
  }
  // Lines downward from `top` (the top of the block); returns the y below the block.
  function lines(pg, ls, { x, top, size, lh = 1.2, ...o }) {
    ls.forEach((l, i) => line(pg, l, { x, y: top - size * 0.8 - i * size * lh, size, ...o }));
    return top - size * (0.8 + 0.25) - (ls.length - 1) * size * lh;
  }
  const blockH = (n, size, lh = 1.2) => size * 1.05 + (n - 1) * size * lh;
  function picture(pg, img, box, mode = 'cover') {
    const s = mode === 'cover' ? Math.max(box.w / img.width, box.h / img.height) : Math.min(box.w / img.width, box.h / img.height);
    const w = img.width * s, hh = img.height * s, x = box.x + (box.w - w) / 2, y = box.y + (box.h - hh) / 2;
    pg.pushOperators(P().pushGraphicsState(), P().rectangle(box.x, box.y, box.w, box.h), P().clip(), P().endPath());
    pg.drawImage(img, { x, y, width: w, height: hh });
    pg.pushOperators(P().popGraphicsState());
  }
  const diamond = (pg, cx, cy, r, color) => pg.drawSvgPath(`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`, { x: cx, y: cy, color });
  const pubLine = d => [d.publisher, d.edition].filter(s => s && s.trim()).join('  ·  ');

  /* ——— Designs ———  each: (pg, d, f, ctx) with ctx = { W, H, accent, img }  */
  const FRONT = {
    classic: { name: 'Classic', note: 'Cream paper, framed, serif', draw(pg, d, f, { W, H, accent }) {
      const ink = P().rgb(0.13, 0.12, 0.11);
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: P().rgb(0.969, 0.953, 0.918) });
      const m = W * 0.055;
      pg.drawRectangle({ x: m, y: m, width: W - 2 * m, height: H - 2 * m, borderColor: shade(accent, 0.15), borderWidth: 1.1 });
      pg.drawRectangle({ x: m + 5, y: m + 5, width: W - 2 * m - 10, height: H - 2 * m - 10, borderColor: shade(accent, 0.15), borderWidth: 0.4 });
      if (d.series) line(pg, d.series.toUpperCase(), { x: W / 2, y: H * 0.86, size: W * 0.018, font: f.serif, color: rgbOf(accent), align: 'center', tracking: 0.25 });
      const t = fit(d.title, f.serifB, W * 0.085, 18, W * 0.68, 4);
      const sub = d.subtitle ? wrap(d.subtitle, f.serifI, W * 0.03, W * 0.62) : [];
      const total = blockH(t.lines.length, t.size, 1.12) + 40 + (sub.length ? blockH(sub.length, W * 0.03, 1.3) : 0);
      let y = lines(pg, t.lines, { x: W / 2, top: H * 0.6 + total / 2, size: t.size, lh: 1.12, font: f.serifB, color: ink, align: 'center' });
      y -= 16; pg.drawLine({ start: { x: W / 2 - W * 0.16, y }, end: { x: W / 2 - 9, y }, thickness: 0.6, color: rgbOf(accent) });
      pg.drawLine({ start: { x: W / 2 + 9, y }, end: { x: W / 2 + W * 0.16, y }, thickness: 0.6, color: rgbOf(accent) });
      diamond(pg, W / 2, y, 3.6, rgbOf(accent)); y -= 18;
      if (sub.length) lines(pg, sub, { x: W / 2, top: y, size: W * 0.03, lh: 1.3, font: f.serifI, color: shade('#6e6458', 0), align: 'center' });
      if (d.author) line(pg, d.author.toUpperCase(), { x: W / 2, y: H * 0.25, size: W * 0.026, font: f.serif, color: ink, align: 'center', tracking: 0.18 });
      if (d.contributor) line(pg, d.contributor, { x: W / 2, y: H * 0.25 - W * 0.04, size: W * 0.019, font: f.serifI, color: shade('#6e6458', 0), align: 'center' });
      if (pubLine(d)) line(pg, pubLine(d), { x: W / 2, y: H * 0.1, size: W * 0.018, font: f.serif, color: shade('#6e6458', 0), align: 'center', tracking: 0.08 });
    } },
    swiss: { name: 'Swiss', note: 'Colour field, bold grid', draw(pg, d, f, { W, H, accent }) {
      const band = H * 0.56, m = W * 0.09, white = P().rgb(1, 1, 1), ink = P().rgb(0.1, 0.1, 0.1);
      pg.drawRectangle({ x: 0, y: H - band, width: W, height: band, color: rgbOf(accent) });
      if (d.series) line(pg, d.series.toUpperCase(), { x: m, y: H - m * 0.9, size: W * 0.018, font: f.sansB, color: white, tracking: 0.12 });
      if (d.edition) line(pg, d.edition, { x: W - m, y: H - m * 0.9, size: W * 0.018, font: f.sans, color: white, align: 'right' });
      const t = fit(d.title, f.sansB, W * 0.105, 18, W - 2 * m, 4);
      const th = blockH(t.lines.length, t.size, 1.02);
      lines(pg, t.lines, { x: m, top: H - band + th + m * 0.7, size: t.size, lh: 1.02, font: f.sansB, color: white });
      let y = H - band - m * 0.75;
      if (d.subtitle) y = lines(pg, wrap(d.subtitle, f.sans, W * 0.032, W - 2 * m), { x: m, top: y, size: W * 0.032, lh: 1.25, font: f.sans, color: ink });
      pg.drawLine({ start: { x: m, y: m * 1.9 }, end: { x: W - m, y: m * 1.9 }, thickness: 1.2, color: ink });
      if (d.author) line(pg, d.author, { x: m, y: m * 1.9 - W * 0.045, size: W * 0.03, font: f.sansB, color: ink });
      if (d.publisher) line(pg, d.publisher, { x: W - m, y: m * 1.9 - W * 0.045, size: W * 0.022, font: f.sans, color: ink, align: 'right' });
      if (d.contributor) line(pg, d.contributor, { x: m, y: m * 1.9 - W * 0.08, size: W * 0.02, font: f.sans, color: P().rgb(0.4, 0.4, 0.4) });
    } },
    nordic: { name: 'Nordic', note: 'Soft light, one calm shape', draw(pg, d, f, { W, H, accent }) {
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: tint(accent, 0.9) });
      pg.drawCircle({ x: W * 0.72, y: H * 0.7, size: W * 0.36, color: tint(accent, 0.55) });
      pg.drawCircle({ x: W * 0.72, y: H * 0.7, size: W * 0.2, color: tint(accent, 0.35) });
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H * 0.42, color: tint(accent, 0.94) });
      pg.drawLine({ start: { x: 0, y: H * 0.42 }, end: { x: W, y: H * 0.42 }, thickness: 0.8, color: shade(accent, 0.2) });
      const m = W * 0.1, ink = shade(accent, 0.65);
      const t = fit(d.title.toUpperCase(), f.sans, W * 0.06, 14, W - 2 * m, 4, 0.12);
      let y = lines(pg, t.lines, { x: m, top: H * 0.36, size: t.size, lh: 1.25, font: f.sans, color: ink, tracking: 0.12 });
      if (d.subtitle) y = lines(pg, wrap(d.subtitle, f.serifI, W * 0.028, W - 2 * m), { x: m, top: y - 6, size: W * 0.028, lh: 1.3, font: f.serifI, color: shade(accent, 0.45) });
      if (d.author) line(pg, d.author.toUpperCase(), { x: m, y: m * 0.95, size: W * 0.02, font: f.sansB, color: ink, tracking: 0.2 });
      if (d.publisher) line(pg, d.publisher, { x: W - m, y: m * 0.95, size: W * 0.018, font: f.sans, color: shade(accent, 0.45), align: 'right' });
    } },
    midnight: { name: 'Midnight', note: 'Dark, gold lines, elegant', draw(pg, d, f, { W, H }) {
      const gold = P().rgb(0.79, 0.64, 0.36), ivory = P().rgb(0.96, 0.94, 0.89);
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: P().rgb(0.075, 0.085, 0.11) });
      const m = W * 0.07;
      pg.drawRectangle({ x: m, y: m, width: W - 2 * m, height: H - 2 * m, borderColor: gold, borderWidth: 0.7 });
      for (const [cx, cy] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) diamond(pg, cx, cy, 4, gold);
      if (d.series) line(pg, d.series.toUpperCase(), { x: W / 2, y: H * 0.83, size: W * 0.017, font: f.sans, color: gold, align: 'center', tracking: 0.35 });
      const t = fit(d.title, f.serif, W * 0.088, 18, W * 0.7, 4);
      const th = blockH(t.lines.length, t.size, 1.1);
      let y = lines(pg, t.lines, { x: W / 2, top: H * 0.6 + th / 2, size: t.size, lh: 1.1, font: f.serif, color: ivory, align: 'center' });
      y -= 14; pg.drawLine({ start: { x: W / 2 - 28, y }, end: { x: W / 2 + 28, y }, thickness: 0.7, color: gold }); y -= 16;
      if (d.subtitle) lines(pg, wrap(d.subtitle, f.serifI, W * 0.03, W * 0.62), { x: W / 2, top: y, size: W * 0.03, lh: 1.3, font: f.serifI, color: P().rgb(0.75, 0.73, 0.68), align: 'center' });
      if (d.author) line(pg, d.author.toUpperCase(), { x: W / 2, y: H * 0.2, size: W * 0.024, font: f.sans, color: gold, align: 'center', tracking: 0.3 });
      if (pubLine(d)) line(pg, pubLine(d), { x: W / 2, y: H * 0.115, size: W * 0.016, font: f.serifI, color: P().rgb(0.7, 0.68, 0.63), align: 'center' });
    } },
    academic: { name: 'Thesis', note: 'University title page', draw(pg, d, f, { W, H, accent, img }) {
      const ink = P().rgb(0.08, 0.08, 0.1), grey = P().rgb(0.35, 0.35, 0.38), m = W * 0.12;
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: P().rgb(1, 1, 1) });
      let y = H - m * 0.9;
      if (d.publisher) y = lines(pg, wrap(d.publisher.toUpperCase(), f.serifB, W * 0.026, W - 2 * m, 0.04 * W * 0.026), { x: W / 2, top: y, size: W * 0.026, lh: 1.25, font: f.serifB, color: ink, align: 'center', tracking: 0.04 });
      if (d.series) y = lines(pg, wrap(d.series, f.serif, W * 0.022, W - 2 * m), { x: W / 2, top: y - 4, size: W * 0.022, lh: 1.25, font: f.serif, color: grey, align: 'center' });
      if (img) { const box = { x: W / 2 - W * 0.11, y: y - W * 0.25, w: W * 0.22, h: W * 0.22 }; picture(pg, img, box, 'contain'); y = box.y - 10; }
      else { pg.drawLine({ start: { x: m, y: y - 14 }, end: { x: W - m, y: y - 14 }, thickness: 0.6, color: rgbOf(accent) }); y -= 28; }
      const t = fit(d.title, f.serifB, W * 0.055, 14, W - 2 * m, 5);
      y = lines(pg, t.lines, { x: W / 2, top: H * 0.58 + blockH(t.lines.length, t.size, 1.2) / 2, size: t.size, lh: 1.2, font: f.serifB, color: ink, align: 'center' });
      if (d.subtitle) y = lines(pg, wrap(d.subtitle, f.serifI, W * 0.024, W - 2.2 * m), { x: W / 2, top: y - 14, size: W * 0.024, lh: 1.35, font: f.serifI, color: grey, align: 'center' });
      let yb = H * 0.3;
      if (d.author) { line(pg, 'by', { x: W / 2, y: yb, size: W * 0.02, font: f.serifI, color: grey, align: 'center' }); line(pg, d.author, { x: W / 2, y: yb - W * 0.04, size: W * 0.03, font: f.serifB, color: ink, align: 'center' }); yb -= W * 0.1; }
      if (d.contributor) { line(pg, d.contributor, { x: W / 2, y: yb, size: W * 0.021, font: f.serif, color: grey, align: 'center' }); }
      if (d.edition) line(pg, d.edition, { x: W / 2, y: m * 0.8, size: W * 0.022, font: f.serif, color: ink, align: 'center' });
    } },
    report: { name: 'Report', note: 'Technical or company report', draw(pg, d, f, { W, H, accent, img }) {
      const ink = P().rgb(0.1, 0.11, 0.13), grey = P().rgb(0.42, 0.43, 0.46), m = W * 0.11;
      pg.drawRectangle({ x: 0, y: 0, width: W * 0.035, height: H, color: rgbOf(accent) });
      if (img) picture(pg, img, { x: m, y: H - m - W * 0.09, w: W * 0.3, h: W * 0.09 }, 'contain');
      else if (d.publisher) line(pg, d.publisher.toUpperCase(), { x: m, y: H - m - W * 0.03, size: W * 0.02, font: f.sansB, color: rgbOf(accent), tracking: 0.1 });
      if (d.series) line(pg, d.series, { x: W - m * 0.7, y: H - m - W * 0.03, size: W * 0.019, font: f.sans, color: grey, align: 'right' });
      const t = fit(d.title, f.sansB, W * 0.07, 16, W - 1.8 * m, 4);
      let y = lines(pg, t.lines, { x: m, top: H * 0.66, size: t.size, lh: 1.08, font: f.sansB, color: ink });
      if (d.subtitle) y = lines(pg, wrap(d.subtitle, f.sans, W * 0.03, W - 2 * m), { x: m, top: y - 8, size: W * 0.03, lh: 1.3, font: f.sans, color: grey });
      pg.drawLine({ start: { x: m, y: y - 14 }, end: { x: m + W * 0.12, y: y - 14 }, thickness: 2.4, color: rgbOf(accent) });
      const rows = [['Prepared by', d.author], ['With', d.contributor], ['For', d.publisher && img ? d.publisher : ''], ['Date', d.edition]].filter(r => r[1] && r[1].trim());
      let ry = m + rows.length * W * 0.05;
      for (const [k, v] of rows) {
        pg.drawLine({ start: { x: m, y: ry + W * 0.033 }, end: { x: W - m * 0.7, y: ry + W * 0.033 }, thickness: 0.4, color: P().rgb(0.8, 0.8, 0.82) });
        line(pg, k.toUpperCase(), { x: m, y: ry, size: W * 0.015, font: f.sansB, color: grey, tracking: 0.08 });
        line(pg, v, { x: m + W * 0.22, y: ry, size: W * 0.021, font: f.sans, color: ink });
        ry -= W * 0.05;
      }
    } },
    bold: { name: 'Bold', note: 'Full colour, big type', draw(pg, d, f, { W, H, accent }) {
      const white = P().rgb(1, 1, 1), m = W * 0.08;
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgbOf(accent) });
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H * 0.18, color: shade(accent, 0.25) });
      const t = fit(d.title.toUpperCase(), f.sansB, W * 0.15, 20, W - 2 * m, 5);
      let y = lines(pg, t.lines, { x: m, top: H - m * 1.4, size: t.size, lh: 0.98, font: f.sansB, color: white });
      if (d.subtitle) lines(pg, wrap(d.subtitle, f.sans, W * 0.034, W - 2 * m), { x: m, top: y - 10, size: W * 0.034, lh: 1.25, font: f.sans, color: tint(accent, 0.75) });
      if (d.author) line(pg, d.author, { x: m, y: H * 0.18 / 2 - W * 0.012, size: W * 0.034, font: f.sansB, color: white });
      if (d.publisher) line(pg, d.publisher, { x: W - m, y: H * 0.18 / 2 - W * 0.012, size: W * 0.02, font: f.sans, color: tint(accent, 0.7), align: 'right' });
    } },
    picture: { name: 'Picture', note: 'Your photo on top', draw(pg, d, f, { W, H, accent, img }) {
      const ink = P().rgb(0.1, 0.1, 0.1), top = H * 0.4, m = W * 0.08;
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: P().rgb(0.985, 0.98, 0.97) });
      if (img) picture(pg, img, { x: 0, y: top, w: W, h: H - top });
      else { // no photo yet: a quiet pattern in the accent colour
        pg.drawRectangle({ x: 0, y: top, width: W, height: H - top, color: tint(accent, 0.2) });
        pg.pushOperators(P().pushGraphicsState(), P().rectangle(0, top, W, H - top), P().clip(), P().endPath());
        for (let k = 5; k >= 1; k--) pg.drawCircle({ x: W * 0.78, y: top + (H - top) * 0.62, size: W * 0.13 * k, color: tint(accent, 0.2 + k * 0.1) });
        pg.pushOperators(P().popGraphicsState());
      }
      pg.drawRectangle({ x: m, y: top - 3, width: W * 0.14, height: 6, color: rgbOf(accent) });
      const t = fit(d.title, f.serifB, W * 0.075, 16, W - 2 * m, 3);
      let y = lines(pg, t.lines, { x: m, top: top - W * 0.06, size: t.size, lh: 1.08, font: f.serifB, color: ink });
      if (d.subtitle) lines(pg, wrap(d.subtitle, f.serifI, W * 0.03, W - 2 * m), { x: m, top: y - 6, size: W * 0.03, lh: 1.3, font: f.serifI, color: P().rgb(0.38, 0.38, 0.4) });
      if (d.author) line(pg, d.author.toUpperCase(), { x: m, y: m, size: W * 0.022, font: f.sansB, color: ink, tracking: 0.15 });
      if (d.publisher) line(pg, d.publisher, { x: W - m, y: m, size: W * 0.018, font: f.sans, color: P().rgb(0.4, 0.4, 0.42), align: 'right' });
    } },
  };
  const BACK = {
    blurb: { name: 'Back cover', note: 'Description, author, ISBN', draw(pg, d, f, { W, H, accent }) {
      const ivory = P().rgb(0.97, 0.96, 0.93), m = W * 0.12;
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: shade(accent, 0.55) });
      // measure first, so the whole text block sits optically centred
      const t = fit(d.title, f.serifB, W * 0.05, 14, W - 2 * m, 2), bs = W * 0.026, as = W * 0.022;
      const paras = d.blurb ? String(d.blurb).split(/\n\s*\n|\n/).filter(p => p.trim()).map(p => wrap(p, f.serif, bs, W - 2 * m)) : [];
      const about = d.about ? wrap(d.about, f.serifI, as, W - 2.4 * m) : [];
      const tall = blockH(t.lines.length, t.size, 1.15) + 30 + paras.reduce((a, ls) => a + blockH(ls.length, bs, 1.45) + 8, 0) + (about.length ? 28 + blockH(about.length, as, 1.4) : 0);
      let y = Math.min(H - m, H * 0.56 + tall / 2);
      y = lines(pg, t.lines, { x: W / 2, top: y, size: t.size, lh: 1.15, font: f.serifB, color: ivory, align: 'center' });
      pg.drawLine({ start: { x: W / 2 - 22, y: y - 10 }, end: { x: W / 2 + 22, y: y - 10 }, thickness: 0.7, color: tint(accent, 0.5) }); y -= 30;
      for (const ls of paras) y = lines(pg, ls, { x: W / 2, top: y, size: bs, lh: 1.45, font: f.serif, color: ivory, align: 'center' }) - 8;
      if (about.length) { y -= 10; line(pg, 'ABOUT THE AUTHOR', { x: W / 2, y, size: W * 0.016, font: f.sansB, color: tint(accent, 0.55), align: 'center', tracking: 0.25 }); y -= 18;
        lines(pg, about, { x: W / 2, top: y, size: as, lh: 1.4, font: f.serifI, color: tint(accent, 0.8), align: 'center' }); }
      if (d.isbn) { const bw = W * 0.3, bh = W * 0.075, bx = W - m - bw + m * 0.4, by = m * 0.6; pg.drawRectangle({ x: bx, y: by, width: bw, height: bh, color: P().rgb(1, 1, 1) });
        line(pg, 'ISBN ' + d.isbn, { x: bx + bw / 2, y: by + bh / 2 - W * 0.007, size: W * 0.02, font: f.sans, color: P().rgb(0.1, 0.1, 0.1), align: 'center' }); }
      const pub = [d.publisher, d.website].filter(Boolean).join('  ·  ');
      if (pub) line(pg, pub, { x: m * 0.6, y: m * 0.6 + W * 0.03, size: W * 0.018, font: f.sans, color: tint(accent, 0.7) });
    } },
    colophon: { name: 'Colophon', note: 'Copyright & edition page', draw(pg, d, f, { W, H }) {
      const ink = P().rgb(0.2, 0.2, 0.22), m = W * 0.12, s = W * 0.019;
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: P().rgb(1, 1, 1) });
      const yr = (String(d.edition || '').match(/(19|20)\d\d/) || [String(new Date().getFullYear())])[0];
      const rows = [d.title && d.title, d.subtitle, '', `© ${yr} ${d.author || ''}`.trim() + '. All rights reserved.', 'No part of this publication may be reproduced without the written permission of the copyright holder.', '',
        d.edition, d.publisher, d.website, d.isbn ? 'ISBN ' + d.isbn : '', d.contributor, '', 'Made with Loeito.'].filter(r => r != null);
      let y = m + rows.length * s * 1.6;
      rows.forEach((r, i) => { if (r) lines(pg, wrap(r, i === 0 ? f.serifB : f.serif, s, W * 0.6), { x: m, top: y, size: s, lh: 1.45, font: i === 0 ? f.serifB : f.serif, color: ink }); y -= s * 1.6 * Math.max(1, wrap(r || ' ', f.serif, s, W * 0.6).length); });
    } },
    author: { name: 'About the author', note: 'Portrait and short bio', draw(pg, d, f, { W, H, accent, img }) {
      const ink = P().rgb(0.12, 0.12, 0.14), m = W * 0.14;
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: P().rgb(0.985, 0.98, 0.97) });
      line(pg, 'ABOUT THE AUTHOR', { x: W / 2, y: H - m, size: W * 0.02, font: f.sansB, color: rgbOf(accent), align: 'center', tracking: 0.3 });
      let y = H - m - 30;
      if (img) { const s = W * 0.3; picture(pg, img, { x: W / 2 - s / 2, y: y - s, w: s, h: s }); y -= s + 26; }
      if (d.author) { line(pg, d.author, { x: W / 2, y, size: W * 0.04, font: f.serifB, color: ink, align: 'center' }); y -= 26; }
      if (d.about) for (const para of String(d.about).split(/\n+/)) y = lines(pg, wrap(para, f.serif, W * 0.025, W - 2 * m), { x: W / 2, top: y, size: W * 0.025, lh: 1.5, font: f.serif, color: ink, align: 'center' }) - 10;
      if (d.website) line(pg, d.website, { x: W / 2, y: m * 0.7, size: W * 0.02, font: f.sans, color: rgbOf(accent), align: 'center' });
    } },
    notes: { name: 'Notes', note: 'A lined page', draw(pg, d, f, { W, H, accent }) {
      const m = W * 0.11;
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: P().rgb(1, 1, 1) });
      line(pg, 'Notes', { x: m, y: H - m, size: W * 0.045, font: f.serifI, color: rgbOf(accent) });
      for (let y = H - m - W * 0.08; y > m; y -= W * 0.045) pg.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.4, color: P().rgb(0.78, 0.8, 0.84) });
    } },
    end: { name: 'The end', note: 'A quiet closing page', draw(pg, d, f, { W, H, accent }) {
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: P().rgb(0.985, 0.98, 0.97) });
      diamond(pg, W / 2, H * 0.56, 5, rgbOf(accent));
      pg.drawLine({ start: { x: W / 2 - 50, y: H * 0.56 }, end: { x: W / 2 - 12, y: H * 0.56 }, thickness: 0.6, color: rgbOf(accent) });
      pg.drawLine({ start: { x: W / 2 + 12, y: H * 0.56 }, end: { x: W / 2 + 50, y: H * 0.56 }, thickness: 0.6, color: rgbOf(accent) });
      line(pg, d.closing || 'Thank you for reading', { x: W / 2, y: H * 0.5, size: W * 0.036, font: f.serifI, color: P().rgb(0.2, 0.2, 0.22), align: 'center' });
      const tail = [d.author, d.website].filter(Boolean).join('  ·  ');
      if (tail) line(pg, tail, { x: W / 2, y: H * 0.45, size: W * 0.02, font: f.sans, color: P().rgb(0.45, 0.45, 0.48), align: 'center' });
    } },
  };

  /* ——— Making the page ——— */
  const dataUrlBytes = url => Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0));
  L.COVER_DESIGNS = { front: Object.entries(FRONT).map(([id, t]) => ({ value: id, label: t.name })), back: Object.entries(BACK).map(([id, t]) => ({ value: id, label: t.name })) };
  L.coverPdf = async (kind, id, d, [Wd, Hd]) => {
    const { PDFDocument, StandardFonts } = P();
    const doc = await PDFDocument.create(), pg = doc.addPage([Wd, Hd]);
    const f = {
      serif: await doc.embedFont(StandardFonts.TimesRoman), serifB: await doc.embedFont(StandardFonts.TimesRomanBold), serifI: await doc.embedFont(StandardFonts.TimesRomanItalic),
      sans: await doc.embedFont(StandardFonts.Helvetica), sansB: await doc.embedFont(StandardFonts.HelveticaBold),
    };
    let img = null;
    if (d.picture) try { img = d.picture.startsWith('data:image/png') ? await doc.embedPng(dataUrlBytes(d.picture)) : await doc.embedJpg(dataUrlBytes(d.picture)); } catch {}
    const T = (kind === 'back' ? BACK : FRONT)[id];
    T.draw(pg, { ...d, title: d.title || 'Untitled' }, f, { W: Wd, H: Hd, accent: d.accent || '#2b5d8a', img });
    doc.setTitle(kind === 'back' ? `${d.title || ''} — ${T.name}` : d.title || ''); doc.setAuthor(d.author || ''); doc.setProducer('Loeito PDF'); doc.setCreator('Loeito PDF');
    return doc.save();
  };
  async function renderThumb(bytes, canvas, width) {
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    try {
      const p = await pdf.getPage(1), v0 = p.getViewport({ scale: 1 }), dpr = Math.min(2, devicePixelRatio || 1);
      const vp = p.getViewport({ scale: width / v0.width * dpr });
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
      canvas.style.width = width + 'px'; canvas.style.height = Math.round(vp.height / dpr) + 'px';
      await p.render({ canvasContext: canvas.getContext('2d'), viewport: vp, intent: 'print' }).promise;
    } finally { pdf.destroy(); }
  }

  /* ——— Blade ——— */
  const ACCENTS = ['#2b5d8a', '#1d1d1f', '#4f6b45', '#b5562f', '#6b3f69', '#c08a2b', '#7a9bb0', '#a8454f'];
  const SIZES = [{ value: 'doc', label: 'Same as this document' }, { value: 'A4', label: 'A4' }, { value: 'Letter', label: 'US Letter' }, { value: 'A5', label: 'A5' }, { value: 'B5', label: 'B5 · 176 × 250 mm' }, { value: 'book', label: 'Book · 6 × 9 in' }];
  const C = { kind: 'front', front: 'classic', back: 'blurb', size: 'doc', token: 0 };
  const info = () => {
    const s = L.state;
    return (s.coverInfo ||= { title: s.meta?.title || s.name || '', subtitle: '', author: s.meta?.author || '', contributor: '', publisher: '', edition: String(new Date().getFullYear()), series: '', blurb: '', about: '', isbn: '', website: '', closing: '', picture: '', accent: ACCENTS[0] });
  };
  async function pageSize() {
    if (C.size === 'doc') { const p = L.state.pages[0], v = L.makeView(await L.proxy(p), p, 1); return [Math.min(v.width, v.height), Math.max(v.width, v.height)]; } // the paper of this document, upright
    return { A4: [595.28, 841.89], Letter: [612, 792], A5: [419.53, 595.28], B5: [498.9, 708.66], book: [432, 648] }[C.size];
  }
  const current = () => (C.kind === 'back' ? C.back : C.front);
  let preview = null, gallery = null;
  const refreshPreview = L.debounce(async () => {
    if (!preview || !L.hasDoc()) return;
    const token = ++C.token, size = await pageSize();
    try {
      const bytes = await L.coverPdf(C.kind, current(), info(), size);
      if (token !== C.token) return;
      await renderThumb(bytes, preview, 220);
      if (gallery) for (const el of gallery.querySelectorAll('canvas[data-id]')) {
        const b = await L.coverPdf(C.kind, el.dataset.id, info(), size);
        if (token !== C.token) return;
        await renderThumb(b, el, 122);
      }
    } catch (e) { console.warn('cover preview', e); }
  }, 260);

  async function add(where) {
    const s = L.state, d = info();
    if (!d.title.trim() && C.kind === 'front') return L.toast('Type a title first', { icon: 'info' });
    const t = L.task('Making the page', { cancellable: false });
    try {
      const T = (C.kind === 'back' ? BACK : FRONT)[current()];
      const bytes = await L.coverPdf(C.kind, current(), d, await pageSize());
      const { id } = await L.addSource(new Uint8Array(bytes), `${T.name}.pdf`);
      const pg = L.newPage(id, 0);
      L.mutate(`add ${T.name.toLowerCase()}`, () => {
        if (where === 'first') { s.pages.unshift(pg); s.cur = 0; }
        else if (where === 'last') { s.pages.push(pg); s.cur = s.pages.length - 1; }
        else if (where === 'replace-first') { s.pages[0] = pg; s.cur = 0; }
        else { s.pages[s.pages.length - 1] = pg; s.cur = s.pages.length - 1; }
      });
      L.toast(`${T.name} added — change the details and add again any time`, { kind: 'ok', icon: 'cover' });
    } catch (e) { L.error('Couldn’t make the page', e); }
    finally { t.done(); }
  }
  async function choosePicture() {
    const inp = h('input', { type: 'file', accept: 'image/png,image/jpeg' });
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
      info().picture = url; L.renderInspector(); refreshPreview();
    };
    inp.click();
  }

  L.registerBlade({
    id: 'covers', label: 'Covers', icon: 'cover', color: '#c08a2b',
    desc: 'Beautiful front covers and last pages for books, reports and theses — type the details, pick a design.',
    activate() { L.setCursor(''); },
    deactivate() { preview = null; gallery = null; },
    inspector() {
      const d = info(), designs = C.kind === 'back' ? BACK : FRONT;
      const set = (k, v) => { d[k] = v; refreshPreview(); };
      const field = (k, label, ph, area = false) => ui.field(label, h(area ? 'textarea' : 'input', { class: 'input', rows: area ? 4 : null, value: d[k] || '', placeholder: ph, oninput: e => set(k, e.target.value) }));
      preview = h('canvas', { class: 'cover-preview' });
      gallery = h('div', { class: 'cover-gallery' }, Object.entries(designs).map(([id, T]) => h('button', {
        class: 'cover-card' + (current() === id ? ' on' : ''), title: T.note,
        onclick: () => { C[C.kind] = id; L.renderInspector(); },
      }, h('canvas', { 'data-id': id }), h('b', null, T.name), h('span', null, T.note))));
      refreshPreview();
      const front = C.kind === 'front';
      return [
        ui.head('cover', 'Covers', 'A finished first and last page. Type the details, pick a design.'),
        h('div', { class: 'section' },
          ui.seg([{ value: 'front', label: 'Front cover', icon: 'cover' }, { value: 'back', label: 'Last page', icon: 'book' }], C.kind, v => { C.kind = v; L.renderInspector(); }),
          h('div', { class: 'cover-stage' }, preview),
          h('div', { class: 'grid2', style: { marginTop: '12px' } },
            ui.btn(front ? 'Add as first page' : 'Add as last page', 'plus', () => add(front ? 'first' : 'last'), 'primary'),
            ui.btn(front ? 'Replace page 1' : 'Replace last page', 'rot180', () => add(front ? 'replace-first' : 'replace-last')))),
        ui.section('Design', gallery),
        ui.section('Details',
          h('div', { class: 'stack' },
            field('title', 'Title', 'The book’s title'),
            field('subtitle', front ? 'Subtitle' : 'Subtitle (for the colophon)', front ? 'Optional' : ''),
            field('author', 'Author', 'Your name'),
            front ? null : field('blurb', 'Description — back cover', 'What the book is about, in a few sentences.', true),
            front ? null : field('about', 'About the author', 'Two or three lines.', true),
            h('details', { class: 'more' }, h('summary', null, 'More details'),
              h('div', { class: 'stack', style: { marginTop: '10px' } },
                field('publisher', 'Publisher / institution', 'e.g. Wah Engineering College'),
                field('series', 'Series / department', 'e.g. Department of Civil Engineering'),
                field('contributor', 'Supervisor / editor / illustrator', 'e.g. Supervised by Dr. A. Khan'),
                field('edition', 'Edition / date', 'e.g. Second edition · 2026'),
                front ? null : field('isbn', 'ISBN', '978-…'),
                field('website', 'Website', 'e.g. www.example.com'),
                front ? null : field('closing', 'Closing line (The end)', 'Thank you for reading'))))),
        ui.section('Look',
          h('div', { class: 'stack' },
            L.swatches(d.accent, v => set('accent', v), ACCENTS),
            ui.field('Page size', ui.select(SIZES, C.size, v => { C.size = v; refreshPreview(); })),
            h('div', { class: 'grid2' },
              ui.btn(d.picture ? 'Change picture' : 'Add picture or logo', 'image', choosePicture),
              d.picture ? ui.btn('Remove picture', 'trash', () => { d.picture = ''; L.renderInspector(); }) : h('span')),
            h('p', { class: 'muted tiny', style: { margin: 0 } }, 'Pictures appear in Picture, Thesis (logo), Report (logo) and About the author.'))),
      ];
    },
  });
})();
