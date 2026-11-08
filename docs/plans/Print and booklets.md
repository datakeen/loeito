# Plan: professional print management, made visual

> Planned, not built yet. Comments welcome: open an issue on GitHub.

Printing a booklet normally takes real skill: which page goes where, which way up, and which edge to flip. The goal is that you never have to work that out. You say what you want to hold in your hand, you see it, and Loeito does the arithmetic.

## How it will work, click by click

1. Open the PDF and click **Print & Publish**.
2. Click a picture of what you want to make: **Folded booklet**, **Book in sections**, **Several per sheet**, **Cards and labels**, **Poster**, or **Plain**.
3. Choose the paper, for example A4 for an A5 booklet.
4. Choose the reading direction: **Left to right**, or **Right to left** for Urdu, Arabic and Persian books, which open and bind from the other side.
5. Look at the **3D preview**: turn pages of the finished booklet to see that page 1 is the cover and every page follows in order.
6. Open **Sheet view** to see each side of each sheet, with page numbers and arrows showing which way up. Drag a page to change it.
7. Click **Print guide** for your printer, then **Save print-ready PDF** or **Print**.

## An example: an 8-page folded booklet

Two sheets, printed on both sides, stacked, folded in half and stapled in the middle.

| Sheet | Front (left, right) | Back (left, right) |
|---|---|---|
| 1 (outer) | 8, 1 | 2, 7 |
| 2 (inner) | 6, 3 | 4, 5 |

Loeito works this out for any length. A booklet needs a page count divisible by 4, so if yours isn't, Loeito offers to add blank pages and lets you choose where: for example before the back cover.

## Print guide for your printer

- **Printer prints both sides:** Loeito says which setting to choose, normally "flip on short edge".
- **Printer prints one side only:** a step-by-step guide: print the fronts, turn the stack as the picture shows, reload it, print the backs.
- **One-page test:** print one sheet with arrows and numbers once. Tell Loeito how it came out, and it remembers how that printer feeds paper, so later jobs come out right the first time.

## What it will cover

**Layouts (imposition)**

| Method | For |
|---|---|
| Saddle stitch | Folded and stapled booklets, as above |
| Sections (signatures) | Thick books: several small folded booklets glued or sewn together |
| Perfect and side binding | Glued spine or staples along the edge, with extra margin |
| Several per sheet (N-up) | 2, 4, 8 or more pages per sheet, with order and gaps |
| Step and repeat | Many copies of one card, label or ticket on a sheet |
| Cut and stack | Numbered pads and tickets that stay in order after the stack is cut |
| Poster tiling | A large page over many sheets, with overlap and glue marks |
| Work-and-turn, work-and-tumble | Press work that prints both sides using one plate set |
| Paper saving | Fits the most copies per sheet and shows the waste |

**Getting the paper right**

- **Creep compensation:** in a thick folded booklet, inner pages stick out and get trimmed more. Loeito shifts them, using the paper thickness.
- **Binding margin (gutter),** on the correct side for the reading direction.
- **Printer's safe area:** warns about content the printer can't reach, and offers fit or actual size.
- **Scaling** between paper sizes, such as A4, A5, Letter, Legal and custom sizes.

**Marks for a print shop**

Crop marks, bleed, fold marks, registration marks, color bars, sheet and section numbers, and a note of the job on each sheet. The trim and bleed sizes are stored in the PDF.

**Checks before printing (preflight)**

Low-resolution pictures, fonts not embedded, images without bleed, text too close to the edge, RGB colors where print needs CMYK, too much ink on the page, hairlines too thin to print. Each comes with a plain explanation and a **Fix** button where possible.

**Color and standards (desktop app)**

Convert to CMYK using color profiles, grayscale, spot colors, overprint preview, ink-saving, and PDF/X files that print shops ask for.

**Print order**

Reverse order, collating, odd or even pages only, page ranges, and printing only one damaged sheet again.

**Saved presets**

For example *A5 booklet on my office printer* or *Visiting cards, 10 per A4*, for one-click repeats, as part of Preferences.

## Friction free

Print & Publish can be started from the Pages tool, the Print command, the right-click menu and Ctrl K, and works by mouse or by keyboard.

## Things to know

- Printers differ, so one test sheet before a long run is always wise.
- Exact color needs a calibrated printer and the print shop's color profile; a screen can only approximate it.
- CMYK and PDF/X need the desktop app, using an added color engine.
- Very thick folded booklets don't fold well. Above roughly 60 pages Loeito will suggest sections instead.

## Order of work

1. Folded booklet: sheet view, 3D preview, right-to-left, print guide, test sheet.
2. Several per sheet, step and repeat, cards, poster tiling.
3. Sections, creep, binding margins.
4. Print-shop marks, bleed and page boxes.
5. Preflight checks with fixes.
6. CMYK, spot colors and PDF/X.
