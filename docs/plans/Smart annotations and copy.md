# Plan: smart annotations and clean copy

> Planned, not built yet. Comments welcome: open an issue on GitHub.

Today Loeito has text highlight and a selection bar with Copy, Highlight, Find and Speak. This plan adds annotation tools that are quicker, smarter and friendlier than what other PDF apps offer, plus copy that gives you clean text without the usual line-break mess.

## Clean copy (no line breaks in the middle of sentences)

The problem: you select a paragraph in a PDF, press Ctrl C, paste it into an email, and every line ends with a hard break. You then have to delete them one by one.

How it will work:

1. Select text and press **Ctrl C** or click **Copy** in the selection bar. The text is already cleaned: line breaks inside a paragraph become spaces, while real paragraph breaks stay.
2. If you do want the raw text with every line break, press **Ctrl Shift C** or hold Shift when clicking Copy. The selection bar shows a small label: "Clean" or "Raw".
3. In Preferences, choose the default: clean (recommended) or raw.

How Loeito decides: if a line break falls in the middle of a sentence (no period, question mark, colon or list marker before it, and the next line starts with a lowercase letter or continues a word), it's a soft break and becomes a space. A break after a heading, a list item, a blank line or a sentence end stays. This works for most documents; when it guesses wrong, Ctrl Z in the program you pasted into, then Ctrl Shift C for raw.

## One-click line highlight

Select a word anywhere on a line and click **Highlight**: the entire line is highlighted edge to edge, not just the word. No need to drag precisely from the first letter to the last.

If you select across several lines, each full line is highlighted.

**Shift-click Highlight** to highlight only the exact selection, as today.

## One-click sentence highlight

1. Double-click a word: it selects the word (as today).
2. Triple-click: selects the whole sentence, from the capital letter to the period, even across lines.
3. Click **Highlight**: the sentence is highlighted, following the text rather than covering the full line width.

In Preferences, choose whether Highlight covers the full line or follows the text.

## Quick highlight while reading (no selection bar needed)

Hold **H** and drag across text. The text is highlighted as you move, and the highlight is saved when you release. No clicking, no bar, no tool switch. Works in Read and in any other view.

Colors: press **1** through **5** before or during the drag to pick a color. The five colors are shown in a subtle strip at the top while H is held.

## Underline and strikethrough, same way

- Hold **U** and drag: underline.
- Hold **D** and drag: strikethrough.

Same key-then-drag pattern, same one-click full-line behavior from the selection bar.

## Margin notes

Click in the margin next to any line. A small note icon appears and a text box opens. Type your thought and press Escape or click away. The note sits in the margin, connected to the line by a thin rule.

Notes can be shown, hidden, or shown as icons only (click to read). Export all notes to Markdown, CSV or HTML.

## Stamps and quick marks

A toolbar of small marks you click once to place:

| Mark | What it means |
|---|---|
| ✓ | Approved, checked |
| ✗ | Rejected, wrong |
| ? | Question, unsure |
| ! | Important |
| ★ | Favorite passage |
| 🔖 | Bookmark this spot |

Click the mark, click the page. One click to place, one click to remove. Keyboard: press the key (**?**, **!**, etc.) while pointing at the page.

## Freehand circle and bracket

- **Circle:** hold **C** and draw a rough circle around something. Loeito smooths it into a neat oval that fits the area you circled. Good for marking a figure, a table, or a block of text.
- **Bracket:** hold **B** and drag down along the margin beside several lines. Loeito draws a clean curly bracket covering those lines, with an optional label at the tip.

## Smart link between pages

Select text on one page, press **Ctrl L**, click a spot on another page. A link arrow connects them: click it to jump. Useful for connecting a question to its answer, a reference to its source, or a figure to its mention.

## Text-to-speech for a highlight

Right-click any highlight and choose **Speak**. The highlighted text is read aloud without selecting it again.

## Annotation summary

Click **Notes** in the sidebar. Every highlight, underline, note, stamp and link in the document is listed, grouped by page or by color. Click one to jump. Export the summary as Markdown, CSV, or a new PDF with just the marked parts and your notes.

## Friction free

Every annotation can be made in at least three ways:
- from the selection bar after selecting text;
- from a keyboard shortcut or hold-and-drag gesture;
- from the right-click menu;
- from Ctrl K ("highlight this line", "add a note here").

## Order of work

1. Clean copy.
2. One-click line and sentence highlight; full-line vs. text-following preference.
3. Hold-key-and-drag for highlight, underline and strikethrough.
4. Margin notes.
5. Stamps and quick marks.
6. Freehand circle and bracket.
7. Smart link between pages.
8. Annotation summary and export.
