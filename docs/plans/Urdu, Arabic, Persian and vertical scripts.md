# Plan: first-class Urdu, Arabic and Persian, and vertical Chinese and Japanese

> Planned, not built yet. Comments welcome: open an issue on GitHub.

The goal: everything Loeito does should work as well in Urdu, Arabic and Persian (written right to left, with joined letters) and in vertical Chinese and Japanese (written top to bottom) as it does in English.

## What "first class" means, tool by tool

| Tool | What will work |
|---|---|
| **Read** | Right-to-left page order, search that finds joined letters, read-aloud with the right voice |
| **Edit** | Type Urdu, Arabic or Persian with letters joined correctly; Nastaliq style for Urdu; vertical text boxes for Chinese and Japanese |
| **Forms** | Right-to-left fields and labels; numbers in Eastern Arabic digits (۱۲۳) when wanted; dates in the matching calendar order |
| **Searchable (OCR)** | Urdu, Arabic and Persian included, plus vertical Chinese and Japanese, with copied text in the right order |
| **Tables** | Columns read right to left; export keeps the direction |
| **Stamp** | Page numbers and headers in these scripts and digits |
| **Covers** | Templates laid out right to left, and vertical ones |
| **Merge, Pages, Crop** | Right-to-left books: pages in the right order, thumbnails right to left |
| **Properties** | Titles and authors in these scripts saved correctly |
| **Loeito itself** | Menus and messages in Urdu, Arabic and Persian, with the whole window mirrored |

## How you will use it, click by click

1. Click **Settings** (gear icon) → **Language and writing**.
2. Under **Writing direction**, click **Right to left** (Urdu, Arabic, Persian) or **Top to bottom** (Chinese, Japanese), or leave **Automatic**: Loeito decides from the text.
3. Under **Fonts**, click **Download** next to the script you need (for example *Urdu — Nastaliq, 4 MB*). Once downloaded, it works offline.
4. Under **Digits**, choose **0123**, **٠١٢٣** (Arabic) or **۰۱۲۳** (Urdu and Persian).
5. Under **Loeito's language**, choose **اردو**, **العربية** or **فارسی** to see Loeito itself in that language.

In any text box you can also switch direction on the spot with **Ctrl Shift X**.

## Things to know

- **Font size:** good Nastaliq and CJK fonts are large (several MB each), so they are downloaded only when you ask, then kept.
- **Old PDFs:** some older Urdu and Arabic PDFs store letters in a broken order. Loeito will offer to repair copied text; when it can't, OCR is the fallback.
- **Speed:** joining letters correctly takes a little more work while typing and saving, but you should not notice it.

## Order of work

1. Typing and saving in Urdu, Arabic and Persian with joined letters (Edit, Forms, Stamp).
2. Right-to-left reading, search and page order.
3. OCR for Urdu, Arabic, Persian and vertical Chinese and Japanese.
4. Vertical text boxes.
5. Loeito's menus in Urdu, Arabic and Persian.
