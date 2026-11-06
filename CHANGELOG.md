# Changelog

All notable changes to Loeito, newest first. Version rules: `POLICY.md` § 6. Milestones (x.0.0, x.5.0) are preserved in `versions/`.

## 1.7.0 — 2026-11-07

### Added
- **Views in every tool:** full window (Ctrl Shift F), full screen (F11), continuous reading, and scrolling on into the next page — all from the zoom % menu.
- **Snapshot** (Ctrl Shift C): drag a box or click for the whole page; copy it or save a sharp PNG.
- **Works offline from the first start (desktop app):** the installers now carry pdf.js, pdf-lib, the OCR engine, the fonts and 7 OCR languages (English, Urdu, Arabic, Swedish, Chinese Simplified and Traditional, Japanese). Other languages download once.
- **More OCR languages:** Chinese (Traditional), Japanese, Korean.

### Changed
- **Full credits** for every library, font and tool in NOTICE.md and About.

## 1.6.2 — 2026-11-07

### Changed
- **Livelier tools:** toolbar and welcome cards react to hover and clicks; toolbar tools work on the welcome screen too (they ask for a file first).
- **Arrow keys** move between the welcome cards.
- **Search tools and commands** box on the welcome screen (same as Ctrl K).

## 1.6.1 — 2026-11-07

### Added
- **Dates in forms:** a calendar button in Fill in, and impossible dates (like 23/76/5006 or 30/02) are flagged.
- **Script help:** basic syntax and recipes in the User Manual, and a clear note on which readers run scripts.

### Changed
- **Templates:** each field now carries its own box, so moving, resizing or deleting a field takes its box along.
- **README** rewritten for people who just want to download and use Loeito; developer details moved to CONTRIBUTING.md.

## 1.6.0 — 2026-11-06

### Changed
- **New name: Loeito**, everywhere: app, launcher (`Start Loeito.cmd`), server (`loeito_server.py`), documents. Saved preferences carry over.

### Added
- **Document properties** (click the document name, or Ctrl K → "properties"):
  - title, author, subject, keywords, language, created date, "made with", your own custom fields, and "show the title in viewers";
  - a **check** with one-click fixes and **Tidy up everything**;
  - what the original file said.
- **Passwords** (Protect → Password): lock a PDF with **AES-256**, choose what people may do (print, copy, fill forms, edit), add an owner password, or **remove** a password. Protected files open with their password and stay protected when saved. Needs `Start Loeito.cmd` (or the desktop app) and `py -m pip install pypdf cryptography`.
- **Stamps by hand:**
  - drag a page number, header, footer or watermark on the page, then choose: all pages, only this page, pages of the same size and orientation, or chosen pages;
  - **Scale with the page** for documents that mix sizes;
  - page-size groups in *On pages* (e.g. "A4 portrait · 30", "A4 landscape · 6");
  - positions keep their distance from the page edge, so they fit every size and orientation;
  - **Back to the standard position** undoes the moves.
- **Command palette (Ctrl K):** type what you want to do and press Enter.
- **Desktop app and installers:** `desktop/` (Electron) runs Loeito in its own window with the server built in. GitHub builds Windows (setup + portable), macOS (.dmg) and Linux (AppImage, .deb) installers from every version tag.
- `ROADMAP.md` (public) and `CONTRIBUTING.md`.

### Fixed
- Encrypted PDFs were not recognised as encrypted when opened, so saving them could hang. They are now detected and unlocked properly.

## 1.5.0 — 2026-11-05 · milestone

Preserved in `versions/1.5.0/` with its manuals.

### Added
- **Merge from where you are:** *Pages → Merge this with other files…* (also in the Save menu) starts the merge with your open document, then asks for the files to add.
- **Your edits travel with the pages:** rotation, page order, crop, highlights and other marks, form fields and OCR text. The open document's card is marked *open tab · edited*, and **Update from the open tab** picks up later edits.
- **Back to Loeito:** the merge can be set aside (button or Esc). A small *Merge waiting* dock brings it back exactly as you left it: files, order, pages, name and folder. The × discards it.

### Fixed
- Pages copied or merged inside the Merge workspace kept only their rotation; they now keep all their edits.

## 1.4.0 — 2026-11-05

