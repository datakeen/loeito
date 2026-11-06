# Notices

**Loeito** — free and open-source PDF workbench.
Copyright (C) 2026 Ahmed Bilal and contributors.

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either **version 3** of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details. A copy is included in the file `LICENSE`, and it is also available at <https://www.gnu.org/licenses/agpl-3.0.html>.

**Source code.** Loeito has no build step: the files in this folder are the complete source. If you run a modified Loeito for others over a network, AGPL § 13 requires you to offer them its source code.

## Third-party components

Loeito uses the work of these projects. They are not modified, and each stays under its own licence, all compatible with the AGPL. The browser version loads them from public CDNs; the desktop installers carry copies, together with their licence texts (in `vendor/`).

### Libraries in the app

| Component | Version | Authors | Licence | Used for |
|---|---|---|---|---|
| [pdf.js](https://github.com/mozilla/pdf.js) | 3.11.174 | Mozilla and contributors | Apache-2.0 | Showing PDF pages, text and forms |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.1 | Andrew Dillon and contributors | MIT | Writing and changing PDF files |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | 5.1.1 | Jerome Wu, Kevin Kwok and contributors | Apache-2.0 | OCR (Make Searchable, scanned tables and forms) |
| [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) engine (tesseract.js-core) | 5 | Google, Ray Smith and contributors | Apache-2.0 | The recognition engine inside Tesseract.js |
| [Tesseract language data](https://github.com/tesseract-ocr/tessdata) (via @tesseract.js-data) | 4.0.0 best_int | Google and contributors | Apache-2.0 | Language models for OCR |
| [JSZip](https://github.com/Stuk/jszip) | 3.10.1 | Stuart Knightley and contributors | MIT (dual MIT / GPL-3.0) | Shapefile and Office file packages |
| [SheetJS Community Edition](https://github.com/SheetJS/sheetjs) | 0.18.5 | SheetJS LLC | Apache-2.0 | Reading and writing Excel files |
| [xlsx-js-style](https://github.com/gitbrent/xlsx-js-style) | 1.2.0 | Brent Ely, based on SheetJS | Apache-2.0 | Excel cell styles |

### Fonts

| Font | Designer | Licence | Used for |
|---|---|---|---|
| [Inter](https://rsms.me/inter/) | Rasmus Andersson | SIL Open Font License 1.1 | The interface |
| [Caveat](https://fonts.google.com/specimen/Caveat) | Impallari Type | SIL Open Font License 1.1 | Typed signatures |
| [Homemade Apple](https://fonts.google.com/specimen/Homemade+Apple) | Font Diner | Apache-2.0 | Typed signatures |

### Desktop app and helpers

| Component | Licence | Used for |
|---|---|---|
| [Electron](https://www.electronjs.org/) (includes Chromium and Node.js) | MIT (Chromium: BSD-3-Clause and others, listed in the app's `LICENSES.chromium.html`) | The desktop app window |
| [electron-builder](https://www.electron.build/) | MIT | Building the installers (not shipped) |
| [Python](https://www.python.org/) | PSF License | Running `loeito_server.py` when you start Loeito from the source code (not shipped) |
| [pypdf](https://github.com/py-pdf/pypdf) | BSD-3-Clause | Password protection (AES-256) |
| [cryptography](https://github.com/pyca/cryptography) | Apache-2.0 or BSD-3-Clause | Encryption for pypdf |
| Microsoft Office (yours, if installed) | Proprietary, not included | Opening Word, Excel and PowerPoint files |

Icons, the Loeito logo, the cover designs and the form templates were made for Loeito and are under the AGPL like the rest of it.

Thank you to everyone who built these.
