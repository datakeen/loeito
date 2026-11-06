/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito forms core: field model, painting, live calculation & validation, reading existing PDF forms,
   and writing real (AcroForm) fields into the saved PDF.
   A field lives on page.fields[] with its rectangle in PDF user space: { x, y, w, h }. */
(() => {
  const L = window.Loeito;
  const F = (L.forms = {});

  F.KINDS = {
    text: { label: 'Text', icon: 'type', size: [170, 18] },
    para: { label: 'Paragraph', icon: 'text', size: [240, 64] },
    check: { label: 'Checkbox', icon: 'check', size: [12, 12] },
    radio: { label: 'Choice', icon: 'radio', size: [12, 12] },
    dropdown: { label: 'Dropdown', icon: 'down', size: [150, 18] },
    list: { label: 'List', icon: 'list', size: [150, 60] },
    sign: { label: 'Signature', icon: 'signature', size: [170, 42] },
    button: { label: 'Button', icon: 'cursor', size: [90, 22] },
  };
  F.FORMATS = [
    { value: 'none', label: 'Any text' }, { value: 'number', label: 'Number' }, { value: 'currency', label: 'Money' },
    { value: 'percent', label: 'Percent' }, { value: 'date', label: 'Date' }, { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' }, { value: 'cnic', label: 'CNIC (#####-#######-#)' }, { value: 'mask', label: 'Pattern…' },
  ];
  F.numeric = f => ['number', 'currency', 'percent'].includes(f.format);
  F.make = (kind, r, extra = {}) => ({
    id: L.uid('f'), kind, name: '', r, value: kind === 'check' ? false : '', tip: '', required: false, readOnly: false,
    fontSize: 0, align: 'left', format: 'none', decimals: 2, currency: 'Rs', dateFmt: 'dd/mm/yyyy', mask: '', maxLen: 0, comb: false,
    options: kind === 'dropdown' || kind === 'list' ? ['Option 1', 'Option 2', 'Option 3'] : [], editable: false, multi: false,
    group: '', exportValue: '', calc: null, action: 'reset', caption: kind === 'button' ? 'Reset form' : '', style: 'box', ...extra,
  });
  F.all = (S = L.state) => S.pages.flatMap((p, pi) => (p.fields || []).map(f => ({ f, page: p, pi })));
  F.names = (S = L.state) => new Set(F.all(S).map(x => x.f.name));
  F.uniqueName = (base, S = L.state, except) => {
    base = String(base || 'Field').replace(/[.\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Field';
    const used = new Set(F.all(S).filter(x => x.f !== except && x.f.kind !== 'radio').map(x => x.f.name));
    if (!used.has(base)) return base;
    let n = 2; while (used.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  };

  /* ——— values, formats, validation, totals ——— */
  F.toNumber = v => { const n = parseFloat(String(v ?? '').replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : null; };
  F.display = f => {
    if (f.kind === 'check') return f.value ? '✓' : '';
    const v = f.value; if (v === '' || v == null) return '';
    if (F.numeric(f)) {
      const n = F.toNumber(v); if (n == null) return String(v);
      const s = n.toLocaleString('en-US', { minimumFractionDigits: f.format === 'number' && !f.decimals ? 0 : f.decimals, maximumFractionDigits: f.decimals });
      return f.format === 'currency' ? `${f.currency} ${s}` : f.format === 'percent' ? `${s}%` : s;
    }
    return String(v);
  };
  const RX = { email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, phone: /^\+?[0-9 ()\-]{7,20}$/, cnic: /^\d{5}-\d{7}-\d$/ };
  /* ——— Dates: read and write them in the field's own style (dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, dd-mmm-yyyy) ——— */
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  F.parseDate = (str, fmt = 'dd/mm/yyyy') => {
    const order = fmt.toLowerCase().match(/dd|mmm|mm|yyyy/g) || [], parts = String(str).trim().split(/[\/.\- ]+/);
    if (parts.length !== order.length) return null;
    let d, m, y;
    order.forEach((t, i) => { const p = parts[i]; if (t === 'dd') d = +p; else if (t === 'mm') m = +p; else if (t === 'mmm') m = MON.indexOf(p.slice(0, 3).toLowerCase()) + 1; else y = +p; });
    if (!(y >= 1800 && y <= 2200) || !(m >= 1 && m <= 12) || !(d >= 1)) return null;
    const dt = new Date(y, m - 1, d);
    return dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null; // rejects 31/02 and 23/76
  };
  F.formatDate = (dt, fmt = 'dd/mm/yyyy') => fmt.toLowerCase()
    .replace('yyyy', dt.getFullYear()).replace('mmm', MON[dt.getMonth()].replace(/^./, c => c.toUpperCase()))
    .replace('mm', String(dt.getMonth() + 1).padStart(2, '0')).replace('dd', String(dt.getDate()).padStart(2, '0'));
  F.problem = f => {
    const v = f.value;
    if (f.kind === 'check' || f.kind === 'button' || f.kind === 'sign') return null;
    if (f.required && (v === '' || v == null)) return 'Required';
    if (v === '' || v == null) return null;
    if (F.numeric(f) && F.toNumber(v) == null) return 'Numbers only';
    if (f.format === 'date' && !F.parseDate(v, f.dateFmt)) return `Not a real date — write it as ${f.dateFmt}`;
    if (RX[f.format] && !RX[f.format].test(String(v).trim())) return { email: 'Not an email address', phone: 'Not a phone number', cnic: 'Use #####-#######-#' }[f.format];
    if (f.format === 'mask' && f.mask && String(v).length !== f.mask.length) return `Use the pattern ${f.mask}`;
    return null;
  };
  // Typing helpers for patterns: 9 = digit, A = letter, X = anything (Acrobat-compatible masks)
  F.maskOf = f => (f.format === 'cnic' ? '99999-9999999-9' : f.format === 'mask' ? f.mask : '');
  F.applyMask = (mask, raw) => {
    if (!mask) return raw;
    const chars = String(raw).replace(/[^0-9A-Za-z]/g, '').split(''); let out = '';
    for (const m of mask) {
      if (!chars.length) break;
      if (m === '9') { const i = chars.findIndex(c => /\d/.test(c)); if (i < 0) break; out += chars.splice(0, i + 1).pop(); }
      else if (m === 'A') { const i = chars.findIndex(c => /[A-Za-z]/.test(c)); if (i < 0) break; out += chars.splice(0, i + 1).pop(); }
      else if (m === 'X' || m === '*') out += chars.shift();
      else out += m;
    }
    return out;
  };
  // Recompute every calculated field (in tab order) — mirrors what Acrobat does with the saved form.
  F.recalc = (S = L.state) => {
    const list = F.all(S), byName = new Map();
    for (const x of list) if (!byName.has(x.f.name)) byName.set(x.f.name, x.f);
    let changed = false;
    for (const { f } of list) {
      if (!f.calc || !f.calc.of || !f.calc.of.length) continue;
      const nums = f.calc.of.map(n => byName.get(n)).filter(Boolean).map(g => F.toNumber(g.value)).filter(n => n != null);
      const op = f.calc.op;
      let r = '';
      if (nums.length) r = op === 'SUM' ? nums.reduce((a, b) => a + b, 0) : op === 'PRD' ? nums.reduce((a, b) => a * b, 1) : op === 'AVG' ? nums.reduce((a, b) => a + b, 0) / nums.length : op === 'MIN' ? Math.min(...nums) : Math.max(...nums);
      if (r !== '') r = +r.toFixed(Math.max(2, f.decimals || 0));
      if (f.value !== r) { f.value = r; changed = true; }
    }
    return changed;
  };

  /* ——— painting ——— */
  const BLUE = '#0a84ff';
  F.toSvg = (f, view, { design = false, selected = false, suggestion = false } = {}) => {
    const s = L.s, b = view.rectToScreen(f.r), g = s('g', { 'data-fid': f.id || '' });
    const stroke = suggestion ? '#8e4ec6' : selected ? BLUE : 'rgba(10,132,255,.55)';
    const fill = suggestion ? 'rgba(142,78,198,.10)' : f.style === 'plain' && !design ? 'rgba(10,132,255,.05)' : 'rgba(10,132,255,.09)';
    const dash = suggestion ? '4 3' : '';
    if (f.kind === 'radio') g.append(s('ellipse', { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2, ry: b.h / 2, fill, stroke, 'stroke-width': selected ? 1.6 : 1, 'stroke-dasharray': dash }));
    else g.append(s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: f.kind === 'button' ? 4 : 1.5, fill: f.kind === 'button' ? 'rgba(10,132,255,.16)' : fill, stroke, 'stroke-width': selected ? 1.6 : 1, 'stroke-dasharray': dash }));
    const k = view.scale, fs = Math.min(b.h * 0.72, (f.fontSize || 10) * k, 14 * k);
    if (f.kind === 'check' && f.value) g.append(s('path', { d: `M${b.x + b.w * 0.2} ${b.y + b.h * 0.55}l${b.w * 0.22} ${b.h * 0.22} ${b.w * 0.38} -${b.h * 0.5}`, fill: 'none', stroke: '#1d1d1f', 'stroke-width': Math.max(1.2, b.w * 0.12), 'stroke-linecap': 'round' }));
    else if (f.kind === 'radio' && f.value && f.value === f.exportValue) g.append(s('circle', { cx: b.x + b.w / 2, cy: b.y + b.h / 2, r: Math.min(b.w, b.h) * 0.25, fill: '#1d1d1f' }));
    else if (f.kind === 'button') g.append(s('text', { x: b.x + b.w / 2, y: b.y + b.h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': fs, 'font-weight': 600, fill: BLUE }, f.caption || 'Button'));
    else if (f.kind === 'sign' && !f.value) g.append(s('text', { x: b.x + 6, y: b.y + b.h - 6, 'font-size': Math.min(fs, 11 * k), fill: 'rgba(10,132,255,.8)' }, '✎ Sign here'));
    else {
      const txt = F.display(f);
      if (txt) {
        const lines = f.kind === 'para' || f.kind === 'list' ? String(txt).split('\n') : [String(txt)];
        const t = s('text', { 'font-size': fs, fill: '#1d1d1f', 'font-family': 'Helvetica, Arial, sans-serif' });
        lines.slice(0, Math.max(1, Math.floor(b.h / (fs * 1.2)))).forEach((ln, i) => t.append(s('tspan', { x: f.align === 'center' ? b.x + b.w / 2 : f.align === 'right' ? b.x + b.w - 3 : b.x + 3, y: (lines.length > 1 ? b.y + fs * (1 + i * 1.2) : b.y + b.h / 2 + fs * 0.35), 'text-anchor': f.align === 'center' ? 'middle' : f.align === 'right' ? 'end' : 'start' }, ln)));
        g.append(t);
      }
      if (f.kind === 'dropdown') g.append(s('path', { d: `M${b.x + b.w - 11} ${b.y + b.h / 2 - 2}l4 4 4-4`, fill: 'none', stroke: BLUE, 'stroke-width': 1.3 }));
    }
    if (design && (f.name || suggestion)) {
      const label = (f.required ? '* ' : '') + (f.name || '') + (f.calc ? ' = ' + f.calc.op.toLowerCase() : '');
      const lw = Math.min(260, label.length * 5.6 + 8);
      g.append(s('rect', { x: b.x, y: b.y - 13, width: lw, height: 12, rx: 3, fill: suggestion ? '#8e4ec6' : selected ? BLUE : 'rgba(10,132,255,.75)' }));
      g.append(s('text', { x: b.x + 4, y: b.y - 4, 'font-size': 9, fill: '#fff', 'font-weight': 600 }, label.length > 46 ? label.slice(0, 45) + '…' : label));
    }
    return g;
  };
  // canvas painter (thumbnails, reader, images): just the filled-in values and light boxes
  F.paint = (ctx, page, view) => {
    for (const f of page.fields || []) {
      const b = view.rectToScreen(f.r);
      ctx.save();
      ctx.fillStyle = 'rgba(10,132,255,.07)'; ctx.strokeStyle = 'rgba(10,132,255,.35)'; ctx.lineWidth = 0.75;
      if (f.kind === 'radio') { ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (f.value && f.value === f.exportValue) { ctx.fillStyle = '#1d1d1f'; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.25, 0, Math.PI * 2); ctx.fill(); } }
      else {
        ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x, b.y, b.w, b.h);
        const txt = f.kind === 'check' ? (f.value ? '✓' : '') : f.kind === 'button' ? f.caption : F.display(f);
        if (txt) { const fs = Math.min(b.h * 0.72, (f.fontSize || 10) * view.scale); ctx.fillStyle = '#1d1d1f'; ctx.font = `${fs}px Helvetica, Arial, sans-serif`; ctx.textBaseline = 'middle'; ctx.fillText(String(txt).split('\n')[0], b.x + 3, b.y + Math.min(b.h / 2, fs)); }
      }
      ctx.restore();
    }
  };

  /* ——— reading forms that already exist in a PDF ——— */
  F.importFromPdf = async (srcId, pages) => {
    const src = L.sources[srcId];
    let objs = null; try { objs = await src.doc.getFieldObjects(); } catch {}
    if (!objs || !Object.keys(objs).length) return 0;
    src.hasForm = true;
    let n = 0;
    for (const page of pages) {
      const proxy = await L.proxy(page);
      const anns = await proxy.getAnnotations({ intent: 'display' }).catch(() => []);
      const fields = [];
      for (const a of anns) {
        if (a.subtype !== 'Widget' || !a.fieldName || !a.rect) continue;
        const r = { x: Math.min(a.rect[0], a.rect[2]), y: Math.min(a.rect[1], a.rect[3]), w: Math.abs(a.rect[2] - a.rect[0]), h: Math.abs(a.rect[3] - a.rect[1]) };
        const base = { name: a.fieldName, tip: a.alternativeText || '', required: !!(a.fieldFlags & 2), readOnly: !!a.readOnly, fontSize: a.defaultAppearanceData?.fontSize || 0, align: ['left', 'center', 'right'][a.textAlignment || 0] || 'left', style: 'plain' };
        let f;
        if (a.fieldType === 'Tx') f = F.make(a.multiLine ? 'para' : 'text', r, { ...base, value: a.fieldValue ?? '', maxLen: a.maxLen || 0, comb: !!a.comb });
        else if (a.fieldType === 'Btn' && a.checkBox) f = F.make('check', r, { ...base, value: !!a.fieldValue && a.fieldValue !== 'Off', exportValue: a.exportValue || 'Yes' });
        else if (a.fieldType === 'Btn' && a.radioButton) f = F.make('radio', r, { ...base, group: a.fieldName, exportValue: a.buttonValue || 'Option', value: a.fieldValue && a.fieldValue !== 'Off' ? a.fieldValue : '' });
        else if (a.fieldType === 'Btn' && a.pushButton) f = F.make('button', r, { ...base, caption: a.alternativeText || 'Button', action: 'reset' });
        else if (a.fieldType === 'Ch') f = F.make(a.combo ? 'dropdown' : 'list', r, { ...base, options: (a.options || []).map(o => o.displayValue ?? o.exportValue), value: Array.isArray(a.fieldValue) ? a.fieldValue[0] || '' : a.fieldValue || '', multi: !!a.multiSelect, editable: !!a.customAppearance });
        else if (a.fieldType === 'Sig') f = F.make('sign', r, base);
        if (f) { fields.push(f); n++; }
      }
      page.fields = fields;
    }
    // Choice buttons are often named 0, 1, 2… with the real labels kept in the field's /Opt list — read those.
    const radios = pages.flatMap(p => p.fields).filter(f => f.kind === 'radio' && /^\d+$/.test(f.exportValue));
    if (radios.length) {
      try {
        const doc = await PDFLib.PDFDocument.load(src.bytes, { ignoreEncryption: true, updateMetadata: false });
        const opts = new Map(doc.getForm().getFields().filter(x => x instanceof PDFLib.PDFRadioGroup).map(x => [x.getName(), x.getOptions()]));
        for (const f of radios) {
          const o = opts.get(f.group); if (!o) continue;
          const label = o[+f.exportValue]; if (label == null) continue;
          if (/^\d+$/.test(String(f.value)) && o[+f.value] != null) f.value = o[+f.value];
          f.exportValue = label;
        }
      } catch (e) { console.warn('radio labels', e); }
    }
    return n;
  };

  /* ——— writing real form fields at save time ——— */
  F.collect = S => F.all(S);
  // out: pdf-lib document; items: [{ pg (pdf-lib page), page (Loeito page), rotation }]
  F.build = async (out, items, { flatten = false, script = '', S = L.state } = {}) => {
    const P = PDFLib, { PDFName, PDFHexString, PDFString, rgb, degrees, TextAlignment } = P, ctx = out.context;
    const form = out.getForm(), helv = await out.embedFont(P.StandardFonts.Helvetica);
    const used = new Set(), radios = new Map(), calcs = [], hasSig = { v: false };
    const unique = n => { let base = String(n || 'Field').replace(/\./g, '_').trim() || 'Field', name = base, k = 2; while (used.has(name)) name = `${base} ${k++}`; used.add(name); return name; };
    const js = code => ctx.obj({ Type: 'Action', S: 'JavaScript', JS: PDFHexString.fromText(code) });
    const look = f => f.style === 'plain' ? { borderWidth: 0 } : { borderColor: rgb(0.62, 0.69, 0.8), borderWidth: 0.75, backgroundColor: rgb(0.94, 0.96, 1) };
    const nameMap = new Map(); // Loeito name -> written name (for calculations)
    const written = new Map(); // Loeito name (radio: group) -> { name, widgets: [dict], kind } (for show/hide rules)
    const note = (loeitoName, name, widgets, kind) => { const w = written.get(loeitoName) || { name, widgets: [], kind }; w.widgets.push(...widgets); written.set(loeitoName, w); };
    const buttons = [];
    for (const { pg, page, rotation } of items) {
      for (const f of page.fields || []) {
        const rect = { x: f.r.x, y: f.r.y, width: f.r.w, height: f.r.h, rotate: degrees(rotation || 0), font: helv, textColor: rgb(0.07, 0.07, 0.09), ...look(f) };
        const val = v => L.winAnsi(String(v ?? ''));
        let field = null;
        if (f.kind === 'text' || f.kind === 'para') {
          const name = unique(f.name); nameMap.set(f.name, name);
          field = form.createTextField(name);
          if (f.kind === 'para') field.enableMultiline();
          const ml = f.comb ? (f.maxLen || 10) : f.maxLen;
          if (ml) field.setMaxLength(ml);
          if (f.comb) field.enableCombing();
          field.setAlignment(f.align === 'center' ? TextAlignment.Center : f.align === 'right' ? TextAlignment.Right : TextAlignment.Left);
          const shown = F.numeric(f) ? (F.toNumber(f.value) ?? '') : f.value;
          if (shown !== '' && shown != null) field.setText(val(shown));
          field.addToPage(pg, rect);
          field.setFontSize(f.fontSize || 0);
          const aa = {}, dec = f.format === 'number' ? (f.decimals ?? 0) : f.decimals ?? 2;
          if (f.format === 'number' || f.format === 'currency') { const cur = f.format === 'currency' ? JSON.stringify((f.currency || '') + ' ') : '""'; aa.K = `AFNumber_Keystroke(${dec}, 0, 0, 0, ${cur}, true);`; aa.F = `AFNumber_Format(${dec}, 0, 0, 0, ${cur}, true);`; }
          if (f.format === 'percent') { aa.K = `AFPercent_Keystroke(${dec}, 0);`; aa.F = `AFPercent_Format(${dec}, 0);`; }
          if (f.format === 'date') { aa.K = `AFDate_KeystrokeEx(${JSON.stringify(f.dateFmt)});`; aa.F = `AFDate_FormatEx(${JSON.stringify(f.dateFmt)});`; }
          if (F.maskOf(f)) { aa.K = `AFSpecial_KeystrokeEx(${JSON.stringify(F.maskOf(f))});`; aa.F = aa.K; }
          if (f.format === 'email') aa.V = `if (event.value && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(event.value)) { app.alert("Please enter a valid email address."); event.rc = false; }`;
          if (f.format === 'phone') aa.V = `if (event.value && !/^\\+?[0-9 ()\\-]{7,20}$/.test(event.value)) { app.alert("Please enter a valid phone number."); event.rc = false; }`;
          // expert scripts: own format / keystroke replace the built-in ones; an own check runs after the built-in one
          const sc = f.scripts || {};
          if (sc.format) aa.F = sc.format; if (sc.keystroke) aa.K = sc.keystroke;
          if (sc.validate) aa.V = (aa.V ? aa.V + '\n' : '') + sc.validate;
          if ((f.calc && f.calc.of && f.calc.of.length) || sc.calculate) { calcs.push({ f, field }); }
          note(f.name, name, field.acroField.getWidgets().map(w => w.dict), 'text');
          if (Object.keys(aa).length) { const d = ctx.obj({}); for (const [k, code] of Object.entries(aa)) d.set(PDFName.of(k), js(code)); field.acroField.dict.set(PDFName.of('AA'), d); }
        } else if (f.kind === 'check') {
          const name = unique(f.name);
          field = form.createCheckBox(name);
          field.addToPage(pg, rect);
          if (f.value) field.check();
          note(f.name, name, field.acroField.getWidgets().map(w => w.dict), 'check');
        } else if (f.kind === 'radio') {
          const gname = f.group || f.name || 'Choice';
          let grp = radios.get(gname);
          if (!grp) { const nm = unique(gname); grp = { field: form.createRadioGroup(nm), value: '', name: nm }; radios.set(gname, grp); }
          const opt = L.winAnsi(f.exportValue || `Option ${grp.field.getOptions().length + 1}`);
          const before = grp.field.acroField.getWidgets().length;
          grp.field.addOptionToPage(opt, pg, rect);
          if (f.value && f.value === f.exportValue) grp.value = opt;
          field = grp.field;
          note(gname, grp.name, field.acroField.getWidgets().slice(before).map(w => w.dict), 'radio');
        } else if (f.kind === 'dropdown' || f.kind === 'list') {
          const opts = (f.options || []).map(o => L.winAnsi(o)).filter(Boolean), name = unique(f.name);
          field = f.kind === 'dropdown' ? form.createDropdown(name) : form.createOptionList(name);
          if (opts.length) field.addOptions(opts);
          if (f.kind === 'dropdown' && f.editable) field.enableEditing();
          if (f.kind === 'list' && f.multi) field.enableMultiselect();
          if (f.value && (opts.includes(L.winAnsi(f.value)) || f.editable)) field.select(L.winAnsi(f.value));
          field.addToPage(pg, rect);
          field.setFontSize(f.fontSize || 0);
          if (f.kind === 'dropdown') field.acroField.dict.set(PDFName.of('Ff'), ctx.obj((field.acroField.getFlags() | (1 << 26)) >>> 0)); // CommitOnSelChange: rules react at once
          note(f.name, name, field.acroField.getWidgets().map(w => w.dict), f.kind);
        } else if (f.kind === 'sign') {
          // pdf-lib has no signature API: write the signature widget by hand (a flattened form has no fields at all)
          if (!flatten) {
            const ap = ctx.register(ctx.formXObject([], { BBox: [0, 0, f.r.w, f.r.h] }));
            const nm = unique(f.name);
            const w = ctx.obj({ Type: 'Annot', Subtype: 'Widget', FT: 'Sig', T: PDFHexString.fromText(nm), Rect: [f.r.x, f.r.y, f.r.x + f.r.w, f.r.y + f.r.h], F: 4, P: pg.ref, MK: {}, AP: { N: ap } });
            if (f.tip) w.set(PDFName.of('TU'), PDFHexString.fromText(f.tip));
            const ref = ctx.register(w); pg.node.addAnnot(ref); form.acroForm.addField(ref); hasSig.v = true;
            note(f.name, nm, [w], 'sign');
          }
          if (f.style !== 'plain') {
            pg.drawRectangle({ x: f.r.x, y: f.r.y, width: f.r.w, height: f.r.h, borderColor: rgb(0.62, 0.69, 0.8), borderWidth: 0.75, color: rgb(0.97, 0.98, 1) });
            pg.drawText('Signature', { x: f.r.x + 4, y: f.r.y + 4, size: 7, font: helv, color: rgb(0.45, 0.52, 0.65) });
          }
          continue;
        } else if (f.kind === 'button') {
          const nm = unique(f.name || f.caption);
          field = form.createButton(nm);
          field.addToPage(L.winAnsi(f.caption || 'Button'), pg, { ...rect, backgroundColor: rgb(0.88, 0.93, 1), borderColor: rgb(0.04, 0.52, 1), borderWidth: 0.75 });
          buttons.push({ f, field }); // actions are written once every field name is known
          note(f.name || f.caption, nm, field.acroField.getWidgets().map(w => w.dict), 'button');
        }
        if (field && f.kind !== 'radio') {
          if (f.required) field.enableRequired();
          if (f.readOnly || f.calc) field.enableReadOnly();
          if (f.tip) field.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(f.tip));
        }
      }
    }
    for (const g of radios.values()) if (g.value) g.field.select(g.value);
    // automatic totals: Acrobat-standard simple calculation + calculation order
    if (calcs.length) {
      const order = [];
      for (const { f, field } of calcs) {
        const names = (f.calc?.of || []).map(n => nameMap.get(n)).filter(Boolean);
        const d = field.acroField.dict.get(PDFName.of('AA')) || ctx.obj({});
        d.set(PDFName.of('C'), js(f.scripts?.calculate || `AFSimple_Calculate(${JSON.stringify(f.calc.op)}, new Array(${names.map(n => JSON.stringify(n)).join(', ')}));`));
        field.acroField.dict.set(PDFName.of('AA'), d);
        order.push(field.acroField.ref);
      }
      form.acroForm.dict.set(PDFName.of('CO'), ctx.obj(order));
    }
    const q = s => JSON.stringify(s);
    // buttons: clear, print, e-mail the filled form, open a web page, go to a page, show / hide fields, or an own script
    for (const { f, field } of buttons) {
      let act;
      if (f.action === 'print') act = js('print({ bUI: true });');
      else if (f.action === 'email') act = js(`this.mailDoc({ bUI: true, cTo: ${q(f.mailTo || '')}, cSubject: ${q(f.mailSubject || S.name || 'Form')} });`);
      else if (f.action === 'link' && f.url) act = ctx.obj({ Type: 'Action', S: 'URI', URI: PDFString.of(/^[a-z]+:/i.test(f.url) ? f.url : 'https://' + f.url) });
      else if (f.action === 'page') { const pages = out.getPages(), pgRef = pages[L.clamp((f.pageNo || 1) - 1, 0, pages.length - 1)].ref; act = ctx.obj({ Type: 'Action', S: 'GoTo', D: [pgRef, PDFName.of('Fit')] }); }
      else if (f.action === 'toggle') {
        const names = (f.targets || []).map(n => written.get(n)?.name).filter(Boolean);
        act = js(`var t = ${q(names)}; for (var i = 0; i < t.length; i++) { var g = this.getField(t[i]); if (g) g.display = g.display == display.hidden ? display.visible : display.hidden; }`);
      } else if (f.action === 'script' && f.script) act = js(f.script);
      else act = ctx.obj({ Type: 'Action', S: 'ResetForm' });
      field.acroField.getWidgets().forEach(wd => wd.dict.set(PDFName.of('A'), act));
    }
    // "Show only when…": hidden from the start if the rule says so; the controlling field shows / hides on every change
    const rules = new Map(); // controller Loeito name -> [{ dep, rule }]
    for (const { f } of F.all(S)) if (f.showIf && f.showIf.field && written.has(f.showIf.field)) {
      const depName = f.kind === 'radio' ? f.group : f.name;
      if (!written.has(depName)) continue;
      const list = rules.get(f.showIf.field) || []; if (!list.some(x => x.dep === depName)) list.push({ dep: depName, rule: f.showIf });
      rules.set(f.showIf.field, list);
      if (!F.showing(f, S)) for (const wd of written.get(depName).widgets) wd.set(PDFName.of('F'), ctx.obj(6)); // print + hidden
    }
    for (const [ctrl, deps] of rules) {
      const c = written.get(ctrl), button = c.kind === 'check' || c.kind === 'radio';
      const val = button ? 'event.target.value' : 'event.value';
      const cond = r => { const v = q(String(r.value ?? '')); return r.op === 'checked' ? `(v != "Off" && v != "")` : r.op === 'unchecked' ? `(v == "Off" || v == "")` : r.op === 'filled' ? `(String(v) != "")` : r.op === 'empty' ? `(String(v) == "")` : r.op === 'not' ? `(String(v) != ${v})` : `(String(v) == ${v})`; };
      const code = `var v = ${val};\n` + deps.map(({ dep, rule }) => `var g = this.getField(${q(written.get(dep).name)}); if (g) g.display = ${cond(rule)} ? display.visible : display.hidden;`).join('\n');
      if (button) for (const wd of c.widgets) { const aa = wd.get(PDFName.of('AA')) || ctx.obj({}); aa.set(PDFName.of('U'), js(code)); wd.set(PDFName.of('AA'), aa); } // a tick or choice reacts on click
      else { // a text or choice field reacts when its new value is committed (Validate)
        const fld = form.getField(c.name).acroField.dict, aa = fld.get(PDFName.of('AA')) || ctx.obj({});
        const prev = aa.get(PDFName.of('V')), prevJs = prev ? ctx.lookup(prev)?.get?.(PDFName.of('JS'))?.decodeText?.() || '' : '';
        aa.set(PDFName.of('V'), js((prevJs ? prevJs + '\n' : '') + code)); fld.set(PDFName.of('AA'), aa);
      }
    }
    if (script && script.trim()) out.addJavaScript('Loeito', script);
    if (hasSig.v) form.acroForm.dict.set(PDFName.of('SigFlags'), ctx.obj(1));
    if (flatten) form.flatten();
    return form.getFields().length;
  };
  // Is a field visible under its "show only when…" rule (with the current answers)?
  F.showing = (f, S = L.state) => {
    const r = f.showIf; if (!r || !r.field) return true;
    const ctrls = F.all(S).map(x => x.f).filter(g => (g.kind === 'radio' ? g.group : g.name) === r.field);
    if (!ctrls.length) return true;
    const c = ctrls[0];
    const v = c.kind === 'check' ? (c.value ? 'Yes' : 'Off') : c.kind === 'radio' ? (ctrls.find(g => g.value && g.value === g.exportValue)?.exportValue || 'Off') : String(c.value ?? '');
    switch (r.op) {
      case 'checked': return v !== 'Off' && v !== '';
      case 'unchecked': return v === 'Off' || v === '';
      case 'filled': return v !== '' && v !== 'Off';
      case 'empty': return v === '' || v === 'Off';
      case 'not': return v !== String(r.value ?? '');
      default: return v === String(r.value ?? '');
    }
  };
  // Remove form widgets that came with a copied page (their fields are rebuilt from page.fields).
  F.stripWidgets = pg => {
    const { PDFName, PDFArray, PDFDict, PDFRef } = PDFLib, annots = pg.node.lookup(PDFName.of('Annots'));
    if (!(annots instanceof PDFArray)) return;
    const keep = annots.asArray().filter(ref => { const a = pg.doc.context.lookup(ref); return !(a instanceof PDFDict && a.get(PDFName.of('Subtype')) === PDFName.of('Widget')); });
    pg.node.set(PDFName.of('Annots'), pg.doc.context.obj(keep));
  };

  /* ——— form data ——— */
  F.dataRows = (S = L.state) => F.all(S).filter(x => x.f.kind !== 'button').reduce((acc, { f }) => {
    if (f.kind === 'radio') { const g = f.group || f.name; if (!acc.some(r => r.name === g)) acc.push({ name: g, value: F.all(S).find(y => (y.f.group || y.f.name) === g && y.f.value)?.f.value || '' }); return acc; }
    acc.push({ name: f.name, value: f.kind === 'check' ? (f.value ? 'Yes' : 'No') : F.display(f) }); return acc;
  }, []);
})();
