# Loeito — User Manual

_Loeito 1.6.0 · November 2026. Quick answers: Help → Help. Step-by-step: Help → Tutorials._ Every PDF task, just right._

Loeito is a private PDF workbench. Everything happens on your computer: files are never uploaded.

## Starting Loeito

**Desktop app:** download the installer for Windows, macOS or Linux from the project's *Releases* page on GitHub. It runs Loeito in its own window, with everything built in.


- **Double-click `Start Loeito.cmd`** (recommended). A small local helper starts and Loeito opens in your browser at http://localhost:8765. With it, Loeito can save straight back into your files, browse your folders, and open Word, Excel and PowerPoint files through your installed Microsoft Office.
- Or double-click `index.html`. Everything works except folder browsing, safety copies and Office import; saving back into a file still works in Edge and Chrome for files opened with Loeito’s Open button or dropped onto Loeito.
- The first start needs an internet connection so Loeito can load its PDF engine (and, for OCR, the language model).

The welcome screen lists your **Recent** files. Click one to open it again.

## Opening, tabs and saving

### Open
Press **Ctrl O**, click **+** on the tab bar, or drop files onto Loeito. Each document opens in its own **tab**, and opening never replaces what you’re working on. Dropping files onto the page list instead adds their pages to the current document.

The **Open** sheet shows your places on the left: Desktop, Documents, Downloads, your drives, recent folders. Double-click a folder to go in. Use the arrows for back, forward and up, or click any part of the path. Ctrl- or Shift-click picks several files. *Use the Windows dialog…* is there if you prefer it.

### Save to the original (Ctrl S)
Loeito asks one short question:

> **Save changes to the original?** This updates “Report.pdf” in Projects. Want to keep the original as it is? Save a copy instead.

- **Save to Original** is the default, so pressing **Enter** saves.
- **Save a Copy Instead…** opens Save As.
- Tick *Don’t ask again for this document* if you’re saving often.

Loeito keeps the previous version as a **safety copy** for 30 days. You can find it under *Safety copies* in the Save As sheet. If the file is open in another program (for example Acrobat), Loeito tells you and offers to save a copy.

A document that came from Word, Excel or an image is never overwritten. Ctrl S opens Save As in the same folder.

### Save As (Ctrl Shift S)
One sheet for name, place and options:

- **Name** with Smart Name suggestions.
- **Folders:** places, back / forward / up, clickable path, filter, and **New folder** (type the name and press Enter to go straight into it).
- **Replace or Keep both:** if the name exists, Loeito says so and offers *Keep both* (adds “(2)”).
- **Format:** PDF, page images (PNG / JPEG, 72–300 dpi), or plain text.
- **Options:** include OCR text, keep the form fillable or flatten it, and **Clean for sharing** (see Protect).

After saving a whole PDF, the tab continues with the new file. The Save button’s arrow menu also offers *Save a copy for sharing…* and *Show in folder*.

Every export (tables, maps, text, images) uses the same sheet.

## Document properties

Click the document's name in the toolbar (or press Ctrl K and type *properties*).

- **File name** with Smart Name suggestions.
- **Details saved inside the PDF:**
  - title, author, subject and keywords;
  - language, created date and *made with*;
  - your own fields (for example *Project*, *Reference number*);
  - *Show the title in viewers' title bars*.
- **Check:** lists what's missing or untidy: no title, a title in CAPITALS or with "_" and ".pdf", repeated keywords, no language, and so on. Each item has a **Fix** button, and **Tidy up everything** fixes them all at once.
- **What the original file said:** the original title, author, program, dates, PDF version and whether it was protected.

## Passwords

**Protect → Password:**

1. Type a password to open the file (a strength bar helps) and type it again.
2. Under *What people may do with it*, choose printing, copying, form filling and editing. Add an owner password if you set limits.
3. Click **Protect when saving**. The protection (AES-256) is applied every time you save, or use *Save a protected copy…*.

A protected PDF asks for its password when you open it. Saving keeps it protected with the same password unless you click **Remove password**.

You need Loeito started with *Start Loeito.cmd* (or the desktop app) and, once, `py -m pip install pypdf cryptography`.

## Merge PDFs

