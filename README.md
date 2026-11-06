# Loeito — PDF, just right

Every everyday PDF task, just right: not too little, not too much.
**Version 1.6.0 “Hantverk”** · see `CHANGELOG.md`.

A private, install-free PDF workbench for everyday document work. Everything runs on your computer; files are never uploaded.

Loeito is **free and open-source software**, licensed under the **GNU Affero General Public License v3** (AGPL-3.0-or-later). You may use, study, share and improve it; see `LICENSE` and `NOTICE.md`.

## Start

- **Desktop app (easiest):** download the installer for Windows, macOS or Linux from the GitHub *Releases* page and install it.

- **Double-click `Start Loeito.cmd`** (recommended). It starts Loeito’s small local helper (Python standard library) and opens http://localhost:8765 (or the next free port if another program uses 8765; if Loeito is already running, it just opens it). With it, Loeito can:
  - save straight back into your files, keeping a safety copy of the old version;
  - browse folders in its own Open / Save As sheet;
  - open Word, Excel and PowerPoint files through your installed Microsoft Office.
- Or double-click `index.html`. Everything works except folder browsing, safety copies and Office import.

The first start needs an internet connection to load the PDF engine (and, for OCR, the language model).

## What it does

| Tool | For |
|---|---|
| **Merge PDFs** | Pick files in order, preview, reorder files and pages, move/copy/rotate pages between files, one click to merge, save and open |
| **Read** | Calm reader, focus mode, themes, contents, read-aloud, selectable text |
| **Pages** | Rotate, reorder, delete, duplicate, merge, extract, split, send pages to other tabs |
| **Edit** | Fix and add text, highlight, white-out, redact, draw, shapes, signature, images |
| **Crop** | One, odd/even or all pages; auto-trim scans |
| **Searchable** | OCR that keeps the layout |
| **Tables** | Ruled and scanned tables with merged cells → Excel, CSV, Word, Markdown |
| **Digitize** | Graphs → numbers; maps → Shapefile, GeoJSON, KML, DXF, Delft3D .ldb/.pol/.xyz … |
| **Optimize** | What’s using space; smaller files; paper sizes; page images |
| **Stamp** | Page numbers (incl. Bates across documents), 3-part headers and footers, watermarks — on all / odd / even / chosen pages, skipping first or last pages |
| **Covers** | 8 front-cover designs and 5 last pages for PDF books, reports and theses |
| **Forms** | 10 templates, drawing, automatic field finding (Word, Excel, scans), arrange & snap, behaviour (show-if, e-mail buttons, scripts), fill in |
| **Properties** | Title, author, keywords, language, dates and your own fields, with a check and one-click tidy-up |
| **Protect** | Find & black out (CNIC, phone, e-mail, accounts…) for real; inspect and remove hidden information; **passwords** (AES-256), permissions, unlock |

Across all tools:

- **Save to the original** (Ctrl S, Enter confirms), or **Save As** (Ctrl Shift S) with folders, New folder, Replace / Keep both.
- **Several documents in tabs.**
- **Pointer tools:** Select, Text and Hand (V / T / H).
- **Command palette:** Ctrl K, then type what you want to do.
- **Zoom speed:** Auto, Fine, Normal or Fast; Shift zooms finely.

## Documents

| File | What it is |
|---|---|
| `docs/Help.md` | Quick help: what each part does and how, each with a tutorial |
| `docs/tutorials/` | 14 short hands-on tutorials, one per part (Help → Tutorials) |
| `docs/About.md` | The About text shown in the app |
| `docs/User Manual.md` | How to use everything (also under Help in the app) |
| `docs/Reference Manual.md` | Architecture, data model, saving, server API, for maintainers |
| `POLICY.md` | The Loeito Rulebook: design philosophy, rules, versioning, definition of done |
| `ROADMAP.md` | Where Loeito is heading |
| `CONTRIBUTING.md` | How to help |
| `desktop/` | Desktop app and installer builds (Electron) |
| `CHANGELOG.md` | What changed in each version |
| `LICENSE` · `NOTICE.md` | GNU AGPL v3 licence text; copyright and third-party notices |
| `sourceforge/` | Ready-to-paste texts for the SourceForge project page |
| `versions/` | Preserved milestones (1.0.0 …), each runnable with its own manuals |

Try the files in `samples/`: a Word form, an Excel form and a scanned form.

## Licence

Copyright (C) 2026 Ahmed Bilal and contributors. Loeito is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License, version 3 or (at your option) any later version. It comes with **no warranty**. Contributions are welcome under the same licence.
