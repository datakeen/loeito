# Plan: Compare, Preferences and Measure

> Planned, not built yet. Comments welcome: open an issue on GitHub.

## Compare two PDFs

For the moment someone says "I made the changes you asked for" and you want to see exactly what changed. It works whether the new PDF came from Word again or from a PDF editor.

1. Open the old PDF and click **Compare**.
2. Click **Choose the newer version** and pick the new PDF.
3. The two files appear side by side and scroll together. Loeito matches pages by their content, so an added page doesn't mark everything after it as changed.
4. Colors show the changes: **green** added, **red** removed, **amber** changed or moved.
5. The **Changes** list shows each one, for example *Page 4: "30 days" became "45 days"*. Click one to jump to it.
6. Use the switches to show **Text**, **Pictures and layout**, or both, and to ignore things that don't matter: spacing, line breaks, font, or capital letters.
7. Mark each change **OK** or **Query**. Click **Save report** for a PDF that lists the changes, ready to send back.

**How it finds changes**

| Kind of file | Method |
|---|---|
| Both have real text | Compares the words, even if the text flows differently after re-export from Word |
| Pictures, drawings, stamps, signatures | Compares how the pages look |
| One or both are scans | Reads them with OCR first, then compares; slower, and each OCR mistake can appear as a false change |

**Things to know:** a change can be hidden in form values, comments or document details, so those are compared too. Compare shows what differs; it can't prove who made a change. All of it happens on your computer.

## Preferences

Click the **gear icon** or press **Ctrl ,**. Each change applies at once.

| Section | Examples of defaults |
|---|---|
| General | Start screen, reopen last work, language |
| Appearance | Theme, reader zoom, thumbnail size |
| Saving | Safety copy on or off, autosave interval, default folder |
| Tools | Default OCR engine and language, paper size, stamp position, signature |
| Measure | Units, decimals, angle format and direction |
| Writing | Direction, fonts, digits |
| Compare | What to ignore, colors |

Each section has **Reset**. **Export** and **Import** copy your settings to another computer.

## Measure

Works on any PDF page or picture in a PDF.

**Calibrate**

1. Open the page and click **Measure → Calibrate**.
2. Click both ends of something whose size you know, such as a scale bar or a dimension line.
3. Type its real length and choose the unit (mm, cm, m, km, in, ft, yd, or your own).
4. Click **Apply to**: this page, these pages, or the whole document. Each page can keep its own scale; a badge shows the one in use.

You can instead type a drawing scale such as 1:100. Uncalibrated measurements are labeled as page sizes.

**Measure**

| Tool | Result |
|---|---|
| **Length** | One line or a path of several segments, with each segment and the total |
| **Area** | Polygon: area and perimeter; also rectangle and circle |
| **Angle** | Three clicks: the corner and two arms |

**Angle choices:** clockwise or counterclockwise (with the reflex angle on request), shown as degrees-minutes-seconds, decimal degrees or radians. A click on the value switches format.

**Fine adjustment**

1. Click a point of a finished measurement. A magnifier appears, with a **knob** beside it.
2. Choose the knob's job: move along **X**, along **Y**, or **rotate** the arm around its corner.
3. Drag the knob or turn the mouse wheel for tiny moves; hold **Shift** for even finer ones. Arrow keys also nudge the point.
4. Set the angle or length by typing an exact value, if you want to.

Points can snap to line ends, corners and intersections. Turn snapping off with **Alt**.

**Results:** measurements stay on the page as editable marks, can be saved into the PDF, and can be exported to Excel or CSV.

**Things to know:** accuracy depends on the calibration and on the drawing. A photo taken at an angle or a stretched scan can't give true sizes across the whole picture, so calibrate near what you measure.

## Order of work

1. Preferences, since the other tools use it.
2. Compare: real text, then appearance, then scans.
3. Measure: calibrate and length, then area and angle, then the knob and export.
