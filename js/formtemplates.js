/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Form templates: ten everyday forms, laid out the way a careful designer would, with real fillable fields,
   formats and totals. A template is a short description (sections, rows, tables, choices…); the layout engine turns
   it into PDF pages (vector, Helvetica) plus Loeito form fields, then opens it in a new tab ready to adapt. */
(() => {
  const L = window.Loeito, h = L.h, ui = L.ui;
  const P = () => PDFLib;

  /* ——— the ten forms (chosen from research into the most-used PDF form types; see PLAN.md Round 4 § 2) ——— */
  const EDU = { table: { cols: [{ label: 'Degree / certificate', w: 0.32 }, { label: 'Institution', w: 0.34 }, { label: 'Year', w: 0.12, format: 'number', decimals: 0 }, { label: 'Grade / CGPA', w: 0.22 }], rows: 3 } };
  const DECLARE = { text: 'I declare that the information given in this form is true and complete to the best of my knowledge.' };
  const PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Jammu & Kashmir', 'Other'];
  const T = {
    registration: { title: 'Registration Form', note: 'Admission, course or event registration with CNIC and education', blocks: [
      { head: 'Personal details' },
      { row: [{ label: 'Full name', w: 0.6, req: true }, { label: 'Father’s / guardian’s name', w: 0.4 }] },
      { row: [{ label: 'CNIC / B-Form no.', w: 0.34, format: 'cnic' }, { label: 'Date of birth', w: 0.33, format: 'date' }, { label: 'Gender', w: 0.33, kind: 'dropdown', options: ['Female', 'Male', 'Prefer not to say'] }] },
      { row: [{ label: 'Email', w: 0.5, format: 'email', req: true }, { label: 'Mobile', w: 0.5, format: 'phone', req: true }] },
      { row: [{ label: 'Postal address', w: 1 }] },
      { row: [{ label: 'City', w: 0.4 }, { label: 'Province', w: 0.35, kind: 'dropdown', options: PROVINCES }, { label: 'Postal code', w: 0.25 }] },
      { head: 'Education' }, EDU,
      { head: 'Program' },
      { row: [{ label: 'Program / course applied for', w: 0.65, req: true }, { label: 'Session', w: 0.35 }] },
      { choice: 'Preferred shift', options: ['Morning', 'Evening', 'Weekend'] },
      { head: 'Declaration' }, DECLARE, { sign: ['Signature of applicant', 'Date'] },
    ] },
    job: { title: 'Job Application', note: 'Position, education, experience and references', blocks: [
      { row: [{ label: 'Position applied for', w: 0.62, req: true }, { label: 'Expected salary (per month)', w: 0.38, format: 'currency', decimals: 0 }] },
      { head: 'About you' },
      { row: [{ label: 'Full name', w: 0.5, req: true }, { label: 'CNIC no.', w: 0.25, format: 'cnic' }, { label: 'Date of birth', w: 0.25, format: 'date' }] },
      { row: [{ label: 'Email', w: 0.5, format: 'email', req: true }, { label: 'Mobile', w: 0.5, format: 'phone', req: true }] },
      { row: [{ label: 'Address', w: 1 }] },
      { head: 'Education' }, EDU,
      { head: 'Experience — most recent first' },
      { table: { cols: [{ label: 'Organization', w: 0.3 }, { label: 'Job title', w: 0.24 }, { label: 'From', w: 0.15, format: 'date' }, { label: 'To', w: 0.15, format: 'date' }, { label: 'Years', w: 0.16, format: 'number', decimals: 1 }], rows: 3, total: { col: 'Years', label: 'Total experience (years)' } } },
      { checks: 'Available for', options: ['Full-time', 'Part-time', 'Contract', 'Remote'] },
      { row: [{ label: 'Earliest start date', w: 0.5, format: 'date' }, { label: 'Notice period', w: 0.5 }] },
      { head: 'References' },
      { table: { cols: [{ label: 'Name', w: 0.3 }, { label: 'Relationship', w: 0.22 }, { label: 'Phone', w: 0.2, format: 'phone' }, { label: 'Email', w: 0.28, format: 'email' }], rows: 2, name: 'Reference' } },
      DECLARE, { sign: ['Signature', 'Date'] },
    ] },
    leave: { title: 'Leave Application', note: 'Type of leave, dates, cover and approval', blocks: [
      { row: [{ label: 'Employee name', w: 0.5, req: true }, { label: 'Employee no.', w: 0.22 }, { label: 'Department', w: 0.28 }] },
      { row: [{ label: 'Designation', w: 0.5 }, { label: 'Phone while on leave', w: 0.5, format: 'phone' }] },
      { choice: 'Type of leave', options: ['Casual', 'Earned / annual', 'Sick', 'Maternity / paternity', 'Without pay', 'Other'], req: true },
      { row: [{ label: 'From', w: 0.33, format: 'date', req: true }, { label: 'To', w: 0.33, format: 'date', req: true }, { label: 'Number of days', w: 0.34, format: 'number', decimals: 1 }] },
      { para: 'Reason for leave', h: 52 },
      { row: [{ label: 'Duties handed over to', w: 0.6 }, { label: 'Their signature', w: 0.4, kind: 'sign' }] },
      { sign: ['Signature of applicant', 'Date'] },
      { head: 'For office use' },
      { row: [{ label: 'Leave balance before', w: 0.33, format: 'number', decimals: 1 }, { label: 'This leave', w: 0.33, format: 'number', decimals: 1 }, { label: 'Balance after', w: 0.34, format: 'number', decimals: 1 }] },
      { choice: 'Decision', options: ['Approved', 'Not approved'] },
      { approve: ['Recommended by', 'Approved by'] },
    ] },
    expense: { title: 'Expense Claim', note: 'Receipts table with an automatic total', blocks: [
      { row: [{ label: 'Name', w: 0.5, req: true }, { label: 'Employee no.', w: 0.22 }, { label: 'Department', w: 0.28 }] },
      { row: [{ label: 'Purpose of the expense', w: 0.68 }, { label: 'Project / cost center', w: 0.32 }] },
      { head: 'Expenses' },
      { table: { cols: [{ label: 'Date', w: 0.15, format: 'date' }, { label: 'Description', w: 0.43 }, { label: 'Category', w: 0.2, kind: 'dropdown', options: ['Travel', 'Meals', 'Lodging', 'Fuel', 'Supplies', 'Other'] }, { label: 'Amount', w: 0.22, format: 'currency' }], rows: 8, total: { col: 'Amount', label: 'Total claimed' } } },
      { row: [{ label: 'Advance received', w: 0.5, format: 'currency' }, { label: 'Balance to be paid', w: 0.5, format: 'currency' }] },
      { checks: null, options: ['All receipts are attached'] },
      { sign: ['Signature of claimant', 'Date'] },
      { approve: ['Checked by (accounts)', 'Approved by'] },
    ] },
    invoice: { title: 'Invoice', note: 'Line items: quantity × rate, subtotal, total', meta: [['Invoice no.', ''], ['Date', 'date'], ['Due date', 'date']], blocks: [
      { row: [{ label: 'Bill to', w: 0.5, kind: 'para', h: 54 }, { label: 'From', w: 0.5, kind: 'para', h: 54 }] },
      { table: { cols: [{ label: 'Description', w: 0.46 }, { label: 'Qty', w: 0.12, format: 'number', decimals: 0 }, { label: 'Rate', w: 0.2, format: 'currency' }, { label: 'Amount', w: 0.22, format: 'currency', prd: ['Qty', 'Rate'] }], rows: 8, total: { col: 'Amount', label: 'Subtotal' } } },
      { totals: [{ label: 'Tax', format: 'currency' }, { label: 'Shipping', format: 'currency' }, { label: 'Total due', format: 'currency', sum: ['Subtotal', 'Tax', 'Shipping'], strong: true }] },
      { para: 'Payment details and notes', h: 46 },
      { text: 'Thank you for your business.' },
    ] },
    purchase: { title: 'Purchase Requisition', note: 'Items, estimated cost, budget and approvals', blocks: [
      { row: [{ label: 'Requested by', w: 0.4, req: true }, { label: 'Department', w: 0.32 }, { label: 'Date', w: 0.28, format: 'date' }] },
      { row: [{ label: 'Budget head / cost center', w: 0.5 }, { label: 'Needed by', w: 0.5, format: 'date' }] },
      { head: 'Items' },
      { table: { cols: [{ label: 'Item and specification', w: 0.42 }, { label: 'Unit', w: 0.1 }, { label: 'Qty', w: 0.12, format: 'number', decimals: 0 }, { label: 'Unit price', w: 0.17, format: 'currency' }, { label: 'Amount', w: 0.19, format: 'currency', prd: ['Qty', 'Unit price'] }], rows: 7, total: { col: 'Amount', label: 'Estimated total' } } },
      { choice: 'Priority', options: ['Normal', 'Urgent'] },
      { para: 'Why is it needed?', h: 46 },
      { approve: ['Head of department', 'Finance', 'Approving authority'] },
    ] },
    feedback: { title: 'Feedback Survey', note: 'Rating grid, recommendation and comments', blocks: [
      { row: [{ label: 'Name (optional)', w: 0.55 }, { label: 'Date', w: 0.45, format: 'date' }] },
      { row: [{ label: 'Course / event / service', w: 1 }] },
      { head: 'How would you rate…' },
      { rating: { items: ['Overall experience', 'Quality of the content', 'Clarity of communication', 'Organization and timing', 'Value for your time', 'Venue and facilities'], scale: ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] } },
      { choice: 'Would you recommend it to others?', options: ['Yes', 'Maybe', 'No'] },
      { para: 'What did you like most?', h: 46 },
      { para: 'What could be better?', h: 46 },
      { text: 'Thank you — your answers help us improve.' },
    ] },
    consent: { title: 'Consent & Release', note: 'Statements to check, guardian and signatures', blocks: [
      { row: [{ label: 'Participant’s full name', w: 0.62, req: true }, { label: 'Date of birth', w: 0.38, format: 'date' }] },
      { row: [{ label: 'Activity / study / event', w: 1 }] },
      { text: 'Please read each statement and check it to confirm.' },
      { checks: null, list: true, options: ['I have read and understood the information about this activity.', 'I have had the chance to ask questions, and they were answered.', 'I take part voluntarily and may withdraw at any time without giving a reason.', 'I agree that photographs or recordings may be used as described.', 'I agree that my information is kept confidential and used only as described.'] },
      { row: [{ label: 'Emergency contact', w: 0.55 }, { label: 'Emergency phone', w: 0.45, format: 'phone' }] },
      { sign: ['Signature of participant', 'Date'] },
      { head: 'If the participant is under 18' },
      { row: [{ label: 'Parent / guardian name', w: 0.62 }, { label: 'Relationship', w: 0.38 }] },
      { sign: ['Signature of parent / guardian', 'Date'] },
    ] },
    timesheet: { title: 'Weekly Timesheet', note: 'Hours per day with an automatic weekly total', blocks: [
      { row: [{ label: 'Employee name', w: 0.5, req: true }, { label: 'Employee no.', w: 0.22 }, { label: 'Week starting', w: 0.28, format: 'date' }] },
      { row: [{ label: 'Department', w: 0.5 }, { label: 'Supervisor', w: 0.5 }] },
      { table: { cols: [{ label: 'Day', w: 0.18, fixed: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }, { label: 'Start', w: 0.13 }, { label: 'Finish', w: 0.13 }, { label: 'Break (h)', w: 0.13, format: 'number', decimals: 2 }, { label: 'Hours', w: 0.13, format: 'number', decimals: 2 }, { label: 'Notes', w: 0.3 }], rows: 7, total: { col: 'Hours', label: 'Total hours' } } },
      { row: [{ label: 'Overtime hours', w: 0.5, format: 'number', decimals: 2 }, { label: 'Leave hours', w: 0.5, format: 'number', decimals: 2 }] },
      { sign: ['Signature of employee', 'Date'] },
      { approve: ['Approved by supervisor'] },
    ] },
    service: { title: 'Service / IT Request', note: 'Request type, priority, description, sign-off', blocks: [
      { row: [{ label: 'Requested by', w: 0.5, req: true }, { label: 'Department', w: 0.28 }, { label: 'Phone / ext.', w: 0.22 }] },
      { row: [{ label: 'Email', w: 0.5, format: 'email' }, { label: 'Location / room', w: 0.5 }] },
      { choice: 'Type of request', options: ['Hardware', 'Software', 'Network / internet', 'Account / access', 'Repair / maintenance', 'Other'], req: true },
      { choice: 'Priority', options: ['Low', 'Normal', 'High', 'Critical'] },
      { row: [{ label: 'Asset / tag no.', w: 0.5 }, { label: 'Needed by', w: 0.5, format: 'date' }] },
      { para: 'Describe the problem or request', h: 70, req: true },
      { sign: ['Signature of requester', 'Date'] },
      { head: 'For the service desk' },
      { row: [{ label: 'Ticket no.', w: 0.33 }, { label: 'Assigned to', w: 0.33 }, { label: 'Completed on', w: 0.34, format: 'date' }] },
      { para: 'Action taken', h: 46 },
      { approve: ['Completed by', 'Confirmed by requester'] },
    ] },
  };
  L.FORM_TEMPLATES = T;

  /* ——— layout engine ——— */
  const GRAY = [0.43, 0.43, 0.45], INK = [0.11, 0.11, 0.12], LINE = [0.78, 0.78, 0.8], FILL = [0.985, 0.985, 0.99];
  L.formTemplatePdf = async (id, { org = '', accent = '#0071e3', paper = 'A4' } = {}) => {
    const { PDFDocument, StandardFonts, rgb } = P();
    const tpl = T[id], doc = await PDFDocument.create();
    const reg = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const [PW, PH] = paper === 'Letter' ? [612, 792] : [595.28, 841.89];
    const M = 48, CW = PW - 2 * M, BOTTOM = 56, ac = L.hexToRgb(accent);
    const C = a => rgb(a[0], a[1], a[2]), acc = rgb(...ac), accTint = rgb(...ac.map(c => c + (1 - c) * 0.9));
    const pages = []; let pg, y, fields;
    const names = new Set();
    const uniq = base => { base = String(base).replace(/[.\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Field'; let n = base, k = 2; while (names.has(n)) n = `${base} ${k++}`; names.add(n); return n; };
    const newPage = () => { pg = doc.addPage([PW, PH]); fields = []; pages.push({ pg, fields }); y = PH - M; };
    const need = hh => { if (y - hh < BOTTOM) { newPage(); y -= 4; } };
    const text = (s, x, yy, size, font = reg, color = INK, opts = {}) => {
      s = L.winAnsi(s); const w = font.widthOfTextAtSize(s, size);
      pg.drawText(s, { x: opts.align === 'right' ? x - w : opts.align === 'center' ? x - w / 2 : x, y: yy, size, font, color: C ? (Array.isArray(color) ? C(color) : color) : color });
      return w;
    };
    const wrapLines = (s, font, size, maxW) => { const out = []; let cur = ''; for (const w of L.winAnsi(s).split(/\s+/)) { const t = cur ? cur + ' ' + w : w; if (font.widthOfTextAtSize(t, size) <= maxW || !cur) cur = t; else { out.push(cur); cur = w; } } if (cur) out.push(cur); return out; };
    const box = (x, yy, w, hh) => pg.drawRectangle({ x, y: yy, width: w, height: hh, color: C(FILL), borderColor: C(LINE), borderWidth: 0.6 });
    const field = (kind, r, props) => { const f = L.forms.make(kind, r, { style: 'box', ...props }); fields.push(f); return f; };
    const fmtProps = c => ({ format: c.format || 'none', decimals: c.decimals ?? 2, ...(c.kind === 'dropdown' ? { options: c.options } : {}) });
    // labels are Label objects that belong to their field: they can be edited, recolored and moved with it, and the
    // red * follows the field's Required setting
    const hex = a => '#' + a.map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
    const ltext = (s, x, base, size, font = reg, color = INK, opts = {}, owner = null) => {
      const isBold = font === bold, tw = font.widthOfTextAtSize(L.winAnsi(s), size), pad = size * 0.3;
      const bx = opts.align === 'right' ? x - tw - pad : opts.align === 'center' ? x - tw / 2 - pad : x;
      fields.push(L.forms.make('label', { x: bx, y: base - size * 0.4, w: tw + 2 * pad + (owner && owner.required ? size : 0), h: size * 1.6 }, { text: s, fontSize: size, bold: isBold, color: hex(Array.isArray(color) ? color : INK), align: opts.align === 'right' ? 'right' : opts.align === 'center' ? 'center' : 'left', of: owner ? owner.id : null }));
      return tw;
    };
    const flabel = (s, x, base, size, owner, { isBold = false, color = GRAY, w } = {}) => {
      const tw = (isBold ? bold : reg).widthOfTextAtSize(L.winAnsi(s), size) + size * 1.4;
      fields.push(L.forms.make('label', { x, y: base - size * 0.4, w: Math.max(w || 0, tw), h: size * 1.6 }, { text: s, fontSize: size, bold: isBold, color: hex(color), of: owner ? owner.id : null }));
    };
    const section = s => { need(40); y -= 14; ltext(s.toUpperCase(), M, y - 9, 8.5, bold, ac); y -= 14; fields.push(L.forms.make('line', { x: M, y: y - 3, w: CW, h: 6 }, { color: hex(LINE), lineW: 0.5 })); y -= 10; };
    const rowFields = cells => {
      const hh = Math.max(...cells.map(c => c.h || (c.kind === 'para' ? 46 : c.kind === 'sign' ? 26 : 20)));
      need(hh + 22);
      let x = M; const gap = 10, avail = CW - gap * (cells.length - 1);
      for (const c of cells) {
        const w = avail * c.w, fh = c.h || (c.kind === 'para' ? 46 : c.kind === 'sign' ? 26 : 20);
        const by = y - 12 - fh;
        const f = field(c.kind || 'text', { x: x + 1, y: by + 1, w: w - 2, h: fh - 2 }, { name: uniq(c.label), required: !!c.req, ...fmtProps(c), ...(c.kind === 'para' ? { fontSize: 9 } : {}) });
        flabel(c.label, x, y - 8, 7.5, f, { w: Math.min(w, 200) });
        x += w + gap;
      }
      y -= 12 + hh + 10;
    };
    const choice = b => {
      const group = uniq(b.choice), opts = b.options;
      need(40);
      const titleY = y - 9;
      y -= 16;
      let x = M; const rowH = 18; let first = true;
      for (const o of opts) {
        const ow = 16 + reg.widthOfTextAtSize(L.winAnsi(o), 9) + 18;
        if (x + ow > M + CW) { x = M; y -= rowH; need(rowH); }
        const rf = field('radio', { x: x, y: y - 13, w: 12, h: 12 }, { group, name: group, exportValue: o, required: !!b.req && first });
        if (first) flabel(b.choice, M, titleY, 8.5, rf, { isBold: true, color: INK });
        flabel(o, x + 16, y - 10, 9, null, { color: INK });
        x += ow; first = false;
      }
      y -= rowH + 8;
    };
    const checks = b => {
      if (b.checks) { need(20); ltext(b.checks, M, y - 9, 8.5, bold); y -= 16; }
      let x = M;
      for (const o of b.options) {
        if (b.list || b.checks == null) {
          const ls = wrapLines(o, reg, 9, CW - 22), hh = ls.length * 12 + 6; need(hh);
          const cf = field('check', { x, y: y - 12, w: 10, h: 10 }, { name: uniq(o.replace(/^I (have |agree |take )?/i, '').slice(0, 40)) });
          ls.forEach((l, i) => ltext(l, x + 18, y - 10 - i * 12, 9, reg, INK, {}, cf));
          y -= hh;
        } else {
          const ow = 18 + reg.widthOfTextAtSize(L.winAnsi(o), 9) + 18;
          if (x + ow > M + CW) { x = M; y -= 18; }
          const cf = field('check', { x, y: y - 12, w: 10, h: 10 }, { name: uniq(`${b.checks}: ${o}`) });
          ltext(o, x + 16, y - 10, 9, reg, INK, {}, cf); x += ow;
        }
      }
      y -= b.list || b.checks == null ? 6 : 26;
    };
    const table = t => {
      const RH = 20, HH = 18, n = t.rows, totalH = HH + n * RH + (t.total ? RH : 0);
      need(Math.min(totalH, HH + 3 * RH) + 8);
      const xs = []; let x = M; for (const c of t.cols) { xs.push(x); x += CW * c.w; }
      const head = () => {
        pg.drawRectangle({ x: M, y: y - HH, width: CW, height: HH, color: accTint });
        t.cols.forEach((c, i) => text(c.label, xs[i] + 5, y - 12, 7.5, bold, INK));
        y -= HH;
      };
      head();
      for (let r = 1; r <= n; r++) {
        if (y - RH < BOTTOM) { newPage(); y -= 4; head(); }
        if (r % 2 === 0) pg.drawRectangle({ x: M, y: y - RH, width: CW, height: RH, color: C(FILL) });
        t.cols.forEach((c, i) => {
          const w = CW * c.w;
          if (c.fixed) { text(c.fixed[r - 1] || '', xs[i] + 5, y - 13, 9); return; }
          const nm = t.name ? `${t.name} ${r} ${c.label}` : `${c.label} ${r}`;
          const f = field(c.kind || 'text', { x: xs[i] + 2, y: y - RH + 2, w: w - 4, h: RH - 4 }, { name: uniq(nm), style: 'plain', ...fmtProps(c), ...(L.forms.numeric({ format: c.format || 'none' }) ? { align: 'right' } : {}) });
          if (c.prd) { f.calc = { op: 'PRD', of: c.prd.map(k => (t.name ? `${t.name} ${r} ${k}` : `${k} ${r}`)) }; f.readOnly = true; }
        });
        pg.drawLine({ start: { x: M, y: y - RH }, end: { x: M + CW, y: y - RH }, thickness: 0.4, color: C(LINE) });
        y -= RH;
      }
      if (t.total) {
        const ci = t.cols.findIndex(c => c.label === t.total.col), c = t.cols[ci], w = CW * c.w;
        need(RH + 4);
        text(t.total.label, xs[ci] - 8, y - 13, 8.5, bold, INK, { align: 'right' });
        pg.drawRectangle({ x: xs[ci], y: y - RH, width: w, height: RH, color: accTint });
        const of = Array.from({ length: n }, (_, k) => (t.name ? `${t.name} ${k + 1} ${c.label}` : `${c.label} ${k + 1}`));
        field('text', { x: xs[ci] + 2, y: y - RH + 2, w: w - 4, h: RH - 4 }, { name: uniq(t.total.label), style: 'plain', ...fmtProps(c), align: 'right', readOnly: true, calc: { op: 'SUM', of } });
        y -= RH;
      }
      y -= 14;
    };
    const totals = list => {
      for (const t of list) {
        need(24);
        const w = 150, x = M + CW - w;
        text(t.label, x - 10, y - 13, t.strong ? 9.5 : 8.5, t.strong ? bold : reg, INK, { align: 'right' });
        field('text', { x: x + 2, y: y - 18, w: w - 4, h: 16 }, { name: uniq(t.label), format: t.format || 'none', align: 'right', ...(t.sum ? { calc: { op: 'SUM', of: t.sum }, readOnly: true } : {}) });
        y -= 26;
      }
      y -= 4;
    };
    const rating = r => {
      const iw = CW * 0.4, cw = (CW - iw) / r.scale.length, RH = 20;
      need(RH * 2 + 10);
      pg.drawRectangle({ x: M, y: y - 18, width: CW, height: 18, color: accTint });
      r.scale.forEach((s, i) => text(s, M + iw + cw * i + cw / 2, y - 12, 7.5, bold, INK, { align: 'center' }));
      y -= 18;
      r.items.forEach((it, k) => {
        need(RH);
        if (k % 2) pg.drawRectangle({ x: M, y: y - RH, width: CW, height: RH, color: C(FILL) });
        text(it, M + 6, y - 13, 9);
        const group = uniq(it);
        r.scale.forEach((s, i) => {
          const cx = M + iw + cw * i + cw / 2;
          field('radio', { x: cx - 6, y: y - RH / 2 - 6, w: 12, h: 12 }, { group, name: group, exportValue: s });
        });
        y -= RH;
      });
      y -= 12;
    };
    const statement = s => { const ls = wrapLines(s, reg, 9, CW); need(ls.length * 13 + 6); ls.forEach((l, i) => ltext(l, M, y - 10 - i * 13, 9, reg, [0.23, 0.23, 0.24])); y -= ls.length * 13 + 8; };
    const signRow = ([a, b]) => rowFields([{ label: a, w: 0.62, kind: 'sign', req: true }, { label: b, w: 0.38, format: 'date' }]);
    const approvals = list => {
      const n = list.length, gap = 14, w = (CW - gap * (n - 1)) / n;
      need(96); y -= 4;
      list.forEach((who, i) => {
        const x = M + i * (w + gap); let yy = y;
        ltext(who, x, yy - 9, 8.5, bold); yy -= 16;
        for (const [lab, kind, fmt] of [['Name', 'text'], ['Signature', 'sign'], ['Date', 'text', 'date']]) {
          const fh = kind === 'sign' ? 22 : 18, by = yy - 11 - fh;
          const af = field(kind, { x: x + 1, y: by + 1, w: w - 2, h: fh - 2 }, { name: uniq(`${who} — ${lab}`), format: fmt || 'none' });
          flabel(lab, x, yy - 8, 7.5, af);
          yy = by - 6;
        }
      });
      y -= 100;
    };

    newPage();
    // header: a short accent dash, organization, title, and (for invoices) reference fields on the right
    pg.drawRectangle({ x: M, y: y - 3, width: 28, height: 3, color: acc });
    if (org) ltext(org.toUpperCase(), M, y - 18, 8.5, bold, GRAY);
    ltext(tpl.title, M, y - (org ? 40 : 30), 21, bold, INK);
    if (tpl.meta) {
      let my = y - 4; const w = 140, x = M + CW - w;
      for (const [lab, fmt] of tpl.meta) { const mf = field('text', { x: x + 1, y: my - 17, w: w - 2, h: 16 }, { name: uniq(lab), format: fmt || 'none' }); ltext(lab, x - 8, my - 13, 8, reg, GRAY, { align: 'right' }, mf); my -= 22; }
      y = Math.min(y - (org ? 52 : 42), my);
    } else y -= org ? 52 : 42;
    pg.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.8, color: C(INK) });
    y -= 8;
    for (const b of tpl.blocks) {
      if (b.head) section(b.head);
      else if (b.row) rowFields(b.row);
      else if (b.para) rowFields([{ label: b.para, w: 1, kind: 'para', h: b.h, req: b.req }]);
      else if (b.choice) choice(b);
      else if ('checks' in b) checks(b);
      else if (b.table) table(b.table);
      else if (b.totals) totals(b.totals);
      else if (b.rating) rating(b.rating);
      else if (b.text) statement(b.text);
      else if (b.sign) signRow(b.sign);
      else if (b.approve) approvals(b.approve);
    }
    pages.forEach(({ pg: p }, i) => {
      pg = p;
      if (org) text(org, M, 30, 7.5, reg, GRAY);
      text(`${tpl.title}${pages.length > 1 ? ` · ${i + 1} / ${pages.length}` : ''}`, M + CW, 30, 7.5, reg, GRAY, { align: 'right' });
    });
    doc.setTitle(tpl.title); doc.setProducer('Loeito PDF'); doc.setCreator('Loeito PDF');
    return { bytes: await doc.save(), fields: pages.map(p => p.fields) };
  };

  // Open a template as a new document (tab), ready to edit in Forms.
  L.createFromTemplate = async (id, opts) => {
    const tpl = T[id];
    const { bytes, fields } = await L.formTemplatePdf(id, opts);
    const src = await L.addSource(new Uint8Array(bytes), `${tpl.title}.pdf`);
    const doc = L.newDoc(), s = doc.state;
    s.pages = fields.map((fs, k) => { const p = L.newPage(src.id, k); p.fields = fs; return p; });
    s.name = tpl.title; s.meta = { title: tpl.title, author: opts?.org || '', subject: '', keywords: '' }; s.fileSize = bytes.length; s.blade = 'forms';
    await L.proxy(s.pages[0]);
    L.docs.push(doc);
    document.body.classList.add('has-doc');
    L.switchDoc(doc); L.setBlade('forms'); L.forms.recalc(s);
    L.toast(`“${tpl.title}” is ready — ${fields.flat().length} fields. Change anything, then Save.`, { kind: 'ok', icon: 'form', ms: 6000 });
  };

  /* ——— the gallery sheet ——— */
  L.openFormTemplates = async () => {
    let pick = L.pref('formTemplate', 'registration'), org = L.pref('formOrg', ''), accent = L.pref('formAccent', '#0071e3'), paper = L.pref('formPaper', 'A4');
    const cards = h('div', { class: 'tpl-grid' });
    const paint = () => {
      cards.replaceChildren(...Object.entries(T).map(([id, t]) => {
        const cv = h('canvas');
        const el = h('button', { class: 'tpl-card' + (id === pick ? ' on' : ''), onclick: () => { pick = id; L.$$('.tpl-card', cards).forEach(c => c.classList.toggle('on', c === el)); }, ondblclick: () => L.$('.modal-foot .primary').click() },
          h('div', { class: 'tpl-thumb' }, cv), h('b', null, t.title), h('span', null, t.note));
        thumb(id, cv);
        return el;
      }));
    };
    let run = 0;
    const thumb = async (id, cv) => {
      const my = run;
      try {
        const { bytes } = await L.formTemplatePdf(id, { org, accent, paper });
        if (my !== run) return;
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise, p = await pdf.getPage(1);
        const dpr = Math.min(2, devicePixelRatio || 1), vp = p.getViewport({ scale: 150 / p.getViewport({ scale: 1 }).width * dpr });
        cv.width = vp.width; cv.height = vp.height;
        await p.render({ canvasContext: cv.getContext('2d'), viewport: vp, intent: 'print' }).promise; pdf.destroy();
      } catch (e) { console.warn('template preview', e); }
    };
    const repaint = L.debounce(() => { run++; paint(); }, 350);
    const body = h('div', { class: 'stack', style: { gap: '14px' } },
      h('div', { class: 'tpl-opts' },
        ui.field('Organization name (top of the form)', h('input', { class: 'input', value: org, placeholder: 'e.g. Wah Engineering College', oninput: e => { org = e.target.value; repaint(); } })),
        ui.field('Paper', ui.seg([{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'Letter' }], paper, v => { paper = v; repaint(); })),
        h('div', { class: 'field' }, h('span', null, 'Accent color'), L.swatches(accent, v => { accent = v; repaint(); }, ['#0071e3', '#1d1d1f', '#30a46c', '#b5562f', '#8e4ec6', '#c08a2b']))),
      cards);
    paint();
    const go = await L.dialog({ title: 'Start from a template', text: 'Ten everyday forms with real fields, formats and totals. Pick one, then make it your own.', body, wide: 'xl',
      actions: [{ label: 'Cancel', value: false }, { label: 'Create form', primary: true, value: true }] });
    if (!go) return;
    L.setPref('formTemplate', pick); L.setPref('formOrg', org); L.setPref('formAccent', accent); L.setPref('formPaper', paper);
    const t = L.task('Making the form', { cancelable: false });
    try { await L.createFromTemplate(pick, { org, accent, paper }); } catch (e) { L.error('Couldn’t make the form', e); } finally { t.done(); }
  };
})();
