import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { docsFor, PDF_DIR, readPage, triageDoc } from "../extract/patterns";
import { runPython } from "../extract/python";
import { llmPageText } from "./mapInput";
import type { ChartGrid, CropRequest, PageEntry, PatternSource } from "./source";

/**
 * A pattern on this machine: pages preprocessed into data/raw by
 * extract_pdf.py, triage computed in code, and crops and chart grids rendered
 * by the Python scripts from the PDFs in PDF_DIR.
 */
export function localSource(pattern: string): PatternSource {
  const docs = docsFor(pattern);
  const pages: PageEntry[] = docs.flatMap((d) => triageDoc(d.doc).map((triage) => ({ page: d.firstPage + triage.page - 1, doc: d.doc, docPage: triage.page, triage })));
  const entry = (page: number) => {
    const p = pages.find((x) => x.page === page);
    if (!p) throw new Error(`${pattern} has no page ${page}`);
    return p;
  };
  const pdfOf = (doc: string) => path.join(PDF_DIR, docs.find((d) => d.doc === doc)!.source);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `knitting-${pattern}-`));

  return {
    name: pattern,
    docs,
    pages,
    pageData: async (page) => readPage(entry(page).doc, entry(page).docPage),
    markdown: async (page) => llmPageText(readPage(entry(page).doc, entry(page).docPage), entry(page)),

    async crops(requests: CropRequest[]) {
      // One render_crops.py run per document.
      const out = requests.map((_, i) => path.join(work, `crop-${i}.png`));
      for (const d of docs) {
        const mine = requests.map((r, i) => ({ r, i })).filter(({ r }) => entry(r.page).doc === d.doc);
        if (!mine.length) continue;
        const spec = path.join(work, `${d.doc}-crops.json`);
        fs.writeFileSync(spec, JSON.stringify(mine.map(({ r, i }) => ({ page: entry(r.page).docPage, bbox: r.bbox, out: out[i], maxPx: r.maxPx }))));
        runPython("render_crops.py", [pdfOf(d.doc), spec]);
      }
      return out.map((f) => new Uint8Array(fs.readFileSync(f)));
    },

    async chartGrid(page: number, bbox: number[]): Promise<ChartGrid> {
      const { doc, docPage } = entry(page);
      const dir = fs.mkdtempSync(path.join(work, "chart-"));
      const crop = path.join(dir, "chart.png");
      fs.writeFileSync(path.join(dir, "crop.json"), JSON.stringify([{ page: docPage, bbox, out: crop, maxPx: 1600 }]));
      runPython("render_crops.py", [pdfOf(doc), path.join(dir, "crop.json")]);
      runPython("raster_grid.py", [pdfOf(doc), String(docPage), bbox.join(","), dir]);
      const grid = JSON.parse(fs.readFileSync(path.join(dir, "grid.json"), "utf8"));
      // render_crops.py pads the crop by 0.01 of the page on each side.
      const cropBox = [Math.max(0, bbox[0] - 0.01), Math.max(0, bbox[1] - 0.01), Math.min(1, bbox[2] + 0.01), Math.min(1, bbox[3] + 0.01)];
      return {
        cols: grid.cols,
        rows: grid.rows,
        gridBox: grid.gridBox,
        cells: grid.cells,
        classes: grid.classes.map((k: ChartGrid["classes"][number] & { sample: string }) => ({ ...k, sample: new Uint8Array(fs.readFileSync(k.sample)) })),
        image: { png: new Uint8Array(fs.readFileSync(crop)), cropBox },
      };
    },
  };
}