### Added
- **Move pages with the keyboard** (Pages): it works for one page, pages scattered across the document, or a range.
  - **← →** move one place; **↑ ↓** move one row, and the pages passed shift along; **Home / End** go to the start / end.
  - Scattered pages each step past their neighbour; a range moves as a block.
- **Cut / Copy / Paste pages:**
  - **Ctrl X / Ctrl C / Ctrl V** (Ctrl Shift V pastes before the selection), also between tabs;
  - **Ctrl D** duplicates;
  - **Alt + arrows** walk to the next page without moving anything (Shift extends the selection).
- **Move & clipboard** section in the Pages panel: arrow pad, *Before page…*, Cut / Copy / Paste. All undoable, with gliding motion.

## 1.3.0 — 2026-11-05

### Fixed
- **Pages grid:** clicking a page didn't select it, its own rotate/delete buttons seemed to need a selection in the left column first, and dragging only worked in the left column. The cause: the 1.1 pan handler captured every press on the grid. The grid now handles its own presses.

### Added
- **Fluid page grid:**
  - a page's own buttons act on that page at once (or on the whole selection, if the page is part of it);
  - click, Ctrl-click and Shift-click select, and a rectangle dragged on empty space selects several;
  - R / Shift R rotate, Delete removes, Esc clears the selection;
  - cards glide to their new places;
  - a page-size slider, also Ctrl-wheel over the grid.
- **Left column on demand:** it slides away in the grid view and slides back for large pages, the page view, or the sidebar button.
- **Motion everywhere:** a rotated page turns into place (grid, page list, page view, reader); buttons press; pages fade in; toasts rise. It respects the system’s “reduce motion” setting.
- **Merge:**
  - copy a whole file and paste it at the start, the end or between files, or duplicate it;
  - add Word, Excel and PowerPoint files (converted with Microsoft Office when Loeito runs from Start Loeito.cmd);
  - **Cover…** adds a designed front cover or last page from the Covers designs.



### Licence
- Loeito is now **free and open-source software under the GNU AGPL v3** (AGPL-3.0-or-later): `LICENSE`, `NOTICE.md` (third-party licences), a licence line in every source file, and the licence shown in About and the README. A ready-to-paste SourceForge kit is in `sourceforge/`.

### Added
- **Merge PDFs workspace** (welcome screen, Pages tool, Save menu):
  - pick files in click order, or drop them in;
  - preview, page count and size for each file, plus a hover card with title, author, dates, paper and folder;
  - drag to reorder files, with ↑ ↓ buttons as an alternative;
  - show any file's pages; select, drag to move or Ctrl-drag to copy them within or between files;
  - Cut / Copy / Paste at the start, at the end, or between any pages;
  - rotate, remove, and undo (Ctrl Z);
  - choose the name and folder; **Merge & Open** saves, then opens the result for checking.
- **User help set:**
  - `docs/Help.md`: what each part does and how it works, each section pointing to its tutorial;
  - `docs/About.md`;
  - 14 short tutorials in `docs/tutorials/`;
  - all of them under Help → Help / Tutorials / About.

### Changed
- The roadmap phases after Phase 1 each move one version later: Compare & Preflight → 1.3.0 … signatures → 1.6.0. The next preserved milestone is 1.5.0.

## 1.1.1 — 2026-10-28

### Fixed
- **Start Loeito.cmd could show “Error response 404 – File not found”.** On Windows, Python lets a second program listen on the same port, so another local server on port 8765 could answer instead of Loeito. Loeito now claims its port exclusively. If 8765 is taken by another program, it uses the next free port. If Loeito is already running, it simply opens it. The browser opens only once the server is listening, at the right address.

## 1.1.0 “Hantverk” — 2026-10-28

Phase 1 of the five-phase plan (`PLAN.md`, Round 4): everyday craft, plus the first professional tools.