Click **Merge PDFs** on the welcome screen to start fresh. To start from the document you have open, use **Pages → Merge this with other files…** or the Save button's menu. The open document comes in first, **with all your edits** (page order, rotation, crop, highlights, form fields, OCR text), and Loeito asks for the files to add. Its card says *open tab · edited*. If you keep editing the tab, **Update from the open tab** on the card takes the newest version.

**Back to Loeito** (or Esc) sets the merge aside while you work in another tool. A small *Merge waiting* bar at the bottom brings it back exactly as you left it. Its × discards the merge; your documents stay as they are.

1. **Pick the files** in the order you want; they keep the order you clicked. You can also drop files onto the workspace, or use **Add files** later.
2. **Each file is a numbered card** with a preview, its page count, size and author. **Hover** over the preview for its title, author, created and modified dates, the program that made it, paper size and folder.
3. **Reorder files** by dragging a card (the blue line shows where it lands) or with ↑ ↓. Rotate all pages of a file, or remove it from the merge, with the buttons on its card.
4. **Show pages** opens a file's page strip. Click to select; Shift-click selects a range, Ctrl-click adds pages, Ctrl A selects everything.
   - **Move** pages by dragging them within a file or onto another file. Hold **Ctrl** when dropping to **copy** instead.
   - **Cut / Copy** in the bar at the bottom (or Ctrl X / Ctrl C), then click a **+** between pages, or **Paste at start / Paste at end** on any file.
   - **Rotate** with Left / Right, the buttons on each page, or **R** (Shift R = left). **Delete** removes pages. **Ctrl Z** undoes.
5. **Name and place:** type the name next to *Save as*. The folder button chooses where it goes (normally the folder of the first file).
6. **More than PDFs:** add pictures, and Word, Excel or PowerPoint files (converted with your Microsoft Office; start Loeito with *Start Loeito.cmd* for this). **Cover…** adds a designed front cover (at the start) or last page (at the end).
7. **Whole files:** the copy button on a card copies the file; *Paste file at the start / here / at the end* slots appear between the cards. The duplicate button adds a copy right after it.
8. **Merge & Open** (Ctrl Enter) saves without replacing anything ("(2)" is added if the name exists) and opens the result in a new tab. *Show in folder* is in the confirmation.

Tutorial: *01 Merge PDFs*.

## Working with pages in the grid

**Pages** shows every page as a card. The left page list slides away here, because the grid already shows everything; it slides back when you make the cards large, or when you click the sidebar button.

- **Select:** click a page. Ctrl-click adds pages here and there, Shift-click selects a range, and dragging a rectangle on empty space selects everything it touches. Ctrl A selects all; Esc clears.
- **Act at once:** hover a page and use its own buttons (rotate left, rotate right, delete). They act on that page straight away, or on the whole selection if the page is part of it. With the keyboard, **R** rotates right and **Shift R** left; **Delete** removes.
- **Reorder:** drag pages anywhere in the grid; the others glide out of the way.
- **Move with the keyboard:** select one page, several scattered pages or a range.
  - **← →** move them one place, and **↑ ↓** one row (the pages they pass shift along).
  - **Home / End** send them to the start or end, and *Before page…* in the panel moves them to a page number.
- **Cut, copy, paste:**
  - **Ctrl X / Ctrl C**, then select a page and press **Ctrl V** to paste after it (**Ctrl Shift V** before it). This also works into another tab.
  - **Ctrl D** duplicates.
  - **Alt + arrows** walk to the next page without moving anything (add Shift to extend the selection).
- **Size:** the slider at the bottom, or Ctrl-wheel over the grid, makes the cards bigger or smaller.

Rotated pages turn smoothly into place, here and in every other view.

Tutorial: *04 Pages*.

## Looking at pages

### Zoom
- **Ctrl-wheel** or a trackpad pinch zooms around the pointer. **+ / −** step through 25 … 800 %.
- Click the **%** to get Fit width, Fit page, Actual size and **Zoom speed**:
  - **Auto** (recommended): brisk for reading (about 20 % per wheel notch), fine in Digitize and Crop;
  - **Fine**: about 4 % per notch;
  - **Normal**: about 20 % per notch;
  - **Fast**: about 40 % per notch.
- Hold **Shift** while zooming for fine steps at any time.

### Pointer tools
These sit on the page bar at the bottom:

