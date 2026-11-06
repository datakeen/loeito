# The Loeito Rulebook

_Version 1 of this rulebook · adopted with Loeito 1.1.0 · 2026-10-27._
_Read this before every improvement and follow it. When a rule and a request disagree, raise it in `private/PLAN.md` instead of quietly breaking the rule._

---

## 1 · The promise

Loeito is a PDF workbench for people who are not PDF experts: officers, students, researchers, engineers. It must feel calm, obvious and trustworthy, and it must still be able to do the hard things.

> **Every PDF task. Just enough, nothing more.**

Three ideas carry that promise.

| Idea | What it means for Loeito |
|---|---|
| **Just right** — not too little, not too much | Each screen shows what the task needs and nothing more. Advanced options exist, but they wait one click away. |
| **Swedish craftsmanship** | Finished, complete and durable. Edges are smooth: empty states, errors, undo, dark mode, keyboard, long files, scans. Honest materials: we never pretend something was done when it wasn’t. |
| **Swiss army knife** | One compact tool with many blades. Each blade does one family of jobs well, folds away when not used, and works with the others (tabs, undo, save, export). It adapts to the user instead of the reverse. |

The look and feel aims at the standard of Apple’s own apps: clarity, deference to the content, depth through subtle layering, premium yet simple.

## 2 · Design principles

1. **The document is the hero.** Chrome is light, quiet and grey. Colour is reserved for meaning (the active tool, a primary action, a warning).
2. **One obvious next step.** Every panel starts with what it is for, then the main action, then options. Rare options are under “More” or an advanced disclosure.
3. **Plain words.** “Make Searchable”, not “Run OCR”. “Save to original”, not “Overwrite”. Name things by what they do for the user. Units are always shown (mm, pt, %, MB).
4. **Safe defaults; Enter does the common, safe thing.** Destructive choices are never the default button. Escape always cancels.
5. **Everything can be undone,** per tab. If something truly can’t be undone (writing over a file), say so in one short sentence and keep a safety copy.
6. **Show, don’t describe.** Live previews on the page (stamps, crops, fields, covers) rather than settings you have to imagine.
7. **Never lose work.** Opening a file never replaces the current one. Background jobs keep running in a hidden window. Leaving with unsaved changes asks first.
8. **Private by design.** Files never leave the computer. The local server listens on 127.0.0.1 only and answers only Loeito’s own page.
9. **Respect expertise.** Shortcuts, precise numbers, custom scripts and export formats are there for experts, without getting in a beginner’s way.
10. **Honest limits.** When a result may be imperfect (OCR, detection), say so and make review easy (one click removes a wrong suggestion).

## 3 · Visual and interaction rules

| Area | Rule |
|---|---|
| Type | Inter (system fallback). Sizes: 11 tiny · 12 secondary · 13 body · 15 titles · 22+ hero. Weights 400/500/600/700 only. |
| Spacing | 4-pt base grid; panels use 12/14/16/24 px rhythm. |
| Shape | Radii `--r-sm` 6 (controls) · `--r` 10 (cards) · `--r-lg` 14 (sheets). Hairline borders `var(--sep)`; soft shadows only for floating things. |
| Colour | Use the tokens in `css/loeito.css` (`--accent`, `--accent-soft`, `--ok`, `--warn`, `--danger`, `--text`, `--text-2`, `--text-3`, `--sep`, `--bg`, `--surface`, `--surface-2`, `--glass`). Every new colour must also work in dark mode. |
| Icons | 24-unit grid, 1.6 stroke, round caps and joins, drawn in the `L.icon` set. No emoji in the UI. |
| Motion | 120–220 ms, ease-out; nothing bounces; nothing moves without a reason. |
| Feedback | Every action answers: a toast (≤ 1 line), a progress HUD with Cancel for anything longer than ~1 s, a live preview where possible. |
| Errors | Say what happened and what to do next, in one sentence. Never show a stack trace or a raw code. |
| Keyboard | Every frequent action has a shortcut, shown in its tooltip. Focus is always visible. Esc closes, Enter confirms the default. |
| Pointer | Cursor tells the truth: arrow (select), I-beam (text), open hand / closed hand (pan), crosshair (draw), move (drag). |
| Sheets | Title (what), one-line explanation (why), content, then buttons right-aligned: secondary · **primary**. |
| Accessibility | Contrast ≥ 4.5:1 for text; controls ≥ 28 px tall; labels on every input; tooltips on icon-only buttons. |
| Performance | UI response < 100 ms; heavy work in steps with progress; large files stay usable. |

## 4 · Engineering rules

