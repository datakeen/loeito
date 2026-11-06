// Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE)
// Copies the web app (the repository root) into desktop/app so the installers carry it. Run by "npm run dist".
const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..'), out = path.join(__dirname, 'app');
const KEEP = ['index.html', 'js', 'css', 'docs', 'samples', 'tools', 'LICENSE', 'NOTICE.md', 'README.md', 'CHANGELOG.md', 'VERSION'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const k of KEEP) { const src = path.join(repo, k); if (fs.existsSync(src)) fs.cpSync(src, path.join(out, k), { recursive: true }); }
// an icon for the installers (drawn here so no binary file is needed in the repository)
const icon = path.join(__dirname, 'build', 'icon.png');
if (!fs.existsSync(icon)) console.warn('desktop/build/icon.png is missing — the installers will use the default Electron icon.');
console.log('Prepared', KEEP.length, 'items in desktop/app');
