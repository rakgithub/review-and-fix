# Review & Fix

A guided review-and-fix step for customer imports. It takes a non-technical user from a messy 200,000-row CSV to a file they trust, without reading it row by row.

It runs entirely in the browser (React + TypeScript, no backend): the file is never uploaded.

## Quick start

Requires **Node 22.12+**. The project uses **pnpm**, but npm works too.

```bash
pnpm install
pnpm data        # writes import-data.csv (200,000 rows, seed 42)
pnpm dev         # http://localhost:5173
```

No pnpm? Use npm instead:

```bash
npm install
npm run data
npm run dev
```

npm may install slightly newer package versions than pnpm, because the lockfile (`pnpm-lock.yaml`) is for pnpm. To get the exact same versions without installing pnpm, run `npx pnpm install` instead of `npm install`.

Open the app, then drop `import-data.csv` onto the page or click to choose it.

## What it does

| Step | What the user gets |
| --- | --- |
| **Open the file** | The file is read in chunks with a progress bar, so the page never freezes. A wrong file type, an empty file, missing columns or a broken quote get a plain-language message saying what to do. |
| **See the overview** | A headline ("X of Y rows are ready") and every problem type with its row count, largest first. **All rows** is listed first and selected when the file opens. |
| **Browse and search** | A virtualized grid scrolls smoothly through every row. Pick a problem type to show only those rows with the column highlighted, or search any value. |
| **Understand a problem** | Clicking a cell opens a side panel: what's wrong, why it matters, what a good value looks like, and a one-click suggestion when the right value is certain. **Next problem** steps to the next one. |
| **Fix one value** | Double-click a cell, or press Enter or F2 on a selected cell, to edit it in the table; Esc cancels. The value is checked on save, duplicates included, and the counts update straight away. |
| **Fix all countries** | Writes country names as 2-letter codes (Germany → DE). A preview lists every change and what is left unchanged. The fix can be undone, keeping any edits made since. |

Readable dates (`3 Apr 2024`, `25/04/2024`, `03/04/2024`) are rewritten as `YYYY-MM-DD` when the file opens rather than flagged, so they never appear as problems. Dates that could mean two days (`03/04/2024`) are read in the file's own date style: the style its unambiguous dates prove (`25/04/2024` is day first, `04/25/2024` is month first). If the file proves neither, day first is assumed. Missing, unreadable and impossible dates stay flagged.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | ESLint |
| `pnpm format` / `pnpm format:check` | Format with Prettier, or check formatting |
| `pnpm build` / `pnpm preview` | Production build and local preview |
| `pnpm data` | Generate the test file |

## Test data

`scripts/generate-data.mjs` is the provided generator, unchanged. It is deterministic, so everyone gets the same file:

```bash
node scripts/generate-data.mjs [rows=200000] [seed=42]
```

`pnpm data` runs it with the defaults and writes `import-data.csv` to the project root (git-ignored). The file was treated as a black box: the rules in the brief are the specification, and the generator's `--report` answer key was not used.

## Project structure

```
src/
  rules/        Checks per column, the plain-language problem catalogue, fix suggestions
  core/         Loading, the data model, filtering, editing, bulk fix and undo
  components/   React UI: Upload, Overview, Grid, ProblemPanel, Banners, Toolbar, dialogs
  useBulkFix.ts Bulk fix preview, apply and undo state
  App.tsx       App state and layout
docs/           Design document, PRD and notes
```

`rules/` and `core/` are plain TypeScript with no React, so all business logic is unit-tested. Two dependencies do the heavy lifting: `papaparse` for CSV parsing and `@tanstack/react-virtual` for the grid.


## Docs

| File | What's in it |
| --- | --- |
| [`docs/design-document.pdf`](docs/design-document.pdf) | Architecture, the ADR, UX and performance decisions, the AI note and trade-offs |
