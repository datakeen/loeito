/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito build: turns the working document into real PDF bytes with pdf-lib, plus resize, compress and image/text export. */
(() => {
  const L = window.Loeito;
  const { PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFNumber, PDFRawStream, PDFArray, PDFDict, PDFRef, LineCapStyle, BlendMode } = PDFLib;
  const col = hex => rgb(...L.hexToRgb(hex || '#000000'));

  // Note: pdf-lib wraps a page's existing content in q … Q before the first drawing call,
  // so our marks always start from a clean graphics state.
  const dataUrlBytes = url => { const b64 = url.split(',')[1], bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

  async function drawAnnotations(doc, pg, page, font) {
    for (const a of page.ann) {
      if (a.r) {
        const { x, y, w, h } = a.r;
        if (a.type === 'ellipse') pg.drawEllipse({ x: x + w / 2, y: y + h / 2, xScale: w / 2, yScale: h / 2, borderColor: col(a.color), borderWidth: a.width });
        else if (a.type === 'rect') pg.drawRectangle({ x, y, width: w, height: h, borderColor: col(a.color), borderWidth: a.width });
        else if (a.type === 'highlight') pg.drawRectangle({ x, y, width: w, height: h, color: col(a.color), opacity: a.opacity ?? 0.4, blendMode: BlendMode.Multiply });
        else pg.drawRectangle({ x, y, width: w, height: h, color: a.type === 'redact' ? rgb(0, 0, 0) : col(a.color || '#ffffff') });
      } else if (a.type === 'ink') {
        if (a.pts.length < 2) continue;
        const d = a.pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${(-p[1]).toFixed(2)}`).join(' ');
        pg.drawSvgPath(d, { x: 0, y: 0, borderColor: col(a.color), borderWidth: a.width, borderOpacity: a.opacity ?? 1, borderLineCap: LineCapStyle.Round });
      } else if (a.p1) {
        const opt = { thickness: a.width, color: col(a.color), lineCap: LineCapStyle.Round };
        pg.drawLine({ start: { x: a.p1[0], y: a.p1[1] }, end: { x: a.p2[0], y: a.p2[1] }, ...opt });
        if (a.type === 'arrow') {
          const ang = Math.atan2(a.p2[1] - a.p1[1], a.p2[0] - a.p1[0]), len = Math.max(6, a.width * 4);
          for (const s of [-0.45, 0.45]) pg.drawLine({ start: { x: a.p2[0], y: a.p2[1] }, end: { x: a.p2[0] - len * Math.cos(ang + s), y: a.p2[1] - len * Math.sin(ang + s) }, ...opt });
        }
      } else if (a.type === 'text') {
        const { d } = L.annFrame(a);
        const f = await font(a.bold ? L.FONTS[a.font || 'Helvetica'].bold : L.FONTS[a.font || 'Helvetica'].pdf);
        const text = L.winAnsi(a.text); if (!text.trim()) continue;
        pg.drawText(text, { x: a.x + d[0] * a.size * 0.8, y: a.y + d[1] * a.size * 0.8, size: a.size, font: f, color: col(a.color), rotate: degrees(a.a || 0), lineHeight: a.size * 1.2 });
      } else if (a.type === 'image') {
        const { d } = L.annFrame(a);
        const bytes = dataUrlBytes(a.src);
        const img = a.src.startsWith('data:image/png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        pg.drawImage(img, { x: a.x + d[0] * a.h, y: a.y + d[1] * a.h, width: a.w, height: a.h, rotate: degrees(a.a || 0) });
      }
    }
  }

  // Invisible OCR text: selectable and searchable, never visible, layout untouched.
  function drawOcrLayer(pg, words, helv) {
    const P = PDFLib;
    const key = pg.node.newFontDictionary('LoeitoOCR', helv.ref);
    const ops = [P.pushGraphicsState(), P.beginText(), P.setTextRenderingMode(P.TextRenderingMode.Invisible)];
    for (const w of words) {
      const text = L.winAnsi(w.t).trim(); if (!text || !(w.h > 0)) continue;
      const natural = helv.widthOfTextAtSize(text + ' ', w.h);
      const squeeze = L.clamp((w.w * 1.04) / natural * 100, 10, 400);
      const r = w.a * Math.PI / 180;
      ops.push(P.setFontAndSize(key, w.h), P.setCharacterSqueeze(squeeze), P.rotateAndSkewTextRadiansAndTranslate(r, 0, 0, w.x, w.y), P.showText(helv.encodeText(text + ' ')));
    }
    ops.push(P.endText(), P.popGraphicsState());
    pg.pushOperators(...ops);
  }

  async function drawStamps(pg, page, idx, total, view, font, S) {
    const items = L.stampItems(idx, total, S); if (!items.length) return;
    const upright = view.uprightAngle();
    for (const it of items) {
      if (it.rule) {
        const g = L.stampGeom(it, view), a = view.toPdf([g.x1, g.y]), b = view.toPdf([g.x2, g.y]);
        pg.drawLine({ start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, thickness: 0.6, color: col(it.color) });
        continue;
      }
      const fam = L.FONTS[it.font] || L.FONTS.Helvetica;
      const f = await font(it.bold ? fam.bold : fam.pdf), text = L.winAnsi(it.text); if (!text) continue;
      const g = L.stampGeom(it, view), tw = f.widthOfTextAtSize(text, g.size);
      const th = (it.angle || 0) * Math.PI / 180, dir = [Math.cos(th), -Math.sin(th)], down = [Math.sin(th), Math.cos(th)];
      const shift = it.align === 'middle' ? -tw / 2 : it.align === 'end' ? -tw : 0, vs = it.watermark ? g.size * 0.35 : 0;
      const pt = view.toPdf([g.x + dir[0] * shift + down[0] * vs, g.y + dir[1] * shift + down[1] * vs]);
      pg.drawText(text, { x: pt[0], y: pt[1], size: g.size, font: f, color: col(it.color), opacity: it.opacity ?? 1, rotate: degrees(upright + (it.angle || 0)) });
    }
  }

  // A flattened page: the picture of the page, plus — so it stays searchable — the words that were NOT blacked out.
  async function rasterPage(out, page, S, dpi = 200, helv = null) {
    const proxy = await L.proxy(page); const v = L.makeView(proxy, page, 1);
    const c = document.createElement('canvas');
    await L.renderInto(c, page, dpi / 72, { dpr: 1, stamps: true, intent: 'print', state: S });
    const jpg = await new Promise(r => c.toBlob(b => b.arrayBuffer().then(r), 'image/jpeg', 0.9));
    const img = await out.embedJpg(jpg);
    const pg = out.addPage([v.width, v.height]);
    pg.drawImage(img, { x: 0, y: 0, width: v.width, height: v.height });
    if (!helv) return;
    const boxes = page.ann.filter(a => a.type === 'redact').map(a => v.rectToScreen(a.r));
    // a page flattened for hidden layers only keeps OCR words (read from the visible picture), never the PDF's own text
    const words = boxes.length ? await L.pageWords(page).catch(() => []) : page.ocr?.words || [];
    const hits = (b, r) => b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y;
    const keep = [];
    for (const w of words) {
      const b = L.wordBox(w, v);
      if (boxes.some(r => hits(b, r))) continue;
      const hh = b.h / 1.02;
      keep.push({ t: w.t, x: b.x, y: v.height - b.y - b.h + hh * 0.22, w: b.w, h: hh, a: 0 });
    }
    if (keep.length) drawOcrLayer(pg, keep, helv);
  }

  /* Build the document. opts: { state, pages, ocrLayer, pageSize, compress, flattenForm, task } — bound to `state` (default: active tab). */
  L.buildPdf = async (opts = {}) => {
    const S = opts.state || L.state;
    const pages = opts.pages || S.pages, total = S.pages.length;
    const out = await PDFDocument.create(), formItems = [];
    if (L.forms) L.forms.recalc(S); // totals up to date
    const loaded = new Map(), fonts = new Map();
    const font = async name => { if (!fonts.has(name)) fonts.set(name, await out.embedFont(StandardFonts[name])); return fonts.get(name); };
    const stampFonts = { reg: await font('Helvetica'), bold: await font('HelveticaBold') };
    const load = async id => {
      if (!loaded.has(id)) {
        try {
          const src = L.sources[id];
          // a password-protected original is unlocked first (with the password it was opened with), so its pages can be rebuilt
          if (src.encrypted && !src.plain) src.plain = await L.pdfCrypt(src.bytes, { password: src.password || '' });
          loaded.set(id, await PDFDocument.load(src.plain || src.bytes, { ignoreEncryption: true, updateMetadata: false }));
        }
        catch (e) { throw new Error(`Couldn’t read “${L.sources[id].name}”: ${e.message}`); }
      }
      return loaded.get(id);
    };
    const flat = page => page.flatten || page.ann.some(a => a.type === 'redact');
    // Copy each source's pages in one go, so fonts and images they share are written once (not once per page).
    const batch = new Map(), want = new Map();
    for (const p of pages) if (!flat(p)) { if (!want.has(p.src)) want.set(p.src, new Set()); want.get(p.src).add(p.index); }
    for (const [id, set] of want) { const idxs = [...set], cps = await out.copyPages(await load(id), idxs); idxs.forEach((ix, k) => batch.set(`${id}:${ix}`, cps[k])); }
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (opts.task) { if (opts.task.canceled) throw new Error('Canceled'); opts.task.set(i / pages.length, `Page ${i + 1} of ${pages.length}`); }
      const idx = L.pageIndex(page.id, S);
      if (flat(page)) { await rasterPage(out, page, S, 200, opts.ocrLayer !== false ? stampFonts.reg : null); continue; } // burn redactions in for real
      const key = `${page.src}:${page.index}`;
      let pg = batch.get(key); batch.delete(key);
      if (!pg) [pg] = await out.copyPages(await load(page.src), [page.index]); // the same page used twice
      out.addPage(pg);
      const proxy = await L.proxy(page);
      pg.setRotation(degrees(L.totalRotation(proxy, page)));
      if (page.crop) { const c = page.crop; pg.setCropBox(c.x, c.y, c.w, c.h); pg.setTrimBox(c.x, c.y, c.w, c.h); }
      // a page copied from a fillable PDF brings orphan widgets: its fields live in page.fields and are rebuilt below
      if (L.sources[page.src].hasForm && L.forms) L.forms.stripWidgets(pg);
      if (page.fields && page.fields.length) formItems.push({ pg, page, rotation: L.totalRotation(proxy, page) });
      const needsDraw = page.ann.length || (opts.ocrLayer !== false && page.ocr?.words?.length) || L.stampItems(idx, total, S).length;
      if (!needsDraw) continue;
      if (opts.ocrLayer !== false && page.ocr?.words?.length) drawOcrLayer(pg, page.ocr.words, stampFonts.reg);
      await drawAnnotations(out, pg, page, font);
      await drawStamps(pg, page, idx, total, L.makeView(proxy, page, 1), font, S);
    }
    // fillable form fields (flattened when asked to, or when the paper size is changed — re-flowing pages drops widgets)
    if (formItems.length) await L.forms.build(out, formItems, { flatten: !!opts.flattenForm || !!opts.pageSize, script: S.formScript || '', S });
    const m = S.meta;
    out.setTitle(m.title || S.name || ''); out.setAuthor(m.author || ''); out.setSubject(m.subject || '');
    out.setKeywords((m.keywords || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean));
    out.setProducer('Loeito PDF'); out.setCreator(m.creator || 'Loeito PDF');
    if (m.created) { const d = new Date(m.created); if (!isNaN(d)) out.setCreationDate(d); }
    out.setModificationDate(new Date());
    if (m.lang) out.catalog.set(PDFName.of('Lang'), PDFLib.PDFString.of(m.lang));
    if (m.displayTitle) out.catalog.getOrCreateViewerPreferences().setDisplayDocTitle(true);
    const infoDict = out.getInfoDict();
    for (const c of m.custom || []) { const k = String(c.k || '').replace(/[^A-Za-z0-9_-]/g, ''); if (k && !/^(Title|Author|Subject|Keywords|Creator|Producer|CreationDate|ModDate|Trapped)$/.test(k)) infoDict.set(PDFName.of(k), PDFLib.PDFHexString.fromText(String(c.v || ''))); }
    let bytes = await out.save({ useObjectStreams: true });
    if (opts.pageSize) bytes = await L.resizePdf(bytes, opts.pageSize);
    if (opts.compress) bytes = (await L.compressPdf(bytes, opts.compress, opts.task)).bytes;
    if (opts.sanitize) { const r = await L.sanitizePdf(bytes, opts.sanitize, S); bytes = r.bytes; L.lastClean = r.removed; }
    // { open, owner, allow[] } → AES-256. A file that was protected stays protected (same open password) unless the password was removed.
    const locked = S.security === undefined && S.pages.map(p => L.sources[p.src]).find(x => x && x.encrypted && x.password);
    const sec = opts.security !== undefined ? opts.security : S.security !== undefined ? S.security : locked ? { open: locked.password, owner: '', allow: ['print', 'copy', 'forms', 'edit'] } : null;
    if (sec && (sec.open || sec.owner)) bytes = await L.pdfCrypt(bytes, { encrypt: true, open: sec.open, owner: sec.owner, allow: sec.allow || [] });
    return bytes;
  };

  /* ——— Hidden data ———
     What a careful sender removes before sharing. Removing a reference is not enough — pdf-lib writes every object it
     holds — so unreachable objects are dropped too (the old data really leaves the file). */
  L.cleanDefaults = () => ({ details: true, comments: true, attachments: true, scripts: true, links: false, private: true, thumbs: true });
  const isJs = a => a instanceof PDFDict && nameOf(a.get(PDFName.of('S'))) === '/JavaScript';
  function dropUnreachable(doc) {
    const ctx = doc.context, seen = new Set(), todo = [ctx.trailerInfo.Root, ctx.trailerInfo.Info, ctx.trailerInfo.Encrypt].filter(Boolean);
    while (todo.length) {
      const v = todo.pop();
      if (v instanceof PDFRef) { const k = v.toString(); if (seen.has(k)) continue; seen.add(k); const o = ctx.lookup(v); if (o) todo.push(o); }
      else if (v instanceof PDFDict) for (const [, x] of v.entries()) todo.push(x);
      else if (v instanceof PDFArray) for (let i = 0; i < v.size(); i++) todo.push(v.get(i));
      else if (v && v.dict instanceof PDFDict) todo.push(v.dict);
    }
    let n = 0;
    for (const [ref] of ctx.enumerateIndirectObjects()) if (!seen.has(ref.toString())) { ctx.delete(ref); n++; }
    return n;
  }
  L.sanitizePdf = async (bytes, o, S = L.state) => {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const ctx = doc.context, N = PDFName.of, look = v => (v instanceof PDFRef ? ctx.lookup(v) : v), cat = doc.catalog;
    const removed = {}, add = (k, n = 1) => { if (n) removed[k] = (removed[k] || 0) + n; };
    const COMMENTS = new Set(['/Text', '/FreeText', '/Highlight', '/Underline', '/StrikeOut', '/Squiggly', '/Ink', '/Stamp', '/Square', '/Circle', '/Line', '/Polygon', '/PolyLine', '/Caret', '/Popup', '/Sound', '/Redact']);
    if (o.details) {
      const keep = o.keepTitle !== false && S.meta?.title ? S.meta.title : '';
      ctx.trailerInfo.Info = ctx.register(ctx.obj({ Title: PDFLib.PDFHexString.fromText(keep), Producer: PDFLib.PDFHexString.fromText('Loeito PDF') }));
      if (cat.get(N('Metadata'))) { cat.delete(N('Metadata')); add('details'); }
      add('details');
    }
    const names = look(cat.get(N('Names')));
    if (o.scripts) {
      if (names instanceof PDFDict && names.get(N('JavaScript'))) { names.delete(N('JavaScript')); add('scripts'); }
      if (isJs(look(cat.get(N('OpenAction'))))) { cat.delete(N('OpenAction')); add('scripts'); }
      if (cat.get(N('AA'))) { cat.delete(N('AA')); add('scripts'); }
    }
    if (o.attachments) {
      if (names instanceof PDFDict && names.get(N('EmbeddedFiles'))) { names.delete(N('EmbeddedFiles')); add('attachments'); }
      if (cat.get(N('Collection'))) cat.delete(N('Collection'));
    }
    if (o.private && cat.get(N('PieceInfo'))) { cat.delete(N('PieceInfo')); add('private'); }
    for (const pg of doc.getPages()) {
      const node = pg.node;
      if (o.private) for (const k of ['PieceInfo', 'LastModified']) if (node.get(N(k))) { node.delete(N(k)); add('private'); }
      if (o.details && node.get(N('Metadata'))) { node.delete(N('Metadata')); add('details'); }
      if (o.thumbs && node.get(N('Thumb'))) { node.delete(N('Thumb')); add('thumbs'); }
      if (o.scripts && node.get(N('AA'))) { node.delete(N('AA')); add('scripts'); }
      const annots = look(node.get(N('Annots')));
      if (!(annots instanceof PDFArray)) continue;
      const kept = [];
      for (let i = 0; i < annots.size(); i++) {
        const ref = annots.get(i), a = look(ref); if (!(a instanceof PDFDict)) continue;
        const sub = nameOf(a.get(N('Subtype')));
        if (o.comments && COMMENTS.has(sub)) { if (sub !== '/Popup') add('comments'); continue; }
        if (o.attachments && sub === '/FileAttachment') { add('attachments'); continue; }
        if (sub === '/Link') {
          const act = look(a.get(N('A')));
          if (o.links && act instanceof PDFDict && nameOf(act.get(N('S'))) === '/URI') { add('links'); continue; }
          if (o.scripts && isJs(act)) { a.delete(N('A')); add('scripts'); }
        }
        kept.push(ref);
      }
      if (kept.length !== annots.size()) { if (kept.length) node.set(N('Annots'), ctx.obj(kept)); else node.delete(N('Annots')); }
    }
    add('unused', dropUnreachable(doc));
    return { bytes: await doc.save({ useObjectStreams: true }), removed };
  };

  /* ——— Page size: re-flow each page onto a standard sheet, scaled to fit ——— */
  L.PAPER = { A3: [841.89, 1190.55], A4: [595.28, 841.89], A5: [419.53, 595.28], Letter: [612, 792], Legal: [612, 1008], Tabloid: [792, 1224] };
  L.resizePdf = async (bytes, { w, h, margin = 0, orient = 'auto' }) => {
    const src = await PDFDocument.load(bytes), out = await PDFDocument.create();
    out.setTitle(src.getTitle() || ''); out.setAuthor(src.getAuthor() || ''); out.setProducer('Loeito PDF');
    for (const p of src.getPages()) {
      const rot = ((p.getRotation().angle % 360) + 360) % 360, cb = p.getCropBox();
      const emb = await out.embedPage(p, { left: cb.x, bottom: cb.y, right: cb.x + cb.width, top: cb.y + cb.height });
      const dw = rot % 180 ? cb.height : cb.width, dh = rot % 180 ? cb.width : cb.height;
      let W = w, H = h;
      if (orient === 'auto' ? (dw > dh) !== (W > H) : (orient === 'landscape') !== (W > H)) [W, H] = [H, W];
      const s = Math.min((W - 2 * margin) / dw, (H - 2 * margin) / dh);
      const t = -rot * Math.PI / 180, cw = cb.width * s, ch = cb.height * s;
      const corners = [[0, 0], [cw, 0], [0, ch], [cw, ch]].map(([x, y]) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)]);
      const minX = Math.min(...corners.map(c => c[0])), minY = Math.min(...corners.map(c => c[1]));
      const np = out.addPage([W, H]);
      np.drawPage(emb, { x: (W - dw * s) / 2 - minX, y: (H - dh * s) / 2 - minY, xScale: s, yScale: s, rotate: degrees(-rot) });
    }
    return out.save({ useObjectStreams: true });
  };

  /* ——— Compression: recompress photographic images, strip extras, pack objects ——— */
  async function inflate(u8) {
    const ds = new DecompressionStream('deflate');
    const buf = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }
  const nameOf = v => (v instanceof PDFName ? v.asString() : v instanceof PDFArray && v.size() === 1 && v.get(0) instanceof PDFName ? v.get(0).asString() : null);
  L.compressPdf = async (bytes, { quality = 0.72, maxDpi = 150, gray = false, strip = false } = {}, task) => {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const ctx = doc.context, stats = { images: 0, recompressed: 0, skipped: 0, before: bytes.length };
    const lookup = v => (v instanceof PDFRef ? ctx.lookup(v) : v);
    const smasks = new Set();
    const objs = ctx.enumerateIndirectObjects();
    for (const [, o] of objs) if (o instanceof PDFRawStream) { const sm = o.dict.get(PDFName.of('SMask')); if (sm instanceof PDFRef) smasks.add(sm.toString()); }
    let maxSide = 842; for (const p of doc.getPages()) { const { width, height } = p.getSize(); maxSide = Math.max(maxSide, width, height); }
    const maxPx = Math.round(maxSide / 72 * maxDpi);
    const imgs = objs.filter(([, o]) => o instanceof PDFRawStream && nameOf(o.dict.get(PDFName.of('Subtype'))) === '/Image');
    for (let n = 0; n < imgs.length; n++) {
      const [ref, o] = imgs[n]; const d = o.dict; stats.images++;
      task && task.set(0.5 + 0.5 * n / imgs.length, `Image ${n + 1} of ${imgs.length}`);
      try {
        if (smasks.has(ref.toString()) || d.get(PDFName.of('ImageMask'))) { stats.skipped++; continue; }
        const filter = nameOf(d.get(PDFName.of('Filter'))), W = lookup(d.get(PDFName.of('Width')))?.asNumber(), H = lookup(d.get(PDFName.of('Height')))?.asNumber();
        const bpc = lookup(d.get(PDFName.of('BitsPerComponent')))?.asNumber();
        let cs = lookup(d.get(PDFName.of('ColorSpace'))), comps = null;
        if (cs instanceof PDFName) comps = { '/DeviceRGB': 3, '/DeviceGray': 1 }[cs.asString()] || null;
        else if (cs instanceof PDFArray && nameOf(cs.get(0)) === '/ICCBased') { const icc = lookup(cs.get(1)); const nn = icc && lookup(icc.dict.get(PDFName.of('N'))); comps = nn && [1, 3].includes(nn.asNumber()) ? nn.asNumber() : null; }
        if (!comps || !W || !H || W * H < 40000) { stats.skipped++; continue; }
        let bmp;
        if (filter === '/DCTDecode') bmp = await createImageBitmap(new Blob([o.contents], { type: 'image/jpeg' }));
        else if (filter === '/FlateDecode' && bpc === 8 && !d.get(PDFName.of('DecodeParms'))) {
          const raw = await inflate(o.contents); if (raw.length < W * H * comps) { stats.skipped++; continue; }
          const id = new ImageData(W, H), px = id.data;
          for (let i = 0, j = 0; i < W * H; i++, j += comps) { const r = raw[j], g = comps === 3 ? raw[j + 1] : r, b = comps === 3 ? raw[j + 2] : r; px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255; }
          bmp = await createImageBitmap(id);
        } else { stats.skipped++; continue; }
        const k = Math.min(1, maxPx / Math.max(W, H)), nw = Math.max(1, Math.round(W * k)), nh = Math.max(1, Math.round(H * k));
        const c = document.createElement('canvas'); c.width = nw; c.height = nh;
        const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(bmp, 0, 0, nw, nh);
        if (gray || comps === 1) { const id = cx.getImageData(0, 0, nw, nh), p = id.data; for (let i = 0; i < p.length; i += 4) { const y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = y; } cx.putImageData(id, 0, 0); }
        const jpg = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', quality))).arrayBuffer());
        if (jpg.length >= o.contents.length * 0.92) { stats.skipped++; continue; }
        const nd = ctx.obj({ Type: 'XObject', Subtype: 'Image', Width: nw, Height: nh, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode', Length: jpg.length });
        const sm = d.get(PDFName.of('SMask')); if (sm) nd.set(PDFName.of('SMask'), sm);
        const intent = d.get(PDFName.of('Interpolate')); if (intent) nd.set(PDFName.of('Interpolate'), intent);
        ctx.assign(ref, PDFRawStream.of(nd, jpg));
        stats.recompressed++;
      } catch (e) { console.warn('image skipped', e); stats.skipped++; }
    }
    if (strip) {
      doc.catalog.delete(PDFName.of('Metadata'));
      for (const p of doc.getPages()) { p.node.delete(PDFName.of('Thumb')); p.node.delete(PDFName.of('PieceInfo')); }
      doc.catalog.delete(PDFName.of('PieceInfo'));
      doc.setKeywords([]); doc.setSubject(''); doc.setCreator('Loeito PDF');
    }
    doc.setProducer('Loeito PDF');
    // Copying pages into a fresh document drops orphaned objects (old revisions, unused fonts/images) — but it would
    // also drop a fillable form's field list, so forms are saved in place.
    if (doc.catalog.get(PDFName.of('AcroForm'))) {
      let b = await doc.save({ useObjectStreams: true, updateFieldAppearances: false });
      if (b.length > bytes.length) b = bytes;
      stats.after = b.length; return { bytes: b, stats };
    }
    const fresh = await PDFDocument.create();
    const copied = await fresh.copyPages(doc, doc.getPageIndices());
    copied.forEach(p => fresh.addPage(p));
    fresh.setTitle(doc.getTitle() || ''); fresh.setAuthor(doc.getAuthor() || ''); if (!strip) { fresh.setSubject(doc.getSubject() || ''); fresh.setKeywords([doc.getKeywords() || '']); }
    fresh.setProducer('Loeito PDF'); fresh.setCreator('Loeito PDF');
    let outBytes = await fresh.save({ useObjectStreams: true });
    if (outBytes.length > bytes.length) outBytes = bytes; // never make it bigger
    stats.after = outBytes.length;
    return { bytes: outBytes, stats };
  };

  /* ——— Space audit: what the bytes of the original file are spent on ——— */
  L.spaceAudit = async (S = L.state) => {
    const N = PDFName.of, cats = { images: 0, fonts: 0, content: 0, meta: 0, attachments: 0, structure: 0, other: 0 };
    const images = [], fonts = []; let total = 0, pages = 0;
    for (const id of [...new Set(S.pages.map(p => p.src))]) {
      const bytes = L.sources[id].bytes; total += bytes.length;
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      const ctx = doc.context, look = v => (v instanceof PDFRef ? ctx.lookup(v) : v), objs = ctx.enumerateIndirectObjects();
      const contents = new Set(), fontFiles = new Map();
      let pageW = 0;
      for (const pg of doc.getPages()) {
        pages++; pageW = Math.max(pageW, pg.getWidth());
        const c = pg.node.get(N('Contents')), cl = look(c); // a stream, an array of streams, or a reference to such an array
        if (cl instanceof PDFArray) for (let i = 0; i < cl.size(); i++) contents.add(String(cl.get(i)));
        else if (c instanceof PDFRef) contents.add(c.toString());
      }
      // font programs hang off font descriptors, which may sit directly inside font dictionaries
      const scan = (d, depth) => {
        if (!(d instanceof PDFDict) || depth > 3) return;
        for (const k of ['FontFile', 'FontFile2', 'FontFile3']) { const r = d.get(N(k)); if (r instanceof PDFRef) fontFiles.set(r.toString(), (nameOf(d.get(N('FontName'))) || '/Font').slice(1)); }
        for (const [, v] of d.entries()) { if (v instanceof PDFDict) scan(v, depth + 1); else if (v instanceof PDFArray) for (let i = 0; i < v.size(); i++) { const x = v.get(i); if (x instanceof PDFDict) scan(x, depth + 1); } }
      };
      for (const [, o] of objs) scan(o instanceof PDFDict ? o : null, 0);
      for (const [ref, o] of objs) {
        const key = ref.toString();
        if (!(o && o.dict instanceof PDFDict && o.contents)) { cats.structure += o && o.sizeInBytes ? o.sizeInBytes() + 16 : 24; continue; }
        const size = o.contents.length + o.dict.sizeInBytes() + 24, d = o.dict;
        const sub = nameOf(d.get(N('Subtype'))), type = nameOf(d.get(N('Type')));
        if (sub === '/Image') {
          cats.images += size;
          const w = look(d.get(N('Width')))?.asNumber?.() || 0, hh = look(d.get(N('Height')))?.asNumber?.() || 0, cs = look(d.get(N('ColorSpace')));
          const csName = nameOf(cs) || (cs instanceof PDFArray ? nameOf(cs.get(0)) : '') || (d.get(N('ImageMask')) ? 'mask' : '');
          images.push({ size, w, h: hh, filter: (nameOf(d.get(N('Filter'))) || 'raw').slice(1), cs: (csName || '').replace(/^\/(Device)?/, ''), ppi: pageW ? Math.round(w / (pageW / 72)) : 0, mask: !!d.get(N('ImageMask')) });
        } else if (fontFiles.has(key)) { const name = fontFiles.get(key); cats.fonts += size; fonts.push({ name: name.replace(/^[A-Z]{6}\+/, ''), size, subset: /^[A-Z]{6}\+/.test(name) }); }
        else if (contents.has(key) || sub === '/Form') cats.content += size;
        else if (sub === '/XML' || type === '/Metadata') cats.meta += size;
        else if (type === '/EmbeddedFile') cats.attachments += size;
        else if (type === '/XRef' || type === '/ObjStm') cats.structure += size;
        else cats.other += size; // color profiles, character maps, thumbnails…
      }
    }
    // what the counting can't see (cross-reference tables, compression of object streams) is file structure too
    const counted = Object.values(cats).reduce((a, b) => a + b, 0);
    if (counted < total) cats.structure += total - counted;
    const scale = counted > total ? total / counted : 1; // object streams are counted unpacked; scale back to the real size
    for (const k in cats) cats[k] = Math.round(cats[k] * scale);
    return { total, pages, cats, images: images.sort((a, b) => b.size - a.size), fonts: fonts.sort((a, b) => b.size - a.size) };
  };

  /* ——— Images & text ——— */
  L.renderPageImage = async (page, dpi, fmt = 'png', q = 0.9, S = L.state) => {
    const c = document.createElement('canvas');
    await L.renderInto(c, page, dpi / 72, { dpr: 1, stamps: true, intent: 'print', state: S });
    return new Promise(r => c.toBlob(r, fmt === 'jpg' ? 'image/jpeg' : 'image/png', q));
  };
  L.zipAndSave = async (files, zipName) => {
    if (files.length === 1) return L.saveFile(files[0].data, files[0].name, files[0].mime || 'application/octet-stream', files[0].name.split('.').pop());
    await L.loadScript(L.LIBS.jszip);
    const zip = new JSZip(); files.forEach(f => zip.file(f.name, f.data));
    const blob = await zip.generateAsync({ type: 'blob' });
    return L.saveFile(blob, zipName, 'application/zip', 'zip');
  };
  L.documentText = async (pages = L.state.pages, S = L.state) => {
    const parts = [];
    for (const p of pages) parts.push(`——— Page ${L.pageIndex(p.id, S) + 1} ———\n` + (await L.pageText(p)));
    return parts.join('\n\n');
  };
})();