- **Structure.** Classic scripts sharing `window.Loeito` (`L`). Core → render → viewer → docs → reader → engines → blades → app. A blade registers itself with `L.registerBlade({...})` and owns its inspector, overlay drawing and pointer handling.
- **State.** Everything the user changes lives in the tab’s `state` and goes through `L.mutate` / `L.checkpoint`, so undo works. Engines are pure functions where possible.
- **Libraries.** Only well-known libraries, pinned versions, loaded from cdnjs/jsDelivr; heavy ones lazily (`L.loadScript`). No build step.
- **Server.** Python standard library only. Every API endpoint checks the `X-Loeito` header, the Host and the Origin. Writes never overwrite without explicit intent, and they keep a safety copy.
- **Rendering off-screen** uses pdf.js `intent: 'print'` (the display path stalls in hidden windows).
- **Comments** explain *why*, briefly, in the style of the surrounding code.

## 5 · Way of working (every improvement)

1. **Record** the request in `private/PLAN.md`: the user’s words (condensed) and what they mean in practice.
2. **Find out** what the code and the test files actually show (“Findings”).
3. **Plan** each item: how it will be built and how it will be verified.
4. **Implement one item at a time**; verify it in the browser with the real files in `../Input` (and `samples/`), read outputs back with Python where possible.
5. **Tick** the item in `private/PLAN.md` with a short verification note; record known limits honestly.
6. **Release** (section 7).

## 6 · Versioning

Loeito uses **MAJOR.MINOR.PATCH** (Semantic Versioning, adapted to an app):

| Change | Bump | Example |
|---|---|---|
| Fixes, wording, polish; nothing new to learn | PATCH +0.0.1 | 1.1.0 → 1.1.1 |
| A release that adds capabilities and keeps every existing habit and file working | MINOR +0.1.0 (one step per release, however big) | 1.1.x → 1.2.0 |
| A change that breaks habits or compatibility (a redesigned workflow, a changed saved-file format, removing a feature), or the completion of a whole roadmap generation | MAJOR +1.0.0 | 1.x → 2.0.0 |

**Milestones.** Every version ending in **.0.0 or .5.0** is a milestone. A milestone is preserved forever in `versions/<version>/`:

- the complete app (code, server, tools, samples), runnable on its own;
- `README.md`, `private/PLAN.md`, `CHANGELOG.md`, `POLICY.md` as they were;
- `docs/User Manual.md` (for users), `docs/Reference Manual.md` (architecture, data model, formats, server API, shortcuts), `docs/Help.md`, `docs/About.md` and `docs/tutorials/`.

Archive procedure: finish and verify the release → update the manuals → copy everything except `versions/` into `versions/<version>/` → never edit an archive afterwards (fixes go into a new version).

Each release also:
- writes its number to `VERSION` and to `L.VERSION` in `js/core.js` (shown in Help → About);
- adds a `CHANGELOG.md` entry (Added / Changed / Fixed / Known limits), newest first;
- gets a short Swedish codename for the release notes (e.g. 1.1.0 *Hantverk*).

**User documents (kept current with every change).** Each release updates:

- `README.md`;
- `docs/Help.md`: every section says what it does and how it works, and ends with a pointer to its tutorial;
- `docs/About.md`;
- `docs/User Manual.md`;
- one short tutorial per section in `docs/tutorials/` (a new tool gets a new tutorial).

Public direction: `ROADMAP.md`. Detailed plan: `private/ROADMAP (detailed).md`. History: Phase 1 = 1.1.0; Merge workspace = 1.2.0; fluid pages & motion = 1.3.0; keyboard page moving = 1.4.0; merge from the open document = 1.5.0 (milestone, archived); Phases 2–5 = 1.6.0 … 1.9.0. The next preserved milestone after 1.5.0 is 2.0.0. 

## 6b · Licence (every release)

Loeito is **free and open-source software** under the **GNU Affero General Public License v3** (AGPL-3.0-or-later).

- `LICENSE` (the full AGPL text) and `NOTICE.md` (copyright and third-party licences) ship with every release and every archive in `versions/`.
- Every source file starts with the one-line notice `SPDX-License-Identifier: AGPL-3.0-or-later`. New files get it too.
- README and About say clearly that Loeito is free and open source.
- New third-party libraries must have an AGPL-compatible licence and be listed in `NOTICE.md`.
- `sourceforge/` is kept current, so each release can be published by copy and paste.

## 7 · Definition of done (release checklist)

- [ ] Every planned item ticked in `private/PLAN.md` with how it was verified.
- [ ] Works in light and dark mode, at small window sizes, with the keyboard.
- [ ] Undo/redo covers every new change; Save output re-opens correctly.
- [ ] No console errors on the test files; background jobs run with the window hidden.
- [ ] Plain-language review of every new label, tooltip, toast and error.
- [ ] `README.md`, Help, About, tutorials, User Manual, Reference Manual and `CHANGELOG.md` updated; `VERSION` and `L.VERSION` bumped.
- [ ] Licence: `LICENSE`, `NOTICE.md`, SPDX line in new files, `sourceforge/` texts updated.
- [ ] Milestone? Archive it in `versions/`.
