// Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE)
// Loeito desktop: the same Loeito, in its own window, with its local server built in (Windows, macOS, Linux).
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const { create } = require('./server');

// The web app is copied into ./app by "npm run prepare-app" (see package.json); fall back to the repository itself.
const fsx = require('fs');
const ROOT = [path.join(__dirname, 'app'), path.join(__dirname, '..')].find(p => fsx.existsSync(path.join(p, 'index.html')));
const OCR = [path.join(process.resourcesPath || '', 'ocr'), path.join(ROOT, 'vendor', 'tessdata')].find(p => fsx.existsSync(p)) || null;
// Portable (the .zip): no installer put an uninstaller next to Loeito.exe, so settings and safety copies stay in a folder beside it.
if (process.platform === 'win32' && app.isPackaged) {
  const dir = path.dirname(process.execPath);
  if (!fsx.readdirSync(dir).some(f => /^Uninstall /i.test(f))) { try { const data = path.join(dir, 'Loeito data'); fsx.mkdirSync(data, { recursive: true }); app.setPath('userData', data); } catch {} }
}

let server = null, port = 0;
function start() {
  return new Promise(ok => {
    server = create({ root: ROOT, getPath: n => app.getPath(n), reveal: p => shell.showItemInFolder(p), ocrDir: OCR });
    server.listen(0, '127.0.0.1', () => { port = server.address().port; ok(); });
  });
}
async function open() {
  const win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 900, minHeight: 600, title: 'Loeito', backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true, plugins: true }, // plugins: the built-in PDF viewer, used for printing
  });
  // links to the web open in the real browser; Loeito's own pages stay inside
  win.webContents.setWindowOpenHandler(({ url }) => { if (!url.startsWith(`http://127.0.0.1:${port}`)) shell.openExternal(url); return { action: 'deny' }; });
  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
}
app.whenReady().then(async () => {
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  await start(); await open();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) open(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('quit', () => server && server.close());
