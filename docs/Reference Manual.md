# Loeito 1.1 — Reference Manual

_For people who maintain, extend or audit Loeito. Users want the User Manual instead._
_Loeito 1.1.0 “Hantverk” · 2026-10-28. Rules for changes: `POLICY.md`. History: `CHANGELOG.md`, `private/PLAN.md` (kept locally)._

## 1 · What Loeito is

Loeito is a browser PDF workbench with no installation and no build step. It is plain HTML, CSS and classic JavaScript files sharing one global object, `window.Loeito` (written `L`).

- **pdf.js** reads and renders.
- **pdf-lib** writes.
- **tesseract.js** does OCR.

All of them run in the page. An optional local Python server adds the file API and Office import.

| How it runs | What works |
|---|---|
| `Start Loeito.cmd` → `loeito_server.py` on http://localhost:8765 | Everything: Save to original with safety copies, the Open / Save As sheet, Recent files, Office import, manuals inside Help |
| Double-click `index.html` (file://) | Everything else. Save to original works through Edge/Chrome file handles (Loeito’s Open button or drag & drop); exports use the browser’s save window or a download |

## 2 · Files

| Path | Role |
|---|---|
| `index.html` | Shell: toolbar (blades, undo/redo, find, help, split Save button), tab bar, page sidebar, stage, reader, page bar (navigation, zoom, pointer tools), inspector, welcome screen, script order |
| `css/loeito.css` | Design tokens (light/dark), layout grid, all components; 1.1 additions are grouped at the end by feature |
| `js/core.js` | `L.VERSION`, preferences (`L.pref`/`L.setPref`), DOM helpers `L.h`/`L.s`, icon set, event bus, documents & per-tab history, toasts, tasks, dialogs (`wide: 'xl'`, `onKey`, `focusPrimary`), pop-up menus `L.menu`, inspector widgets `L.ui` |
| `js/render.js` | Views (user space ⇄ display), `renderInto`, annotation painting, words, **`L.buildTextLayer`**, stamp engine (`normStamps`, `ruleHits`, `numberAt`, `stampItems`, `stampGeom`) |
| `js/viewer.js` | Blade registry, stage, overlay, pointer routing, **zoom speed** (`L.zoomSpeed`, `L.wheelFactor`, `L.zoomHud`), **pointer tools** (`L.setTool`, `L.wantsPan`), **selection bar**, loupe, thumbnails, search |
| `js/docs.js` | Tabs: switch, close, transfer pages |
| `js/reader.js` | Continuous reader, focus mode, contents, read-aloud, resume position |
| `js/build.js` | `buildPdf`, resize, compress, **`sanitizePdf`** (hidden data + unreachable objects), **`spaceAudit`**, image/text export |
| `js/files.js` | **File API client** (`L.fs`), paths (`L.path`), **Open / Save As sheet** (`L.files.sheet`), `L.save` (to original), `L.saveAs`, exports (`L.saveFile`), recent files, `writeFree` |
| `js/merge.js` | **Merge workspace**: own model `{ files:[{ name, path, info, pages }] }`, FLIP motion, drag & drop, clipboard, undo, output via `buildPdf` on a temporary state + `files.writeFree` |
| `docs/Help.md`, `docs/About.md`, `docs/tutorials/*.md` | User help set shown under Help (kept up to date with every change, see POLICY § 6) |
| `js/help.js` | Help menu, Markdown renderer for `docs/*.md`, shortcuts, About, “what’s new” |
| `js/geo.js` | Coordinate systems and GIS / Delft3D / CAD writers |
| `js/tablegrid.js` | Table engine (vector and raster rulings, merged cells, exporters) |
| `js/forms.js` | Field model, formats, calculations, **show-if** (`F.showing`), AcroForm writer with actions and scripts, importer |
| `js/formdetect.js` | Finds blanks in flat PDFs and scans |
| `js/formtemplates.js` | **Ten form templates** + layout engine (`L.formTemplatePdf`, `L.createFromTemplate`, `L.openFormTemplates`) |
| `js/blades/*.js` | One file per tool: view (Read), pages, edit, crop, ocr (Searchable), tables, digitize, compress (Optimize), stamp, **covers**, forms, **protect** |
| `js/name.js` | Smart Name and document details |
| `js/app.js` | Opening files (records each tab’s `origin`), toolbar, welcome (Recent, Form templates), keyboard, drag & drop (file handles) |
| `loeito_server.py` | Local server (stdlib): static files, Office conversion, file API |
| `tools/convert.ps1` | Office COM export to PDF |
| `docs/` | User Manual, Reference Manual (this file) |
| `versions/` | Frozen milestones (see `versions/README.md`) |

## 3 · Data model

- `L.sources[id]` = `{ id, name, bytes, doc (pdf.js), count, hasForm, proxies, text }`, shared by all tabs.
- `L.docs[]` = `{ id, state, undo[], redo[], view, origin, noAsk }`.
  - `origin` = `{ kind: pdf | converted | image, name, path?, handle? }` says where Save writes.
  - `noAsk` means “don’t ask again” for this session.
- `state` = `{ pages[], cur, sel, name, meta, stamps, blade, dirty, fileSize, sanitize?, formScript?, coverInfo? }`.
- `page` = `{ id, src, index, rot, crop, ann[], ocr, dig, fields[], flatten? }`. Geometry is in PDF user space of the source page. `flatten` makes the save render the page as a picture (hidden layers).
- **Stamps** (`_v: 2`): `numbers { style, fmt, prefix, digits, suffix, pos, start, restart, size, color, font, bold, margin, pages }`, `header` / `footer` `{ left, center, right, size, color, font, bold, margin, rule, pages }`, `watermark { text, size, opacity, angle, color, pages }`.
  - `pages` = `{ set: all | odd | even | range, range, skipFirst, skipLast, mirror }`.
  - v1.0 stamps are migrated by `L.normStamps`.
- **Form field** extras in 1.1:
  - `showIf { field, op: is | not | checked | unchecked | filled | empty, value }`;
  - `scripts { format, keystroke, validate, calculate }`;
  - buttons: `action: reset | print | email | link | page | toggle | script` with `mailTo`, `mailSubject`, `url`, `pageNo`, `targets[]`, `script`.
- History: `L.mutate(label, fn)` snapshots pages, stamps, name, meta and formScript. Undo and redo are per tab.

## 4 · Saving

- `L.buildPdf({ state, pages, ocrLayer, pageSize, compress, flattenForm, sanitize, task })` runs these steps:
  1. Copy each source’s pages in **one** `copyPages` call, so shared fonts and images are written once.
  2. Pages with redactions, or with `flatten`, are rendered at 200 dpi. Words outside the black boxes are written back as invisible text: PDF/OCR words for redaction, OCR words only for flattened layers.
  3. Draw annotations, the OCR layer and stamps.
  4. Write form fields (`F.build`): AcroForm, Acrobat actions, calculation order, show-if rules, document JavaScript.
  5. Resize → compress → `sanitizePdf`.
- `L.sanitizePdf(bytes, { details, comments, attachments, scripts, links, private, thumbs })` removes those items, then **drops unreachable objects**. pdf-lib writes every object it holds, so removing a reference alone would leave the data in the file. It returns `{ bytes, removed }`.
- `L.save()` (Ctrl S): confirmation sheet (`focusPrimary`), then writes back via the server (`/api/fs/write?overwrite=1`, which keeps a safety copy) or via a file handle. Converted Office files and images always go to Save As.
- `L.saveAs({ clean })`: file sheet with format and options. A whole-document PDF save re-points `origin`.

## 5 · Engines (summary)

- **OCR:** tesseract.js 5 at 300 dpi; invisible text (render mode 3); `L.ocrCells` reads table cells one by one.
- **Tables:** rulings from the operator list or from pixels; union-find for merged cells; XLSX/CSV/TSV/HTML/Markdown.
- **Field detection:** underscores, lines, ☐ glyphs and squares, empty table cells, “Label:” gaps, Word placeholders.
- **Templates:** a block list (`head`, `row`, `para`, `choice`, `checks`, `table` with `prd` / `total`, `totals`, `rating`, `text`, `sign`, `approve`) laid out on A4/Letter with paging. Fields use `style: 'plain'` over drawn boxes.
- **Covers:** `L.coverPdf(kind, id, details, [w, h])` uses pdf-lib with the standard fonts; titles are auto-fitted and wrapped.
- **Space audit:** classifies every indirect object (images, font programs found through font descriptors at any depth, page contents and form XObjects, metadata, embedded files, structure, other), scaled to the real file size.
- **Hidden-data inspector:** `L.inspectHidden(state)` reads each source with pdf-lib and checks:
  - the XMP size;
  - name trees (embedded files, JavaScript), OpenAction and AA scripts;
  - OCProperties (hidden layers);
  - outlines;
  - page annotations by subtype, page AA, Thumb and PieceInfo.
- **GIS:** UTM ⇄ WGS 84, `.prj`, Shapefile, TEKAL `.ldb/.pol/.pli`, `.xyz`, `.xyn`, GeoJSON, KML, GPX, DXF, CSV + WKT.

## 6 · Server API (1.1.0)

Every `/api/*` call except `status` requires all three:

- the header `X-Loeito: 1`;
- `Host` = `localhost:<port>` or `127.0.0.1:<port>` (this defeats DNS rebinding);
- `Origin` absent or equal to that host.

The server binds to 127.0.0.1 only. It claims its port **exclusively** (`SO_EXCLUSIVEADDRUSE`, no address reuse); otherwise Windows lets two servers share a port and the browser may reach the wrong one.

With `--open` (used by `Start Loeito.cmd`):

- If the preferred port (8765) is busy and the listener there is a Loeito serving the same folder (`/api/status` returns `app: "loeito"` and the same `root`), the server opens that one and exits.
- If something else holds the port, it tries the next one (up to +19).
- The browser opens only after the server is listening.

| Endpoint | Purpose |
|---|---|
| `GET /api/status` | `{ office, apps, types, fs: true }` |
| `POST /api/convert?name=` | Office → PDF through `convert.ps1` (60 MB, 180 s) |
| `GET /api/fs/places` | Desktop / Documents / Downloads (Windows known folders), drives with labels, home, safety folder |
| `GET /api/fs/list?path=` | Folder entries (hidden/system skipped, max 5000) and the parent |
| `GET /api/fs/read?path=` | File bytes. PDF, images and Office files only; 500 MB max |
| `POST /api/fs/mkdir?path=&name=` | New folder (409 if it exists) |
| `POST /api/fs/write?path=&overwrite=0|1` | Saves an allowed type. 409 if the file exists without `overwrite`. On overwrite, copies the old file to `%LOCALAPPDATA%\Loeito\Safety copies` (pruned after 30 days). Writes to a temp file, then replaces atomically. 423 if the file is locked |
| `POST /api/fs/reveal?path=` | Opens Explorer with the file selected |

## 7 · Pointer tools and text

- `L.setTool('select' | 'text' | 'hand')` sets the classes `pm-*`, plus `bare` when the active blade has no pointer handler. CSS sends events to the overlay or the text layer.
- `L.wantsPan(e, bladeActs)` decides whether a drag pans:
  - always for Hand, Space or the backdrop;
  - for Select, only on empty paper when the blade doesn’t act.
- The stage and the reader share `L.buildTextLayer(page, view)` (pdf.js text plus OCR spans).

## 8 · Libraries

pdf.js 3.11.174 · pdf-lib 1.17.1 · tesseract.js 5.1.1 (lazy) · JSZip 3.10.1 (lazy) · xlsx-js-style 1.2.0 / SheetJS 0.18.5 (lazy) · Inter (Google Fonts).

## 9 · Keyboard

- **Files:** Ctrl O open · Ctrl S save · Ctrl Shift S Save As · Ctrl F find · Ctrl Z / Ctrl Shift Z undo/redo.
- **View:** Ctrl + / − / 0 zoom (Shift = fine) · V / T / H tools · Space pan · F focus · ? shortcuts.
- **Pages:** Ctrl L / R rotate · Ctrl \ sidebar · ← → pages.
- **Forms:** Ctrl D duplicate · Alt-click key field · Alt-drag without snapping · arrows nudge.

## 10 · Verification record

`private/PLAN.md` (kept locally) Round 4 § 5 lists how each 1.1 feature was verified: in the browser with the files in `../Input` and `samples/`, with outputs read back with pypdf. Earlier rounds are recorded above it.
