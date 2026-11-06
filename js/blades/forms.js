/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Forms blade: draw fillable fields, let Loeito find them in flat forms, set them up in plain words, try them out. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui, F = L.forms;
  const FS = (L.formsUI = { mode: 'design', tool: 'select', sel: new Set(), drag: null, draft: null, sugg: null, busy: false, key: null, alignTo: null, guides: [], flip: new Set() });
  const page = () => L.page();
  const fieldsOf = p => (p.fields ||= []);
  const selected = () => fieldsOf(page()).filter(f => FS.sel.has(f.id));
  const one = () => { const s = selected(); return s.length === 1 ? s[0] : null; };
  const refresh = L.debounce(() => { if (L.state.blade === 'forms') L.renderInspector(); }, 40);
  const change = (label, fn) => { L.checkpoint(label); fn(); L.state.dirty = true; L.drawOverlay(); refresh(); L.emit('docs'); };

  /* ——— creating fields ——— */
  async function create(kind, rUser) {
    const p = page();
    const label = await L.formdetect.labelFor(p, rUser).catch(() => '');
    const inferred = L.formdetect.infer(label, rUser.h);
    let f;
    if (kind === 'radio') {
      const last = fieldsOf(p).filter(x => x.kind === 'radio').pop();
      const group = FS.newGroup || !last ? F.uniqueName(label || 'Choice') : last.group;
      FS.newGroup = false;
      const n = F.all().filter(x => x.f.kind === 'radio' && x.f.group === group).length + 1;
      f = F.make('radio', rUser, { group, name: group, exportValue: `Option ${n}` });
    } else {
      f = F.make(kind, rUser, { name: F.uniqueName(label || F.KINDS[kind].label), ...(kind === 'text' || kind === 'para' ? { format: inferred.format || 'none', decimals: inferred.decimals ?? 2 } : {}) });
      if (kind === 'text' && inferred.kind === 'para') f.kind = 'para';
    }
    change('add field', () => fieldsOf(p).push(f));
    FS.sel = new Set([f.id]);
    if (!['check', 'radio'].includes(kind)) FS.tool = 'select';
    L.setCursor(FS.tool === 'select' ? '' : 'crosshair');
    L.renderInspector();
  }
  function screenBox(f, view) { return view.rectToScreen(f.r); }
  function hit(view, sx, sy) {
    const fs = fieldsOf(page());
    for (let i = fs.length - 1; i >= 0; i--) { const b = screenBox(fs[i], view); if (sx >= b.x - 3 && sx <= b.x + b.w + 3 && sy >= b.y - 3 && sy <= b.y + b.h + 3) return fs[i]; }
    return null;
  }

  /* ——— pointer (design mode) ——— */
  function pointer(type, ev) {
    if (FS.mode === 'fill') return;
    const view = L.viewer.view, p = page();
    if (type === 'hover') {
      if (FS.tool !== 'select') return L.setCursor('crosshair');
      const s = one(); const b = s && screenBox(s, view);
      L.setCursor(b && Math.hypot(b.x + b.w - ev.sx, b.y + b.h - ev.sy) < 9 ? 'crosshair' : hit(view, ev.sx, ev.sy) ? 'move' : '');
      return;
    }
    // suggestions: click one to leave it out
    if (type === 'down' && FS.sugg && FS.sugg.pageId === p.id && FS.tool === 'select') {
      const i = FS.sugg.fields.findIndex(f => { const b = view.rectToScreen(f.r); return ev.sx >= b.x - 2 && ev.sx <= b.x + b.w + 2 && ev.sy >= b.y - 2 && ev.sy <= b.y + b.h + 2; });
      if (i >= 0) { FS.sugg.fields.splice(i, 1); if (!FS.sugg.fields.length) FS.sugg = null; L.drawOverlay(); refresh(); return; }
    }
    if (type === 'down') {
      if (FS.tool !== 'select') { FS.draft = { s: [ev.sx, ev.sy], c: [ev.sx, ev.sy] }; return; }
      const s = one(), b = s && screenBox(s, view);
      if (b && Math.hypot(b.x + b.w - ev.sx, b.y + b.h - ev.sy) < 9) { FS.drag = { kind: 'resize', f: s, b0: b, moved: false }; return; }
      const f = hit(view, ev.sx, ev.sy);
      if (f) {
        if (ev.e.altKey && FS.sel.has(f.id)) { FS.key = f.id; L.drawOverlay(); refresh(); return; } // Alt-click: this one is the key field
        if (ev.e.shiftKey || ev.e.ctrlKey || ev.e.metaKey) { FS.sel.has(f.id) ? FS.sel.delete(f.id) : FS.sel.add(f.id); if (!FS.sel.has(FS.key)) FS.key = FS.sel.has(f.id) ? f.id : [...FS.sel][0] || null; }
        else if (!FS.sel.has(f.id)) { FS.sel = new Set([f.id]); FS.key = f.id; }
        const sel = selected(), mine = new Set(sel.map(x => x.id));
        FS.drag = { kind: 'move', s0: [ev.sx, ev.sy], orig: sel.map(x => ({ f: x, r: { ...x.r }, b: view.rectToScreen(x.r) })), moved: false,
          others: fieldsOf(p).filter(x => !mine.has(x.id)).map(x => view.rectToScreen(x.r)) };
      } else { FS.sel = new Set(); FS.key = null; FS.drag = { kind: 'marquee', s: [ev.sx, ev.sy], c: [ev.sx, ev.sy] }; }
      L.drawOverlay(); refresh(); return;
    }
    if (type === 'move') {
      if (FS.draft) { FS.draft.c = [ev.sx, ev.sy]; L.drawOverlay(); return; }
      const d = FS.drag; if (!d) return;
      if (d.kind === 'marquee') { d.c = [ev.sx, ev.sy]; L.drawOverlay(); return; }
      if (!d.moved) { L.checkpoint(d.kind === 'move' ? 'move field' : 'resize field'); d.moved = true; }
      if (d.kind === 'move') {
        // move in screen space, then snap the group's edges / centres to other fields and the page (hold Alt to move freely)
        const ox = ev.sx - d.s0[0], oy = ev.sy - d.s0[1];
        const bb = bounds(d.orig.map(o => ({ x: o.b.x + ox, y: o.b.y + oy, w: o.b.w, h: o.b.h })));
        const sn = ev.e.altKey ? { dx: 0, dy: 0, guides: [] } : snap(bb, view, d.others);
        for (const o of d.orig) o.f.r = view.rectToPdf({ x: o.b.x + ox + sn.dx, y: o.b.y + oy + sn.dy, w: o.b.w, h: o.b.h });
        FS.guides = sn.guides;
      }
      else { const q = [ev.sx, ev.sy]; d.f.r = view.rectToPdf({ x: d.b0.x, y: d.b0.y, w: Math.max(6, q[0] - d.b0.x), h: Math.max(6, q[1] - d.b0.y) }); if (['check', 'radio'].includes(d.f.kind)) { const m = Math.max(d.f.r.w, d.f.r.h); d.f.r = { ...d.f.r, w: m, h: m, y: d.f.r.y + d.f.r.h - m }; } }
      L.drawOverlay(); return;
    }
    if (type === 'up') {
      if (FS.draft) {
        const d = FS.draft; FS.draft = null;
        const w = Math.abs(d.c[0] - d.s[0]), hh = Math.abs(d.c[1] - d.s[1]);
        let sr;
        if (w < 6 && hh < 6) { const [dw, dh] = F.KINDS[FS.tool].size; sr = { x: d.s[0], y: d.s[1] - dh * view.scale / 2, w: dw * view.scale, h: dh * view.scale }; }
        else sr = { x: Math.min(d.s[0], d.c[0]), y: Math.min(d.s[1], d.c[1]), w, h: hh };
        create(FS.tool, view.rectToPdf(sr)); return;
      }
      const d = FS.drag; FS.drag = null;
      if (d && d.kind === 'marquee') {
        const m = { x: Math.min(d.s[0], d.c[0]), y: Math.min(d.s[1], d.c[1]), w: Math.abs(d.c[0] - d.s[0]), h: Math.abs(d.c[1] - d.s[1]) };
        if (m.w > 4 && m.h > 4) { FS.sel = new Set(fieldsOf(page()).filter(f => { const b = screenBox(f, view); return b.x < m.x + m.w && b.x + b.w > m.x && b.y < m.y + m.h && b.y + b.h > m.y; }).map(f => f.id)); FS.key = [...FS.sel][0] || null; }
        L.drawOverlay(); refresh(); return;
      }
      if (d && d.moved) { L.state.dirty = true; refresh(); }
      if (FS.guides.length) { FS.guides = []; L.drawOverlay(); }
    }
    if (type === 'dbl') { const f = hit(view, ev.sx, ev.sy); if (f) { FS.sel = new Set([f.id]); L.renderInspector(); setTimeout(() => L.$('#inspector [data-focus="name"]')?.focus(), 30); } }
  }

  /* ——— overlay ——— */
  function draw({ svg, view, page: p, html }) {
    html.replaceChildren();
    if (FS.mode === 'fill') return drawFill(html, view, p);
    const g = L.s('g', { 'pointer-events': 'none' });
    for (const f of p.fields || []) {
      g.append(F.toSvg(f, view, { design: true, selected: FS.sel.has(f.id) }));
      if (f.showIf) { const b = screenBox(f, view); g.append(L.s('g', { class: 'if-badge', transform: `translate(${b.x + b.w - 7},${b.y - 5})` }, L.s('rect', { x: -8, y: -6, width: 16, height: 12, rx: 6 }), L.s('text', { x: 0, y: 3.5, 'text-anchor': 'middle' }, 'if'))); }
    }
    if (FS.sugg && FS.sugg.pageId === p.id) for (const f of FS.sugg.fields) g.append(F.toSvg(f, view, { design: true, suggestion: true }));
    const s = one();
    if (s && FS.tool === 'select') { const b = screenBox(s, view); g.append(L.s('circle', { cx: b.x + b.w, cy: b.y + b.h, r: 5, fill: '#fff', stroke: '#0a84ff', 'stroke-width': 1.5 })); }
    const key = FS.sel.size > 1 && fieldsOf(p).find(f => f.id === FS.key);
    if (key) { const b = screenBox(key, view); g.append(L.s('rect', { x: b.x - 3, y: b.y - 3, width: b.w + 6, height: b.h + 6, rx: 3, fill: 'none', stroke: '#0a84ff', 'stroke-width': 2.2 })); }
    for (const gd of FS.guides) g.append(L.s('line', { class: 'smart-guide', ...(gd.x != null ? { x1: gd.x, x2: gd.x, y1: 0, y2: view.height } : { x1: 0, x2: view.width, y1: gd.y, y2: gd.y }) }));
    const box = (a, c) => L.s('rect', { x: Math.min(a[0], c[0]), y: Math.min(a[1], c[1]), width: Math.abs(c[0] - a[0]), height: Math.abs(c[1] - a[1]), fill: 'rgba(10,132,255,.08)', stroke: '#0a84ff', 'stroke-dasharray': '4 3' });
    if (FS.draft) g.append(box(FS.draft.s, FS.draft.c));
    if (FS.drag && FS.drag.kind === 'marquee') g.append(box(FS.drag.s, FS.drag.c));
    svg.append(g);
  }

  /* ——— fill mode: real inputs over the page ——— */
  function drawFill(html, view, p) {
    const k = view.scale, extras = [];
    for (const f of p.fields || []) {
      const b = screenBox(f, view), fs = Math.max(9, Math.min(b.h * 0.62, (f.fontSize || 11) * k));
      const st = { position: 'absolute', left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', fontSize: fs + 'px', boxSizing: 'border-box' };
      const touch = () => { if (!f._touched) { L.checkpoint('fill in form'); f._touched = true; } L.state.dirty = true; };
      const after = el => {
        if (F.recalc()) L.$$('[data-calc]', html).forEach(x => { const g = F.all().find(y => y.f.id === x.dataset.calc)?.f; if (g) x.value = F.display(g); });
        const pr = F.problem(f); el && el.classList.toggle('bad', !!pr); if (el) el.title = pr || f.tip || f.name;
        syncVisibility(html, p);
      };
      let el;
      if (f.kind === 'text' || f.kind === 'para') {
        el = h(f.kind === 'para' ? 'textarea' : 'input', { class: 'ff-input', value: F.numeric(f) && f.calc ? F.display(f) : f.value ?? '', placeholder: f.format === 'date' ? f.dateFmt : F.maskOf(f).replace(/9/g, '0') || '', readOnly: !!(f.readOnly || f.calc), title: f.tip || f.name, inputmode: F.numeric(f) ? 'decimal' : f.format === 'phone' || f.format === 'cnic' ? 'tel' : f.format === 'email' ? 'email' : null, maxlength: f.maxLen || null });
        if (f.calc) el.dataset.calc = f.id;
        if (f.comb) Object.assign(st, { letterSpacing: Math.max(0, b.w / (f.maxLen || 10) - fs * 0.6) + 'px', fontFamily: 'monospace' });
        el.addEventListener('input', () => {
          touch();
          const mask = f.format === 'date' ? f.dateFmt.replace(/mmm/i, 'AAA').replace(/[dmy]/gi, '9') : F.maskOf(f);
          if (mask) { const m = F.applyMask(mask, el.value); if (m !== el.value) el.value = m; }
          f.value = el.value; after(el);
        });
        el.addEventListener('blur', () => { if (F.numeric(f) && !f.calc && f.value !== '') { const n = F.toNumber(f.value); if (n != null) { f.value = n; el.value = F.display(f); } } after(el); refresh(); });
        el.addEventListener('focus', () => { if (F.numeric(f) && !f.calc) el.value = f.value ?? ''; });
        if (f.format === 'date' && !f.readOnly && !f.calc) { // a calendar button inside the field
          const pick = h('input', { type: 'date', tabindex: '-1', class: 'ff-datepick', 'aria-hidden': 'true',
            onchange: e => { if (!e.target.value) return; const [y, m, d] = e.target.value.split('-').map(Number); touch(); f.value = el.value = F.formatDate(new Date(y, m - 1, d), f.dateFmt); after(el); refresh(); } });
          const cal = h('button', { class: 'ff-cal', title: 'Pick a date', tabindex: '-1', style: { position: 'absolute', left: b.x + b.w - Math.min(26, b.h) + 'px', top: b.y + 'px', width: Math.min(26, b.h) + 'px', height: b.h + 'px' },
            onclick: () => { const cur = F.parseDate(el.value, f.dateFmt); pick.value = cur ? `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}` : ''; try { pick.showPicker(); } catch { pick.click(); } } }, L.icon('calendar', 14), pick);
          cal.dataset.fid = f.id; extras.push(cal);
        }
      } else if (f.kind === 'check') {
        el = h('input', { type: 'checkbox', class: 'ff-check', checked: !!f.value, title: f.tip || f.name, onchange: e => { touch(); f.value = e.target.checked; after(); refresh(); } });
      } else if (f.kind === 'radio') {
        el = h('input', { type: 'radio', class: 'ff-check', name: 'r-' + f.group, checked: !!f.value && f.value === f.exportValue, title: `${f.group}: ${f.exportValue}`, onchange: () => { touch(); F.all().forEach(x => { if (x.f.kind === 'radio' && x.f.group === f.group) x.f.value = f.exportValue; }); after(); refresh(); } });
      } else if (f.kind === 'dropdown' || f.kind === 'list') {
        el = h('select', { class: 'ff-input', multiple: f.kind === 'list' && f.multi, size: f.kind === 'list' ? Math.max(2, Math.floor(b.h / (fs * 1.3))) : null, title: f.tip || f.name, onchange: e => { touch(); f.value = e.target.value; after(e.target); refresh(); } },
          f.kind === 'dropdown' ? h('option', { value: '' }, '—') : null, (f.options || []).map(o => h('option', { value: o, selected: o === f.value }, o)));
      } else if (f.kind === 'sign') {
        el = h('button', { class: 'ff-sign', title: 'Sign here', onclick: () => L.signInto ? L.signInto(p, f.r) : null }, '✎ Sign here');
      } else if (f.kind === 'button') {
        el = h('button', { class: 'ff-button', onclick: () => {
          if (f.action === 'reset') { L.checkpoint('reset form'); F.all().forEach(({ f: g }) => { if (!g.calc) g.value = g.kind === 'check' ? false : ''; }); F.recalc(); L.drawOverlay(); refresh(); }
          else if (f.action === 'link' && f.url) window.open(/^[a-z]+:/i.test(f.url) ? f.url : 'https://' + f.url, '_blank', 'noopener');
          else if (f.action === 'page') L.go((f.pageNo || 1) - 1);
          else if (f.action === 'toggle') { for (const n of f.targets || []) FS.flip.has(n) ? FS.flip.delete(n) : FS.flip.add(n); syncVisibility(html, p); }
          else L.toast({ print: 'Print works in the saved PDF (or press Ctrl P after saving).', email: 'In the saved PDF this opens an e-mail with the filled form attached.', script: 'Scripts run in the saved PDF (Acrobat, Foxit, PDF-XChange).' }[f.action] || 'Works in the saved PDF.', { icon: 'info' });
        } }, f.caption || 'Button');
      }
      if (!el) continue;
      Object.assign(el.style, st);
      if (f.format === 'date') el.style.paddingRight = Math.min(26, b.h) + 'px';
      el.dataset.fid = f.id;
      if (F.problem(f)) el.classList.add('bad');
      html.append(el, ...extras.splice(0));
    }
    syncVisibility(html, p);
  }
  // Fields with a "show only when…" rule (or toggled by a button) appear and disappear as answers change.
  function syncVisibility(html, p) {
    for (const f of p.fields || []) {
      const el = html.querySelector(`[data-fid="${f.id}"]`); if (!el) continue;
      const shown = F.showing(f) !== FS.flip.has(ctrlName(f));
      el.style.display = shown ? '' : 'none';
    }
  }

  /* ——— detection ——— */
  async function detect(all) {
    if (FS.busy) return;
    FS.busy = true; L.renderInspector();
    const pages = all ? L.state.pages : [page()], t = L.task(all ? 'Finding fields on every page' : 'Finding fields');
    try {
      let total = 0; const found = [];
      for (let i = 0; i < pages.length; i++) {
        if (t.cancelled) break;
        const res = await L.formdetect.detect(pages[i], { onStep: s => t.set((i + 0.5) / pages.length, `${pages.length > 1 ? `Page ${i + 1}: ` : ''}${s}`) });
        if (res.scanned && !pages[i].ocr && !(await L.pdfTextItems(pages[i])).length) L.toast('This page is a scan without text — run Make Searchable first so fields get proper names.', { icon: 'info', ms: 6000 });
        found.push({ page: pages[i], fields: res.fields }); total += res.fields.length;
      }
      if (!all) { FS.sugg = found[0].fields.length ? { pageId: found[0].page.id, fields: found[0].fields } : null; if (!total) L.toast('No blanks found on this page — draw fields with the tools above.', { icon: 'info', ms: 4200 }); }
      else if (total) { change(`add ${total} detected fields`, () => found.forEach(x => fieldsOf(x.page).push(...x.fields))); L.toast(`Added ${total} fields on ${found.filter(x => x.fields.length).length} page(s)`, { kind: 'ok', icon: 'sparkles' }); }
      else L.toast('No blanks found — draw fields with the tools above.', { icon: 'info' });
    } catch (e) { L.error('Field detection failed', e); }
    finally { t.done(); FS.busy = false; L.drawOverlay(); L.renderInspector(); }
  }
  FS.detectNow = () => detect(false);
  function acceptSuggestions() {
    const s = FS.sugg; if (!s) return;
    const p = L.state.pages.find(x => x.id === s.pageId); if (!p) return;
    change(`add ${s.fields.length} fields`, () => fieldsOf(p).push(...s.fields));
    FS.sugg = null; L.toast(`${s.fields.length} fields added — click any to fine-tune`, { kind: 'ok', icon: 'sparkles' });
  }

  /* ——— property panel ——— */
  const set = (f, k, v, label = 'field settings') => change(label, () => { f[k] = v; });
  function props(f) {
    const kids = [];
    kids.push(ui.field(f.kind === 'radio' ? 'Group name' : 'Name', h('input', { class: 'input', 'data-focus': 'name', value: f.kind === 'radio' ? f.group : f.name, onchange: e => {
      const v = e.target.value.trim(); if (!v) return;
      if (f.kind === 'radio') { const old = f.group; change('rename group', () => F.all().forEach(x => { if (x.f.kind === 'radio' && x.f.group === old) { x.f.group = v; x.f.name = v; } })); }
      else { const old = f.name, nv = F.uniqueName(v, L.state, f); change('rename field', () => { f.name = nv; F.all().forEach(x => { if (x.f.calc) x.f.calc.of = x.f.calc.of.map(n => (n === old ? nv : n)); }); }); }
    } })));
    if (f.kind === 'radio') kids.push(ui.field('This choice', h('input', { class: 'input', value: f.exportValue, onchange: e => set(f, 'exportValue', e.target.value.trim() || f.exportValue) })));
    kids.push(ui.field('Help text (shown on hover)', h('input', { class: 'input', value: f.tip, placeholder: 'e.g. As written on your CNIC', onchange: e => set(f, 'tip', e.target.value) })));
    if (f.kind === 'text' || f.kind === 'para') {
      kids.push(h('div', { class: 'grid2' },
        ui.field('Kind of answer', ui.select(F.FORMATS, f.format, v => set(f, 'format', v))),
        ui.field('Size', ui.select([{ value: '0', label: 'Auto' }, ...[8, 9, 10, 11, 12, 14, 16].map(n => ({ value: String(n), label: n + ' pt' }))], String(f.fontSize || 0), v => set(f, 'fontSize', +v)))));
      if (F.numeric(f)) kids.push(h('div', { class: 'grid2' },
        ui.field('Decimals', ui.select(['0', '1', '2', '3'], String(f.decimals ?? 2), v => set(f, 'decimals', +v))),
        f.format === 'currency' ? ui.field('Currency', h('input', { class: 'input', value: f.currency, onchange: e => set(f, 'currency', e.target.value) })) : h('span')));
      if (f.format === 'date') kids.push(ui.field('Date style', ui.select(['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd', 'dd-mmm-yyyy'], f.dateFmt, v => set(f, 'dateFmt', v))));
      if (f.format === 'mask') kids.push(ui.field('Pattern — 9 digit, A letter, X anything', h('input', { class: 'input', value: f.mask, placeholder: '9999-9999999', onchange: e => set(f, 'mask', e.target.value) })));
      kids.push(h('div', { class: 'grid2' },
        ui.field('Max characters', ui.num(f.maxLen || '', v => set(f, 'maxLen', Math.max(0, Math.round(v || 0))), { min: 0, placeholder: 'No limit' })),
        ui.field('Align', ui.seg([{ value: 'left', label: 'L' }, { value: 'center', label: 'C' }, { value: 'right', label: 'R' }], f.align, v => set(f, 'align', v)))));
      kids.push(ui.check('One box per character (needs a max)', f.comb, v => change('field settings', () => { f.comb = v; if (v && !f.maxLen) f.maxLen = f.format === 'cnic' ? 15 : 10; })));
      if (F.numeric(f)) kids.push(calcEditor(f));
      if (!f.calc) kids.push(ui.field('Pre-filled value', h('input', { class: 'input', value: f.value ?? '', onchange: e => set(f, 'value', e.target.value) })));
    }
    if (f.kind === 'check') kids.push(ui.check('Ticked to start with', f.value, v => set(f, 'value', v)));
    if (f.kind === 'radio') kids.push(ui.check('Selected to start with', f.value === f.exportValue, v => change('field settings', () => F.all().forEach(x => { if (x.f.kind === 'radio' && x.f.group === f.group) x.f.value = v ? f.exportValue : ''; }))));
    if (f.kind === 'dropdown' || f.kind === 'list') {
      kids.push(ui.field('Choices — one per line', h('textarea', { class: 'input', rows: Math.min(8, Math.max(3, f.options.length + 1)), value: f.options.join('\n'), onchange: e => set(f, 'options', e.target.value.split('\n').map(s => s.trim()).filter(Boolean)) })));
      kids.push(f.kind === 'dropdown' ? ui.check('Let people type their own answer', f.editable, v => set(f, 'editable', v)) : ui.check('Allow several choices', f.multi, v => set(f, 'multi', v)));
    }
    if (f.kind === 'button') kids.push(...buttonEditor(f));
    if (!['button'].includes(f.kind)) kids.push(h('div', { class: 'row wrap', style: { gap: '16px' } },
      ui.check('Required', f.required, v => set(f, 'required', v)), ui.check('Read-only', f.readOnly, v => set(f, 'readOnly', v))));
    kids.push(ui.field('Look', ui.seg([{ value: 'box', label: 'Light box' }, { value: 'plain', label: 'Invisible until used' }], f.style, v => set(f, 'style', v))));
    if (f.kind !== 'button') kids.push(showIfEditor(f));
    if (f.kind === 'text' || f.kind === 'para') kids.push(scriptsEditor(f));
    return ui.section(`${F.KINDS[f.kind].label} field`, h('div', { class: 'stack' }, kids),
      h('div', { class: 'grid2', style: { marginTop: '12px' } }, ui.btn('Duplicate ↓', 'duplicate', duplicate), ui.btn('Delete', 'trash', removeSel, 'danger')));
  }
  /* ——— behaviour: what buttons do, when fields appear, scripts for experts ——— */
  const ACTIONS = [{ value: 'reset', label: 'Clear the form' }, { value: 'print', label: 'Print' }, { value: 'email', label: 'E-mail the filled form' }, { value: 'link', label: 'Open a web page' },
    { value: 'page', label: 'Go to a page' }, { value: 'toggle', label: 'Show / hide fields' }, { value: 'script', label: 'Run a script (experts)' }];
  const ctrlName = g => (g.kind === 'radio' ? g.group : g.name);
  function buttonEditor(f) {
    const inp = (k, ph, type = 'text') => h('input', { class: 'input', type, value: f[k] || '', placeholder: ph, onchange: e => set(f, k, e.target.value) });
    const names = [...new Set(F.all().map(x => x.f).filter(g => g !== f && g.kind !== 'button').map(ctrlName))];
    return [
      h('div', { class: 'grid2' }, ui.field('Caption', inp('caption', 'Button text')), ui.field('When clicked', ui.select(ACTIONS, f.action, v => set(f, 'action', v)))),
      f.action === 'email' ? h('div', { class: 'grid2' }, ui.field('Send to', inp('mailTo', 'name@example.com', 'email')), ui.field('Subject', inp('mailSubject', L.state.name))) : null,
      f.action === 'email' ? h('p', { class: 'muted tiny', style: { margin: 0 } }, 'Opens the person’s e-mail program with the filled PDF attached (Acrobat, Foxit).') : null,
      f.action === 'link' ? ui.field('Web address', inp('url', 'www.example.com')) : null,
      f.action === 'page' ? ui.field('Page number', ui.num(f.pageNo || 1, v => set(f, 'pageNo', L.clamp(Math.round(v) || 1, 1, L.state.pages.length)), { min: 1, max: L.state.pages.length })) : null,
      f.action === 'toggle' ? ui.field('Fields to show or hide', names.length ? h('div', { class: 'list', style: { maxHeight: '140px', overflow: 'auto' } }, names.map(n => h('label', { class: 'list-item' },
        h('input', { type: 'checkbox', checked: (f.targets || []).includes(n), onchange: e => set(f, 'targets', e.target.checked ? [...(f.targets || []), n] : (f.targets || []).filter(x => x !== n)) }), h('span', { class: 'grow' }, n)))) : h('p', { class: 'muted tiny' }, 'Add other fields first.')) : null,
      f.action === 'script' ? ui.field('JavaScript (Acrobat)', h('textarea', { class: 'input mono', rows: 4, value: f.script || '', placeholder: 'app.alert("Hello");', onchange: e => set(f, 'script', e.target.value) })) : null,
    ].filter(Boolean);
  }
  function showIfEditor(f) {
    const me = ctrlName(f), seen = new Set(), ctrls = [];
    for (const { f: g } of F.all()) { const nm = ctrlName(g); if (!nm || nm === me || seen.has(nm) || g.kind === 'button' || g.kind === 'sign') continue; seen.add(nm); ctrls.push({ name: nm, kind: g.kind, f: g }); }
    const group = f.kind === 'radio' ? F.all().map(x => x.f).filter(g => g.kind === 'radio' && g.group === f.group) : [f];
    const setRule = rule => change('show rule', () => group.forEach(g => { g.showIf = rule; }));
    const defOp = k => (k === 'check' ? 'checked' : 'is');
    const r = f.showIf;
    if (!r) return h('div', null, ui.btn('Show only when…', 'eyeoff', () => (ctrls.length ? setRule({ field: ctrls[0].name, op: defOp(ctrls[0].kind), value: '' }) : L.toast('Add the field it depends on first', { icon: 'info' })), 'block'),
      h('p', { class: 'muted tiny', style: { margin: '6px 0 0' } }, 'e.g. show “Other details” only when “Other” is chosen.'));
    const c = ctrls.find(x => x.name === r.field) || ctrls[0]; if (!c) return null;
    const ops = c.kind === 'check' ? [['checked', 'is ticked'], ['unchecked', 'is not ticked']] : [['is', 'is'], ['not', 'is not'], ['filled', 'has an answer'], ['empty', 'is empty']];
    const choices = c.kind === 'radio' ? F.all().map(x => x.f).filter(g => g.kind === 'radio' && g.group === c.name).map(g => g.exportValue) : c.kind === 'dropdown' || c.kind === 'list' ? c.f.options : null;
    return h('div', { class: 'rule-box' },
      h('div', { class: 'row between' }, h('span', { class: 'label', style: { margin: 0 } }, 'Show only when'), h('button', { class: 'linkish', onclick: () => setRule(null) }, 'Remove')),
      ui.select(ctrls.map(x => ({ value: x.name, label: x.name })), c.name, v => setRule({ field: v, op: defOp(ctrls.find(x => x.name === v).kind), value: '' })),
      h('div', { class: 'grid2' },
        ui.select(ops.map(([value, label]) => ({ value, label })), r.op, v => setRule({ ...r, op: v })),
        r.op === 'is' || r.op === 'not' ? (choices ? ui.select([{ value: '', label: '—' }, ...choices.map(o => ({ value: o, label: o }))], r.value, v => setRule({ ...r, value: v }))
          : h('input', { class: 'input', value: r.value || '', placeholder: 'Answer', onchange: e => setRule({ ...r, value: e.target.value }) })) : h('span')),
      h('p', { class: 'muted tiny', style: { margin: 0 } }, F.showing(f) ? 'Visible with the answers as they are now.' : 'Hidden with the answers as they are now.'));
  }
  function scriptsEditor(f) {
    const sc = f.scripts || {};
    const area = (k, label) => ui.field(label, h('textarea', { class: 'input mono', rows: 3, value: sc[k] || '', placeholder: '// Acrobat JavaScript', onchange: e => set(f, 'scripts', { ...(f.scripts || {}), [k]: e.target.value }, 'field script') }));
    return h('details', { class: 'more', open: Object.values(sc).some(Boolean) || null }, h('summary', null, 'Scripts (for experts)'),
      h('div', { class: 'stack', style: { marginTop: '8px' } },
        area('format', 'Format — how the value is shown'), area('keystroke', 'Keystroke — while typing'),
        area('validate', 'Validate — after typing (event.rc = false rejects)'), area('calculate', 'Calculate — set event.value'),
        h('p', { class: 'muted tiny', style: { margin: 0 } }, 'Runs in Acrobat, Foxit and PDF-XChange; most browsers ignore scripts. Loeito’s Fill in preview uses the built-in rules only.')));
  }
  function calcEditor(f) {
    const others = F.all().filter(x => x.f !== f && F.numeric(x.f) && x.f.kind === 'text');
    const op = f.calc ? f.calc.op : '';
    const box = h('div', { class: 'stack' },
      ui.field('Work it out automatically', ui.select([{ value: '', label: 'No — people type it' }, { value: 'SUM', label: 'Sum of…' }, { value: 'AVG', label: 'Average of…' }, { value: 'PRD', label: 'Product of… (×)' }, { value: 'MIN', label: 'Smallest of…' }, { value: 'MAX', label: 'Largest of…' }], op, v => change('calculation', () => { f.calc = v ? { op: v, of: f.calc ? f.calc.of : [] } : null; F.recalc(); }))));
    if (f.calc) box.append(others.length ? h('div', { class: 'list', style: { maxHeight: '160px', overflow: 'auto' } }, others.map(({ f: g }) => h('label', { class: 'list-item' },
      h('input', { type: 'checkbox', checked: f.calc.of.includes(g.name), onchange: e => change('calculation', () => { f.calc.of = e.target.checked ? [...f.calc.of, g.name] : f.calc.of.filter(n => n !== g.name); F.recalc(); }) }), h('span', { class: 'grow' }, g.name))))
      : h('p', { class: 'muted tiny', style: { margin: 0 } }, 'Add some Number or Money fields first.'));
    return box;
  }
  function duplicate() {
    const s = selected(); if (!s.length) return;
    const top = Math.min(...s.map(f => f.r.y)), bottom = Math.max(...s.map(f => f.r.y + f.r.h)), dy = bottom - top + 6;
    const copies = s.map(f => { const c = JSON.parse(JSON.stringify(f)); c.id = L.uid('f'); c.r = { ...c.r, y: c.r.y - dy }; if (c.kind === 'radio') c.exportValue = `Option ${F.all().filter(x => x.f.kind === 'radio' && x.f.group === c.group).length + 1}`; else c.name = F.uniqueName(f.name.replace(/\s\d+$/, '')); return c; });
    change('duplicate field', () => fieldsOf(page()).push(...copies));
    FS.sel = new Set(copies.map(c => c.id)); refresh();
  }
  function removeSel() { const ids = new Set(FS.sel); if (!ids.size) return; change('delete field', () => { page().fields = fieldsOf(page()).filter(f => !ids.has(f.id)); }); FS.sel = new Set(); }
  /* ——— Arrange: align to the selection, a key field or the page; distribute; match sizes ———
     Worked out in screen space, so "left" and "top" mean what you see, even on a rotated page. */
  const bounds = rs => { const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y }; };
  // Smart guides: snap the moving group's edges or centre to other fields and to the page (5 px reach).
  function snap(bb, view, others) {
    const T = 5, xs = [0, view.width / 2, view.width], ys = [0, view.height / 2, view.height];
    for (const r of others) { xs.push(r.x, r.x + r.w / 2, r.x + r.w); ys.push(r.y, r.y + r.h / 2, r.y + r.h); }
    const near = (mine, theirs) => { let best = null; for (const m of mine) for (const t of theirs) { const d = t - m; if (Math.abs(d) <= T && (!best || Math.abs(d) < Math.abs(best))) best = d; } return best; };
    const dx = near([bb.x, bb.x + bb.w / 2, bb.x + bb.w], xs) ?? 0, dy = near([bb.y, bb.y + bb.h / 2, bb.y + bb.h], ys) ?? 0;
    const at = (mine, theirs, d) => theirs.filter(t => mine.some(m => Math.abs(m + d - t) < 0.5));
    const guides = [...new Set(dx || near([bb.x, bb.x + bb.w / 2, bb.x + bb.w], xs) === 0 ? at([bb.x, bb.x + bb.w / 2, bb.x + bb.w], xs, dx) : [])].map(x => ({ x }))
      .concat([...new Set(dy || near([bb.y, bb.y + bb.h / 2, bb.y + bb.h], ys) === 0 ? at([bb.y, bb.y + bb.h / 2, bb.y + bb.h], ys, dy) : [])].map(y => ({ y })));
    return { dx, dy, guides };
  }
  const alignTarget = s => (s.length < 2 ? 'page' : FS.alignTo === 'page' || (FS.alignTo === 'key' && s.some(f => f.id === FS.key)) ? FS.alignTo : 'sel');
  function arrange(how) {
    const s = selected(), view = L.viewer.view; if (!s.length || !view) return;
    const to = alignTarget(s), R = f => view.rectToScreen(f.r);
    const ref = to === 'page' ? { x: 0, y: 0, w: view.width, h: view.height } : to === 'key' ? R(s.find(f => f.id === FS.key)) : bounds(s.map(R));
    change('align fields', () => s.forEach(f => {
      if (to === 'key' && f.id === FS.key) return;
      const b = R(f);
      if (how === 'left') b.x = ref.x; if (how === 'center') b.x = ref.x + (ref.w - b.w) / 2; if (how === 'right') b.x = ref.x + ref.w - b.w;
      if (how === 'top') b.y = ref.y; if (how === 'middle') b.y = ref.y + (ref.h - b.h) / 2; if (how === 'bottom') b.y = ref.y + ref.h - b.h;
      f.r = view.rectToPdf(b);
    }));
  }
  // Equal gaps between neighbours; the first and last stay where they are.
  function distribute(axis) {
    const s = selected(), view = L.viewer.view; if (s.length < 3 || !view) return;
    const X = axis === 'h', items = s.map(f => ({ f, b: view.rectToScreen(f.r) })).sort((a, b) => (X ? a.b.x - b.b.x : a.b.y - b.b.y));
    const first = items[0].b, last = items[items.length - 1].b;
    const span = X ? last.x + last.w - first.x : last.y + last.h - first.y, used = items.reduce((a, it) => a + (X ? it.b.w : it.b.h), 0), gap = (span - used) / (items.length - 1);
    change('distribute fields', () => { let p = X ? first.x : first.y; for (const it of items) { if (X) it.b.x = p; else it.b.y = p; p += (X ? it.b.w : it.b.h) + gap; it.f.r = view.rectToPdf(it.b); } });
  }
  function match(dim) {
    const s = selected(), view = L.viewer.view; if (s.length < 2 || !view) return;
    const key = s.find(f => f.id === FS.key), rs = s.map(f => view.rectToScreen(f.r));
    const W = key ? view.rectToScreen(key.r).w : Math.max(...rs.map(r => r.w)), H = key ? view.rectToScreen(key.r).h : Math.max(...rs.map(r => r.h));
    change('match size', () => s.forEach((f, i) => { const b = rs[i]; if (dim !== 'h') b.w = W; if (dim !== 'w') b.h = H; f.r = view.rectToPdf(b); }));
  }
  function arrangeSection(s) {
    const to = alignTarget(s), many = s.length > 1;
    const keyF = s.find(f => f.id === FS.key);
    const btn = (how, icon, tip, fn = () => arrange(how)) => h('button', { class: 'icon-btn', title: tip, 'aria-label': tip, onclick: fn }, L.icon(icon));
    return ui.section('Arrange',
      many ? h('div', { style: { marginBottom: '10px' } }, ui.seg([{ value: 'sel', label: 'Selection', title: 'Line up with each other' }, { value: 'key', label: 'Key field', title: 'Line up with one field (thick outline) — Alt-click a selected field to choose it' }, { value: 'page', label: 'Page', title: 'Line up with the page' }],
        to, v => { FS.alignTo = v; if (v === 'key' && !keyF) FS.key = s[0].id; L.drawOverlay(); L.renderInspector(); }))
        : h('p', { class: 'muted tiny', style: { margin: '0 0 8px' } }, 'Aligns to the page. Select several fields to align them with each other or with a key field.'),
      h('div', { class: 'align-bar' },
        btn('left', 'alignL', 'Align left edges'), btn('center', 'alignC', 'Centre horizontally'), btn('right', 'alignR', 'Align right edges'),
        h('span', { class: 'align-sep' }),
        btn('top', 'alignT', 'Align top edges'), btn('middle', 'alignM', 'Centre vertically'), btn('bottom', 'alignB', 'Align bottom edges'),
        many ? h('span', { class: 'align-sep' }) : null,
        many ? btn('', 'distH', 'Distribute horizontally — equal gaps (3 or more)', () => distribute('h')) : null,
        many ? btn('', 'distV', 'Distribute vertically — equal gaps (3 or more)', () => distribute('v')) : null),
      many ? h('div', { class: 'grid3', style: { marginTop: '8px' } }, ui.btn('Same width', null, () => match('w')), ui.btn('Same height', null, () => match('h')), ui.btn('Same size', null, () => match('wh'))) : null,
      many && to === 'key' ? h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, `Key field: “${keyF ? keyF.name : '—'}” stays put; Alt-click another selected field to change it.`) : null,
      h('p', { class: 'muted tiny', style: { margin: '8px 0 0' } }, 'Dragging snaps to other fields and the page centre — hold Alt to move freely. Arrow keys nudge (Shift = 10 pt).'));
  }
  function sortTabOrder() { change('tab order', () => L.state.pages.forEach(p => { if (p.fields) p.fields.sort((a, b) => Math.abs((b.r.y + b.r.h) - (a.r.y + a.r.h)) > 6 ? (b.r.y + b.r.h) - (a.r.y + a.r.h) : a.r.x - b.r.x); })); L.toast('Tab order now runs top to bottom, left to right', { kind: 'ok' }); }
  function exportData(kind) {
    const rows = F.dataRows(), base = L.safeName(L.state.name) + ' — form data';
    if (kind === 'json') return L.saveFile(new Blob([JSON.stringify(Object.fromEntries(rows.map(r => [r.name, r.value])), null, 2)], { type: 'application/json' }), base + '.json', 'application/json', 'json');
    const q = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = '﻿' + [rows.map(r => q(r.name)).join(','), rows.map(r => q(r.value)).join(',')].join('\r\n') + '\r\n';
    L.saveFile(new Blob([csv], { type: 'text/csv' }), base + '.csv', 'text/csv', 'csv');
  }
  async function importData() {
    const inp = h('input', { type: 'file', accept: '.json,.csv' });
    inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      const text = new TextDecoder().decode(await L.readFile(file)); let map = {};
      try { if (/\.json$/i.test(file.name)) map = JSON.parse(text); else { const [hd, vl] = text.replace(/^﻿/, '').split(/\r?\n/); const split = l => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')); const k = split(hd), v = split(vl || ''); k.forEach((n, i) => { if (n) map[n] = v[i] ?? ''; }); } }
      catch (e) { return L.error('Couldn’t read that file', e); }
      let n = 0;
      change('import form data', () => F.all().forEach(({ f }) => {
        const key = f.kind === 'radio' ? f.group : f.name; if (!(key in map)) return;
        const v = map[key]; n++;
        if (f.kind === 'check') f.value = /^(yes|true|1|on|x|✓)$/i.test(String(v)); else f.value = String(v);
      }));
      F.recalc(); L.drawOverlay(); L.toast(`Filled ${n} field${n === 1 ? '' : 's'}`, { kind: 'ok' });
    };
    inp.click();
  }

  L.registerBlade({
    id: 'forms', label: 'Forms', icon: 'form', color: '#ff375f', ownsFields: true,
    desc: 'Make fillable PDF forms — or let Loeito turn a Word, Excel or scanned form into one.',
    activate() { L.setCursor(FS.tool === 'select' ? '' : 'crosshair'); },
    deactivate() { FS.sel = new Set(); FS.draft = null; FS.drag = null; L.$('#html-layer').replaceChildren(); },
    draw, pointer,
    key(e) {
      if (e.target.closest('input,textarea,select') || FS.mode === 'fill') return;
      const mod = e.ctrlKey || e.metaKey, s = selected();
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.length) { removeSel(); return true; }
      if (mod && e.key.toLowerCase() === 'd' && s.length) { duplicate(); return true; }
      if (mod && e.key.toLowerCase() === 'a') { FS.sel = new Set(fieldsOf(page()).map(f => f.id)); L.drawOverlay(); refresh(); return true; }
      if (e.key === 'Escape') { FS.sel = new Set(); FS.tool = 'select'; FS.sugg = null; L.setCursor(''); L.drawOverlay(); refresh(); return true; }
      if (s.length && /^Arrow/.test(e.key)) {
        const st = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, dy = e.key === 'ArrowUp' ? st : e.key === 'ArrowDown' ? -st : 0;
        change('nudge field', () => s.forEach(f => { f.r = { ...f.r, x: f.r.x + dx, y: f.r.y + dy }; })); return true;
      }
    },
    inspector() {
      const all = F.all(), p = page(), s = selected(), f = one();
      const head = ui.head('form', 'Forms', FS.mode === 'fill' ? 'Try the form exactly as people will use it.' : 'Draw fields, or let Loeito find them in a flat form.');
      const modeSeg = h('div', { class: 'section' }, ui.seg([{ value: 'design', label: 'Design', icon: 'edit' }, { value: 'fill', label: 'Fill in', icon: 'type' }], FS.mode, v => { FS.mode = v; FS.sel = new Set(); L.setCursor(''); F.recalc(); L.drawOverlay(); L.renderInspector(); }));
      if (FS.mode === 'fill') {
        const issues = all.map(x => ({ x, pr: F.problem(x.f) })).filter(y => y.pr);
        const filled = all.filter(x => x.f.kind !== 'button' && x.f.value !== '' && x.f.value !== false && x.f.value != null).length;
        return [head, modeSeg,
          ui.section('Progress', h('div', { class: 'grid2' },
            h('div', { class: 'stat' }, h('span', { class: 'v' }, `${filled}/${all.filter(x => x.f.kind !== 'button').length}`), h('span', { class: 'k' }, 'answered')),
            h('div', { class: 'stat' }, h('span', { class: 'v', style: { color: issues.length ? 'var(--warn)' : 'var(--ok)' } }, issues.length), h('span', { class: 'k' }, 'to fix'))),
            issues.length ? h('div', { class: 'list', style: { marginTop: '10px' } }, issues.slice(0, 12).map(({ x, pr }) => h('button', { class: 'list-item', style: { border: 0, textAlign: 'left' }, onclick: () => L.go(x.pi) }, h('span', { class: 'grow' }, x.f.name), h('span', { class: 'muted tiny' }, `${pr} · p${x.pi + 1}`)))) : null),
          ui.section('Answers', h('div', { class: 'grid2' }, ui.btn('Save as CSV', 'download', () => exportData('csv')), ui.btn('Save as JSON', 'download', () => exportData('json'))),
            h('div', { class: 'grid2', style: { marginTop: '8px' } }, ui.btn('Load answers…', 'upload', importData), ui.btn('Clear all', 'trash', () => change('clear answers', () => { all.forEach(({ f: g }) => { g.value = g.kind === 'check' ? false : ''; }); F.recalc(); }), 'danger'))),
          ui.section(null, ui.callout('Save keeps the form fillable (or flattens it — your choice in Save). Totals, formats and checks keep working in Acrobat, Edge, Chrome and Foxit.')),
        ];
      }
      const pageSugg = FS.sugg && FS.sugg.pageId === p.id ? FS.sugg.fields : null;
      const tally = pageSugg && Object.entries(pageSugg.reduce((a, x) => ((a[F.KINDS[x.kind].label] = (a[F.KINDS[x.kind].label] || 0) + 1), a), {})).map(([k, n]) => `${n} ${k.toLowerCase()}${n > 1 ? (k === 'Choice' ? 's' : k === 'Checkbox' ? 'es' : 's') : ''}`).join(', ');
      return [head, modeSeg,
        h('div', { class: 'section', style: { paddingTop: '4px' } }, ui.btn('Start from a template…', 'template', () => L.openFormTemplates(), 'block')),
        ui.section('Add a field',
          h('div', { class: 'toolgrid' }, [['select', 'Select', 'cursor'], ...Object.entries(F.KINDS).map(([k, d]) => [k, d.label, d.icon])].map(([k, label, icon]) =>
            h('button', { class: 'tool' + (FS.tool === k ? ' on' : ''), title: label, onclick: () => { FS.tool = k; if (k === 'radio') FS.newGroup = true; L.setCursor(k === 'select' ? '' : 'crosshair'); L.renderInspector(); } }, L.icon(icon), label))),
          h('p', { class: 'muted tiny', style: { margin: '10px 0 0' } }, FS.tool === 'select' ? 'Click a field to set it up · drag to move · corner to resize · Shift-click or drag a box to pick several · Ctrl D duplicates below.'
            : FS.tool === 'radio' ? 'Click to place each choice of one question. Pick the tool again to start a new question.' : 'Drag on the page to draw the field — or just click for a standard size. The name comes from the nearby label.')),
        ui.section('Make a flat form fillable',
          pageSugg ? h('div', { class: 'stack' },
            ui.callout(`<b>Found ${pageSugg.length} field${pageSugg.length > 1 ? 's' : ''}</b> — ${tally}. Purple boxes on the page; click one to leave it out.`, '', 'sparkles'),
            h('div', { class: 'grid2' }, ui.btn(`Add ${pageSugg.length}`, 'check', acceptSuggestions, 'primary'), ui.btn('Discard', 'close', () => { FS.sugg = null; L.drawOverlay(); L.renderInspector(); })))
            : h('div', { class: 'stack' },
              h('div', { class: 'grid2' }, ui.btn(FS.busy ? 'Looking…' : 'Find fields', 'sparkles', () => detect(false), 'primary'), ui.btn('All pages', 'pages', () => detect(true))),
              h('p', { class: 'muted tiny', style: { margin: 0 } }, 'Spots blanks ____, empty table cells, ☐ boxes and “Label:” gaps — in PDFs from Word or Excel and in scans. You can also open .docx / .xlsx files directly.'))),
        s.length ? arrangeSection(s) : null,
        f ? props(f) : s.length > 1 ? ui.section(`${s.length} fields selected`,
          h('div', { class: 'grid2' }, ui.btn('Duplicate ↓', 'duplicate', duplicate), ui.btn('Delete', 'trash', removeSel, 'danger')),
          h('div', { style: { marginTop: '10px' } }, ui.check('All required', s.every(x => x.required), v => change('field settings', () => s.forEach(x => { x.required = v; }))))) : null,
        ui.section(`All fields · ${all.length}`,
          all.length ? h('div', { class: 'list', style: { maxHeight: '220px', overflow: 'auto' } }, all.map(({ f: g, pi }) => h('button', {
            class: 'list-item' + (FS.sel.has(g.id) ? ' on' : ''), style: { border: 0, textAlign: 'left', width: '100%' },
            onclick: () => { FS.sel = new Set([g.id]); if (pi !== L.state.cur) L.go(pi); else { L.drawOverlay(); L.renderInspector(); } },
          }, L.icon(F.KINDS[g.kind].icon, 15), h('span', { class: 'grow', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, (g.required ? '* ' : '') + (g.kind === 'radio' ? `${g.group}: ${g.exportValue}` : g.name)), h('span', { class: 'muted tiny' }, (g.calc ? '= ' : '') + (g.format !== 'none' && g.kind === 'text' ? F.FORMATS.find(x => x.value === g.format).label.split(' ')[0] : '') + ` p${pi + 1}`)))) : h('p', { class: 'muted', style: { margin: 0 } }, 'No fields yet.'),
          all.length ? h('div', { class: 'grid2', style: { marginTop: '10px' } }, ui.btn('Tab order ↓', 'list', sortTabOrder), ui.btn('Try it', 'type', () => { FS.mode = 'fill'; FS.sel = new Set(); FS.flip = new Set(); L.drawOverlay(); L.renderInspector(); }, 'primary')) : null,
          all.length ? h('details', { class: 'more', style: { marginTop: '12px' }, open: L.state.formScript ? true : null }, h('summary', null, 'Document script (for experts)'),
            h('div', { class: 'stack', style: { marginTop: '8px' } },
              h('textarea', { class: 'input mono', rows: 4, value: L.state.formScript || '', placeholder: '// runs when the PDF opens (Acrobat JavaScript)', onchange: e => change('document script', () => { L.state.formScript = e.target.value; }) }),
              h('p', { class: 'muted tiny', style: { margin: 0 } }, 'Shared functions for your field scripts. ⚠ Scripts run only in Acrobat, Foxit and PDF-XChange — not in Chrome, Edge, Firefox, phone apps or this preview. Don’t make the form depend on them. Recipes: Help → User Manual → Forms.'))) : null),
      ];
    },
  });
  L.on('page', () => { FS.sel = new Set(); });
  L.on('change', () => { if (L.state.blade === 'forms' && FS.mode === 'fill') F.recalc(); });
})();
