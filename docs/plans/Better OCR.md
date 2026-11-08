# Plan: better OCR — choose your engine

> Planned, not built yet. This page shows how it is meant to work, so you can comment before it is made. Open an issue on GitHub with ideas.

Today Loeito reads scans with **Tesseract**. It is small, fast and works everywhere, but it can struggle with photos, tables, handwriting-like print and Asian scripts. The plan adds a choice of engines, a check of whether your computer can run each one, and a way to compare results.

## The engines

| Engine | Good at | Speed and load | Download | Where |
|---|---|---|---|---|
| **Standard — Tesseract** (today) | Clean printed pages | Fast; light on the computer | Built in | Browser and desktop |
| **Accurate — PaddleOCR** | Photos, tables, low-quality scans, Chinese and Japanese | 2–5× slower than Standard; keeps the processor busy while it works | About 10–20 MB per language set, once | Browser and desktop |
| **Your own model** | Whatever you choose (for example Surya, or a model trained for your documents) | Depends on the model; large models are slow without a graphics card | You install it yourself | Desktop only |

All engines run on your own computer. Nothing is uploaded.

## Your computer's score

Before you pick an engine, Loeito checks your computer and gives it a score from 0 to 100. Each engine shows the minimum score it needs.

| What Loeito looks at | Points |
|---|---|
| Processor cores (more cores read pages in parallel) | up to 30 |
| Memory (RAM) | up to 30 |
| Graphics card that Loeito can use (WebGPU) | up to 25 |
| Free disk space for models | up to 10 |
| Desktop app (not the browser) | 5 |

| Engine | Minimum score | Recommended |
|---|---|---|
| Standard (Tesseract) | 10 | 20 |
| Accurate (PaddleOCR) | 35 | 55 |
| Your own model (large, such as Surya) | 60 | 80, with a graphics card |

What the colors mean:

- **Green** (at or above recommended): runs well.
- **Amber** (between minimum and recommended): works, but slowly. Fine for a few pages; leave large jobs running.
- **Red** (below minimum): not offered, with the reason (for example "needs 8 GB memory, this computer has 4 GB").

The check reads only general facts about your hardware. Nothing is sent anywhere.

## How it will work, click by click

### Choose an engine

1. Open a scanned PDF and click **Searchable** (or **Tables**).
2. Under **Engine**, click the list. You see each engine with its score badge, for example *Accurate — PaddleOCR · your computer: 62 / needs 35 ✓*.
3. Click **Accurate — PaddleOCR**.
4. The first time, Loeito asks: *Download the Accurate engine for English (14 MB)?* Click **Download**. This happens once; afterward it works offline.
5. Click **Make searchable**. A progress bar shows page by page, with the time left.

### Not happy with a page? Try the other engine

1. After OCR, click **Check results**. Low-confidence words are underlined in amber.
2. On a page that looks wrong, click **Redo this page with… → Accurate**.
3. Only that page is read again.

### Compare both engines

1. In **Searchable**, tick **Compare engines**.
2. Click **Make searchable**. Each page is read twice, so it takes about twice as long.
3. Pages appear side by side: Standard on the left, Accurate on the right.
4. For each page click **Use left** or **Use right**, or click **Best of both** to let Loeito keep, word by word, the version its engine was more sure of.
5. Click **Done**.

### Add your own model (desktop app): the guided setup

You don't need to know how models work. A guide walks you through it, one small step at a time, and checks each step for you.

1. Open **Settings → OCR engines → Add my own engine**. The guide opens.
2. **Pick the model** from a list of cards. Each card says in plain words what the model is good at, its license, the download size, and your computer's score against what it needs:
   - **Surya**: best on complex layouts and many languages; large; a graphics card helps a lot.
   - **docTR**: good on business documents and receipts; medium size.
   - **EasyOCR**: simple, 80+ languages; medium size.
   - **Other model**: for anything else (advanced).
3. The guide now shows **steps for that model only**, and for your system (Windows, macOS or Linux). Every step has:
   - what to click or type, with a picture;
   - a **Copy** button for any command, so nothing needs typing;
   - a **Check** button: Loeito tests that the step worked and shows ✓, or says in plain words what went wrong and how to fix it.

   For example, for Surya on Windows:
   1. *Install Python.* Click **Open Python download page**, click the yellow **Download** button, run the file, tick **Add to PATH**, click **Install**. Then click **Check** in Loeito.
   2. *Install Surya.* Click **Copy**, open the Start menu, type `PowerShell`, press Enter, right-click to paste, press Enter. Wait until it finishes (a few minutes). Click **Check**.
   3. *Download the model files.* Click **Download models** in Loeito (about 1–2 GB, once). Click **Check**.
4. **Test page:** Loeito reads a sample page with the new engine and shows the text and how long it took, next to Standard for comparison.
5. Click **Finish**. The engine appears in the **Engine** list with its score badge.

For every model, the guide's steps cover three things: **where to download** (the exact page and button), **which files** to get (and which to skip), and **how to connect them to Loeito**. That is the only part that differs between models.

**After setup, Loeito does all the talking to the model.** You never open the model's own program, type commands or handle its output. Working with scans and pictures stays exactly the same whatever engine you choose: open the file, click **Searchable** (or **Tables**), click **Make searchable**. The only difference is the name in the **Engine** list.

Any time later, **Settings → OCR engines** shows each engine with **Test**, **Repair** (runs the checks again and fixes what it can) and **Remove**.

**Other model** (advanced): pick the program, choose its output kind (hOCR, ALTO, or JSON with word boxes), then **Test** and **Finish**.

## Things to know

- **Speed:** Accurate is slower; a 100-page scan can take several minutes on an ordinary laptop. Compare doubles the time.
- **Heat and battery:** the processor works hard while reading; laptops may get warm and use more battery. Plug in for big jobs.
- **Memory:** Accurate needs about 1–2 GB of free memory; large own models can need 8 GB or more.
- **Licenses:** Tesseract and PaddleOCR are free for any use (Apache 2.0). Some other models limit commercial use; when you add your own model, its license is yours to follow.
- **Best of both** is not magic: it picks the more confident word, which is usually, not always, the right one. Check important documents.

## Order of work

1. Engine choice with Accurate (PaddleOCR), and the computer score.
2. Redo a single page with another engine.
3. Compare engines side by side.
4. Best of both.
5. Your own model with the guided setup (desktop).
