// Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE)
// The desktop app's local server: the same API as loeito_server.py, in Node (no Python needed for files and folders).
//   /api/status · /api/fs/{places,list,read,mkdir,write,reveal} · /api/convert (Office → PDF) · /api/pdf/{encrypt,decrypt}
// Listens on 127.0.0.1 only; every API call must come from Loeito's own window (header + Host + Origin checks).
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const OFFICE = new Set(['.doc', '.docx', '.docm', '.rtf', '.odt', '.txt', '.xls', '.xlsx', '.xlsm', '.ods', '.csv', '.ppt', '.pptx', '.odp']);
const OPEN = new Set(['.pdf', '.png', '.jpg', '.jpeg', ...OFFICE]);
const SAVE = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.zip', '.txt', '.csv', '.tsv', '.json', '.xlsx', '.md', '.html', '.geojson', '.kml', '.gpx', '.dxf', '.ldb', '.pol', '.pli', '.xyz', '.xyn', '.svg', '.wkt']);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.ps1': 'text/plain' };
const MAX = 500 * 1024 * 1024;
const BAD = /[\\/:*?"<>|]/;

function create({ root, getPath, reveal, ocrDir }) {
  // OCR languages installed next to the app (the installer lets people leave some out)
  const ocrLangs = () => { try { return fs.readdirSync(ocrDir).filter(f => f.endsWith('.traineddata.gz')).map(f => f.replace('.traineddata.gz', '')); } catch { return null; } };
  const safetyDir = path.join(getPath('userData'), 'Safety copies');
  const which = cmd => spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' }).status === 0;
  const python = ['py', 'python3', 'python'].find(p => spawnSync(p, ['-c', 'import pypdf, cryptography'], { encoding: 'utf8' }).status === 0) || null;
  // LibreOffice (free) converts Word, Excel, PowerPoint and OpenDocument files on Windows, macOS and Linux
  const sofficePaths = ['/Applications/LibreOffice.app/Contents/MacOS/soffice', 'C:\\Program Files\\LibreOffice\\program\\soffice.exe', 'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'];
  const soffice = sofficePaths.find(p => fs.existsSync(p)) || (process.platform === 'win32' ? null : ['soffice', 'libreoffice'].find(which)) || null;
  // Microsoft Office on Windows: registered Word / Excel / PowerPoint automation
  const msOffice = process.platform === 'win32' && ['Word', 'Excel', 'PowerPoint'].some(a => spawnSync('reg', ['query', `HKCR\\${a}.Application\\CLSID`], { encoding: 'utf8' }).status === 0);

  const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Content-Length': Buffer.byteLength(body) }); res.end(body); };
  const json = (res, obj, code = 200) => send(res, code, JSON.stringify(obj));
  const body = req => new Promise((ok, no) => { const parts = []; let n = 0; req.on('data', c => { n += c.length; if (n > MAX) { no(new Error('Larger than 500 MB')); req.destroy(); } else parts.push(c); }); req.on('end', () => ok(Buffer.concat(parts))); req.on('error', no); });
  const fromLoeito = (req, port) => { const ours = [`localhost:${port}`, `127.0.0.1:${port}`], o = req.headers.origin; return req.headers['x-loeito'] === '1' && ours.includes(req.headers.host) && (!o || ours.some(h => o === `http://${h}`)); };

  function drives() {
    if (process.platform === 'win32') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => `${c}:\\`).filter(d => { try { fs.accessSync(d); return true; } catch { return false; } }).map(d => ({ name: `Disk (${d.slice(0, 2)})`, path: d }));
    const out = [{ name: 'Computer', path: '/' }];
    for (const base of ['/Volumes', `/media/${os.userInfo().username}`, '/mnt']) try { for (const v of fs.readdirSync(base)) out.push({ name: v, path: path.join(base, v) }); } catch {}
    return out;
  }
  function keepSafety(file) {
    fs.mkdirSync(safetyDir, { recursive: true });
    const cutoff = Date.now() - 30 * 864e5;
    for (const f of fs.readdirSync(safetyDir)) { const p = path.join(safetyDir, f); try { if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p); } catch {} }
    const stamp = new Date().toISOString().replace('T', ' ').replace(/:/g, '.').slice(0, 19);
    const dest = path.join(safetyDir, `${stamp} - ${path.basename(file)}`);
    fs.copyFileSync(file, dest); return dest;
  }
  const run = (cmd, args, input) => new Promise((ok, no) => {
    const p = spawn(cmd, args, { windowsHide: true }); const out = [], err = [];
    p.stdout.on('data', d => out.push(d)); p.stderr.on('data', d => err.push(d));
    p.on('error', no); p.on('close', code => (code === 0 ? ok(Buffer.concat(out)) : no(new Error(Buffer.concat(err).toString().trim().split('\n').pop() || 'Failed'))));
    if (input) { p.stdin.end(input); } else p.stdin.end();
  });

  async function api(req, res, port) {
    const url = new URL(req.url, 'http://x'), r = url.pathname, q = Object.fromEntries(url.searchParams);
    if (r === '/api/status') return json(res, { ok: true, app: 'loeito', root, office: msOffice || !!soffice, apps: { microsoft: msOffice, libreoffice: !!soffice }, types: [...OFFICE], ocrLangs: ocrLangs(), fs: true, crypto: !!python, desktop: true });
    if (!fromLoeito(req, port)) return json(res, { error: 'Not allowed' }, 403);
    try {
      if (r === '/api/fs/places') return json(res, { places: [['desktop', 'Desktop'], ['documents', 'Documents'], ['downloads', 'Downloads']].map(([id, name]) => ({ id, name, path: getPath(id) })), drives: drives(), home: os.homedir(), safety: safetyDir, sep: path.sep });
      if (r === '/api/fs/list') {
        // Read the folder without blocking the app: big or cloud-synced folders used to freeze the window.
        const p = path.resolve(q.path || os.homedir()), entries = [];
        const names = (await fs.promises.readdir(p, { withFileTypes: true }))
          .filter(e => !/^(\.|\$|~\$)/.test(e.name) && !/^(desktop\.ini|thumbs\.db)$/i.test(e.name)).slice(0, 5000);
        for (let i = 0; i < names.length; i += 64) {
          const part = await Promise.all(names.slice(i, i + 64).map(e => fs.promises.stat(path.join(p, e.name))
            .then(st => ({ name: e.name, dir: st.isDirectory(), size: st.isDirectory() ? 0 : st.size, mtime: st.mtimeMs }))
            .catch(() => (e.isDirectory() ? { name: e.name, dir: true, size: 0, mtime: 0 } : null))));
          entries.push(...part.filter(Boolean));
        }
        const parent = path.dirname(p); return json(res, { path: p, parent: parent === p ? null : parent, entries });
      }
      if (r === '/api/fs/read') { const p = path.resolve(q.path || ''); if (!OPEN.has(path.extname(p).toLowerCase())) return json(res, { error: 'Loeito opens PDFs, pictures and Office files. Save other kinds as PDF first.' }, 415); return send(res, 200, fs.readFileSync(p), 'application/octet-stream'); }
      if (r === '/api/fs/mkdir') { const name = (q.name || '').trim(); if (!name || BAD.test(name)) return json(res, { error: 'A folder name can’t contain \\ / : * ? " < > |' }, 400); const t = path.join(path.resolve(q.path), name); if (fs.existsSync(t)) return json(res, { error: `“${name}” already exists here` }, 409); fs.mkdirSync(t); return json(res, { path: t }); }
      if (r === '/api/fs/rename') {
        const from = path.resolve(q.path || ''), name = (q.name || '').trim().replace(/\.+$/, '');
        if (!name || BAD.test(name)) return json(res, { error: 'A name can’t contain \\ / : * ? " < > |. Remove those characters and try again.' }, 400);
        const to = path.join(path.dirname(from), name + path.extname(from));
        if (!fs.existsSync(from)) return json(res, { error: 'That file has moved or was renamed. Open it again, then rename it.' }, 404);
        if (to.toLowerCase() !== from.toLowerCase() && fs.existsSync(to)) return json(res, { error: `“${path.basename(to)}” already exists there. Choose another name.`, exists: true }, 409);
        fs.renameSync(from, to); return json(res, { path: to });
      }
      if (r === '/api/fs/write') {
        const p = path.resolve(q.path || ''), name = path.basename(p);
        if (!SAVE.has(path.extname(name).toLowerCase())) return json(res, { error: 'Loeito can’t save that kind of file. Choose PDF, a picture, or a table format.' }, 415);
        if (!fs.existsSync(path.dirname(p))) return json(res, { error: 'That folder has moved or was deleted. Pick another folder.' }, 404);
        const exists = fs.existsSync(p); if (exists && q.overwrite !== '1') return json(res, { error: `“${name}” already exists`, exists: true }, 409);
        const data = await body(req), safety = exists ? keepSafety(p) : null, tmp = path.join(path.dirname(p), `.loeito-${process.pid}-${Date.now()}.tmp`);
        fs.writeFileSync(tmp, data); fs.renameSync(tmp, p);
        return json(res, { path: p, size: data.length, safety });
      }
      if (r === '/api/fs/reveal') { reveal(path.resolve(q.path || '')); return json(res, { ok: true }); }
      if (r === '/api/convert') {
        const ext = path.extname(q.name || '').toLowerCase(); if (!OFFICE.has(ext)) return json(res, { error: `${ext || 'This'} files are not supported` }, 415);
        const work = fs.mkdtempSync(path.join(os.tmpdir(), 'loeito-')), src = path.join(work, 'input' + ext), out = path.join(work, 'output.pdf');
        try {
          fs.writeFileSync(src, await body(req));
          let done = false;
          if (msOffice) { try { await run('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'tools', 'convert.ps1'), '-In', src, '-Out', out]); done = fs.existsSync(out); } catch { done = false; } }
          if (!done && soffice) { await run(soffice, ['--headless', '--norestore', `-env:UserInstallation=file:///${work.replace(/\\/g, '/')}/lo`, '--convert-to', 'pdf', '--outdir', work, src]); fs.renameSync(path.join(work, 'input.pdf'), out); done = true; }
          if (!done) return json(res, { error: 'To open this file, install the free LibreOffice (libreoffice.org) or Microsoft Office, then try again. Or save it as a PDF first.' }, 501);
          return send(res, 200, fs.readFileSync(out), 'application/pdf');
        } finally { fs.rmSync(work, { recursive: true, force: true }); }
      }
      if (r === '/api/pdf/encrypt' || r === '/api/pdf/decrypt') {
        if (!python) return json(res, { error: 'Passwords need a small add-on. Run this once in a terminal: py -m pip install pypdf cryptography, then restart Loeito.' }, 501);
        const h = k => req.headers[k] || '';
        const args = JSON.stringify({ encrypt: r.endsWith('encrypt'), password: h('x-pdf-password'), open: h('x-open-password'), owner: h('x-owner-password'), allow: h('x-allow') });
        const out = await run(python, [path.join(root, 'tools', 'pdfcrypt.py'), args], await body(req));
        return send(res, 200, out, 'application/pdf');
      }
      return json(res, { error: 'Unknown request' }, 404);
    } catch (e) { return json(res, { error: e.message || String(e) }, 500); }
  }

  const server = http.createServer((req, res) => {
    const port = server.address().port;
    if (req.url.startsWith('/api/')) return api(req, res, port);
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (rel === '/') rel = '/index.html';
    const tess = rel.match(/^\/vendor\/tessdata\/([a-z_]+\.traineddata\.gz)$/);
    if (tess && ocrDir) return fs.readFile(path.join(ocrDir, tess[1]), (err, data) => (err ? send(res, 404, 'Not installed', 'text/plain') : send(res, 200, data, 'application/gzip')));
    const file = path.join(root, path.normalize(rel).replace(/^([/\\])+/, ''));
    if (!file.startsWith(root)) return send(res, 403, 'Forbidden', 'text/plain');
    fs.readFile(file, (err, data) => (err ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream')));
  });
  return server;
}
module.exports = { create };
