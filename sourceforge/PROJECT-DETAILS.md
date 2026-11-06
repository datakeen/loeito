# SourceForge — copy & paste kit

Each block below matches a field on SourceForge (*Create Project*, then *Admin → General / Categorization / Files*). Copy the text inside the box.

---

## 1 · Create Project

**Project Name**
```
Loeito PDF
```

**URL / Unix name** (lowercase, permanent: choose carefully)
```
loeito-pdf
```

**Summary / short description** (SourceForge allows 70 characters; this is 66)
```
Free, private PDF workbench: merge, edit, OCR, forms, tables, maps
```

**Description** (about 950 characters)
```
Loeito is a free and open-source PDF workbench that does the jobs people do every day, in one calm window that runs in your own browser. Nothing is uploaded, and no account is needed.

Merge PDFs in click order with page previews, and move, copy and rotate pages between files. Read with focus mode and read-aloud. Rotate, split and extract pages. Edit and sign. Make scans searchable with OCR. Extract tables (also from scans) to Excel with merged cells. Digitize maps to Shapefile, GeoJSON, KML, DXF or Delft3D land boundaries. Build fillable forms from 10 templates, or convert Word, Excel and scanned forms automatically. Add page numbers, Bates numbers, headers and footers on chosen pages, and designed book covers. Black out private details for real and remove hidden data before sharing. Save straight back to the original, with a safety copy.

Licensed under the GNU AGPL v3.
```

---

## 2 · General settings

**Licence**
```
GNU Affero GPL v3 (AGPL-3.0-or-later)
```

**Development status**
```
4 - Beta
```

**Intended audience** (tick all)
```
End Users/Desktop
Education
Science/Research
Engineering
Government
Non-Profit Organizations
```

**Operating system**
```
Windows 10, Windows 11 (launcher); the browser part runs on any OS with Chrome, Edge or Firefox
```

**User interface**
```
Web-based
```

**Programming language**
```
JavaScript, Python, HTML5, CSS
```

**Natural language**
```
English
```

**Topic / categories** (pick these in *Categorization*)
```
Office/Business > Office Suites
Text Processing
Scientific/Engineering > GIS
Multimedia > Graphics > Viewers
```

**Labels / keywords** (one per line)
```
pdf
pdf-editor
pdf-merge
merge-pdf
ocr
pdf-forms
fillable-forms
redaction
table-extraction
pdf-to-excel
gis
shapefile
delft3d
digitizer
bates-numbering
privacy
offline
open-source
agpl
```

**Website** (until you have your own page, use the project page)
```
https://sourceforge.net/projects/loeito-pdf/
```

---

## 3 · Features list (the *Features* box, one per line)
```
Merge PDFs in click order, with previews and page-level rearranging
Move, copy and rotate pages between files before merging
Calm reader with focus mode, themes and read-aloud
Make scans searchable (OCR) without changing their look
Tables (also scanned) to styled Excel with merged cells
Digitize maps to Shapefile, GeoJSON, KML, DXF, Delft3D .ldb
Fillable forms: 10 templates, automatic field finding, totals and rules
Page numbers, Bates numbers, headers/footers on chosen pages
Designed book covers and last pages
Find & truly black out private details; remove hidden data
Save to the original with a safety copy, or Save As to any folder
100% local and private, no upload, no account
```

---

## 4 · Files: first release

**Folder name**
```
1.6.0
```

**File to upload:** `Loeito-1.6.0.zip`. Make it with this PowerShell command, run inside the `4. PDF Software` folder. It packs the Loeito folder without the `versions` archive:
```
Get-ChildItem Loeito -Exclude versions | Compress-Archive -DestinationPath "Loeito-1.6.0.zip" -Force -CompressionLevel Optimal
```

Also upload `sourceforge/README.md` into the same folder. SourceForge shows it under the file list. Then mark the zip as the **default download** for Windows (the *i* button next to the file → *Default download for: Windows*).

**Release notes** (paste into the file's *Release notes* box)
```
Loeito 1.6.0 (formerly Lagom)
• New name: Loeito. • Document properties with a check and one-click tidy-up. • Passwords: AES-256 lock, permissions, unlock. • Drag page numbers, headers and footers by hand; this page / all / same-size pages; scale with page size. • Command palette (Ctrl K). • Desktop installers for Windows, macOS and Linux.
• Merge from where you are: "Merge this with other files" starts with your open document, all its edits included; set the merge aside, work elsewhere, and return to it exactly as you left it.
• Move pages with the keyboard: arrows move one place or one row, Home / End to the start or end; Ctrl X / C / V cut, copy and paste pages (also into another tab); Ctrl D duplicates; "Move to page …".
• Fluid page grid: a page's own buttons act at once; click, Ctrl-click, Shift-click or drag a rectangle to select; R rotates; drag to reorder with gliding motion; page-size slider.
• The left page list hides itself in the grid and comes back for big pages.
• Smooth, satisfying motion: pages turn into place when rotated, everywhere.
• Merge: copy, paste or duplicate whole files; add Word, Excel and PowerPoint files; add designed covers and last pages.
• Free and open source under the GNU AGPL v3. Unzip and double-click Start Loeito.cmd (Python 3.10+).
```

---

## 5 · Screenshots to upload (*Admin → Screenshots*)
Take these in Loeito (Windows: Win Shift S):
1. Welcome screen with *Merge PDFs* and Recent: caption `Start: merge, recent files, every tool`
2. Merge workspace with one file's pages open: caption `Merge PDFs — reorder files and pages, move and rotate`
3. Forms template gallery: caption `10 ready-made fillable forms`
4. Covers designs: caption `Designed covers for books, reports and theses`
5. Protect with red matches: caption `Find and truly black out private details`
6. Tables export: caption `Tables (even scanned) to Excel`

---

## 6 · Author / admin details
```
Developer: Ahmed Bilal
Copyright: (C) 2026 Ahmed Bilal and contributors
License: GNU Affero General Public License v3 or later
Contact: via the SourceForge project page (Discussion / Tickets)
```
Tip: enable *Tickets* (bug reports) and *Discussion* in **Admin → Tools**. Add a wiki later if you like.
