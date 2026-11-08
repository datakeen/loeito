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

### Add your own model (desktop app)

1. Install the model's program as its authors describe (for example Surya needs Python).
2. In Loeito, open **Settings → OCR engines → Add my own engine**.
3. Click **Browse** and pick the program (for example `surya_ocr`).
4. Pick the output kind it gives (Loeito offers the common ones: hOCR, ALTO, or JSON with word boxes).
5. Click **Test**. Loeito reads a sample page and shows the result and the time it took.
6. Click **Save**. The engine now appears in the **Engine** list.

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
5. Your own model (desktop).
