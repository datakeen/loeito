# Contributing to Loeito

Thank you for helping. Loeito is free software under the **GNU AGPL v3 or later**. By contributing you agree that your work is published under the same license.

## Running it

- **In a browser:** double-click `index.html`, or run `Start Loeito.cmd` (Windows; needs Python 3.10+) for the full experience.
- **As a desktop app:**
  ```
  cd desktop
  npm install
  npm start
  ```
  `npm run dist` builds installers for your own system.

`Start Loeito.cmd` starts `loeito_server.py`, a small local helper (Python standard library only) that listens on your own computer (127.0.0.1) and opens Loeito in your browser. The helper adds saving straight back into files with a safety copy, folder browsing, and Word/Excel/PowerPoint import through Microsoft Office. Passwords need `pip install pypdf cryptography`. Opening `index.html` directly works without the helper, minus those extras.

There is no build step for the web app: edit the files in `js/` and `css/` and reload.

Developer documents: `docs/Reference Manual.md` (architecture, saving, server API), `CHANGELOG.md`, and `desktop/` (Electron app and installer builds). Try the forms in `samples/`.

## Before you send a change

- Keep Loeito plain, calm and complete: the document comes first, every tool explains itself in everyday words, and nothing is uploaded.
- Versions: a fix raises the last number (1.8.0 → 1.8.1), a new feature the middle one (1.8 → 1.9). Keep `VERSION`, `js/core.js` (`L.VERSION`) and `desktop/package.json` in step, and add the change to `CHANGELOG.md`.
- Friction free: no task should depend on one option in one tool. Make new actions reachable from wherever the user already is, by mouse and by keyboard.
- Give every new source file the one-line license notice (`SPDX-License-Identifier: AGPL-3.0-or-later`).
- Update the user documents your change touches: `docs/Help.md`, the matching tutorial in `docs/tutorials/`, the User Manual and `CHANGELOG.md`.
- New libraries must have an AGPL-compatible license and be listed in `NOTICE.md`.

## Reporting problems

Open an issue and include:

- what you did;
- what you expected;
- what happened;
- your system and whether you used the browser or the desktop app.

Please never attach a private document. Make a small example instead.
