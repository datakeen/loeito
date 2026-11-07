/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Digitize blade: recover numbers from charts (calibrate axes, click or color-trace) and coordinates from maps (control points, measure). */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;
  const SERIES_COLORS = ['#e5484d', '#0090ff', '#30a46c', '#f76b15', '#8e4ec6', '#d6409f'];
  const D = { placing: null, mode: 'add', feat: 'line', drawing: null, color: null, tol: 70, step: 3, traceMode: 'line', drag: null, boxDraft: null };

  const dig = (p = L.page()) => (p.dig ||= {
    mode: 'chart',
    cal: { X1: { p: null, v: 0 }, X2: { p: null, v: 10 }, Y1: { p: null, v: 0 }, Y2: { p: null, v: 10 }, logX: false, logY: false },
    series: [{ id: L.uid('d'), name: 'Series 1', color: SERIES_COLORS[0], pts: [] }], active: 0,
    map: { cps: [{ p: null, X: '', Y: '' }, { p: null, X: '', Y: '' }, { p: null, X: '', Y: '' }], crs: { type: 'local', zone: 43, south: false }, units: 'm', feats: [] },
  });
  // older documents stored a simple "geo" flag
  const crsOf = m => (m.crs ||= { type: m.geo ? 'wgs84' : 'local', zone: 43, south: false });
  const isGeo = m => crsOf(m).type === 'wgs84';
  const refreshInspector = L.debounce(() => { if (L.state.blade === 'digitize') L.renderInspector(); }, 60);
  const dmut = (label, fn) => { L.checkpoint(label); fn(); L.state.dirty = true; L.drawOverlay(); refreshInspector(); };

  /* ——— Calibration maths (affine-invariant, so it works directly in PDF space) ——— */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  function chartMap(cal) {
    const { X1, X2, Y1, Y2 } = cal;
    if (![X1, X2, Y1, Y2].every(c => c.p && isFinite(c.v))) return null;
    if (cal.logX && (X1.v <= 0 || X2.v <= 0)) return null; if (cal.logY && (Y1.v <= 0 || Y2.v <= 0)) return null;
    const tx = v => (cal.logX ? Math.log10(v) : v), ty = v => (cal.logY ? Math.log10(v) : v);
    const ex = sub(X2.p, X1.p), ey = sub(Y2.p, Y1.p), dxy = cross(ex, ey);
    if (Math.abs(dxy) < 1e-9 || tx(X1.v) === tx(X2.v) || ty(Y1.v) === ty(Y2.v)) return null;
    return P => {
      let x = tx(X1.v) + (tx(X2.v) - tx(X1.v)) * cross(sub(P, X1.p), ey) / dxy;
      let y = ty(Y1.v) + (ty(Y2.v) - ty(Y1.v)) * cross(sub(P, Y1.p), ex) / -dxy;
      return [cal.logX ? 10 ** x : x, cal.logY ? 10 ** y : y];
    };
  }
  function solve3(A, b) { // Gaussian elimination
    const M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < 3; c++) {
      let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]]; if (Math.abs(M[c][c]) < 1e-12) return null;
      for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[3] / r[i]);
  }
  function mapTransform(m) {
    const cps = m.cps.filter(c => c.p && c.X !== '' && c.Y !== '' && isFinite(+c.X) && isFinite(+c.Y));
    if (cps.length === 2) { // two known points: scale + rotation + shift (no shear) — e.g. both ends of a scale bar
      const [c1, c2] = cps, dz = [c2.p[0] - c1.p[0], c2.p[1] - c1.p[1]], dw = [c2.X - c1.X, c2.Y - c1.Y], n2 = dz[0] ** 2 + dz[1] ** 2;
      if (n2 < 1e-9) return null;
      const ar = (dw[0] * dz[0] + dw[1] * dz[1]) / n2, ai = (dw[1] * dz[0] - dw[0] * dz[1]) / n2;
      return { f: P => { const u = P[0] - c1.p[0], v = P[1] - c1.p[1]; return [+c1.X + ar * u - ai * v, +c1.Y + ai * u + ar * v]; }, rms: 0, n: 2, similarity: true };
    }
    if (cps.length < 3) return null;
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bx = [0, 0, 0], by = [0, 0, 0];
    for (const c of cps) { const r = [c.p[0], c.p[1], 1]; for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; bx[i] += r[i] * +c.X; by[i] += r[i] * +c.Y; } }
    const a = solve3(A, bx), b = solve3(A, by); if (!a || !b) return null;
    const f = P => [a[0] * P[0] + a[1] * P[1] + a[2], b[0] * P[0] + b[1] * P[1] + b[2]];
    const rms = Math.sqrt(cps.reduce((s, c) => { const q = f(c.p); return s + (q[0] - c.X) ** 2 + (q[1] - c.Y) ** 2; }, 0) / cps.length);
    return { f, rms, n: cps.length };
  }
  const R_EARTH = 6371008.8, rad = d => d * Math.PI / 180;
  function measure(feat, f, geo) {
    const pts = feat.pts.map(f);
    let len = 0;
    const seg = (a, b) => geo ? 2 * R_EARTH * Math.asin(Math.sqrt(Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2)) : Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let i = 1; i < pts.length; i++) len += seg(pts[i - 1], pts[i]);
    let area = null;
    if (feat.type === 'polygon' && pts.length > 2) {
      len += seg(pts[pts.length - 1], pts[0]);
      let s = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        s += geo ? rad(b[0] - a[0]) * (2 + Math.sin(rad(a[1])) + Math.sin(rad(b[1]))) : a[0] * b[1] - b[0] * a[1];
      }
      area = Math.abs(geo ? s * R_EARTH * R_EARTH / 2 : s / 2);
    }
    return { pts, len, area };
  }
  const fmt = v => { if (!isFinite(v)) return '—'; const a = Math.abs(v); return a !== 0 && (a < 1e-3 || a >= 1e7) ? v.toExponential(4) : (+v.toPrecision(6)).toString(); };
  const fmtLen = (v, geo, units) => geo ? (v >= 1000 ? (v / 1000).toFixed(3) + ' km' : v.toFixed(1) + ' m') : fmt(v) + (units ? ' ' + units : '');
  const fmtArea = (v, geo, units) => geo ? (v >= 1e6 ? (v / 1e6).toFixed(4) + ' km²' : v >= 1e4 ? (v / 1e4).toFixed(3) + ' ha' : v.toFixed(1) + ' m²') : fmt(v) + (units ? ` ${units}²` : '');

  /* ——— Auto-trace ——— */
  function trace(box) {
    const g = dig(), view = L.viewer.view, c = L.$('#page-canvas'), dpr = c.width / view.width;
    if (!D.color) { L.toast('Pick the curve’s color first.', { icon: 'dropper' }); return; }
    const x0 = Math.max(0, Math.round(box.x * dpr)), y0 = Math.max(0, Math.round(box.y * dpr));
    const W = Math.min(c.width - x0, Math.round(box.w * dpr)), H = Math.min(c.height - y0, Math.round(box.h * dpr));
    if (W < 2 || H < 2) return;
    const d = c.getContext('2d').getImageData(x0, y0, W, H).data, [cr, cg, cb] = D.color, tol2 = D.tol * D.tol;
    const match = (x, y) => { const k = (y * W + x) * 4, dr = d[k] - cr, dg = d[k + 1] - cg, db = d[k + 2] - cb; return dr * dr + dg * dg + db * db <= tol2; };
    const out = []; let prevY = null;
    const step = Math.max(1, Math.round(D.step * dpr));
    for (let x = 0; x < W; x += step) {
      const runs = []; let s = -1;
      for (let y = 0; y <= H; y++) { const m = y < H && match(x, y); if (m && s < 0) s = y; if (!m && s >= 0) { runs.push((s + y - 1) / 2); s = -1; } }
      if (!runs.length) continue;
      const pick = D.traceMode === 'line' ? [prevY == null ? runs[0] : runs.reduce((a, b) => Math.abs(b - prevY) < Math.abs(a - prevY) ? b : a)] : runs;
      if (D.traceMode === 'line') prevY = pick[0];
      for (const y of pick) out.push(view.toPdf([(x0 + x) / dpr, (y0 + y) / dpr]));
    }
    if (!out.length) { L.toast('No matching color found in that area. Try a higher tolerance.', { kind: 'err' }); return; }
    dmut('auto-trace', () => { g.series[g.active].pts.push(...out.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)])); });
    L.toast(`Captured ${out.length} points`, { kind: 'ok', icon: 'trace' });
  }

  /* ——— Pointer ——— */
  const CAL_ORDER = ['X1', 'X2', 'Y1', 'Y2'];
  const near = (view, list, sx, sy, r = 7) => list.findIndex(p => { const q = view.toScreen(p); return Math.hypot(q[0] - sx, q[1] - sy) < r; });
  function pointer(type, ev) {
    const view = L.viewer.view, g = dig();
    const precise = D.placing || (g.mode === 'chart' && D.mode === 'add') || (g.mode === 'map') || D.mode === 'pick';
    if (type === 'hover' || type === 'move') { if (precise && !D.boxDraft) L.loupe(true, ev.e, ev.sx, ev.sy); }
    if (type === 'leave') { L.loupe(false); return; }
    if (type === 'context' && g.mode === 'chart') {
      const s = g.series[g.active], i = near(view, s.pts, ev.sx, ev.sy);
      if (i >= 0) { dmut('delete point', () => s.pts.splice(i, 1)); return true; }
      return false;
    }
    if (D.placing && type === 'down') {
      const key = D.placing;
      dmut('calibrate', () => { if (g.mode === 'chart') g.cal[key].p = ev.pt; else g.map.cps[key].p = ev.pt; });
      if (g.mode === 'chart') { const nx = CAL_ORDER[CAL_ORDER.indexOf(key) + 1]; D.placing = nx && !g.cal[nx].p ? nx : null; }
      else { const nx = g.map.cps.findIndex(c => !c.p); D.placing = nx >= 0 ? nx : null; }
      refreshInspector(); return;
    }
    if (D.mode === 'pick' && type === 'down') { D.color = L.pixelAt(ev.sx, ev.sy); D.mode = 'trace'; L.setCursor('crosshair'); refreshInspector(); L.loupe(false); return; }
    if (g.mode === 'chart') {
      const s = g.series[g.active];
      if (D.mode === 'trace') {
        if (type === 'down') D.boxDraft = { s: [ev.sx, ev.sy], c: [ev.sx, ev.sy] };
        else if (type === 'move' && D.boxDraft) { D.boxDraft.c = [ev.sx, ev.sy]; L.drawOverlay(); }
        else if (type === 'up' && D.boxDraft) { const b = D.boxDraft; D.boxDraft = null; const box = { x: Math.min(b.s[0], b.c[0]), y: Math.min(b.s[1], b.c[1]), w: Math.abs(b.c[0] - b.s[0]), h: Math.abs(b.c[1] - b.s[1]) }; L.drawOverlay(); if (box.w > 4 && box.h > 4) trace(box); }
        return;
      }
      if (type === 'down') {
        if (ev.e.altKey) { const i = near(view, s.pts, ev.sx, ev.sy); if (i >= 0) dmut('delete point', () => s.pts.splice(i, 1)); return; }
        const i = near(view, s.pts, ev.sx, ev.sy);
        if (i >= 0) { L.checkpoint('move point'); D.drag = { i }; return; }
        dmut('add point', () => s.pts.push([+ev.pt[0].toFixed(3), +ev.pt[1].toFixed(3)]));
        return;
      }
      if (type === 'move' && D.drag) { s.pts[D.drag.i] = ev.pt; L.drawOverlay(); return; }
      if (type === 'up' && D.drag) { D.drag = null; refreshInspector(); }
      return;
    }
    // map: digitize, edit vertices (drag), Alt-click deletes a vertex, press-and-drag traces freehand
    const m = g.map;
    if (type === 'down') {
      const hitV = !D.drawing && vertexAt(view, m, ev.sx, ev.sy);
      if (hitV && ev.e.altKey) {
        const f = m.feats[hitV.fi], min = f.type === 'polygon' ? 3 : f.type === 'line' ? 2 : 1;
        dmut('delete vertex', () => { if (f.pts.length > min) f.pts.splice(hitV.vi, 1); else m.feats.splice(hitV.fi, 1); });
        return;
      }
      if (hitV) { L.checkpoint('move vertex'); D.drag = { ...hitV, moved: false }; return; }
      if (D.feat === 'point') { dmut('add point', () => m.feats.push({ id: L.uid('f'), type: 'point', name: `Point ${m.feats.filter(f => f.type === 'point').length + 1}`, pts: [ev.pt], value: '' })); return; }
      if (!D.drawing) D.drawing = { id: L.uid('f'), type: D.feat, name: '', pts: [], value: '' };
      const d = D.drawing;
      if (d.type === 'polygon' && d.pts.length >= 3) { const q = view.toScreen(d.pts[0]); if (Math.hypot(q[0] - ev.sx, q[1] - ev.sy) < 9) { finishFeature(); return; } } // click the first point to close
      d.pts.push(ev.pt); d.hover = null; D.pressing = [ev.sx, ev.sy]; L.drawOverlay(); refreshInspector();
      return;
    }
    if (type === 'move') {
      if (D.drag) { const f = m.feats[D.drag.fi]; f.pts[D.drag.vi] = ev.pt; D.drag.moved = true; L.drawOverlay(); return; }
      if (D.drawing && D.pressing && Math.hypot(ev.sx - D.pressing[0], ev.sy - D.pressing[1]) > 7) { D.drawing.pts.push(ev.pt); D.pressing = [ev.sx, ev.sy]; L.drawOverlay(); }
      return;
    }
    if (type === 'up') { D.pressing = null; if (D.drag) { D.drag = null; L.state.dirty = true; refreshInspector(); } return; }
    if (type === 'hover') {
      if (D.drawing) { D.drawing.hover = ev.pt; L.drawOverlay(); }
      else L.setCursor(vertexAt(view, m, ev.sx, ev.sy) ? 'move' : 'crosshair');
    }
    if (type === 'dbl' && D.drawing) finishFeature();
  }
  function vertexAt(view, m, sx, sy) {
    for (let fi = m.feats.length - 1; fi >= 0; fi--) {
      const vi = near(view, m.feats[fi].pts, sx, sy, 7); if (vi >= 0) return { fi, vi };
    }
    return null;
  }
  function finishFeature() {
    const d = D.drawing; D.drawing = null; if (!d) return;
    // dblclick adds a duplicate final vertex; drop it
    if (d.pts.length > 1) { const a = d.pts[d.pts.length - 1], b = d.pts[d.pts.length - 2]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1) d.pts.pop(); }
    if (d.pts.length < (d.type === 'polygon' ? 3 : 2)) { L.drawOverlay(); refreshInspector(); return; }
    const g = dig(); d.name = `${d.type === 'polygon' ? 'Area' : 'Line'} ${g.map.feats.filter(f => f.type === d.type).length + 1}`;
    delete d.hover; D.pressing = null;
    dmut('add ' + d.type, () => g.map.feats.push(d));
  }

  /* ——— Overlay ——— */
  function draw({ svg, view, page }) {
    if (!page.dig && !D.placing) return;
    const g = dig(page), s = L.s, G = s('g', { 'pointer-events': 'none' });
    const mark = (p, label, color = '#0a84ff') => {
      const q = view.toScreen(p);
      G.append(s('circle', { cx: q[0], cy: q[1], r: 7, fill: 'none', stroke: color, 'stroke-width': 1.5 }));
      G.append(s('path', { d: `M${q[0] - 11} ${q[1]}h7m8 0h7M${q[0]} ${q[1] - 11}v7m0 8v7`, stroke: color, 'stroke-width': 1.5 }));
      G.append(s('rect', { x: q[0] + 9, y: q[1] - 25, width: label.length * 7 + 10, height: 18, rx: 9, fill: color }));
      G.append(s('text', { x: q[0] + 14, y: q[1] - 12, fill: '#fff', 'font-size': 11, 'font-weight': 600 }, label));
    };
    if (g.mode === 'chart') {
      const c = g.cal;
      if (c.X1.p && c.X2.p) { const a = view.toScreen(c.X1.p), b = view.toScreen(c.X2.p); G.append(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#0a84ff', 'stroke-width': 1, 'stroke-dasharray': '4 4' })); }
      if (c.Y1.p && c.Y2.p) { const a = view.toScreen(c.Y1.p), b = view.toScreen(c.Y2.p); G.append(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#30a46c', 'stroke-width': 1, 'stroke-dasharray': '4 4' })); }
      for (const k of CAL_ORDER) if (c[k].p) mark(c[k].p, `${k[0]}${k[1] === '1' ? '₁' : '₂'} = ${c[k].v}`, k[0] === 'X' ? '#0a84ff' : '#30a46c');
      g.series.forEach((se, si) => {
        const pts = se.pts.map(view.toScreen);
        if (pts.length > 1 && D.traceMode === 'line') { const sorted = pts.slice().sort((a, b) => a[0] - b[0]); G.append(s('path', { d: 'M' + sorted.map(p => p.join(' ')).join('L'), fill: 'none', stroke: se.color, 'stroke-width': 1, opacity: 0.5 })); }
        pts.forEach(q => G.append(s('circle', { cx: q[0], cy: q[1], r: si === g.active ? 3.6 : 2.8, fill: se.color, stroke: '#fff', 'stroke-width': 1.2 })));
      });
    } else {
      const m = g.map, tf = mapTransform(m);
      m.cps.forEach((c, i) => { if (c.p) mark(c.p, `${i + 1}`, '#8e4ec6'); });
      const drawFeat = (f, live) => {
        const pts = f.pts.map(view.toScreen); if (live && f.hover) pts.push(view.toScreen(f.hover));
        const col = f.type === 'polygon' ? '#0090ff' : f.type === 'line' ? '#e5484d' : '#f76b15';
        if (f.type === 'point') { const q = pts[0]; G.append(s('circle', { cx: q[0], cy: q[1], r: 5, fill: col, stroke: '#fff', 'stroke-width': 1.5 })); }
        else {
          const d = 'M' + pts.map(p => p.join(' ')).join('L') + (f.type === 'polygon' && !live ? 'Z' : '');
          G.append(s('path', { d, fill: f.type === 'polygon' ? 'rgba(0,144,255,.16)' : 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-dasharray': live ? '5 4' : '' }));
          pts.forEach(q => G.append(s('circle', { cx: q[0], cy: q[1], r: 3, fill: '#fff', stroke: col, 'stroke-width': 1.5 })));
        }
        if (!live && tf && f.type !== 'point') {
          const r = measure(f, tf.f, isGeo(m)), q = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
          const u = crsOf(m).type === 'utm' ? 'm' : m.units, label = f.type === 'polygon' ? fmtArea(r.area, isGeo(m), u) : fmtLen(r.len, isGeo(m), u);
          G.append(s('rect', { x: q[0] - label.length * 3.4 - 6, y: q[1] - 10, width: label.length * 6.8 + 12, height: 20, rx: 10, fill: 'rgba(0,0,0,.7)' }));
          G.append(s('text', { x: q[0], y: q[1] + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11, 'font-weight': 600 }, label));
        }
      };
      m.feats.forEach(f => drawFeat(f, false));
      if (D.drawing) drawFeat(D.drawing, true);
    }
    if (D.boxDraft) { const b = D.boxDraft; G.append(s('rect', { x: Math.min(b.s[0], b.c[0]), y: Math.min(b.s[1], b.c[1]), width: Math.abs(b.c[0] - b.s[0]), height: Math.abs(b.c[1] - b.s[1]), fill: 'rgba(10,132,255,.08)', stroke: '#0a84ff', 'stroke-dasharray': '4 3' })); }
    svg.append(G);
  }

  /* ——— Data & export ——— */
  function chartRows(g) {
    const f = chartMap(g.cal); if (!f) return null;
    return g.series.map(se => ({ se, pts: se.pts.map(f).sort((a, b) => a[0] - b[0]) }));
  }
  function miniPlot(data) {
    const all = data.flatMap(d => d.pts); if (!all.length) return null;
    const W = 276, H = 150, pad = 26, g = dig();
    const tx = v => (g.cal.logX ? Math.log10(v) : v), ty = v => (g.cal.logY ? Math.log10(v) : v);
    const xs = all.map(p => tx(p[0])), ys = all.map(p => ty(p[1]));
    let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    if (x0 === x1) { x0 -= 1; x1 += 1; } if (y0 === y1) { y0 -= 1; y1 += 1; }
    const X = v => pad + (tx(v) - x0) / (x1 - x0) * (W - pad - 8), Y = v => H - 18 - (ty(v) - y0) / (y1 - y0) * (H - 28);
    const svg = L.s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mini-plot' });
    svg.append(L.s('path', { d: `M${pad} 8V${H - 18}H${W - 8}`, stroke: 'currentColor', 'stroke-opacity': .3, fill: 'none' }));
    const lab = (x, y, t, a) => svg.append(L.s('text', { x, y, 'font-size': 9, fill: 'currentColor', 'fill-opacity': .55, 'text-anchor': a }, t));
    lab(pad, H - 5, fmt(g.cal.logX ? 10 ** x0 : x0), 'start'); lab(W - 8, H - 5, fmt(g.cal.logX ? 10 ** x1 : x1), 'end');
    lab(pad - 3, H - 18, fmt(g.cal.logY ? 10 ** y0 : y0), 'end'); lab(pad - 3, 14, fmt(g.cal.logY ? 10 ** y1 : y1), 'end');
    for (const d of data) {
      if (d.pts.length > 1) svg.append(L.s('path', { d: 'M' + d.pts.map(p => `${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('L'), fill: 'none', stroke: d.se.color, 'stroke-width': 1.5 }));
      d.pts.forEach(p => svg.append(L.s('circle', { cx: X(p[0]), cy: Y(p[1]), r: 2, fill: d.se.color })));
    }
    return svg;
  }
  const baseName = () => `${L.safeName(L.state.name)} — p${L.state.cur + 1}`;
  function exportChart(kind) {
    const data = chartRows(dig()); if (!data) return;
    const rows = [['series', 'x', 'y'], ...data.flatMap(d => d.pts.map(p => [d.se.name, p[0], p[1]]))];
    const text = rows.map(r => r.join(kind === 'copy' ? '\t' : ',')).join(kind === 'copy' ? '\n' : '\r\n');
    if (kind === 'copy') return L.copyText(text);
    L.saveFile(new Blob([text], { type: 'text/csv' }), baseName() + ' — digitized.csv', 'text/csv', 'csv');
  }
  /* ——— Map exports ——— */
  // map coordinates rounded to what the source can honestly support: 1 mm projected, ~1 mm in degrees
  const mapFeatures = (m, tf) => { const d = isGeo(m) ? 9 : 3; return m.feats.map((f, i) => ({ name: f.name, type: f.type, coords: f.pts.map(p => tf.f(p).map(v => +v.toFixed(d))), value: f.value ?? '', _i: i })); };
  const measureProps = (m, tf) => f => {
    const src = m.feats[f._i]; if (!src || f.type === 'point') return {};
    const r = measure(src, tf.f, isGeo(m)), geo = isGeo(m), units = crsOf(m).type === 'utm' ? 'm' : m.units;
    return { lengthRaw: +r.len.toFixed(4), areaRaw: r.area != null ? +r.area.toFixed(4) : '', length: fmtLen(r.len, geo, units), area: r.area != null ? fmtArea(r.area, geo, units) : '' };
  };
  const MAP_FORMATS = [
    { id: 'shp', group: 'GIS', label: 'Shapefile', sub: 'ArcGIS · QGIS', need: fs => fs.length },
    { id: 'geojson', group: 'GIS', label: 'GeoJSON', sub: 'Web maps · QGIS', need: fs => fs.length },
    { id: 'kml', group: 'GIS', label: 'KML', sub: 'Google Earth', need: (fs, crs) => fs.length && L.geo.canLonLat(crs), why: 'Needs UTM or longitude/latitude coordinates' },
    { id: 'gpx', group: 'GIS', label: 'GPX', sub: 'GPS devices', need: (fs, crs) => fs.length && L.geo.canLonLat(crs), why: 'Needs UTM or longitude/latitude coordinates' },
    { id: 'csv', group: 'GIS', label: 'CSV + WKT', sub: 'Excel · any GIS', need: fs => fs.length },
    { id: 'ldb', group: 'Delft3D · D-Flow FM', label: 'Land boundary', sub: '.ldb · RGFGRID A.2', need: fs => fs.some(f => f.type !== 'point'), why: 'Digitize a line or an area first' },
    { id: 'pol', group: 'Delft3D · D-Flow FM', label: 'Polygons', sub: '.pol · A.5', need: fs => fs.some(f => f.type === 'polygon'), why: 'Digitize an area first' },
    { id: 'pli', group: 'Delft3D · D-Flow FM', label: 'Polylines', sub: '.pli · boundaries', need: fs => fs.some(f => f.type !== 'point'), why: 'Digitize a line first' },
    { id: 'xyz', group: 'Delft3D · D-Flow FM', label: 'Samples', sub: '.xyz · A.3', need: fs => L.geo.xyzCount(fs), why: 'Give points or contour lines a value (e.g. depth) first' },
    { id: 'xyn', group: 'Delft3D · D-Flow FM', label: 'Observation pts', sub: '.xyn', need: fs => fs.some(f => f.type === 'point'), why: 'Digitize points first' },
    { id: 'dxf', group: 'CAD', label: 'DXF', sub: 'AutoCAD · Civil 3D', need: fs => fs.length },
  ];
  async function exportMap(id) {
    const g = dig(), m = g.map, tf = mapTransform(m); if (!tf) return;
    const crs = crsOf(m), fs = mapFeatures(m, tf), props = measureProps(m, tf), base = L.safeName(`${L.state.name} p${L.state.cur + 1}`).replace(/\s+/g, '_');
    const save = (text, ext, mime) => L.saveFile(new Blob([text], { type: mime }), `${base}.${ext}`, mime, ext);
    try {
      if (id === 'shp') { await L.zipAndSave(L.geo.shapefiles(fs, crs, base, props), `${base}_shapefile.zip`); return; }
      if (id === 'geojson') return save(L.geo.geojson(fs, crs, props), 'geojson', 'application/geo+json');
      if (id === 'kml') return save(L.geo.kml(fs, crs, `${L.state.name} — page ${L.state.cur + 1}`, props), 'kml', 'application/vnd.google-earth.kml+xml');
      if (id === 'gpx') return save(L.geo.gpx(fs, crs), 'gpx', 'application/gpx+xml');
      if (id === 'csv') return save(L.geo.csv(fs, crs, props), 'csv', 'text/csv');
      if (id === 'dxf') return save(L.geo.dxf(fs), 'dxf', 'application/dxf');
      if (['ldb', 'pol', 'pli', 'xyz', 'xyn'].includes(id)) return save(L.geo[id](fs, crs), id, 'text/plain');
    } catch (e) { L.error('Export failed', e); }
  }
  L.digitizeExportData = () => { const m = dig().map, tf = mapTransform(m); return tf ? { fs: mapFeatures(m, tf), crs: crsOf(m), props: measureProps(m, tf) } : null; }; // used by tests

  /* ——— Inspector ——— */
  const placeBtn = (key, done) => h('button', { class: 'btn' + (D.placing === key ? ' primary' : ''), style: { padding: '0 10px' }, onclick: () => { D.placing = D.placing === key ? null : key; D.mode = D.mode === 'pick' ? 'add' : D.mode; L.renderInspector(); } }, L.icon('target'), D.placing === key ? 'Click page' : done ? 'Move' : 'Place');
  function chartInspector(g) {
    const c = g.cal, f = chartMap(c), data = f && chartRows(g);
    const calRow = k => h('div', { class: 'list-item' + (D.placing === k ? ' on' : '') },
      h('span', { class: 'dot ' + (D.placing === k ? 'active' : c[k].p ? 'ok' : 'pending') }),
      h('b', { style: { width: '22px' } }, `${k[0]}${k[1] === '1' ? '₁' : '₂'}`),
      h('input', { class: 'input num grow', type: 'number', step: 'any', value: c[k].v, onchange: e => dmut('axis value', () => { c[k].v = parseFloat(e.target.value); }) }),
      placeBtn(k, !!c[k].p));
    const s = g.series[g.active];
    return [
      ui.section('1 · Calibrate axes',
        h('div', { class: 'list' }, CAL_ORDER.map(calRow)),
        h('div', { class: 'row', style: { marginTop: '10px', gap: '18px' } },
          ui.check('Log X', c.logX, v => dmut('log x', () => { c.logX = v; })), ui.check('Log Y', c.logY, v => dmut('log y', () => { c.logY = v; }))),
        h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Place two known ticks on each axis and type their values. A magnifier helps you land precisely.')),
      ui.section('2 · Capture data',
        ui.seg([{ label: 'Click points', value: 'add', icon: 'target' }, { label: 'Auto-trace', value: 'trace', icon: 'trace' }], D.mode === 'pick' ? 'trace' : D.mode, v => { D.mode = v; D.placing = null; L.setCursor('crosshair'); L.renderInspector(); }),
        D.mode === 'add' ? h('p', { class: 'muted tiny', style: { margin: '10px 0 0' } }, 'Click to add · drag to adjust · right-click or Alt-click to delete.') :
          h('div', { class: 'stack', style: { marginTop: '12px' } },
            h('div', { class: 'row' },
              h('span', { class: 'swatch', style: { background: D.color ? `rgb(${D.color})` : 'transparent', flex: 'none', outline: D.color ? '' : '1px dashed var(--sep-strong)' } }),
              h('button', { class: 'btn' + (D.mode === 'pick' ? ' primary' : ''), onclick: () => { D.mode = 'pick'; L.setCursor('pick'); L.renderInspector(); } }, L.icon('dropper'), D.mode === 'pick' ? 'Click the curve…' : 'Pick curve color')),
            h('div', { class: 'field' }, h('span', null, `Color tolerance · ${D.tol}`), h('input', { type: 'range', min: 10, max: 160, value: D.tol, oninput: e => { D.tol = +e.target.value; e.target.previousSibling.textContent = `Color tolerance · ${D.tol}`; } })),
            h('div', { class: 'grid2' },
              ui.field('Every', ui.select([{ value: '2', label: '2 px' }, { value: '3', label: '3 px' }, { value: '6', label: '6 px' }, { value: '12', label: '12 px' }], String(D.step), v => { D.step = +v; })),
              ui.field('Shape', ui.select([{ value: 'line', label: 'Line' }, { value: 'scatter', label: 'Scatter' }], D.traceMode, v => { D.traceMode = v; L.drawOverlay(); }))),
            h('p', { class: 'muted tiny', style: { margin: 0 } }, 'Then drag a box over the curve on the page.')),
        h('div', { class: 'list', style: { marginTop: '12px' } }, g.series.map((se, i) => h('div', { class: 'list-item' + (i === g.active ? ' on' : ''), onclick: e => { if (e.target.tagName !== 'INPUT' && !e.target.closest('button')) { g.active = i; L.renderInspector(); L.drawOverlay(); } } },
          h('span', { class: 'dot', style: { background: se.color } }),
          h('input', { class: 'input grow', value: se.name, style: { border: 0, background: 'transparent', padding: 0, height: '22px' }, onchange: e => dmut('rename series', () => { se.name = e.target.value; }) }),
          h('span', { class: 'muted tiny' }, se.pts.length),
          g.series.length > 1 ? h('button', { class: 'icon-btn small', title: 'Remove series', onclick: () => dmut('remove series', () => { g.series.splice(i, 1); g.active = Math.min(g.active, g.series.length - 1); }) }, L.icon('trash')) : null))),
        h('div', { class: 'row between', style: { marginTop: '8px' } },
          h('button', { class: 'btn ghost', style: { paddingLeft: 0 }, onclick: () => dmut('add series', () => { g.series.push({ id: L.uid('d'), name: `Series ${g.series.length + 1}`, color: SERIES_COLORS[g.series.length % SERIES_COLORS.length], pts: [] }); g.active = g.series.length - 1; }) }, L.icon('plus'), 'Add series'),
          s.pts.length ? h('button', { class: 'btn ghost danger', onclick: () => dmut('clear points', () => { s.pts = []; }) }, 'Clear') : null)),
      ui.section('3 · Data',
        !f ? ui.callout('Place all four axis points to see real values.', '', 'target') :
          !data.some(d => d.pts.length) ? ui.callout('No points yet — click on the curve or use Auto-trace.', '', 'info') :
            h('div', { class: 'stack' },
              miniPlot(data),
              h('div', { class: 'table-preview', style: { maxHeight: '180px' } }, h('table', null, h('tr', null, h('th', null, 'Series'), h('th', null, 'X'), h('th', null, 'Y')),
                data.flatMap(d => d.pts.slice(0, 200).map(p => h('tr', null, h('td', null, d.se.name), h('td', null, fmt(p[0])), h('td', null, fmt(p[1])))))) ),
              h('div', { class: 'grid2' }, ui.btn('CSV', 'download', () => exportChart('csv'), 'primary'), ui.btn('Copy', 'copy', () => exportChart('copy'))))),
    ];
  }
  function mapInspector(g) {
    const m = g.map, tf = mapTransform(m), crs = crsOf(m), geo = isGeo(m), units = crs.type === 'utm' ? 'm' : m.units;
    const ph = crs.type === 'wgs84' ? ['Longitude', 'Latitude'] : crs.type === 'utm' ? ['Easting', 'Northing'] : ['X', 'Y'];
    const cpRow = (c, i) => h('div', { class: 'list-item' + (D.placing === i ? ' on' : ''), style: { flexWrap: 'wrap' } },
      h('span', { class: 'dot ' + (D.placing === i ? 'active' : c.p ? 'ok' : 'pending') }), h('b', { style: { width: '14px' } }, i + 1),
      h('input', { class: 'input num', style: { flex: 1, minWidth: '70px' }, placeholder: ph[0], value: c.X, onchange: e => dmut('control point', () => { c.X = e.target.value; }) }),
      h('input', { class: 'input num', style: { flex: 1, minWidth: '70px' }, placeholder: ph[1], value: c.Y, onchange: e => dmut('control point', () => { c.Y = e.target.value; }) }),
      placeBtn(i, !!c.p),
      m.cps.length > 2 ? h('button', { class: 'icon-btn small', title: 'Remove this reference point', onclick: () => dmut('remove control point', () => m.cps.splice(i, 1)) }, L.icon('close')) : null);
    // gentle hint if the numbers typed don't match the chosen coordinate system
    const vals = m.cps.filter(c => c.X !== '' && c.Y !== '').map(c => [+c.X, +c.Y]);
    const looksLL = vals.length && vals.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90), looksUTM = vals.length && vals.every(([x, y]) => x > 100000 && x < 900000 && Math.abs(y) < 10000000);
    const hint = crs.type !== 'wgs84' && looksLL ? 'These look like longitude / latitude — choose “Longitude / latitude”.' : crs.type !== 'utm' && looksUTM ? 'These look like UTM meters — choose “UTM” and its zone.' : null;
    const fs = tf ? mapFeatures(m, tf) : [];
    const groups = [...new Set(MAP_FORMATS.map(f => f.group))];
    const crsNote = crs.type === 'utm' ? 'Pakistan: Karachi ≈ 42N, Lahore / Islamabad ≈ 43N. Exports carry the matching .prj; KML and GPX are converted to latitude / longitude.'
      : crs.type === 'wgs84' ? 'Lengths and areas are measured on the Earth’s surface.' : 'Without a real coordinate system, KML and GPX are unavailable.';
    const drawHint = D.feat === 'point' ? 'Click to drop a point.'
      : `Click to add vertices, or press and drag to trace freehand. ${D.feat === 'polygon' ? 'Click the first point to close. ' : ''}Double-click or Enter finishes · Esc cancels.`;
    return [
      ui.section('1 · Coordinate system',
        ui.select([{ value: 'local', label: 'Local / unknown (drawing units)' }, { value: 'utm', label: 'UTM — meters (WGS 84)' }, { value: 'wgs84', label: 'Longitude / latitude (WGS 84)' }], crs.type, v => dmut('coordinate system', () => { crs.type = v; })),
        crs.type === 'utm' ? h('div', { class: 'grid2', style: { marginTop: '8px' } },
          ui.field('Zone', ui.num(crs.zone, v => dmut('UTM zone', () => { crs.zone = L.clamp(Math.round(v) || 43, 1, 60); }), { min: 1, max: 60 })),
          ui.field('Hemisphere', ui.select([{ value: 'N', label: 'North' }, { value: 'S', label: 'South' }], crs.south ? 'S' : 'N', v => dmut('hemisphere', () => { crs.south = v === 'S'; })))) : null,
        crs.type === 'local' ? h('div', { style: { marginTop: '8px' } }, ui.field('Units', h('input', { class: 'input', value: m.units, onchange: e => dmut('units', () => { m.units = e.target.value; }) }))) : null,
        h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, crsNote),
        hint ? h('div', { style: { marginTop: '8px' } }, ui.callout(hint, 'warn', 'warn')) : null),
      ui.section('2 · Reference points',
        h('div', { class: 'list' }, m.cps.map(cpRow)),
        h('div', { class: 'row between', style: { marginTop: '8px' } },
          h('button', { class: 'btn ghost', style: { paddingLeft: 0 }, onclick: () => dmut('add control point', () => m.cps.push({ p: null, X: '', Y: '' })) }, L.icon('plus'), 'Add point'),
          tf ? h('span', { class: 'muted tiny', title: 'Root-mean-square misfit of the reference points' }, tf.similarity ? '2-point fit (no skew)' : tf.n === 3 || tf.rms < 1e-6 ? 'Exact fit' : `Fit error ±${fmt(tf.rms)}${geo ? '°' : ' ' + units}`) : null),
        h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Place points whose real coordinates you know — grid crossings, survey marks, the ends of a scale bar. Two points suit an upright, undistorted map; three or more also correct skew.')),
      ui.section('3 · Digitize',
        ui.seg([{ label: 'Point', value: 'point', icon: 'pin' }, { label: 'Line', value: 'line', icon: 'polyline' }, { label: 'Area', value: 'polygon', icon: 'polygon' }], D.feat, v => { D.feat = v; D.drawing = null; D.placing = null; L.drawOverlay(); L.renderInspector(); }),
        h('p', { class: 'muted tiny', style: { margin: '10px 0 0' } }, drawHint),
        h('p', { class: 'muted tiny', style: { margin: '4px 0 0' } }, 'Edit later: drag any vertex · Alt-click a vertex to delete it.'),
        D.drawing ? h('div', { class: 'row', style: { marginTop: '8px' } }, ui.btn('Finish', 'check', finishFeature, 'primary'), ui.btn('Cancel', null, () => { D.drawing = null; L.drawOverlay(); L.renderInspector(); })) : null),
      ui.section('4 · Features',
        !m.feats.length ? h('p', { class: 'muted', style: { margin: 0 } }, 'Nothing digitized yet.') :
          h('div', { class: 'list' }, m.feats.map((f, i) => {
            const r = tf && measure(f, tf.f, geo);
            const val = !tf ? 'needs reference points' : f.type === 'point' ? r.pts[0].map(fmt).join(', ') : f.type === 'line' ? `${fmtLen(r.len, geo, units)} · ${f.pts.length} vertices` : `${fmtArea(r.area, geo, units)} · ${fmtLen(r.len, geo, units)}`;
            return h('div', { class: 'list-item' }, L.icon(f.type === 'point' ? 'pin' : f.type === 'line' ? 'polyline' : 'polygon', 16),
              h('div', { class: 'grow' }, h('input', { class: 'input', value: f.name, style: { border: 0, background: 'transparent', padding: 0, height: '20px', fontWeight: 600 }, onchange: e => dmut('rename', () => { f.name = e.target.value; }) }), h('div', { class: 'muted tiny' }, val)),
              h('input', { class: 'input num', style: { width: '64px' }, placeholder: 'value', title: 'Attribute value — e.g. depth or elevation (used by .xyz samples)', value: f.value ?? '', onchange: e => dmut('value', () => { f.value = e.target.value; }) }),
              h('button', { class: 'icon-btn small', title: 'Delete', onclick: () => dmut('delete feature', () => m.feats.splice(i, 1)) }, L.icon('trash')));
          }))),
      tf && m.feats.length ? ui.section('5 · Export',
        groups.map(gname => h('div', { style: { marginBottom: '10px' } }, h('div', { class: 'muted tiny', style: { margin: '0 0 6px', fontWeight: 600 } }, gname),
          h('div', { class: 'grid2' }, MAP_FORMATS.filter(f => f.group === gname).map(f => {
            const ok = !!f.need(fs, crs);
            return h('button', { class: 'name-chip', disabled: !ok, title: ok ? `Save as ${f.label}` : f.why || '', style: { opacity: ok ? 1 : 0.45, padding: '7px 10px' }, onclick: () => exportMap(f.id) }, h('b', null, f.label), h('span', null, f.sub));
          })))),
        h('p', { class: 'muted tiny', style: { margin: '2px 0 0' } }, `Coordinates: ${L.geo.crsLabel(crs)}.`)) : null,
    ];
  }

  L.registerBlade({
    id: 'digitize', label: 'Digitize', icon: 'chart', color: '#e5484d', precise: true,
    desc: 'Recover numbers from graphs and coordinates, lengths and areas from maps.',
    activate() { L.setCursor('crosshair'); },
    deactivate() { L.loupe(false); D.placing = null; D.drawing = null; if (D.mode === 'pick') D.mode = 'trace'; },
    draw, pointer,
    key(e) {
      if (e.target.closest('input,textarea')) return;
      if (e.key === 'Enter' && D.drawing) { finishFeature(); return true; }
      if (e.key === 'Escape') { D.drawing = null; D.placing = null; if (D.mode === 'pick') D.mode = 'trace'; L.drawOverlay(); L.renderInspector(); return true; }
      if ((e.key === 'Backspace' || e.key === 'Delete') && D.drawing) { D.drawing.pts.pop(); L.drawOverlay(); return true; }
    },
    inspector() {
      const g = dig();
      return [
        ui.head('chart', 'Digitize', g.mode === 'chart' ? 'Turn a printed graph back into numbers.' : 'Measure and capture coordinates from a map or drawing.'),
        h('div', { class: 'section' }, ui.seg([{ label: 'Graph', value: 'chart', icon: 'chart' }, { label: 'Map / drawing', value: 'map', icon: 'pin' }], g.mode, v => { g.mode = v; D.placing = null; D.drawing = null; L.drawOverlay(); L.renderInspector(); })),
        ...(g.mode === 'chart' ? chartInspector(g) : mapInspector(g)),
      ];
    },
  });
  L.on('page', () => { D.placing = null; D.drawing = null; if (L.state.blade === 'digitize') L.renderInspector(); });
})();
