# Loeito — PDF, just right

**Free and open-source PDF workbench for Windows: read, merge, edit, sign, fill forms, OCR scans, extract tables, digitize maps. Private: nothing is uploaded.**

*Loeito* (formerly Lagom) — every everyday PDF task, just right: not too little, not too much.

Loeito does the PDF jobs people do every day, in one calm, beautiful window that runs in your own browser. Your files never leave your computer. There is no account, no subscription and no upload.

License: **GNU AGPL v3** · Version **1.6.0** · Windows 10/11 (other systems: the browser part works anywhere)

---

## Features

- **Merge PDFs:** pick PDFs, pictures, Word, Excel or PowerPoint files in click order. Reorder, copy or duplicate whole files; move, copy and rotate pages between them; add designed covers. Then one click merges, saves and opens the result.
- **Read:** continuous reader with themes, focus mode, contents, read-aloud, and selectable text, including scans.
- **Pages:** a fluid grid. Click, Ctrl-click, Shift-click or drag a box to select; rotate a page with its own button; drag to reorder. Also insert, extract and split (odd/even, every N pages, ranges).
- **Edit:** add and correct text, highlight, white-out, draw, shapes, signature and pictures.
- **Make Searchable (OCR):** scans become searchable and copyable without changing how they look.
- **Tables to Excel:** ruled tables, also in scans, with merged cells kept.
- **Digitize maps and graphs:** export Shapefile, GeoJSON, KML, GPX, DXF, CSV/WKT, and Delft3D `.ldb` / `.pol` / `.pli` / `.xyz`.
- **Forms:**
  - 10 ready templates, drawing tools, and automatic field finding in Word, Excel and scanned forms;
  - totals, checks, show-only-when rules, e-mail buttons;
  - fill in, keep fillable, or flatten.
- **Stamp:** page numbers, Bates numbers across documents, and headers and footers on all, odd, even or chosen pages, plus watermarks.
- **Covers:** 13 designed front covers and last pages for books, reports and theses.
- **Protect:** find and truly black out private details (ID card numbers, phone numbers, e-mail addresses, bank accounts…), and remove hidden data before sharing.
- **Optimize:** see what makes a file large, make it smaller, and change the paper size.
- **Saving:** Save to the original (with a safety copy) or Save As with your own folders, and open Word / Excel / PowerPoint files through your installed Microsoft Office.

## Install and run

1. Install **Python 3.10 or newer** from python.org (tick *Add to PATH*).
2. Download and unzip `Loeito-1.6.0.zip`.
3. Double-click **`Start Loeito.cmd`**. Loeito opens in your browser.

You can also double-click `index.html` to use Loeito without Python, without the folder browser and Office import.

An internet connection is needed the first time, to load the PDF engine and the OCR language data.

## Privacy

Everything runs locally. The small helper (`loeito_server.py`, Python standard library only) listens on 127.0.0.1 and answers only Loeito itself.

## Documentation

Inside Loeito, click **Help (?)** for Help, 14 tutorials, the User Manual and keyboard shortcuts. The same files are in the `docs/` folder.

## License

Copyright (C) 2026 Ahmed Bilal and contributors.

Loeito is free software. You can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, version 3 or (at your option) any later version. It is distributed WITHOUT ANY WARRANTY.

See `LICENSE` for the licence and `NOTICE.md` for third-party components (pdf.js, pdf-lib, Tesseract.js, JSZip, SheetJS: Apache-2.0 / MIT; Inter: OFL).