### Added
- **Save to the original.** Ctrl S writes back into the file you opened, after a short question: Enter = *Save to Original*, or *Save a Copy Instead…*. The previous version is kept as a safety copy for 30 days (find it under *Safety copies* in the Save As sheet).
- **Save As sheet.** Rename with Smart Name suggestions, browse folders (original folder, Desktop, Documents, Downloads, drives, recent places), back / forward / up, clickable path, **New folder**, filter, *Replace* or *Keep both*. The same sheet opens files and saves every export. *Show in folder* afterwards.
- **Recent files** on the welcome screen.
- **Pointer tools:** Select (I-beam over text, drag empty paper to move), Text (select text anywhere), Hand (open hand, closed hand while dragging). Keys V / T / H, Space = temporary hand.
- **Selectable text on every page,** including OCR’d scans, with a selection bar: Copy · Highlight · Find · Speak.
- **Zoom speed:** Auto · Fine · Normal · Fast in the zoom menu; Shift = fine; a zoom read-out while zooming.
- **Stamp, rebuilt for whole documents:** header and footer with left / centre / right text, fonts, thin rules; number styles (1, i, I, a, A, Page 1 of N, Bates, custom); every stamp on all / odd / even / chosen pages, skipping the first or last pages, mirrored for books; numbering can start at the first numbered page.
- **Bates across documents:** continue one series through every open tab; save them all to a folder.
- **Covers:** 8 front-cover designs and 5 last pages (back cover, colophon, about the author, notes, the end) with your details, picture and accent colour.
- **Form templates:** 10 ready forms — registration, job application, leave, expense claim, invoice, purchase requisition, feedback survey, consent, weekly timesheet, service/IT request — with real fields, formats and totals.
- **Arrange form fields:** align to the selection, a key field or the page; distribute; match sizes; snapping guides while dragging.
- **Form behaviour:** buttons that e-mail the filled form, open a web page, go to a page or show/hide fields; “Show only when…” rules; expert scripts per field and for the document.
- **Protect:** find & black out words and patterns (CNIC, phone, e-mail, bank accounts, dates, money) with review before removal; hidden-information inspector; *Save a copy for sharing* that removes details, comments, attachments, scripts, links, private data and thumbnails.
- **What’s using space** in Optimize: images, fonts, page drawings, metadata, structure; largest images and embedded fonts.
- **Help menu:** what’s new, User Manual, Reference Manual, keyboard shortcuts (?), About.
- **Versioning & rulebook:** `VERSION`, `CHANGELOG.md`, `POLICY.md`, `versions/1.0.0/`.

### Changed
- Zoom is brisker for reading (≈ 20 % per wheel notch instead of 10 %); precise tools keep fine steps.
- Redacted pages stay searchable: the words that were not blacked out are kept as invisible text.
- The local server checks the Host header too (protects against DNS-rebinding pages) and offers a file API used only by Loeito’s own page.

### Fixed
- Saving copied fonts shared by several pages once per page, which could make files several times larger (e.g. 225 KB → 813 KB); now each source is copied in one pass (223 KB).

### Known limits
- Saving to the original needs Loeito started with *Start Loeito.cmd*, or a file opened through Loeito’s Open button / dropped onto Loeito in Edge or Chrome.
- Covers, form templates and stamps use the standard PDF fonts (Latin characters only).
- Bookmarks of the original are not kept when saving yet (planned for 1.2.0).
- Expert form scripts run in Acrobat, Foxit and PDF-XChange; Loeito’s Fill in preview runs the built-in rules only.

## 1.0.0 — 2026-10-12

First complete release (development rounds 1–3). Preserved in `versions/1.0.0/`.

### Added
- Open PDFs, images, and Word / Excel / PowerPoint files (via the local server and Microsoft Office); several documents in tabs.
- Read: continuous reader, selectable text, themes, focus mode, contents, read-aloud, resume position.
- Pages: rotate, reorder, delete, duplicate, blank page, merge, extract, split (odd/even, every N, ranges), copy/move pages between tabs.
- Edit: rewrite text, add text, highlight, white-out, redaction (flattened on save), drawing, shapes, signature, images.
- Crop: one, odd/even or all pages; auto-trim.
- Make Searchable: OCR with an invisible text layer that keeps the layout.
- Tables: ruled tables in vector PDFs and scans with merged cells; per-cell OCR for scans; styled Excel, CSV, rich copy, Markdown.
- Digitize: graphs to numbers; maps to points, lines and areas in local, UTM or WGS 84; Shapefile, GeoJSON, KML, GPX, DXF, CSV/WKT, Delft3D .ldb/.pol/.pli/.xyz/.xyn.
- Optimize: compress, greyscale, strip metadata, paper size, page images.
- Stamp: page numbers (incl. Bates), header & footer, watermark.
- Forms: draw fillable fields, formats, checks, totals, signature, buttons; fill mode; keep fillable or flatten; import existing forms; automatic field detection in Word, Excel and scanned forms.
- Smart Name and document details.
