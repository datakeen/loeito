// Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE)
// Makes the screenshots for the website and SourceForge.
//   1. start Loeito's local server:   py loeito_server.py --port 8799
//   2. run:                           node tools/shots.mjs
// Raw app screenshots go to marketing/raw/, framed marketing images to marketing/sourceforge/ (1280 × 800),
// website images to website/img/. Uses Microsoft Edge or Chrome in headless mode (nothing to install).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = process.env.LOEITO_URL || 'http://localhost:8799/index.html';
const OUT_RAW = path.join(ROOT, 'marketing', 'raw'), OUT_SF = path.join(ROOT, 'marketing', 'sourceforge'), OUT_WEB = path.join(ROOT, 'website', 'img');
for (const d of [OUT_RAW, OUT_SF, OUT_WEB]) fs.mkdirSync(d, { recursive: true });
const BROWSERS = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const exe = BROWSERS.find(p => fs.existsSync(p));
if (!exe) { console.error('Edge or Chrome is needed. Install one, then run this again.'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 9333, W = 1440, H = 900;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'loeito-shots-'));
const br = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, '--hide-scrollbars', '--force-color-profile=srgb', '--lang=en-US', 'about:blank'], { stdio: 'ignore' });
let ws, seq = 0; const pending = new Map();
async function connect() {
  for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const t = (await r.json()).find(t => t.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(200); }
  await new Promise(ok => ws.addEventListener('open', ok));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.no(new Error(m.error.message)) : p.ok(m.result); } });
}
const cdp = (method, params = {}) => new Promise((ok, no) => { const id = ++seq; pending.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params })); });
async function js(code) {
  const r = await cdp('Runtime.evaluate', { expression: `(async () => { const L = window.Loeito; ${code} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function shot(name, clip) {
  await sleep(500);
  const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  const f = path.join(OUT_RAW, name + '.png'); fs.writeFileSync(f, Buffer.from(r.data, 'base64')); console.log('  ' + path.relative(ROOT, f));
  return f;
}
async function fresh(dark = false) {
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await cdp('Page.navigate', { url: APP }); await sleep(2200);
  await js(`localStorage.setItem('loeito.seenVersion', JSON.stringify(L.VERSION)); L.setPref && L.setPref('seenVersion', L.VERSION); document.querySelectorAll('.toast').forEach(t => t.remove());`);
}
const open = names => js(`
  const files = [];
  for (const n of ${JSON.stringify(names)}) { const b = new Uint8Array(await (await fetch('samples/' + encodeURIComponent(n))).arrayBuffer()); files.push(new File([b], n, { type: 'application/pdf' })); }
  await L.openFiles(files); await new Promise(r => setTimeout(r, 1800)); document.querySelectorAll('.toast').forEach(t => t.remove());`);
const click = text => js(`const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('no button ' + ${JSON.stringify(text)}); b.click();`);
const clean = () => js(`document.querySelectorAll('.toast').forEach(t => t.remove()); document.activeElement && document.activeElement.blur && document.activeElement.blur();`);

const BEFORE_AFTER = [
  ['ba-before', async () => { await fresh(); await open(['Registration Form (scanned).pdf']); await js(`L.setBlade('forms'); for (let i = 0; i < 40 && !(L.viewer.view && document.querySelector('#sheet').offsetWidth > 400); i++) await new Promise(r => setTimeout(r, 200)); await new Promise(r => setTimeout(r, 800));`); }],
  ['ba-after', async () => { await click('Find fields'); await sleep(9000); await js(`document.querySelectorAll('.sel, .selected').forEach(e => e.classList.remove('sel', 'selected')); L.formsUI && L.formsUI.sel && L.formsUI.sel.clear(); L.drawOverlay(); await new Promise(r => setTimeout(r, 400));`); }],
];
const SCENES = [
  ['01-welcome', async () => { await fresh(); }],
  ['02-read', async () => { await fresh(); await open(['Riverside Water Report.pdf']); await js(`L.setBlade('view'); await new Promise(r => setTimeout(r, 1200));`); }],
  ['03-edit', async () => { await fresh(); await open(['Riverside Water Report.pdf']); await js(`L.setBlade('edit'); await new Promise(r => setTimeout(r, 1200));`); }],
  ['04-merge', async () => {
    await fresh();
    await js(`const get = async n => new File([new Uint8Array(await (await fetch('samples/' + encodeURIComponent(n))).arrayBuffer())], n, { type: 'application/pdf' });
      L.openMerge([await get('Riverside Water Report.pdf'), await get('Registration Form (scanned).pdf')]); await new Promise(r => setTimeout(r, 2500));
      L.merge.folder = ['D:', 'Reports', '2026'].join(String.fromCharCode(92)); L.merge.files.forEach(f => { f.path = null; }); document.querySelector('.merge .chip, .merge [class*=show]')?.click();`);
    await js(`const b = [...document.querySelectorAll('.merge button')].find(b => /Show pages/.test(b.textContent)); b && b.click(); await new Promise(r => setTimeout(r, 900));`);
  }],
  ['05-forms', async () => { await fresh(); await open(['Registration Form (scanned).pdf']); await js(`L.setBlade('forms'); await new Promise(r => setTimeout(r, 1500));`); await click('Find fields'); await sleep(9000); }],
  ['06-tables', async () => { await fresh(); await open(['Riverside Water Report.pdf']); await js(`L.go(1); L.setBlade('tables'); await new Promise(r => setTimeout(r, 2000));`); await click('Find tables'); await sleep(5000); }],
  ['07-searchable', async () => { await fresh(); await open(['Registration Form (scanned).pdf']); await js(`L.setBlade('ocr'); await new Promise(r => setTimeout(r, 1200));`); await click('Make Searchable'); await js(`for (let i = 0; i < 90 && !(L.state.pages[0] && L.state.pages[0].ocr); i++) await new Promise(r => setTimeout(r, 500)); L.openSearch && L.openSearch(); const inp = document.querySelector('#search-input'); if (inp) { inp.value = 'Programme'; inp.dispatchEvent(new Event('input')); } await new Promise(r => setTimeout(r, 3000));`); }],
  ['08-protect', async () => { await fresh(); await open(['Riverside Water Report.pdf']); await js(`L.setBlade('protect'); await new Promise(r => setTimeout(r, 1200));`); }],
  ['09-covers', async () => { await fresh(); await open(['Riverside Water Report.pdf']); await js(`L.setBlade('covers'); await new Promise(r => setTimeout(r, 2000));`); }],
  ['10-stamp', async () => { await fresh(); await open(['Riverside Water Report.pdf']); await js(`L.setBlade('stamp'); await new Promise(r => setTimeout(r, 1500));`); }],
  ['11-pages', async () => { await fresh(); await open(['Riverside Water Report.pdf']); await js(`L.setBlade('pages'); await new Promise(r => setTimeout(r, 1500));`); }],
  ['12-palette', async () => { await fresh(); await open(['Riverside Water Report.pdf']); await js(`L.openPalette(); await new Promise(r => setTimeout(r, 300)); const i = document.querySelector('.palette input'); i.value = 'merge'; i.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 500));`); }],
  ['13-dark', async () => { await fresh(true); await open(['Riverside Water Report.pdf']); await js(`L.setBlade('edit'); await new Promise(r => setTimeout(r, 1200));`); }],
  ['14-rulers', async () => {
    await fresh(); await open(['Riverside Water Report.pdf']);
    await js(`L.setBlade('crop'); await new Promise(r => setTimeout(r, 1200)); L.setPref('rulers', true); L.state.guides = { v: [56.7, 538.6], h: [62.4, 780] }; L.rulers.draw(); await new Promise(r => setTimeout(r, 400));`);
  }],
];

const FRAMES = {
  '01-welcome': ['Every PDF task. Just enough.', 'Read, merge, edit, sign, fill forms, OCR and protect. Free, private and offline.'],
  '02-read': ['A calm place to read', 'Themes, focus mode, contents and read-aloud, with every page in one smooth scroll.'],
  '03-edit': ['Edit like it was yours', 'Fix text, highlight, draw, add pictures and sign, right on the page.'],
  '04-merge': ['Merge in the order you want', 'Drag files and pages, rotate and drop, then save where you choose.'],
  '05-forms': ['Turn paper forms into fillable PDFs', 'Ten templates, fields found automatically, a date calendar and totals.'],
  '06-tables': ['Tables out, ready for Excel', 'Pull tables from PDFs and scans into Excel, CSV, Word or Markdown.'],
  '07-searchable': ['Scans you can search and copy', 'Offline text recognition, including Urdu, Arabic, Chinese and Japanese.'],
  '08-protect': ['Private details, really gone', 'Black out text for real, remove hidden data and add a password.'],
  '09-covers': ['Covers that look designed', 'Front covers and last pages for reports, books and theses.'],
  '10-stamp': ['Numbers, headers and stamps', 'Page numbers, Bates numbers, headers, footers and watermarks.'],
  '11-pages': ['Every page in its place', 'Rotate, reorder, delete, extract and split, by mouse or keyboard.'],
  '12-palette': ['Find any command with Ctrl K', 'Type what you want to do, and Loeito takes you there.'],
  '13-dark': ['Easy on the eyes after dark', 'Every tool follows your system theme.'],
  '14-rulers': ['Rulers and guides', 'Measure in millimeters or inches and drag guides out, like a design app.'],
};
const TINTS = [['#eef4ff', '#f6f0ff', '#eefaf6'], ['#fff4ea', '#fef2f6', '#f0f6ff'], ['#eefaf3', '#eef4ff', '#fbf3ff']];

function frameHtml(file, title, sub, i, dark) {
  const img = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'), t = TINTS[i % TINTS.length];
  const bg = dark ? 'linear-gradient(135deg,#0f1420,#151a2b 50%,#10181a)' : `linear-gradient(135deg,${t[0]},${t[1]} 50%,${t[2]})`;
  return `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:1280px;height:800px;overflow:hidden}
  body{background:${bg};font-family:"Segoe UI Variable Display","Segoe UI",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;position:relative}
  .blob{position:absolute;inset:0;background:radial-gradient(520px 360px at 10% 6%,rgba(10,132,255,.20),transparent 70%),radial-gradient(520px 380px at 92% 96%,rgba(175,82,222,.16),transparent 70%)}
  .k{position:absolute;top:38px;width:100%;text-align:center;font:600 13px/1 "Segoe UI",sans-serif;letter-spacing:3px;color:${dark ? '#7fb2ff' : '#0a66d9'}}
  h1{position:absolute;top:62px;width:100%;margin:0;text-align:center;font-size:44px;letter-spacing:-1px;color:${dark ? '#f3f5f9' : '#0f1726'}}
  p{position:absolute;top:122px;width:100%;margin:0;text-align:center;font-size:19px;color:${dark ? '#aab3c3' : '#4a5568'}}
  .f{position:absolute;left:112px;top:176px;width:1056px;height:660px;border-radius:14px 14px 0 0;overflow:hidden;background:#fff;
     box-shadow:0 0 0 1px rgba(0,0,0,.08),0 24px 48px -12px rgba(20,30,60,.28),0 48px 96px -24px rgba(20,30,60,.22)}
  .f img{width:100%;display:block}
  </style><div class="blob"></div><div class="k">LOEITO</div><h1>${title}</h1><p>${sub}</p><div class="f"><img src="${img}"></div>`;
}
async function toWebp(file, outBase, widths = [1600, 800]) {
  const src = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
  await cdp('Page.navigate', { url: 'about:blank' }); await sleep(150);
  for (const w of widths) {
    const r = await cdp('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `new Promise(ok => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = ${w}; c.height = Math.round(i.height * ${w} / i.width); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL('image/webp', 0.86)); }; i.src = ${JSON.stringify(src)}; })` });
    fs.writeFileSync(`${outBase}-${w}.webp`, Buffer.from(r.result.value.split(',')[1], 'base64'));
  }
}
// the page alone, for the before/after slider
async function sheetShot(name) {
  const r = await js(`const el = L.readerActive && L.readerActive() ? document.querySelector('#reader-pages .rpage') : document.querySelector('#sheet'); const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height };`);
  return shot(name, r);
}
async function compose(raws) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  let i = 0;
  for (const [name, file] of raws) {
    const [title, sub] = FRAMES[name];
    const html = path.join(profile, 'frame.html'); fs.writeFileSync(html, frameHtml(file, title, sub, i, name === '13-dark'));
    await cdp('Page.navigate', { url: 'file:///' + html.replace(/\\/g, '/') }); await sleep(700);
    const r = await cdp('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_SF, name + '.png'), Buffer.from(r.data, 'base64')); console.log('  marketing/sourceforge/' + name + '.png'); i++;
  }
}

async function social([name, file]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 640, deviceScaleFactor: 1, mobile: false });
  const html = path.join(profile, 'social.html');
  fs.writeFileSync(html, frameHtml(file, 'Every PDF task. Just enough.', 'Free, private and offline. Windows, macOS, Linux and your browser.', 0, false).replace('height:800px', 'height:640px'));
  await cdp('Page.navigate', { url: 'file:///' + html.replace(/\\/g, '/') }); await sleep(700);
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ROOT, 'website', 'social-preview.png'), Buffer.from(r.data, 'base64')); console.log('  website/social-preview.png');
}
try {
  await connect();
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false });
  const only = process.argv.slice(2), raws = [];
  console.log('App screenshots');
  for (const [name, run] of SCENES) {
    if (only.length && !only.includes(name)) continue;
    try { await run(); await clean(); raws.push([name, await shot(name)]); } catch (e) { console.warn('  skipped ' + name + ': ' + e.message); }
  }
  if (!only.length || only.includes('ba')) {
    console.log('Before and after');
    for (const [name, run] of BEFORE_AFTER) { try { await run(); await clean(); raws.push([name, await sheetShot(name)]); } catch (e) { console.warn('  skipped ' + name + ': ' + e.message); } }
  }
  console.log('Website images');
  for (const [name, file] of raws) { await toWebp(file, path.join(OUT_WEB, name), name.startsWith('ba-') ? [1000] : [1600, 800]); console.log('  website/img/' + name + '-*.webp'); }
  const framed = raws.filter(([n]) => FRAMES[n]);
  console.log('Marketing images'); await compose(framed); if (framed.find(([n]) => n === '01-welcome')) await social(framed.find(([n]) => n === '03-edit') || framed[0]);
} finally { try { ws && ws.close(); } catch {} br.kill(); }
