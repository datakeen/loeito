/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito render: PDF sources, page geometry ("views"), rendering, thumbnails, text words and annotation painting. */
(() => {
  const L = window.Loeito;
  const pdfjsLib = window.pdfjsLib;

  // The worker is fetched and wrapped in a blob so Loeito also works when opened straight from disk (file://).
  L.pdfReady = (async () => {
    const url = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    try {
      const code = await (await fetch(url)).text();
      pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    } catch { pdfjsLib.GlobalWorkerOptions.workerSrc = url; }
  })();

  /* ——— Sources ——— */
  // Is the file encrypted? (pdf.js doesn't say; look for the trailer's /Encrypt entry near the end, or anywhere in small files)
  const hasEncrypt = b => { const tail = b.length > 400000 ? b.subarray(b.length - 400000) : b, s = new TextDecoder('latin1').decode(tail); return /\/Encrypt\s+\d+\s+\d+\s+R/.test(s) || /\/Encrypt\s*<</.test(s); };
  L.addSource = async (bytes, name) => {
    await L.pdfReady;
    const task = pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false });
    let password = null;
    task.onPassword = async (update, reason) => {
      const input = L.h('input', { class: 'input', type: 'password', placeholder: 'Password' });
      const ok = await L.dialog({
        title: `“${name}” is protected`, text: reason === 2 ? 'That password didn’t work. Try again.' : 'Enter the password to open this document.',
        body: input, actions: [{ label: 'Cancel', value: false }, { label: 'Open', primary: true, value: true }],
      });
      if (ok) { password = input.value; update(password); } else task.destroy();
    };
    const doc = await task.promise;
    const id = L.uid('s');
    L.sources[id] = { id, name, bytes, doc, proxies: new Map(), text: new Map(), encrypted: password != null || hasEncrypt(bytes), password };
    return { id, count: doc.numPages, doc };
  };
  L.proxy = async page => {
    const src = L.sources[page.src];
    let p = src.proxies.get(page.index);
    if (!p) { p = await src.doc.getPage(page.index + 1); src.proxies.set(page.index, p); }
    return p;
  };
  L.proxySync = page => L.sources[page.src]?.proxies.get(page.index);
  L.newPage = (src, index) => ({ id: L.uid('p'), src, index, rot: 0, crop: null, ann: [], ocr: null, dig: null });

  // Build a single-page PDF for an image (fits within A4, keeps aspect) or a blank page.
  L.imageToPdf = async (bytes, mime) => {
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.create();
    const img = mime === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const portrait = img.height >= img.width;
    const box = portrait ? [595.28, 841.89] : [841.89, 595.28];
    const s = Math.min(box[0] / img.width, box[1] / img.height);
    const w = img.width * s, h = img.height * s;
    const page = doc.addPage([w, h]);
    page.drawImage(img, { x: 0, y: 0, width: w, height: h });
    return doc.save();
  };
  L.blankPdf = async (w = 595.28, h = 841.89) => {
    const doc = await PDFLib.PDFDocument.create(); doc.addPage([w, h]); return doc.save();
  };

  /* ——— Geometry ———
     A "view" maps PDF user space (the page's own coordinates) to on-screen pixels for the page as
     currently shown: original /Rotate + Loeito rotation, cropped (unless full:true), at a given scale. */
  const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const invert = m => { const d = m[0] * m[3] - m[1] * m[2]; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; };
  L.pageBox = proxy => { const v = proxy.view; return { x: v[0], y: v[1], w: v[2] - v[0], h: v[3] - v[1] }; };
  L.totalRotation = (proxy, page) => ((proxy.rotate + page.rot) % 360 + 360) % 360;
  L.makeView = (proxy, page, scale, { full = false } = {}) => {
    const rotation = L.totalRotation(proxy, page);
    const vp = proxy.getViewport({ scale, rotation });
    const M = vp.transform, inv = invert(M);
    const box = (!full && page.crop) ? page.crop : L.pageBox(proxy);
    const pts = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]].map(p => apply(M, p));
    const ox = Math.min(...pts.map(p => p[0])), oy = Math.min(...pts.map(p => p[1]));
    const width = Math.max(...pts.map(p => p[0])) - ox, height = Math.max(...pts.map(p => p[1])) - oy;
    return {
      scale, rotation, M, inv, ox, oy, width, height, box, viewport: vp, full,
      toScreen: p => { const [x, y] = apply(M, p); return [x - ox, y - oy]; },
      toPdf: ([x, y]) => apply(inv, [x + ox, y + oy]),
      vec: ([x, y]) => [M[0] * x + M[2] * y, M[1] * x + M[3] * y],       // user → screen (linear)
      vecPdf: ([x, y]) => [inv[0] * x + inv[2] * y, inv[1] * x + inv[3] * y], // screen → user (linear)
      rectToScreen(r) { const a = this.toScreen([r.x, r.y]), b = this.toScreen([r.x + r.w, r.y + r.h]); return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) }; },
      rectToPdf(r) { const a = this.toPdf([r.x, r.y]), b = this.toPdf([r.x + r.w, r.y + r.h]); return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) }; },
      // user-space angle (deg) of the on-screen horizontal: text placed with this angle reads upright here
      uprightAngle() { const v = this.vecPdf([1, 0]); return Math.round(Math.atan2(v[1], v[0]) * 180 / Math.PI); },
    };
  };

  // Render a page into a canvas. Returns the view used.
  L.renderInto = async (canvas, page, scale, opts = {}) => {
    const proxy = await L.proxy(page);
    const view = L.makeView(proxy, page, scale, opts);
    const dpr = opts.dpr ?? (window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(view.width * dpr));
    canvas.height = Math.max(1, Math.round(view.height * dpr));
    const ctx = canvas.getContext('2d', { willReadFrequently: !!opts.readback });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Off-screen work (OCR, detection, thumbnails, exports) uses pdf.js's "print" path: the "display" path paces itself
    // with animation frames, which browsers pause while the window is hidden — background jobs would freeze.
    const intent = opts.intent || 'print', AM = pdfjsLib.AnnotationMode;
    // Pages whose form was read into Loeito fields: hide the PDF's own widgets so values aren't drawn twice.
    const annotationMode = L.sources[page.src]?.hasForm ? AM.DISABLE : intent === 'print' ? AM.ENABLE : AM.ENABLE_FORMS;
    const task = proxy.render({ canvasContext: ctx, viewport: view.viewport, transform: [dpr, 0, 0, dpr, -view.ox * dpr, -view.oy * dpr], intent, annotationMode });
    if (opts.onTask) opts.onTask(task);
    await task.promise;
    if (opts.annotations !== false) {
      ctx.save(); ctx.scale(dpr, dpr); L.paintAnnotations(ctx, page, view); if (L.forms) L.forms.paint(ctx, page, view); if (opts.stamps) L.paintStamps(ctx, page, view, opts.state); ctx.restore();
    }
    return view;
  };

  /* ——— Thumbnails ——— */
  const thumbCache = new Map(); // signature -> objectURL
  L.pageSignature = p => `${p.src}|${p.index}|${p.rot}|${p.crop ? [p.crop.x, p.crop.y, p.crop.w, p.crop.h].map(n => n.toFixed(1)).join(',') : ''}|${JSON.stringify(p.ann, (k, v) => (k === 'src' ? v.length : v))}|${p.fields && p.fields.length ? JSON.stringify(p.fields.map(f => [f.r, f.value, f.kind])) : ''}`;
  const queue = []; let running = 0;
  L.thumb = page => new Promise(resolve => {
    const sig = L.pageSignature(page);
    if (thumbCache.has(sig)) return resolve(thumbCache.get(sig));
    queue.push({ page, sig, resolve }); pump();
  });
  async function pump() {
    while (running < 2 && queue.length) {
      const job = queue.shift(); running++;
      (async () => {
        try {
          if (thumbCache.has(job.sig)) return job.resolve(thumbCache.get(job.sig));
          const proxy = await L.proxy(job.page);
          const base = L.makeView(proxy, job.page, 1);
          const c = document.createElement('canvas');
          await L.renderInto(c, job.page, 300 / Math.max(base.width, base.height * 0.75), { dpr: 1 });
          const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
          const url = URL.createObjectURL(blob);
          thumbCache.set(job.sig, url);
          if (thumbCache.size > 600) { const [k, v] = thumbCache.entries().next().value; URL.revokeObjectURL(v); thumbCache.delete(k); }
          job.resolve(url);
        } catch (e) { console.warn('thumb', e); job.resolve(null); }
        finally { running--; pump(); }
      })();
    }
  }

  /* ——— Words ———
     Unified word format for PDF text and OCR text: { t, x, y, a, w, h }
     (x,y) baseline start in user space, a = direction (deg), w = advance, h = font size (user units). */
  L.pdfTextItems = async page => {
    const src = L.sources[page.src];
    if (src.text.has(page.index)) return src.text.get(page.index);
    const proxy = await L.proxy(page);
    const tc = await proxy.getTextContent();
    const items = tc.items.filter(it => it.str && it.str.trim()).map(it => {
      const [a, b, c, d, e, f] = it.transform;
      const h = Math.hypot(c, d) || Math.hypot(a, b) || 1;
      return { t: it.str, x: e, y: f, a: Math.atan2(b, a) * 180 / Math.PI, w: it.width || h * it.str.length * 0.5, h, font: it.fontName, style: tc.styles[it.fontName] };
    });
    src.text.set(page.index, items);
    return items;
  };
  const splitWords = it => {
    const out = [], n = it.t.length, cw = it.w / Math.max(1, n);
    const rad = it.a * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad);
    const re = /\S+/g; let m;
    while ((m = re.exec(it.t))) out.push({ t: m[0], x: it.x + ux * cw * m.index, y: it.y + uy * cw * m.index, a: it.a, w: cw * m[0].length, h: it.h, font: it.font });
    return out;
  };
  L.splitWords = splitWords;
  L.pageWords = async (page, { prefer = 'auto' } = {}) => {
    const items = await L.pdfTextItems(page);
    const pdfWords = items.flatMap(splitWords);
    const ocrWords = page.ocr?.words || [];
    if (prefer === 'ocr') return ocrWords.length ? ocrWords : pdfWords;
    if (prefer === 'pdf') return pdfWords.length ? pdfWords : ocrWords;
    return pdfWords.length >= ocrWords.length * 0.5 && pdfWords.length ? pdfWords : ocrWords;
  };
  L.pageText = async page => {
    const words = await L.pageWords(page);
    return L.wordsToText(words, page);
  };
  // Screen-space box of a word in a view.
  L.wordBox = (w, view) => {
    const rad = w.a * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad), px = -uy, py = ux;
    const pts = [[w.x - px * w.h * 0.22, w.y - py * w.h * 0.22], [w.x + ux * w.w - px * w.h * 0.22, w.y + uy * w.w - py * w.h * 0.22],
      [w.x + px * w.h * 0.8, w.y + py * w.h * 0.8], [w.x + ux * w.w + px * w.h * 0.8, w.y + uy * w.w + py * w.h * 0.8]].map(view.toScreen);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  // Reading-order text from words using a scale-1 display frame.
  L.wordsToText = (words, page) => {
    const proxy = L.proxySync(page);
    if (!proxy || !words.length) return words.map(w => w.t).join(' ');
    const v = L.makeView(proxy, page, 1, { full: true });
    const boxes = words.map(w => ({ w, b: L.wordBox(w, v) })).sort((a, b) => (a.b.y + a.b.h / 2) - (b.b.y + b.b.h / 2));
    const lines = [];
    for (const it of boxes) {
      const cy = it.b.y + it.b.h / 2, line = lines[lines.length - 1];
      if (line && Math.abs(cy - line.cy) < Math.max(3, Math.min(it.b.h, line.h) * 0.5)) { line.items.push(it); line.cy = (line.cy * (line.items.length - 1) + cy) / line.items.length; }
      else lines.push({ cy, h: it.b.h, items: [it] });
    }
    return lines.map(l => l.items.sort((a, b) => a.b.x - b.b.x).map(i => i.w.t).join(' ')).join('\n');
  };

  /* ——— Annotations ———
     Rect-like (r in user space): whiteout, redact, highlight, rect, ellipse.
     Lines: line, arrow (p1,p2). ink (pts). Anchored with angle: text, image (x,y top-left; w,h; a). */
  L.FONTS = {
    Helvetica: { css: 'Helvetica, Arial, sans-serif', pdf: 'Helvetica', bold: 'HelveticaBold' },
    Times: { css: '"Times New Roman", Times, serif', pdf: 'TimesRoman', bold: 'TimesRomanBold' },
    Courier: { css: '"Courier New", Courier, monospace', pdf: 'Courier', bold: 'CourierBold' },
  };
  L.annFrame = a => { // unit vectors for anchored annotations (user space)
    const r = (a.a || 0) * Math.PI / 180;
    return { u: [Math.cos(r), Math.sin(r)], d: [Math.sin(r), -Math.cos(r)] };
  };
  L.textSize = a => { // width/height (user units) of a text annotation
    const ctx = L._measure ||= document.createElement('canvas').getContext('2d');
    ctx.font = `${a.bold ? 700 : 400} ${a.size}px ${L.FONTS[a.font || 'Helvetica'].css}`;
    const lines = String(a.text || ' ').split('\n');
    return { w: Math.max(4, ...lines.map(l => ctx.measureText(l).width)), h: lines.length * a.size * 1.2 };
  };
  L.annCorners = a => { // user-space polygon for hit-testing / bounds
    if (a.r) { const r = a.r; return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; }
    if (a.pts) return a.pts;
    if (a.p1) return [a.p1, a.p2];
    const { u, d } = L.annFrame(a);
    const { w, h } = a.type === 'text' ? L.textSize(a) : a;
    const P = [a.x, a.y];
    return [P, [P[0] + u[0] * w, P[1] + u[1] * w], [P[0] + u[0] * w + d[0] * h, P[1] + u[1] * w + d[1] * h], [P[0] + d[0] * h, P[1] + d[1] * h]];
  };
  L.annScreenBox = (a, view) => {
    const pts = L.annCorners(a).map(view.toScreen);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const pad = a.type === 'ink' || a.p1 ? (a.width || 2) * view.scale / 2 + 2 : 0;
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  };

  // SVG painter (main stage)
  L.annToSvg = (a, view) => {
    const s = L.s, k = view.scale;
    if (a.r) {
      const b = view.rectToScreen(a.r);
      if (a.type === 'ellipse') return s('ellipse', { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2, ry: b.h / 2, fill: a.fill || 'none', stroke: a.color, 'stroke-width': a.width * k });
      const fill = a.type === 'whiteout' ? (a.color || '#fff') : a.type === 'redact' ? '#000' : a.type === 'highlight' ? a.color : (a.fill || 'none');
      return s('rect', {
        x: b.x, y: b.y, width: b.w, height: b.h, fill,
        stroke: a.type === 'rect' ? a.color : 'none', 'stroke-width': a.type === 'rect' ? a.width * k : 0,
        'fill-opacity': a.type === 'highlight' ? (a.opacity ?? 0.4) : 1, style: a.type === 'highlight' ? 'mix-blend-mode:multiply' : '',
      });
    }
    if (a.type === 'ink') {
      const d = a.pts.map((p, i) => { const q = view.toScreen(p); return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('');
      return s('path', { d, fill: 'none', stroke: a.color, 'stroke-width': a.width * k, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': a.opacity ?? 1 });
    }
    if (a.p1) {
      const p = view.toScreen(a.p1), q = view.toScreen(a.p2);
      const g = s('g', null, s('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: a.color, 'stroke-width': a.width * k, 'stroke-linecap': 'round' }));
      if (a.type === 'arrow') {
        const ang = Math.atan2(q[1] - p[1], q[0] - p[0]), L2 = Math.max(8, a.width * k * 4);
        const h1 = [q[0] - L2 * Math.cos(ang - 0.45), q[1] - L2 * Math.sin(ang - 0.45)], h2 = [q[0] - L2 * Math.cos(ang + 0.45), q[1] - L2 * Math.sin(ang + 0.45)];
        g.append(s('path', { d: `M${h1}L${q}L${h2}`, fill: 'none', stroke: a.color, 'stroke-width': a.width * k, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      }
      return g;
    }
    const P = view.toScreen([a.x, a.y]);
    const { u } = L.annFrame(a); const su = view.vec(u);
    const deg = Math.atan2(su[1], su[0]) * 180 / Math.PI;
    const g = s('g', { transform: `translate(${P[0]},${P[1]}) rotate(${deg})` });
    if (a.type === 'text') {
      const lines = String(a.text || '').split('\n');
      const t = s('text', { fill: a.color, 'font-size': a.size * k, 'font-family': L.FONTS[a.font || 'Helvetica'].css, 'font-weight': a.bold ? 700 : 400, style: 'white-space:pre' });
      lines.forEach((ln, i) => t.append(s('tspan', { x: 0, y: (a.size * 0.8 + i * a.size * 1.2) * k }, ln || ' ')));
      g.append(t);
    } else if (a.type === 'image') {
      g.append(s('image', { href: a.src, x: 0, y: 0, width: a.w * k, height: a.h * k, preserveAspectRatio: 'none' }));
    }
    return g;
  };

  // Canvas painter (thumbnails, image export, previews)
  const imgCache = new Map();
  const getImg = src => { let i = imgCache.get(src); if (!i) { i = new Image(); i.src = src; imgCache.set(src, i); } return i; };
  L.paintAnnotations = (ctx, page, view) => {
    const k = view.scale;
    for (const a of page.ann || []) {
      ctx.save();
      if (a.r) {
        const b = view.rectToScreen(a.r);
        if (a.type === 'highlight') { ctx.globalAlpha = a.opacity ?? 0.4; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = a.color; ctx.fillRect(b.x, b.y, b.w, b.h); }
        else if (a.type === 'whiteout' || a.type === 'redact') { ctx.fillStyle = a.type === 'redact' ? '#000' : (a.color || '#fff'); ctx.fillRect(b.x, b.y, b.w, b.h); }
        else {
          ctx.strokeStyle = a.color; ctx.lineWidth = a.width * k; ctx.beginPath();
          if (a.type === 'ellipse') ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2); else ctx.rect(b.x, b.y, b.w, b.h);
          ctx.stroke();
        }
      } else if (a.type === 'ink' || a.p1) {
        const pts = a.pts || [a.p1, a.p2];
        ctx.strokeStyle = a.color; ctx.lineWidth = a.width * k; ctx.lineCap = ctx.lineJoin = 'round'; ctx.globalAlpha = a.opacity ?? 1;
        ctx.beginPath(); pts.forEach((p, i) => { const q = view.toScreen(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
        if (a.type === 'arrow') {
          const p = view.toScreen(a.p1), q = view.toScreen(a.p2), ang = Math.atan2(q[1] - p[1], q[0] - p[0]), L2 = Math.max(4, a.width * k * 4);
          ctx.beginPath(); ctx.moveTo(q[0] - L2 * Math.cos(ang - 0.45), q[1] - L2 * Math.sin(ang - 0.45)); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0] - L2 * Math.cos(ang + 0.45), q[1] - L2 * Math.sin(ang + 0.45)); ctx.stroke();
        }
      } else {
        const P = view.toScreen([a.x, a.y]); const su = view.vec(L.annFrame(a).u);
        ctx.translate(P[0], P[1]); ctx.rotate(Math.atan2(su[1], su[0]));
        if (a.type === 'text') {
          ctx.fillStyle = a.color; ctx.font = `${a.bold ? 700 : 400} ${a.size * k}px ${L.FONTS[a.font || 'Helvetica'].css}`;
          String(a.text || '').split('\n').forEach((ln, i) => ctx.fillText(ln, 0, (a.size * 0.8 + i * a.size * 1.2) * k));
        } else if (a.type === 'image') {
          const im = getImg(a.src); if (im.complete) ctx.drawImage(im, 0, 0, a.w * k, a.h * k);
        }
      }
      ctx.restore();
    }
  };

  /* ——— Selectable text: the PDF's own text plus OCR words, laid exactly over the rendered page ——— */
  L.buildTextLayer = async (p, view) => {
    const proxy = await L.proxy(p), vp = view.viewport;
    const tl = L.h('div', { class: 'textLayer' });
    tl.style.setProperty('--scale-factor', vp.scale);
    Object.assign(tl.style, { left: -view.ox + 'px', top: -view.oy + 'px', width: vp.width + 'px', height: vp.height + 'px' });
    tl.words = 0;
    try {
      const tc = await proxy.getTextContent();
      tl.words = tc.items.reduce((a, it) => a + (it.str.match(/\S+/g) || []).length, 0);
      await pdfjsLib.renderTextLayer({ textContentSource: tc, container: tl, viewport: vp, textDivs: [] }).promise;
    } catch (e) { console.warn('text layer', e); }
    if (p.ocr) { // scanned pages: OCR words become selectable too
      const mc = (L._mctx ||= document.createElement('canvas').getContext('2d'));
      for (const w of p.ocr.words) {
        const b = L.wordBox(w, view), fs = Math.max(4, b.h * 0.86);
        mc.font = `${fs}px sans-serif`; const mw = mc.measureText(w.t).width || 1;
        tl.append(L.h('span', { class: 'ocrw', style: { left: b.x + view.ox + 'px', top: b.y + view.oy + 'px', fontSize: fs + 'px', transform: `scaleX(${(b.w / mw).toFixed(3)})` } }, w.t + ' '));
      }
      tl.words += p.ocr.words.length;
    }
    return tl;
  };

  /* ——— Stamps: page numbers, header, footer, watermark — each with its own page rule ———
     Rule: { set: all | odd | even | range, range, skipFirst, skipLast, mirror }. Items are laid out in display space,
     so a rotated or cropped page still gets its numbers where a reader expects them. */
  const ROMAN = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  const roman = n => { if (n <= 0 || n >= 4000) return String(n); let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s; };
  const alpha = n => { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s || '0'; };
  const fmtNum = (n, how) => !how ? String(n) : /^\d+$/.test(how) ? String(n).padStart(+how, '0') : how === 'i' ? roman(n) : how === 'I' ? roman(n).toUpperCase() : how === 'a' ? alpha(n) : how === 'A' ? alpha(n).toUpperCase() : String(n);
  L.NUMBER_STYLES = [
    { value: '{n}', label: '1, 2, 3' }, { value: 'Page {n}', label: 'Page 1' }, { value: 'Page {n} of {N}', label: 'Page 1 of 12' },
    { value: '{n} / {N}', label: '1 / 12' }, { value: '– {n} –', label: '– 1 –' }, { value: '{n:i}', label: 'i, ii, iii' }, { value: '{n:I}', label: 'I, II, III' },
    { value: '{n:a}', label: 'a, b, c' }, { value: '{n:A}', label: 'A, B, C' }, { value: 'bates', label: 'Bates number · DOC-000001' }, { value: 'custom', label: 'Custom…' },
  ];
  const RULE = () => ({ set: 'all', range: '', skipFirst: 0, skipLast: 0, mirror: false });
  L.STAMP_DEF = {
    numbers: { on: true, style: 'Page {n} of {N}', fmt: 'Page {n} of {N}', prefix: 'DOC-', digits: 6, suffix: '', pos: 'bc', start: 1, restart: true, size: 10, color: '#1d1d1f', font: 'Helvetica', bold: false, margin: 28, pages: RULE() },
    header: { on: true, left: '', center: '{name}', right: '', size: 9, color: '#6e6e73', font: 'Helvetica', bold: false, margin: 28, rule: false, pages: RULE() },
    footer: { on: true, left: '', center: '', right: '{date}', size: 9, color: '#6e6e73', font: 'Helvetica', bold: false, margin: 28, rule: false, pages: RULE() },
    watermark: { on: true, text: 'DRAFT', size: 80, opacity: 0.12, angle: 45, color: '#e5484d', font: 'Helvetica', pages: RULE() },
  };
  // v1.0 documents had one centred header + footer and "skip first page"; bring them into the 1.1 model, same result.
  L.normStamps = S => {
    const st = S.stamps || (S.stamps = {});
    if (st._v === 2) return st;
    const n = st.numbers;
    if (n && !n.pages) st.numbers = { ...L.STAMP_DEF.numbers, ...n, style: L.NUMBER_STYLES.some(x => x.value === n.fmt) ? n.fmt : 'custom', restart: false, pages: { ...RULE(), skipFirst: n.skipFirst ? 1 : 0, mirror: !!n.mirror } };
    const hf = st.header;
    if (hf && !hf.pages) {
      const base = { on: hf.on, size: hf.size, color: hf.color, margin: hf.margin ?? 28 };
      st.header = hf.header ? { ...L.STAMP_DEF.header, ...base, center: hf.header } : null;
      st.footer = hf.footer ? { ...L.STAMP_DEF.footer, ...base, center: hf.footer, right: '' } : null;
    }
    if (st.watermark && !st.watermark.pages) st.watermark = { ...st.watermark, pages: RULE() };
    st._v = 2;
    return st;
  };
  const rangeCache = new Map();
  L.ruleHits = (r, i, total) => {
    if (!r) return true;
    if (i < (r.skipFirst || 0) || i >= total - (r.skipLast || 0)) return false;
    if (r.set === 'odd') return i % 2 === 0;
    if (r.set === 'even') return i % 2 === 1;
    if (r.set === 'range') { const k = r.range + '|' + total; if (!rangeCache.has(k)) rangeCache.set(k, new Set(L.parseRanges(r.range, total))); return rangeCache.get(k).has(i); }
    return true;
  };
  L.rulePages = (r, total) => { const out = []; for (let i = 0; i < total; i++) if (L.ruleHits(r, i, total)) out.push(i); return out; };
  L.numberFormat = nb => nb.style === 'bates' ? `${(nb.prefix || '').replace(/[{}]/g, '')}{n:${L.clamp(+nb.digits || 6, 1, 12)}}${(nb.suffix || '').replace(/[{}]/g, '')}`
    : nb.style === 'custom' || !nb.style ? nb.fmt || '{n}' : nb.style;
  // Logical number of page i: counted from the first numbered page when `restart`, else from page 1.
  L.numberAt = (S, i, total = S.pages.length) => {
    const nb = L.normStamps(S).numbers;
    if (!nb || !nb.on) return { n: i + 1, N: total };
    const start = Number.isFinite(+nb.start) ? +nb.start : 1;
    if (!nb.restart) return { n: start + i, N: start + total - 1 };
    let before = 0, count = 0;
    for (let j = 0; j < total; j++) if (L.ruleHits(nb.pages, j, total)) { count++; if (j < i) before++; }
    return { n: start + before, N: start + count - 1 };
  };
  L.stampText = (fmt, i, total, S = L.state) => {
    const { n, N } = L.numberAt(S, i, total);
    return String(fmt || '')
      .replace(/\{n(?::(\w+))?\}/g, (_, how) => fmtNum(n, how)).replace(/\{N(?::(\w+))?\}/g, (_, how) => fmtNum(N, how))
      .replace(/\{page\}/g, i + 1).replace(/\{pages\}/g, total)
      .replace(/\{date\}/g, new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))
      .replace(/\{name\}/g, S.name || '').replace(/\{title\}/g, S.meta?.title || S.name || '').replace(/\{author\}/g, S.meta?.author || '');
  };
  const POS = { tl: [0, 0, 'start'], tc: [0.5, 0, 'middle'], tr: [1, 0, 'end'], bl: [0, 1, 'start'], bc: [0.5, 1, 'middle'], br: [1, 1, 'end'] };
  const mirrorPos = p => p.replace('l', '#').replace('r', 'l').replace('#', 'r');
  // Items in display space: text { text, u, v, align, size, color, font, bold, margin, avoid } · rule { rule, v, … } · watermark
  L.stampItems = (i, total, S = L.state) => {
    const st = L.normStamps(S), out = [], even = i % 2 === 1, pid = S.pages[i]?.id;
    // hand-placed positions: pages[pageId] wins over all; mirrored on even pages when the stamp mirrors; a live drag previews
    const off = (key, cfg) => {
      const live = L.stampLive && L.stampLive.key === key && L.stampLive.pageId === pid ? L.stampLive : null;
      const n = (st.nudges || {})[key], o = live || (n && ((n.pages && n.pages[pid]) || n.all)) || { dx: 0, dy: 0 };
      return { key, dx: cfg?.pages?.mirror && even && !live ? -o.dx : o.dx, dy: o.dy, fit: !!cfg?.fit };
    };
    const n = st.numbers, numbered = n && n.on && L.ruleHits(n.pages, i, total);
    const numPos = numbered ? (n.pages?.mirror && even ? mirrorPos(n.pos) : n.pos) : null;
    if (numbered) { const [u, v, align] = POS[numPos]; out.push({ text: L.stampText(L.numberFormat(n), i, total, S), u, v, align, size: n.size, color: n.color, font: n.font, bold: n.bold, margin: n.margin ?? 28, ...off('numbers', n) }); }
    for (const kind of ['header', 'footer']) {
      const c = st[kind]; if (!c || !c.on || !L.ruleHits(c.pages, i, total)) continue;
      const v = kind === 'header' ? 0 : 1, edge = v ? 'b' : 't';
      const slots = { l: c.left, c: c.center, r: c.right };
      if (c.pages?.mirror && even) [slots.l, slots.r] = [slots.r, slots.l];
      let any = false;
      for (const [s, txt] of Object.entries(slots)) {
        if (!txt || !String(txt).trim()) continue;
        any = true;
        const [u, , align] = POS[edge + s];
        out.push({ text: L.stampText(txt, i, total, S), u, v, align, size: c.size, color: c.color, font: c.font, bold: c.bold, margin: c.margin ?? 28, avoid: numPos === edge + s ? n.size : 0, ...off(`${kind}:${s}`, c) });
      }
      if (c.rule && any) out.push({ rule: true, v, size: c.size, color: c.color, margin: c.margin ?? 28 });
    }
    const wm = st.watermark;
    if (wm && wm.on && wm.text && L.ruleHits(wm.pages, i, total)) out.push({ text: wm.text, u: 0.5, v: 0.5, align: 'middle', size: wm.size, color: wm.color, font: wm.font, opacity: wm.opacity, angle: wm.angle, watermark: true, bold: true, ...off('watermark', wm) });
    return out;
  };
  // Display-pixel geometry of an item for a view.
  L.stampGeom = (it, view) => {
    // "Scale with the page": sizes follow the page's short side (A4 = 1), so small and large pages look alike
    const f = it.fit ? L.clamp(Math.min(view.width, view.height) / view.scale / 595.28, 0.4, 3) : 1;
    const k = view.scale, m = (it.margin ?? 0) * k * f, s = it.size * k * f, ox = (it.dx || 0) * k, oy = (it.dy || 0) * k;
    if (it.rule) {
      const y = it.v === 0 ? m + s * 1.15 + 2 * k : view.height - m - s - 2 * k;
      return { x1: m, x2: view.width - m, y, w: 0.6 * k };
    }
    let x = it.u * view.width, y = it.v * view.height;
    if (!it.watermark) {
      if (it.u === 0) x += m; if (it.u === 1) x -= m;
      const lift = it.avoid ? it.avoid * k * f * 1.5 : 0;
      y = it.v === 0 ? m + s * 0.8 + lift : view.height - m - lift;
    }
    return { x: x + ox, y: y + oy, size: s };
  };
  // Boxes around each stamp on a page (display px) — for picking them up by hand.
  const measure = document.createElement('canvas').getContext('2d');
  L.stampBoxes = (page, view, S = L.state) => {
    const idx = L.pageIndex(page.id, S);
    return L.stampItems(idx, S.pages.length, S).filter(it => !it.rule).map(it => {
      const g = L.stampGeom(it, view);
      measure.font = `${it.bold ? 700 : 400} ${g.size}px ${(L.FONTS[it.font] || L.FONTS.Helvetica).css}`;
      const w = measure.measureText(it.text).width, hh = g.size;
      if (it.watermark) { const r = Math.max(w, hh) / 2; return { key: it.key, x: g.x - r * 0.75, y: g.y - r * 0.55, w: r * 1.5, h: r * 1.1, item: it }; }
      const x = it.align === 'middle' ? g.x - w / 2 : it.align === 'end' ? g.x - w : g.x;
      return { key: it.key, x, y: g.y - hh * 0.85, w, h: hh * 1.1, item: it };
    });
  };
  const cssFont = it => (L.FONTS[it.font] || L.FONTS.Helvetica).css;
  L.paintStamps = (ctx, page, view, S = L.state) => {
    const idx = L.pageIndex(page.id, S), items = L.stampItems(idx, S.pages.length, S);
    for (const it of items) {
      const g = L.stampGeom(it, view);
      ctx.save();
      if (it.rule) { ctx.strokeStyle = it.color || '#000'; ctx.lineWidth = g.w; ctx.beginPath(); ctx.moveTo(g.x1, g.y); ctx.lineTo(g.x2, g.y); ctx.stroke(); ctx.restore(); continue; }
      ctx.translate(g.x, g.y); if (it.angle) ctx.rotate(-it.angle * Math.PI / 180);
      ctx.globalAlpha = it.opacity ?? 1; ctx.fillStyle = it.color || '#000';
      ctx.font = `${it.bold ? 700 : 400} ${g.size}px ${cssFont(it)}`;
      ctx.textAlign = it.align === 'middle' ? 'center' : it.align === 'end' ? 'right' : 'left';
      ctx.textBaseline = it.watermark ? 'middle' : 'alphabetic';
      ctx.fillText(it.text, 0, 0); ctx.restore();
    }
  };
  L.stampsToSvg = (page, view) => {
    const idx = L.pageIndex(page.id), g = L.s('g', { 'pointer-events': 'none', class: 'stamps' });
    for (const it of L.stampItems(idx, L.state.pages.length)) {
      const p = L.stampGeom(it, view);
      if (it.rule) { g.append(L.s('line', { x1: p.x1, x2: p.x2, y1: p.y, y2: p.y, stroke: it.color || '#000', 'stroke-width': p.w })); continue; }
      g.append(L.s('text', {
        x: 0, y: 0, transform: `translate(${p.x},${p.y}) rotate(${-(it.angle || 0)})`, 'font-size': p.size, 'font-family': cssFont(it),
        'font-weight': it.bold ? 700 : 400, fill: it.color || '#000', 'fill-opacity': it.opacity ?? 1, 'text-anchor': it.align, 'dominant-baseline': it.watermark ? 'middle' : 'alphabetic',
      }, it.text));
    }
    return g;
  };
})();
