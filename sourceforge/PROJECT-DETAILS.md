# SourceForge — copy & paste kit

Each box below is one field on SourceForge. Copy the text inside the box and paste it into that field.

---

## 1 · Create the project

Go to **sourceforge.net → sign in → your name (top right) → Create a Project**.

**Project Name**
```
Loeito
```

**URL** (permanent: it can't be changed later)
```
loeito
```

**Summary** (the short line under the name; at most 70 characters)
```
Free, private PDF app: merge, edit, sign, forms, OCR, tables and maps
```

**Description**
```
Loeito is a free and open-source PDF app for everyday work. It is calm, simple and private: everything happens on your own computer, nothing is uploaded, and no account is needed.

Merge PDFs and rearrange their pages by dragging or with the keyboard. Read comfortably in focus mode. Rotate, split, crop and edit. Make scans searchable with OCR. Copy tables, even from scans, into Excel. Turn maps into Shapefile, GeoJSON, KML or Delft3D files. Build fillable forms from ready templates, or convert Word, Excel and scanned forms. Add page numbers, headers and book covers. Black out private details for real, remove hidden data, and lock files with a password.

Free software under the GNU AGPL v3. Installers for Windows, macOS and Linux.
```

---

## 2 · Admin → General

**Website**
```
https://github.com/datakeen/loeito
```

**Licence**
```
GNU Affero General Public License version 3 (AGPLv3)
```

**Development status**
```
4 - Beta
```

---

## 3 · Admin → Categorization

**Category** (pick these)
```
Office/Business > Office Suites
Text Processing
Scientific/Engineering > GIS
Graphics > Viewers
```

**Intended audience**
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
Windows
Mac
Linux
```

**User interface**
```
Web-based
Win32 (MS Windows)
Cocoa (MacOS X)
X Window System (X11)
```

**Programming language**
```
JavaScript
Python
```

**Translations**
```
English
```

**Labels / keywords** (type each one and press Enter)
```
pdf
pdf-editor
merge-pdf
ocr
pdf-forms
redaction
pdf-password
table-extraction
pdf-to-excel
gis
shapefile
delft3d
privacy
offline
open-source
```

---

## 4 · Features (Admin → Features; one per line)
```
Merge PDFs, then reorder files and pages by dragging or with the keyboard
Read in a calm focus mode, with themes and read-aloud
Make scanned PDFs searchable with OCR, without changing their look
Copy tables, even from scans, into Excel with merged cells
Turn maps into Shapefile, GeoJSON, KML, DXF and Delft3D files
Fillable forms from 10 templates, or converted from Word, Excel and scans
Page numbers, headers, footers and watermarks you can drag into place
Designed book covers and last pages
Black out private details for real and remove hidden data
Lock PDFs with a password (AES-256) or remove a password
Edit document details: title, author, keywords, language
Private: everything stays on your computer
```

---

## 5 · Files: the first release

1. Open the project → **Files** → **Add Folder**. Name it:
   ```
   1.6.0
   ```
2. Open the folder → **Add File**. Upload the installers, downloaded from GitHub (**Releases → v1.6.0 → Assets**):
   - `Loeito-Setup-1.6.0.exe`
   - `Loeito-Portable-1.6.0.exe`
   - the `.dmg`
   - the `.AppImage`
   - the `.deb`
3. Also upload `sourceforge/README.md`. SourceForge shows it under the file list.
4. Click the **i** next to `Loeito-Setup-1.6.0.exe` → under *Default download for* tick **Windows** → **Save**. Do the same for the `.dmg` (**Mac**) and the `.AppImage` (**Linux**).
5. In the same **i** panel of the setup file, paste into **Release notes**:
   ```
   Loeito 1.6.0
   • Document details: edit title, author, keywords and language, with a one-click tidy-up.
   • Passwords: lock a PDF with AES-256 or remove a password.
   • Drag page numbers, headers and footers into place: this page, all pages or chosen pages.
   • Command palette: press Ctrl K and type what you want to do.
   • Installers for Windows, macOS and Linux.
   Windows may warn "Windows protected your PC" because the app is not signed yet: click More info, then Run anyway.
   ```

---

## 6 · Screenshots (Admin → Images → Add)

Take each one in Loeito with **Win + Shift + S**, then upload it with its caption:

| Screenshot | Caption |
|---|---|
| Welcome screen | `Start: merge, recent files and every tool` |
| Merge window with pages open | `Merge PDFs and rearrange their pages` |
| Pages grid with a few pages selected | `Rotate, move and reorder pages` |
| Form template gallery | `Ready-made fillable forms` |
| Covers designs | `Designed covers for books, reports and theses` |
| Protect with red matches | `Black out private details for real` |

Use `desktop/build/icon.png` as the project icon (**Admin → General → Icon**).

---

## 7 · Developer details
```
Developer: Ahmed Bilal
Copyright (C) 2026 Ahmed Bilal and contributors
Licence: GNU Affero General Public License v3 or later
Source code: https://github.com/datakeen/loeito
```
In **Admin → Tools**, switch on **Tickets** (bug reports) and **Discussion**.
