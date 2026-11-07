# Loeito Help

_Loeito 1.6.0. Quick answers on how each part works. Every section ends with a short hands-on tutorial; the full details are in the User Manual._

## Getting started

Tip: press **Ctrl K** anywhere and type what you want to do. The command palette finds every action.

Open the Loeito desktop app, or Loeito's web page in your browser. Your files never leave the computer. The welcome screen offers **Merge PDFs**, your **Recent** files and every tool. Drop a file anywhere, or press **Ctrl O**.

> Tutorial: **02 Open and save** (Help → Tutorials)

## Document properties

**What it does:** shows and edits what is stored inside the PDF:

- title, author, subject and keywords;
- language, created date, the program it was made with, and your own fields.

A **check** points out what's missing or untidy and fixes it with one click.

**How it works:** click the document's name at the top, or press **Ctrl K** and type "properties". The details are written into the file when you save.

> Tutorial: **15 Document properties**

## Merge PDFs

**What it does:** joins two or more files into one PDF. Before merging you can reorder files and pages, move or copy pages between files, rotate and remove pages.

**How it works:**

- From an open document, *Pages → Merge this with other files…* starts with that document and all its edits. **Back to Loeito** sets the merge aside; *Merge waiting* brings it back.
- Files appear in the order you click them, each with a preview, page count and size. Hover a preview for the author, dates and paper size.
- Drag cards to reorder the files. Under **Show pages**, drag pages to move them; Ctrl-drag copies them.
- Cut / Copy / Paste work through the bar at the bottom. Whole files can be copied, pasted or duplicated too.
- Word, Excel, PowerPoint and OpenDocument files can be added in the desktop app (it uses Microsoft Office or the free LibreOffice), and **Cover…** adds a designed cover or last page.
- **Merge & Open** saves the result (in the first file's folder unless you choose another) and opens it for checking.

> Tutorial: **01 Merge PDFs**

## Opening, saving and Save As

**What it does:**

- **Ctrl S** saves back into the original after one question (Enter = yes) and keeps a safety copy.
- **Ctrl Shift S** is Save As: choose a name and folder, make a new folder, choose *Replace* or *Keep both*.

**How it works:** Loeito's own file sheet uses its local helper to browse folders. Without it, your browser's save window is used.

> Tutorial: **02 Open and save**

## Reading, zoom and selecting text

**What it does:**

- **Read** scrolls through the whole document, with themes, focus mode (F), contents and read-aloud.
- The pointer tools are **Select** (V), **Text** (T) and **Hand** (H).
- Zoom speed is set in the **%** menu; **Shift** zooms finely.

**How it works:** Loeito lays the PDF's text, or the OCR text, invisibly over the page image. That is why you can select and copy it.

**Ways to view (every tool):** click the zoom percentage at the bottom for:

- **Full window** (Ctrl Shift F): hides the page list and the tabs, so the page gets the space. Esc brings them back.
- **Full screen** (F11): the whole monitor.
- **Continuous reading:** scroll through all pages in Read.
- **Scroll on to the next page:** in any tool, keep scrolling past the end of a page and the next one opens. You can switch it off in the same menu.
- **Snapshot** (Ctrl Shift C): drag a box on the page, or click for the whole page. Copy the picture, or save it as PNG. The picture is sharp, about 3000 pixels on the long side.

> Tutorial: **03 Reading**

## Pages

**What it does:** rotate, reorder, delete, duplicate, insert blank pages, extract, split, and send pages to another tab. A page's own buttons act on it at once. Select with click, Ctrl-click, Shift-click or a rectangle. Press R to rotate, the arrow keys to move pages (Home / End to the start / end), and Ctrl X / C / V to cut, copy and paste them, also between tabs. The left page list hides itself in the grid.

**How it works:** changes are recorded and only written when you save; Ctrl Z undoes them.

> Tutorial: **04 Pages**

## Edit

**What it does:** add text, highlight, white-out, draw, add shapes, sign and place pictures. You can also correct existing text.

**How it works:** your marks are drawn onto the page when you save. Text you correct is covered and retyped. For real removal, use Protect.

> Tutorial: **05 Edit**

## Crop

**What it does:** trims margins on one page, on odd or even pages, or on all pages. Auto-trim finds the edges of scans.

**How it works:** sets the visible area of the page. Nothing is thrown away, so you can widen it again later.

> Tutorial: **06 Crop**

## Make searchable (OCR)

**What it does:** recognizes the text in scans, so you can search, select and copy it.

**How it works:** runs OCR (Tesseract) on your computer and saves the text as an invisible layer. The page looks unchanged.

> Tutorial: **07 Make searchable**

## Tables

**What it does:** finds tables, including in scans, and exports them to Excel (merged cells and colors kept), CSV, Word or Markdown.

**How it works:** reads the ruling lines of the grid, then reads the text cell by cell.

> Tutorial: **08 Tables**

## Digitize

**What it does:** turns graphs into numbers, and maps into points, lines and areas with real coordinates. Exports include Shapefile, GeoJSON, KML, DXF and Delft3D.

**How it works:** two or more reference points link the page to real coordinates (UTM, WGS 84 or local).

> Tutorial: **09 Digitize**

## Optimize

**What it does:** shows what takes up space, makes files smaller, changes the paper size, and saves pages as images.

**How it works:** re-encodes large images at the resolution you choose and rebuilds the file compactly.

> Tutorial: **10 Optimize**

## Stamp

**What it does:** adds page numbers (including Bates), headers and footers with left / center / right text, and watermarks. Each can go on all, odd, even or chosen pages, skipping the first or last pages.

**How it works:** you see a live preview, and the stamps are written as real text when you save.

- **Place by hand:** drag a stamp on the page. Then choose where the new spot applies: all pages, only this page, pages of the same size, or chosen pages.
- **Mixed page sizes:** *Scale with the page* adapts the text size, and the size-group chips put a stamp only on, say, the landscape pages.

> Tutorial: **11 Stamp**

## Covers

**What it does:** adds a designed front cover or last page. Type the details and pick one of 13 designs.

**How it works:** builds a new vector page in your document's paper size; undo removes it.

> Tutorial: **12 Covers**

## Forms

**What it does:**

- start from 10 templates, draw fields, or let Loeito find the blanks in Word, Excel and scanned forms;
- arrange and align fields;
- add **labels, boxes, ovals and lines** right in Forms. A field's own label moves and is deleted with it, and shows a red * by itself when the field is Required;
- set the text color of answers;
- make fields appear only after certain answers, and add buttons that email the form;
- try the form in Fill in.

**How it works:** saves standard PDF form fields with Acrobat-compatible formats and totals. They work in Acrobat, Edge, Chrome and Foxit.

**Dates:** a date field gets a calendar in Fill in, and impossible dates (like 23/76/5006) are flagged. Acrobat and Foxit also check dates in the saved file; browsers do not.

**Scripts (for experts):** field scripts and the document script are Acrobat JavaScript. They run in **Acrobat, Foxit and PDF-XChange** only, not in Chrome, Edge, Firefox, phone apps or Loeito's preview. Basic syntax and recipes (totals, show/hide, today's date, checks) are in the User Manual → Forms → *Script recipes*.

> Tutorial: **13 Forms**

## Protect

**Passwords:** Protect → *Password* locks the file with AES-256 and lets you choose what others may do (print, copy, fill forms, edit). Protected files stay protected when you save; *Remove password* unlocks them for good. This needs the desktop app (for now also Python with the free pypdf and cryptography packages).

**What it does:** finds and blacks out private details (names, CNIC, phone, email, accounts, dates, money). It also inspects and removes hidden information before you share.

**How it works:** pages with black boxes are saved as pictures, so the covered text is gone. The words you didn't black out stay searchable.

> Tutorial: **14 Protect**

## License

Loeito is free and open-source software under the GNU AGPL v3. See Help → About, `LICENSE` and `NOTICE.md`.

## When something doesn't work

- **A Word or Excel file won't open:** install the free LibreOffice (libreoffice.org), or save it as PDF first.
- **Can't save to the original:** the file may be open in another program (e.g. Acrobat). Close it, or save a copy.
- **A scan has no text:** run Make Searchable first.
- **Everything else:** Help → User Manual, or press **?** for keyboard shortcuts.
