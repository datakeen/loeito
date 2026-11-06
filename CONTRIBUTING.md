# Contributing to Loeito

Thank you for helping. Loeito is free software under the **GNU AGPL v3 or later**. By contributing you agree that your work is published under the same licence.

## Running it

- **In a browser:** double-click `index.html`, or run `Start Loeito.cmd` (Windows; needs Python 3.10+) for the full experience.
- **As a desktop app:**
  ```
  cd desktop
  npm install
  npm start
  ```
  `npm run dist` builds installers for your own system.

There is no build step for the web app: edit the files in `js/` and `css/` and reload.

## Before you send a change

- Read `POLICY.md`, the design rulebook. Keep things plain, calm and complete.
- Give every new source file the one-line licence notice (`SPDX-License-Identifier: AGPL-3.0-or-later`).
- Update the user documents your change touches: `docs/Help.md`, the matching tutorial in `docs/tutorials/`, the User Manual and `CHANGELOG.md`.
- New libraries must have an AGPL-compatible licence and be listed in `NOTICE.md`.

## Reporting problems

Open an issue and include:

- what you did;
- what you expected;
- what happened;
- your system and whether you used the browser or the desktop app.

Please never attach a private document. Make a small example instead.