| Tool | Key | What it does |
|---|---|---|
| Select (arrow) | V | The current tool works as usual. Over text the I-beam selects it; dragging empty paper moves the page. |
| Text (I-beam) | T | Select text anywhere, even while Edit or Forms is open. |
| Hand | H | Drag to move the page: open hand, closed while dragging. Hold **Space** for a moment of Hand. |

Dragging the grey area around the page always moves it.

When you select text, a small bar offers **Copy**, **Highlight** (a real highlight saved in the PDF), **Find** (every place it appears) and **Speak**.

### Read and Focus mode
The **Read** tool scrolls through the whole document. You get themes (Paper, Sepia, Night), one or two pages side by side, the table of contents, read-aloud, and a “continue where you stopped” prompt. **F** enters Focus mode, which shows only the page, a progress line and the reading time left. **Esc** leaves it.

## The tools

| Tool | For |
|---|---|
| **Read** | Calm reading, focus mode, contents, read-aloud, copy text |
| **Pages** | Rotate, reorder, delete, duplicate, blank pages, merge, extract, split, send pages to another tab |
| **Edit** | Fix text, add text, highlight, white-out, redact, draw, shapes, signature, pictures |
| **Crop** | Margins on one, odd/even or all pages; auto-trim scans |
| **Searchable** | OCR: an invisible text layer that makes scans searchable without changing how they look |
| **Tables** | Ruled and scanned tables with merged cells → Excel, CSV, Word, Markdown |
| **Digitize** | Graphs → numbers; maps → points, lines and areas with real coordinates |
| **Optimize** | What’s using space; smaller files; paper sizes; page images |
| **Stamp** | Page numbers, Bates numbers, headers, footers, watermarks |
| **Covers** | Front covers and last pages for books, reports and theses |
| **Forms** | Fillable forms: templates, drawing, finding blanks automatically, behaviour, fill in |
| **Protect** | Find & black out private details; remove hidden information |

## Stamp: numbers, headers and footers on many pages

Each stamp has a switch. Every change is previewed on the page and written when you save.

- **Page numbers.** Pick a style: 1, 2, 3 · Page 1 · Page 1 of 12 · 1 / 12 · – 1 – · i, ii · I, II · a, b · A, B · Bates · your own pattern. Then choose:
  - the position (six spots);
  - the first number;
  - *Count from*: the first numbered page or the very first page;
  - font (Sans / Serif / Mono, bold), size and colour.
- **Header** and **Footer.** Type text into Left, Centre and Right. The chips insert live fields: {name}, {title}, {author}, {date}, {n} page number, {N} last number, {page}, {pages}. You can add a thin line under the header or above the footer and set the distance from the edge.
- **Watermark.** Text, size, angle, strength and colour.
- **On pages** (every stamp has its own rule):
  - which pages: All, Odd, Even, or Choose (e.g. `3-10, 15`);
  - **Skip first** and **Skip last**, e.g. no number on the cover and the contents pages;
  - **Mirror left ↔ right on even pages** for book layouts.

The panel shows which pages are affected, e.g. “137 of 140 · 3–139”.

**Bates numbers for a collection.** Choose the *Bates number* style, then set the prefix (e.g. `DOC-`), digits (e.g. 6) and suffix. With several documents open, **Continue across all open documents** numbers them as one series in tab order. **Save all to a folder…** writes each with its number range in the name.

## Covers: a finished first and last page

1. Open **Covers**. Choose **Front cover** or **Last page**.
2. Type the details: title, subtitle and author. Under *More details* you can add the publisher or institution, series or department, supervisor or editor, edition or date, ISBN and website. A last page also has a description and an *About the author* text.
3. Pick a design:
   - Front covers: Classic, Swiss, Nordic, Midnight, Thesis, Report, Bold or Picture.
   - Last pages: Back cover, Colophon, About the author, Notes or The end.
4. Choose an accent colour, a paper size (*Same as this document* keeps covers upright) and, if you like, a picture or logo.
5. **Add as first page** / **Add as last page**, or replace the existing one. Undo works as always.

Covers are real PDF text and shapes, so they stay sharp and searchable.

## Stamps by hand and mixed page sizes

