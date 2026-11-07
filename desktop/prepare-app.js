// Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE)
// Copies the web app (the repository root) into desktop/app so the installers carry it, then downloads every
// library, font and the main OCR languages into desktop/app/vendor and points the copied files at them.
// Result: the installed app works with no internet, even on its very first start. Run by "npm start" / "npm run dist".
const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..'), out = path.join(__dirname, 'app'), V = path.join(out, 'vendor');
const KEEP = ['index.html', 'js', 'css', 'docs', 'samples', 'tools', 'LICENSE', 'NOTICE.md', 'README.md', 'CHANGELOG.md', 'VERSION'];
const CACHE = path.join(__dirname, '.vendor-cache'); // downloads are kept here, so later builds are fast and work offline

// Every file the app loads from the internet in the browser version: [public URL, local path inside vendor/]
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const FILES = [
  [PDFJS + 'pdf.min.js', 'pdfjs/pdf.min.js'],
  [PDFJS + 'pdf.worker.min.js', 'pdfjs/pdf.worker.min.js'],
  ['https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', 'pdf-lib/pdf-lib.min.js'],
  ['https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', 'tesseract/tesseract.min.js'],
  ['https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js', 'tesseract/worker.min.js'],
  ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'jszip/jszip.min.js'],
  ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'sheetjs/xlsx.full.min.js'],
  ['https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js', 'sheetjs/xlsx.bundle.js'],
  // license texts that travel with the copies
  ['https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/LICENSE', 'pdfjs/LICENSE'],
  ['https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/LICENSE.md', 'pdf-lib/LICENSE.md'],
  ['https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/LICENSE.md', 'tesseract/LICENSE.md'],
  ['https://cdn.jsdelivr.net/npm/jszip@3.10.1/LICENSE.markdown', 'jszip/LICENSE.markdown'],
  ['https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/LICENSE', 'sheetjs/LICENSE'],
];
// The OCR engine comes in several builds; Tesseract.js picks the fastest one the computer supports.
const CORE = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/';
for (const f of ['tesseract-core.wasm.js', 'tesseract-core-simd.wasm.js', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) FILES.push([CORE + f, 'tesseract/core/' + f, 'optional']);
// OCR languages built into the installer (others still download once, when first chosen)
const LANGS = ['eng', 'urd', 'ara', 'swe', 'chi_sim', 'chi_tra', 'jpn'];
for (const l of LANGS) FILES.push([`https://cdn.jsdelivr.net/npm/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`, `tessdata/${l}.traineddata.gz`]);
FILES.push(['https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/LICENSE', 'tessdata/LICENSE', 'optional']);
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Caveat:wght@500&family=Homemade+Apple&display=swap';

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
async function get(url, optional) {
  const key = path.join(CACHE, url.replace(/^https?:\/\//, '').replace(/[?&=:;@,+]/g, '_'));
  if (fs.existsSync(key)) return fs.readFileSync(key);
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(r.status + ' ' + url);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.mkdirSync(path.dirname(key), { recursive: true }); fs.writeFileSync(key, buf);
      return buf;
    } catch (e) { lastErr = e; }
  }
  if (optional) { console.warn('  (skipped, optional) ' + url); return null; }
  throw lastErr;
}
const put = (rel, buf) => { const p = path.join(V, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); };
const edit = (rel, fn) => { const p = path.join(out, rel); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };
const swap = (s, a, b) => { if (!s.includes(a)) throw new Error('prepare-app: could not find ' + a); return s.split(a).join(b); };

(async () => {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const k of KEEP) { const src = path.join(repo, k); if (fs.existsSync(src)) fs.cpSync(src, path.join(out, k), { recursive: true }); }

  // 1. libraries, OCR engine and languages
  let bytes = 0;
  for (const [url, rel, opt] of FILES) { const b = await get(url, opt); if (b) { put(rel, b); bytes += b.length; } }
  // 2. fonts: the Google Fonts stylesheet, with every font file saved next to it
  let css = (await get(FONTS_CSS)).toString();
  let n = 0;
  for (const u of [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g) || [])]) {
    const name = 'f' + (n++) + path.extname(new URL(u).pathname);
    const b = await get(u); put('fonts/' + name, b); bytes += b.length; css = css.split(u).join(name);
  }
  put('fonts/fonts.css', css);

  // 3. point the copied app at vendor/
  edit('index.html', s => {
    s = swap(s, FONTS_CSS, 'vendor/fonts/fonts.css');
    s = s.replace(/<link rel="preconnect"[^>]*>\s*/g, '');
    s = swap(s, PDFJS + 'pdf.min.js', 'vendor/pdfjs/pdf.min.js');
    return swap(s, 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', 'vendor/pdf-lib/pdf-lib.min.js');
  });
  edit('js/render.js', s => swap(s, PDFJS + 'pdf.worker.min.js', 'vendor/pdfjs/pdf.worker.min.js'));
  edit('js/core.js', s => {
    for (const [url, rel] of FILES) if (url.endsWith('.js') && s.includes(url)) s = s.split(url).join('vendor/' + rel);
    const offline = { tess: { workerPath: 'vendor/tesseract/worker.min.js', corePath: 'vendor/tesseract/core', langPath: 'vendor/tessdata', langs: LANGS } };
    return swap(s, 'L.OFFLINE = null; /*LOEITO_OFFLINE*/', 'L.OFFLINE = ' + JSON.stringify(offline) + ';');
  });
  // the worker, OCR and libraries must now come from vendor/ only: fail the build if any internet address is left
  const left = [];
  for (const f of ['index.html', 'js/core.js', 'js/render.js']) {
    const s = fs.readFileSync(path.join(out, f), 'utf8');
    for (const m of s.match(/https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com)[^'"\s)]*/g) || []) left.push(f + ': ' + m);
  }
  if (left.length) throw new Error('prepare-app: still loading from the internet:\n' + left.join('\n'));

  const icon = path.join(__dirname, 'build', 'icon.png');
  if (!fs.existsSync(icon)) console.warn('desktop/build/icon.png is missing — the installers will use the default Electron icon.');
  console.log(`Prepared desktop/app with ${(bytes / 1048576).toFixed(1)} MB of built-in libraries, fonts and ${LANGS.length} OCR languages.`);
})().catch(e => { console.error(e.message || e); process.exit(1); });
