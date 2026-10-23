# Knitting

Turns knitting pattern PDFs into row-by-row steps. A local pipeline extracts
each pattern in stages; results live in [Convex](https://convex.dev), where the
inspector (a Vite + React app) reads them live and records reviews.

## Setup

- `npm install`, and a Python venv at `.venv` with PyMuPDF (for `scripts/*.py`).
- `npx convex dev` keeps the backend deployed while you work (it writes `VITE_CONVEX_URL` to `.env.local`).
- `.env` holds `ANTHROPIC_API_KEY` and the login the scripts use, `KNITTING_EMAIL` / `KNITTING_PASSWORD`. Create that account on the inspector's sign-in page (or it already exists).
- `npm run dev` starts the app at http://localhost:5173. It opens in knit mode (your projects); the ⚙ menu switches to pattern extraction mode, the pipeline inspector.

## Pipeline

Each stage reads the previous one's output from Convex and saves its own there.

| Stage | Command | Saves |
| --- | --- | --- |
| Preprocess | `.venv/bin/python -I scripts/extract_pdf.py <pdf> data/raw/<doc>` | local page files |
| 0 · Triage | `npx tsx scripts/triage.ts [pattern...]` | patterns, pages (+ uploads page files) |
| 1 · Map | `npx tsx scripts/map.ts <pattern...>` | maps |
| 2 · Sections | `npx tsx scripts/sections.ts <pattern> [sectionId...]` | sections |
| 3 · Charts | `npx tsx scripts/charts.ts <pattern> [chartId...]` | charts (+ chart images) |
| Glossary | `npx tsx scripts/glossary.ts <pattern...>` | glossaries (abbreviations, techniques) |

Preprocessing and chart grids run Python locally; everything else is TypeScript.

## Tests

`npm test`. Tests that need real patterns skip unless the local data is there:
`data/raw` from preprocessing, and `data/snapshot` plus reviewed `fixtures/`
from `npx tsx scripts/export.ts`, which pulls them from Convex.

## Layout

- `convex/`: schema and functions. Stored shapes are the zod schemas from `src/`, converted in `convex/validators.ts`.
- `src/extract/`: pipeline code (Node), plus pure helpers the inspector shares.
- `src/shared/`: the pattern schema, chart row generation, and the step expander.
- `src/web/`: the inspector, one component per file under `inspector/<stage>/`.
- `scripts/`: stage entry points; `convex.ts` signs them in, `llm.ts` wraps the model call.