- In **Stamp**, every number, header, footer and watermark on the page has a faint outline. **Drag it** where you want it. When you let go, choose where the move applies: *all pages*, *only this page*, *pages of this size & orientation*, or *pages…* (a range).
- Positions are kept as a distance from the page edge, so a moved stamp sits in the same spot on A4, Letter, portrait and landscape pages alike.
- **Scale with the page** makes text smaller on small pages and bigger on large ones.
- When a document mixes sizes, *On pages* shows one chip per size and orientation (for example *A4 landscape · 6*). Click it to stamp only those pages.
- **Back to the standard position** clears hand placements.

## Command palette

Press **Ctrl K**, type a few letters ("merge", "password", "rotate", "properties"…) and press **Enter**. Every tool and action is there, including switching tabs.

## Forms

### Start from a template
Forms → **Start from a template…** (also on the welcome screen). There are ten everyday forms:

- Registration, Job Application, Leave Application, Expense Claim, Invoice;
- Purchase Requisition, Feedback Survey, Consent & Release, Weekly Timesheet, Service / IT Request.

Type your organisation’s name, pick the paper and an accent colour, then **Create form**. The form opens in a new tab with its fields, formats and totals ready. The Invoice works out Qty × Rate per line, the subtotal and the total. Change anything you like.

### Make or convert a form
- **Draw fields:** text, paragraph, checkbox, choice, dropdown, list, signature, button. Click for a standard size or drag to draw. The name comes from the nearby label.
- **Find fields** turns blanks in a flat PDF into fields: lines, `____`, ☐ boxes, empty table cells and “Label:” gaps. It works on Word, Excel and scanned forms too. Run Make Searchable on a scan first.
- **Settings in plain words:** required, help text, kind of answer (number, money, percent, date, email, phone, CNIC, pattern), character boxes and automatic totals.

### Arrange
Select one or more fields. **Arrange** aligns them:

- **Align to:** *Selection* (to each other), *Key field* (one field stays put; it has a thick outline, and Alt-click picks another) or *Page*.
- Align left, centre, right, top, middle or bottom; distribute with equal gaps; make them the same width, height or size.
- While you drag, fields **snap** to other fields and to the page centre (red guide lines). Hold **Alt** to move freely. The arrow keys nudge by 1 pt (Shift = 10 pt).

### Behaviour
- **Buttons:** clear the form, print, **e-mail the filled form**, open a web page, go to a page, show/hide fields, or run your own script.
- **Show only when…:** a field appears only when another one has a certain answer. For example, show “Other details” only when “Other” is chosen, or “Supervisor’s phone” only when a box is ticked. Conditional fields carry a small blue *if* badge.
- **Scripts (for experts):** Format, Keystroke, Validate and Calculate scripts per field, plus a document script. These are Acrobat JavaScript, run by Acrobat, Foxit and PDF-XChange, but not by browsers or phone apps (see below).

### Dates
Choose **Date** as the kind of answer and pick a style (dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd or dd-mmm-yyyy).

- In Loeito's **Fill in**, a date field has a small calendar button, and an impossible date such as 23/76/5006 or 30/02/2026 is marked *Not a real date*.
- In the saved PDF, **Acrobat, Foxit and PDF-XChange** show their own calendar and refuse wrong dates.
- **Browsers (Chrome, Edge, Firefox) and most phone apps** show a plain text box and accept anything. That is a limit of those readers, not of the file.

### Scripts: where they work
Scripts are **Acrobat JavaScript** stored inside the PDF.

| Works | Does not work |
|---|---|
| Adobe Acrobat / Reader, Foxit, PDF-XChange (desktop) | Chrome, Edge, Firefox, Mac Preview, most phone apps, Loeito's own preview |

So never make a form depend on a script alone. Loeito's own totals, formats and *Show only when* rules are saved in the standard way and work in more readers. Use scripts only for extras.

### Script basics
- `this` is the document; `event` is what just happened.
- `this.getField("Name")` finds a field; `.value` reads or sets its answer; `.display = display.hidden` or `display.visible` hides or shows it.
- `event.value` is the field's new value (in Calculate, Format and Validate); `event.rc = false` refuses it (in Validate and Keystroke).
- `app.alert("Text")` shows a message.
- The **document script** runs once when the PDF opens. Put shared functions there and call them from field scripts.

