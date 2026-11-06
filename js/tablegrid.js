/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito table engine: finds ruled grids (vector drawings or scanned pixels), rebuilds merged cells, and exports.
   All geometry is in display points (scale 1, visible page frame) — the same space as L.wordBox(w, view@1). */
(() => {
  const L = window.Loeito;
  const TG = (L.tablegrid = {});
  const compose = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const hex = c => (c && c.length >= 3 ? [...c].slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() : '000000');
  const lum = c => (c ? (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 : 0);

  /* ——— 1 · Rulings from the PDF's own drawing commands ——— */
  const vecCache = new Map();
  TG.vectorRulings = async page => {
    const proxy = await L.proxy(page), view = L.makeView(proxy, page, 1);
    const key = `${page.src}:${page.index}:${view.rotation}:${JSON.stringify(view.box)}`;
    if (vecCache.has(key)) return vecCache.get(key);
    const O = pdfjsLib.OPS, ol = await proxy.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0], fill = [0, 0, 0], stroke = [0, 0, 0];
    const stack = [], thin = [], strokes = [], fills = [], squares = [];
    let imageArea = 0; // how much of the page is covered by pictures (a scan is one big picture)
    let path = null; // [{pts:[[x,y]...], closed, rect}]
    const FILL = new Set([O.fill, O.eoFill, O.fillStroke, O.eoFillStroke, O.closeFillStroke, O.closeEOFillStroke]);
    const STROKE = new Set([O.stroke, O.closeStroke, O.fillStroke, O.eoFillStroke, O.closeFillStroke, O.closeEOFillStroke]);
    const rgb = a => (a && a.length >= 3 ? [a[0], a[1], a[2]] : a && a.length === 1 ? [a[0] * 255, a[0] * 255, a[0] * 255] : [0, 0, 0]);
    for (let i = 0; i < ol.fnArray.length; i++) {
      const fn = ol.fnArray[i], a = ol.argsArray[i];
      if (fn === O.save) stack.push([ctm, fill, stroke]);
      else if (fn === O.restore) { const s = stack.pop(); if (s) [ctm, fill, stroke] = s; }
      else if (fn === O.transform) ctm = compose(ctm, a);
      else if (fn === O.paintFormXObjectBegin) { stack.push([ctm, fill, stroke]); if (a && a[0]) ctm = compose(ctm, a[0]); }
      else if (fn === O.paintFormXObjectEnd) { const s = stack.pop(); if (s) [ctm, fill, stroke] = s; }
      else if (fn === O.paintImageXObject || fn === O.paintJpegXObject || fn === O.paintInlineImageXObject) imageArea += Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]);
      else if (fn === O.setFillRGBColor) fill = rgb(a);
      else if (fn === O.setStrokeRGBColor) stroke = rgb(a);
      else if (fn === O.setFillGray) fill = rgb([a[0]]);
      else if (fn === O.setStrokeGray) stroke = rgb([a[0]]);
      else if (fn === O.constructPath) {
        const ops = a[0], c = a[1]; let k = 0, cur = null; path = path || [];
        for (const op of ops) {
          if (op === O.rectangle) { const [x, y, w, hh] = c.slice(k, k + 4); k += 4; path.push({ pts: [ap(ctm, x, y), ap(ctm, x + w, y), ap(ctm, x + w, y + hh), ap(ctm, x, y + hh)], closed: true }); cur = null; }
          else if (op === O.moveTo) { cur = { pts: [ap(ctm, c[k], c[k + 1])], closed: false }; path.push(cur); k += 2; }
          else if (op === O.lineTo) { if (!cur) { cur = { pts: [], closed: false }; path.push(cur); } cur.pts.push(ap(ctm, c[k], c[k + 1])); k += 2; }
          else if (op === O.curveTo) { if (cur) { cur.pts.push(ap(ctm, c[k + 4], c[k + 5])); cur.curved = true; } k += 6; }
          else if (op === O.curveTo2 || op === O.curveTo3) { if (cur) { cur.pts.push(ap(ctm, c[k + 2], c[k + 3])); cur.curved = true; } k += 4; }
          else if (op === O.closePath) { if (cur) cur.closed = true; }
        }
      } else if (FILL.has(fn) || STROKE.has(fn) || fn === O.endPath) {
        if (path && fn !== O.endPath) {
          for (const sp of path) {
            if (sp.curved || sp.pts.length < 2) continue;
            const xs = sp.pts.map(p => p[0]), ys = sp.pts.map(p => p[1]);
            const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
            const boxy = sp.pts.every(p => (Math.abs(p[0] - x0) < 0.6 || Math.abs(p[0] - x1) < 0.6) && (Math.abs(p[1] - y0) < 0.6 || Math.abs(p[1] - y1) < 0.6));
            if (FILL.has(fn) && boxy && sp.pts.length >= 3) {
              const w = x1 - x0, hh = y1 - y0;
              if (Math.min(w, hh) <= 2.6 && Math.max(w, hh) >= 3 && lum(fill) < 0.93) thin.push(w >= hh ? [[x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]] : [[(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]]);
              else if (w > 2.6 && hh > 2.6) fills.push({ x0, y0, x1, y1, color: fill });
            }
            const sw = x1 - x0, sh = y1 - y0; // small outlined squares are check boxes
            if (STROKE.has(fn) && boxy && sp.pts.length >= 4 && sw >= 5 && sh >= 5 && sw <= 20 && sh <= 20 && Math.abs(sw - sh) <= Math.max(sw, sh) * 0.25) squares.push({ x0, y0, x1, y1 });
            if (STROKE.has(fn) && lum(stroke) < 0.93) {
              const pts = sp.closed ? [...sp.pts, sp.pts[0]] : sp.pts;
              for (let j = 1; j < pts.length; j++) {
                const [p, q] = [pts[j - 1], pts[j]];
                if ((Math.abs(p[0] - q[0]) < 0.8 || Math.abs(p[1] - q[1]) < 0.8) && Math.hypot(p[0] - q[0], p[1] - q[1]) >= 3) strokes.push([p, q]);
              }
            }
          }
        }
        path = null;
      }
    }
    // to display space; split into horizontal / vertical
    const H = [], V = [], toD = p => view.toScreen(p);
    for (const [p, q] of [...thin, ...strokes]) {
      const a = toD(p), b = toD(q);
      if (Math.abs(a[1] - b[1]) <= Math.abs(a[0] - b[0])) H.push({ y: (a[1] + b[1]) / 2, x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]) });
      else V.push({ x: (a[0] + b[0]) / 2, y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) });
    }
    const F = fills.map(f => { const a = toD([f.x0, f.y0]), b = toD([f.x1, f.y1]); return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]), color: f.color }; });
    const SQ = squares.map(q => { const a = toD([q.x0, q.y0]), b = toD([q.x1, q.y1]); return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) }; });
    const pageArea = view.box.w * view.box.h;
    const res = { H, V, fills: F, squares: SQ, imageCover: Math.min(1, imageArea / pageArea) };
    vecCache.set(key, res);
    return res;
  };

  /* ——— 2 · Rulings from pixels (scans, photos) ——— */
  TG.rasterRulings = async (page, region) => {
    const k = 3, c = document.createElement('canvas');
    await L.renderInto(c, page, k, { dpr: 1, annotations: false, readback: true });
    const x0 = Math.max(0, Math.floor(region.x * k)), y0 = Math.max(0, Math.floor(region.y * k));
    const W = Math.min(c.width - x0, Math.ceil(region.w * k)), Hh = Math.min(c.height - y0, Math.ceil(region.h * k));
    if (W < 10 || Hh < 10) return { H: [], V: [], fills: [] };
    // Two ink levels (hysteresis): lines must be found at the strict level; the loose level only extends them where
    // a grey border fades. Scanner streaks never pass the strict level, so they can't sneak in through the loose one.
    const d = c.getContext('2d').getImageData(x0, y0, W, Hh).data, strict = new Uint8Array(W * Hh), loose = new Uint8Array(W * Hh);
    // levels follow the paper: a grey photocopy and a bright laser print get the same treatment
    const hist = new Uint32Array(256); for (let i = 0; i < W * Hh; i += 7) hist[Math.round(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114)]++;
    let acc = 0, total = 0; for (const v of hist) total += v; let paper = 255; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.6) { paper = v; break; } }
    const tS = Math.min(150, paper - 80), tL = Math.min(185, paper - 45); // stricter only on grey paper
    for (let i = 0; i < W * Hh; i++) { const l = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114; strict[i] = l < tS ? 1 : 0; loose[i] = l < tL ? 1 : 0; }
    // Lines in photos are grey, broken and slightly skewed. Each axis is traced on a mask thickened by 1 px across
    // the line, short solid pieces (≥ 80 % ink, gaps ≤ 3 px bridged) are collected, then stitched end-to-end while the
    // line drifts by a pixel or two. Only stitched lines ≥ 18 pt survive — letter stems and text rows never get that far.
    const runs = (len, other, at) => {
      const out = [], minPiece = 5 * k;
      for (let o = 0; o < other; o++) {
        let s = -1, gap = 0, ink = 0;
        for (let i = 0; i <= len; i++) {
          const on = i < len && (at(i, o) || (o > 0 && at(i, o - 1)) || (o < other - 1 && at(i, o + 1)));
          if (on) { if (s < 0) { s = i; ink = 0; } ink++; gap = 0; }
          else if (s >= 0 && ++gap > 3) { const e = i - gap; if (e - s >= minPiece && ink / (e - s) >= 0.8 && thin(at, o, s, e, other)) out.push({ o, s, e }); s = -1; gap = 0; }
        }
      }
      return out;
    };
    // A ruled line has clean paper ~1.7 pt to either side; text rows and scanner streaks don't.
    const thin = (at, o, s, e, other) => {
      const off = 5; let side = 0;
      for (let i = s; i < e; i++) { if (o - off >= 0 && at(i, o - off)) side++; if (o + off < other && at(i, o + off)) side++; }
      return side / (2 * (e - s)) <= 0.25;
    };
    const merge = (segs, len) => {
      segs.sort((a, b) => a.s - b.s || a.o - b.o);
      const lines = [];
      for (const r of segs) {
        // join a piece that continues (or overlaps) a line whose current end sits within 3 px across
        const l = lines.find(l => Math.abs(r.o - l.oEnd) <= 3 && r.s <= l.e + 6 && r.e >= l.s - 6);
        if (l) {
          if (r.e > l.covEnd) { l.cov += r.e - Math.max(r.s, l.covEnd); l.covEnd = r.e; } // union of inked stretches
          if (r.e > l.e) { l.e = r.e; l.oEnd = r.o; } l.s = Math.min(l.s, r.s); l.oMin = Math.min(l.oMin, r.o); l.oMax = Math.max(l.oMax, r.o); l.oSum += r.o * (r.e - r.s); l.wSum += r.e - r.s;
        } else lines.push({ s: r.s, e: r.e, oEnd: r.o, oMin: r.o, oMax: r.o, oSum: r.o * (r.e - r.s), wSum: r.e - r.s, cov: r.e - r.s, covEnd: r.e });
      }
      const minLen = Math.max(18 * k, len * 0.05);
      // a stitched line must be long, and thin relative to its length (thick blobs are text or pictures)
      // …and continuous: ≥ 85 % real ink along its length (scanner streaks are dotted)
      return lines.filter(l => l.e - l.s >= minLen && l.oMax - l.oMin <= Math.max(6 * k, (l.e - l.s) * 0.04) && l.cov / (l.e - l.s) >= 0.85).map(l => ({ ...l, n: 1, oSum: l.oSum / l.wSum }));
    };
    const toH = ls => ls.map(l => ({ y: (y0 + l.oSum) / k, x0: (x0 + l.s) / k, x1: (x0 + l.e) / k })), toV = ls => ls.map(l => ({ x: (x0 + l.oSum) / k, y0: (y0 + l.s) / k, y1: (y0 + l.e) / k }));
    const trace = m => ({ H: toH(merge(runs(W, Hh, (i, o) => m[o * W + i]), W)), V: toV(merge(runs(Hh, W, (i, o) => m[i * W + o]), Hh)) });
    const S = trace(strict), Lo = trace(loose);
    // a loose line that lies on a strict one (within 1.5 pt across, overlapping along) lends it its fuller extent
    const extend = (strong, weak, pos, a, b) => strong.map(s => { const out = { ...s }; for (const w of weak) if (Math.abs(w[pos] - s[pos]) <= 1.5 && w[a] <= s[b] + 2 && w[b] >= s[a] - 2) { out[a] = Math.min(out[a], w[a]); out[b] = Math.max(out[b], w[b]); } return out; });
    // one physical line can be traced twice (both edges of a thick rule): fold parallels within 3 pt into one
    const fold = (ls, pos, a, b) => { const out = []; for (const l of ls.slice().sort((p, q) => p[pos] - q[pos])) { const m = out.find(o => Math.abs(o[pos] - l[pos]) <= 3 && l[a] <= o[b] && l[b] >= o[a]); if (m) { m[pos] = (m[pos] + l[pos]) / 2; m[a] = Math.min(m[a], l[a]); m[b] = Math.max(m[b], l[b]); } else out.push({ ...l }); } return out; };
    let H = fold(extend(S.H, Lo.H, 'y', 'x0', 'x1'), 'y', 'x0', 'x1'), V = fold(extend(S.V, Lo.V, 'x', 'y0', 'y1'), 'x', 'y0', 'y1');
    // In a real table every line meets at least two lines of the other direction. Lone rules, underlines and
    // streak fragments don't — prune them until nothing changes.
    const meets = (h, v) => v.x >= h.x0 - 5 && v.x <= h.x1 + 5 && h.y >= v.y0 - 5 && h.y <= v.y1 + 5;
    const allH = H;
    for (let it = 0; it < 4; it++) {
      const H2 = H.filter(h => V.filter(v => meets(h, v)).length >= 2), V2 = V.filter(v => H.filter(h => meets(h, v)).length >= 2);
      if (H2.length === H.length && V2.length === V.length) break;
      H = H2; V = V2;
    }
    // lines that belong to no grid are kept apart: on a form they are often the blanks to write on
    const lonelyH = allH.filter(l => !H.includes(l));
    return { H, V, fills: [], raster: true, lonelyH };
  };

  /* ——— 3 · Grid with merged cells ——— */
  const cluster = (vals, tol) => {
    const s = vals.slice().sort((a, b) => a - b), out = [];
    for (const v of s) { const c = out[out.length - 1]; if (c && v - c.max <= tol) { c.max = v; c.sum += v; c.n++; } else out.push({ max: v, sum: v, n: 1 }); }
    return out.map(c => c.sum / c.n);
  };
  const mergeSegs = (segs, key, a, b, tol) => {
    const out = [];
    for (const s of segs.slice().sort((p, q) => p[key] - q[key] || p[a] - q[a])) {
      const m = out.find(o => Math.abs(o[key] - s[key]) <= tol && s[a] <= o[b] + 2.5 && s[b] >= o[a] - 2.5);
      if (m) { m[a] = Math.min(m[a], s[a]); m[b] = Math.max(m[b], s[b]); } else out.push({ ...s });
    }
    return out;
  };
  // Segments inside the region, clipped to it.
  TG.clip = (r, region, pad = 3) => ({
    H: r.H.filter(s => s.y >= region.y - pad && s.y <= region.y + region.h + pad && s.x1 > region.x && s.x0 < region.x + region.w).map(s => ({ ...s, x0: Math.max(s.x0, region.x - pad), x1: Math.min(s.x1, region.x + region.w + pad) })),
    V: r.V.filter(s => s.x >= region.x - pad && s.x <= region.x + region.w + pad && s.y1 > region.y && s.y0 < region.y + region.h).map(s => ({ ...s, y0: Math.max(s.y0, region.y - pad), y1: Math.min(s.y1, region.y + region.h + pad) })),
    fills: r.fills || [], raster: !!r.raster,
  });
  TG.hasGrid = r => r.H.length >= 2 && r.V.length >= 2;
  TG.buildGrid = (rul, words) => {
    const tol = 2.2;
    const H = mergeSegs(rul.H, 'y', 'x0', 'x1', tol), V = mergeSegs(rul.V, 'x', 'y0', 'y1', tol);
    let xs = cluster(V.map(s => s.x), tol), ys = cluster(H.map(s => s.y), tol);
    // open tables: rows ruled but no outer verticals (or vice versa) — close them at the line ends
    const hx0 = Math.min(...H.map(s => s.x0)), hx1 = Math.max(...H.map(s => s.x1)), vy0 = Math.min(...V.map(s => s.y0)), vy1 = Math.max(...V.map(s => s.y1));
    if (xs.length && hx0 < xs[0] - 6) xs.unshift(hx0); if (xs.length && hx1 > xs[xs.length - 1] + 6) xs.push(hx1);
    if (ys.length && vy0 < ys[0] - 6) ys.unshift(vy0); if (ys.length && vy1 > ys[ys.length - 1] + 6) ys.push(vy1);
    xs = xs.filter((x, i) => i === 0 || x - xs[i - 1] > 3); ys = ys.filter((y, i) => i === 0 || y - ys[i - 1] > 3);
    if (xs.length < 2 || ys.length < 2) return null;
    const nR = ys.length - 1, nC = xs.length - 1;
    const covered = (segs, key, a, b, pos, lo, hi) => {
      let cov = 0; for (const s of segs) if (Math.abs(s[key] - pos) <= tol + 0.8) cov += Math.max(0, Math.min(hi, s[b]) - Math.max(lo, s[a]));
      return cov >= (hi - lo) * (rul.raster ? 0.35 : 0.5); // scanned borders fade; a truly merged cell has ~0 % border
    };
    const parent = Array.from({ length: nR * nC }, (_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
    for (let r = 0; r < nR; r++) for (let c = 0; c < nC; c++) {
      if (c < nC - 1 && !covered(V, 'x', 'y0', 'y1', xs[c + 1], ys[r], ys[r + 1])) unite(r * nC + c, r * nC + c + 1);
      if (r < nR - 1 && !covered(H, 'y', 'x0', 'x1', ys[r + 1], xs[c], xs[c + 1])) unite(r * nC + c, (r + 1) * nC + c);
    }
    const groups = new Map();
    for (let r = 0; r < nR; r++) for (let c = 0; c < nC; c++) {
      const g = find(r * nC + c); const e = groups.get(g);
      if (!e) groups.set(g, { r0: r, r1: r, c0: c, c1: c }); else { e.r0 = Math.min(e.r0, r); e.r1 = Math.max(e.r1, r); e.c0 = Math.min(e.c0, c); e.c1 = Math.max(e.c1, c); }
    }
    const cells = [...groups.values()].map(g => ({ r: g.r0, c: g.c0, rs: g.r1 - g.r0 + 1, cs: g.c1 - g.c0 + 1, x: xs[g.c0], y: ys[g.r0], w: xs[g.c1 + 1] - xs[g.c0], h: ys[g.r1 + 1] - ys[g.r0], words: [] }));
    const at = new Map(); cells.forEach(cl => { for (let r = cl.r; r < cl.r + cl.rs; r++) for (let c = cl.c; c < cl.c + cl.cs; c++) at.set(r * nC + c, cl); });
    for (const w of words) {
      const cx = w.b.x + w.b.w / 2, cy = w.b.y + w.b.h / 2;
      const c = xs.findIndex((x, i) => i < nC && cx >= x && cx < xs[i + 1]), r = ys.findIndex((y, i) => i < nR && cy >= y && cy < ys[i + 1]);
      if (r >= 0 && c >= 0) at.get(r * nC + c).words.push(w);
    }
    for (const cl of cells) {
      cl.text = TG.joinWords(cl.words); cl.bold = cl.words.length > 0 && cl.words.filter(w => w.bold).length > cl.words.length / 2;
      const f = [...rul.fills].reverse().find(f => cl.x + cl.w / 2 > f.x && cl.x + cl.w / 2 < f.x + f.w && cl.y + cl.h / 2 > f.y && cl.y + cl.h / 2 < f.y + f.h);
      cl.fill = f && lum(f.color) < 0.97 ? hex(f.color) : null;
      delete cl.words;
    }
    cells.sort((a, b) => a.r - b.r || a.c - b.c);
    return { mode: 'grid', nR, nC, xs, ys, cells, colW: xs.slice(1).map((x, i) => x - xs[i]), rowH: ys.slice(1).map((y, i) => y - ys[i]) };
  };
  // Words → lines (top to bottom) → text with line breaks.
  TG.joinWords = ws => {
    if (!ws.length) return '';
    const mh = ws.map(w => w.b.h).sort((a, b) => a - b)[Math.floor(ws.length / 2)] || 8;
    const sorted = ws.slice().sort((a, b) => (a.b.y + a.b.h / 2) - (b.b.y + b.b.h / 2)), lines = [];
    for (const w of sorted) { const cy = w.b.y + w.b.h / 2, l = lines[lines.length - 1]; if (l && Math.abs(cy - l.cy) < mh * 0.55) { l.ws.push(w); l.cy = (l.cy * (l.ws.length - 1) + cy) / l.ws.length; } else lines.push({ cy, ws: [w] }); }
    return lines.map(l => l.ws.sort((a, b) => a.b.x - b.b.x).map(w => w.t).join(' ')).join('\n').replace(/-\n(?=[a-z])/g, '-');
  };
  // Plain rows (text-gap tables) as a grid without spans.
  TG.fromRows = (rows, cols, region) => {
    const nC = Math.max(1, ...rows.map(r => r.length)), xs = [region.x, ...cols.slice().sort((a, b) => a - b), region.x + region.w];
    return { mode: 'text', nR: rows.length, nC, cells: rows.flatMap((r, ri) => Array.from({ length: nC }, (_, ci) => ({ r: ri, c: ci, rs: 1, cs: 1, text: r[ci] || '' }))), colW: xs.slice(1).map((x, i) => x - xs[i]), rowH: rows.map(() => 14) };
  };
  // Find whole tables on a page: connected clusters of rulings.
  TG.findTables = r => {
    const tol = r.raster ? 10 : 3; // scanned borders often fade out near corners
    const segs = [...r.H.map(s => ({ h: 1, ...s, bx0: s.x0, bx1: s.x1, by0: s.y, by1: s.y })), ...r.V.map(s => ({ h: 0, ...s, bx0: s.x, bx1: s.x, by0: s.y0, by1: s.y1 }))];
    const parent = segs.map((_, i) => i), find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i], b = segs[j];
      if (a.bx0 - tol <= b.bx1 && b.bx0 - tol <= a.bx1 && a.by0 - tol <= b.by1 && b.by0 - tol <= a.by1) parent[find(i)] = find(j);
    }
    const comps = new Map();
    segs.forEach((s, i) => { const k = find(i); const c = comps.get(k) || { h: 0, v: 0, x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; c[s.h ? 'h' : 'v']++; c.x0 = Math.min(c.x0, s.bx0); c.x1 = Math.max(c.x1, s.bx1); c.y0 = Math.min(c.y0, s.by0); c.y1 = Math.max(c.y1, s.by1); comps.set(k, c); });
    return [...comps.values()].filter(c => c.h >= 2 && c.v >= 2 && c.x1 - c.x0 > 30 && c.y1 - c.y0 > 15).map(c => ({ x: c.x0 - 2, y: c.y0 - 2, w: c.x1 - c.x0 + 4, h: c.y1 - c.y0 + 4 })).sort((a, b) => a.y - b.y);
  };

  /* ——— 4 · Shapes of the result ——— */
  TG.matrix = (g, repeat = false) => {
    const m = Array.from({ length: g.nR }, () => Array(g.nC).fill(''));
    for (const c of g.cells) for (let r = c.r; r < c.r + c.rs; r++) for (let k = c.c; k < c.c + c.cs; k++) m[r][k] = (r === c.r && k === c.c) || repeat ? c.text : '';
    return m;
  };
  TG.append = (a, b, dropHeader) => { // stack two grids (multi-page tables)
    if (!a) return b; if (!b) return a;
    const nC = Math.max(a.nC, b.nC);
    let cells = b.cells, shift = a.nR;
    if (dropHeader) { const ha = TG.matrix(a)[0].join('|'), hb = TG.matrix(b)[0].join('|'); if (ha === hb) { cells = b.cells.filter(c => c.r > 0).map(c => ({ ...c, r: c.r - 1 })); shift = a.nR; } }
    const nRb = dropHeader && cells !== b.cells ? b.nR - 1 : b.nR;
    return { ...a, nC, nR: a.nR + nRb, cells: [...a.cells, ...cells.map(c => ({ ...c, r: c.r + shift }))], rowH: [...a.rowH, ...b.rowH.slice(b.nR - nRb)], colW: a.colW.length >= b.colW.length ? a.colW : b.colW };
  };
  const escH = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  TG.html = (g, { header = true, editable = false } = {}) => {
    const covered = new Set(); g.cells.forEach(c => { for (let r = c.r; r < c.r + c.rs; r++) for (let k = c.c; k < c.c + c.cs; k++) if (r !== c.r || k !== c.c) covered.add(r * g.nC + k); });
    const at = new Map(g.cells.map(c => [c.r * g.nC + c.c, c]));
    let s = '<table class="data" style="border-collapse:collapse">';
    for (let r = 0; r < g.nR; r++) {
      s += '<tr>';
      for (let k = 0; k < g.nC; k++) {
        if (covered.has(r * g.nC + k)) continue;
        const c = at.get(r * g.nC + k) || { text: '', rs: 1, cs: 1 }, tag = header && r === 0 ? 'th' : 'td';
        const st = [`border:1px solid #9a9a9a`, `padding:3px 6px`, `vertical-align:middle`, c.fill ? `background:#${c.fill}` : '', c.bold ? 'font-weight:bold' : ''].filter(Boolean).join(';');
        s += `<${tag}${c.rs > 1 ? ` rowspan="${c.rs}"` : ''}${c.cs > 1 ? ` colspan="${c.cs}"` : ''} style="${st}"${editable ? ` contenteditable="true" data-r="${c.r}" data-c="${c.c}"` : ''}>${escH(c.text).replace(/\n/g, '<br>')}</${tag}>`;
      }
      s += '</tr>';
    }
    return s + '</table>';
  };
  TG.tsv = (g, repeat) => TG.matrix(g, repeat).map(r => r.map(c => c.replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t')).join('\n');
  TG.csv = (g, repeat) => '﻿' + TG.matrix(g, repeat).map(r => r.map(c => /[",\n;]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\r\n') + '\r\n';
  TG.markdown = g => { const m = TG.matrix(g, true); if (!m.length) return ''; const f = r => '| ' + r.map(c => c.replace(/\|/g, '\\|').replace(/\n/g, '<br>')).join(' | ') + ' |'; return [f(m[0]), '| ' + m[0].map(() => '---').join(' | ') + ' |', ...m.slice(1).map(f)].join('\n'); };
  TG.copyRich = async (g, header, repeat) => {
    const html = `<html><body>${TG.html(g, { header })}</body></html>`, text = TG.tsv(g, repeat);
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      L.toast('Copied — paste into Excel or Word keeps merged cells', { kind: 'ok', ms: 3600 });
    } catch { L.copyText(text); }
  };
  const numify = v => { const t = String(v || '').trim(); if (/^-?[\d,]*\.?\d+%?$/.test(t) && !/^0\d/.test(t) && !/,\d{1,2}$/.test(t)) { const n = parseFloat(t.replace(/,/g, '')); return isFinite(n) ? (t.endsWith('%') ? n / 100 : n) : null; } return null; };
  // Styled workbook: merges, fills, bold, borders, wrapping, column widths and row heights from the PDF.
  TG.xlsx = async (g, { header = true, sheet = 'Table' } = {}) => {
    let styled = true;
    try { await L.loadScript(L.LIBS.xlsxStyle); } catch { styled = false; await L.loadScript(L.LIBS.xlsx); }
    const X = window.XLSX, ws = {}, border = { style: 'thin', color: { rgb: '9A9A9A' } };
    for (const c of g.cells) {
      for (let r = c.r; r < c.r + c.rs; r++) for (let k = c.c; k < c.c + c.cs; k++) {
        const ref = X.utils.encode_cell({ r, c: k }), main = r === c.r && k === c.c, n = main ? numify(c.text) : null;
        const cell = main ? (n != null ? { t: 'n', v: n } : { t: 's', v: c.text }) : { t: 's', v: '' };
        if (styled) cell.s = {
          alignment: { wrapText: true, vertical: 'center', horizontal: c.cs > 1 || c.rs > 1 || (header && c.r === 0) ? 'center' : 'left' },
          border: { top: border, bottom: border, left: border, right: border },
          font: { name: 'Calibri', sz: 10, bold: !!(c.bold || (header && c.r === 0)) },
          ...(c.fill ? { fill: { patternType: 'solid', fgColor: { rgb: c.fill } } } : header && c.r === 0 ? { fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F5' } } } : {}),
        };
        ws[ref] = cell;
      }
    }
    ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, g.nR - 1), c: Math.max(0, g.nC - 1) } });
    ws['!merges'] = g.cells.filter(c => c.rs > 1 || c.cs > 1).map(c => ({ s: { r: c.r, c: c.c }, e: { r: c.r + c.rs - 1, c: c.c + c.cs - 1 } }));
    ws['!cols'] = g.colW.map(w => ({ wpx: Math.round(L.clamp(w * 1.45, 30, 420)) }));
    ws['!rows'] = g.rowH.map(hh => ({ hpx: Math.round(L.clamp(hh * 1.33, 15, 400)) }));
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
    return { data: X.write(wb, { bookType: 'xlsx', type: 'array' }), styled };
  };
})();