### Script recipes
**Total of three fields** (Calculate script of *Total*):
```js
event.value = Number(this.getField("A").value) + Number(this.getField("B").value) + Number(this.getField("C").value);
```
**Show a field only when a box is ticked** (Calculate script of the hidden field):
```js
event.target.display = this.getField("Has car").value !== "Off" ? display.visible : display.hidden;
```
**Today's date as the default** (document script):
```js
var d = this.getField("Date"); if (!d.value) d.value = util.printd("dd/mm/yyyy", new Date());
```
**Allow only 18 to 99** (Validate script of *Age*):
```js
if (event.value !== "" && (event.value < 18 || event.value > 99)) { app.alert("Age must be 18 to 99."); event.rc = false; }
```
**Capital letters** (Keystroke script):
```js
event.change = event.change.toUpperCase();
```
**A shared function** (document script, then use `fullName()` in any field):
```js
function fullName() { return this.getField("First").value + " " + this.getField("Last").value; }
```
Test scripted forms in Acrobat Reader or Foxit before you send them.

### Fill in and save
**Fill in** lets you try the form exactly as people will: CNIC dashes appear by themselves, wrong e-mails are flagged, totals update and conditional fields appear. Answers can be saved and loaded as CSV or JSON. When saving, keep the form fillable or flatten the answers into the page.

## Protect: share without leaking

### Find & black out
1. Type names, numbers or phrases (one per line), and/or pick kinds of information: **CNIC numbers, phone numbers, e-mail addresses, bank accounts & IBAN, dates, money amounts**.
2. **Find.** Every match is outlined in red and listed. Untick any you want to keep, and click a match to see its page.
3. **Black out.** The boxes can be changed or removed in Edit until you save.

When you save, pages with black boxes become pictures, so the covered text is truly gone. The words you didn’t black out stay searchable as invisible text.

### Hidden information
**Inspect this document** lists what travels unseen in a PDF:

- document details;
- hidden metadata;
- comments;
- attached files;
- scripts;
- web links;
- hidden layers;
- private app data and thumbnails;
- form answers;
- bookmarks;
- OCR text.

Each row says whether it is kept. Switch items on to remove them every time this document is saved. If there are hidden layers, flatten those pages so their content can’t reappear. **Save a clean copy for sharing…** removes everything that’s safe to remove in one go.

## Optimize: smaller files

**What’s using space → Look inside** shows how the file’s size divides into:

- images;
- fonts;
- page drawings & text;
- metadata;
- attached files;
- file structure.

It also lists the largest images (pixels, compression, colour) and the embedded fonts, with a suggestion on what would help most. Then pick *Original, Tidy, Balanced* or *Smallest*, greyscale or metadata removal, and a paper size. The main Save uses these settings too.

## Other tools in brief

- **Tables:** Loeito finds ruled tables, including in scans, where it reads cell by cell. It exports a styled Excel file with merged cells, CSV, a rich copy for Word/Excel, or Markdown.
- **Digitize maps:**
  1. Choose Local, a UTM zone or WGS 84.
  2. Place two or more reference points.
  3. Trace points, lines and areas.
  4. Export to Shapefile, GeoJSON, KML, GPX, DXF, CSV/WKT or Delft3D (.ldb land boundary, .pol, .pli, .xyz, .xyn).
- **Make Searchable:** OCR in English and other Latin-script languages; Urdu and Arabic are recognised for copying.
- **Smart Name:** click the document name for name suggestions and the details stored in the PDF.

## Keyboard shortcuts

Press **?** in Loeito for the full list.

| Action | Keys |
|---|---|
| Open · Save · Save As | Ctrl O · Ctrl S · Ctrl Shift S |
| Find · Undo · Redo | Ctrl F · Ctrl Z · Ctrl Shift Z |
| Zoom · fine zoom · fit | Ctrl + / −, Ctrl-wheel · Shift · Ctrl 0 |
| Select · Text · Hand | V · T · H (Space = Hand for a moment) |
| Pages | → ← · Home · End |
| Rotate | Ctrl L · Ctrl R |
| Focus mode | F · Esc |

## Good to know

- **Privacy:** files are processed in the browser window. The local helper only answers Loeito’s own page on this computer.
- **Fonts:** stamps, covers, form templates and form answers use the standard PDF fonts, so they’re limited to Latin characters for now.
- **Bookmarks** of the original aren’t kept when saving yet (coming in 1.2).
- **Older versions:** each milestone is kept in the `versions` folder with its own manuals.
