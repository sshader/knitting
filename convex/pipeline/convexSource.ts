"use node";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { PageData } from "../../src/extract/pageData";
import { llmPageText } from "../../src/pipeline/mapInput";
import type { ChartGrid, CropRequest, PageEntry, PatternSource } from "../../src/pipeline/source";
import { callPdfService, text } from "./pdfService";

/**
 * A pattern as the pipeline stages read it, from Convex: pages and their
 * stored text, crops from the cache (rendering missing ones with the PDF
 * service), and chart grids from the PDF service.
 */
export async function convexSource(ctx: ActionCtx, patternId: Id<"patterns">): Promise<PatternSource> {
  const pattern = await ctx.runQuery(internal.pipeline.state.pattern, { patternId });
  const rows = await ctx.runQuery(internal.pipeline.state.pages, { patternId });
  const pages: PageEntry[] = rows.map((r) => ({ page: r.page, doc: r.doc, docPage: r.docPage, triage: r.triage }));
  const row = (page: number) => {
    const r = rows.find((x) => x.page === page);
    if (!r) throw new Error(`no page ${page}`);
    return r;
  };
  const pdfUrl = async (doc: string) => {
    const pdf = pattern.docs.find((d) => d.doc === doc)?.pdf;
    if (!pdf) throw new Error(`No PDF stored for ${doc}: upload it (scripts/upload-pdfs.ts) to re-run in the app`);
    return (await ctx.storage.getUrl(pdf))!;
  };
  const bytesOf = async (file: Id<"_storage">) => new Uint8Array(await (await ctx.storage.get(file))!.arrayBuffer());
  const store = (bytes: Uint8Array, type: string) => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type }));

  const loaded = new Map<number, Promise<PageData>>();
  const pageData = (page: number) => {
    if (!loaded.has(page)) loaded.set(page, bytesOf(row(page).json).then((b) => JSON.parse(text(b))));
    return loaded.get(page)!;
  };

  return {
    name: pattern.title ?? pattern.slug,
    docs: pattern.docs,
    pages,
    pageData,
    markdown: async (page) => row(page).markdown ?? llmPageText(await pageData(page), pages.find((p) => p.page === page)!),

    async crops(requests: CropRequest[]) {
      const keys = requests.map((r) => `${r.page}:${r.bbox.join(",")}:${r.maxPx ?? "full"}`);
      const files = await Promise.all(keys.map((key) => ctx.runQuery(internal.pipeline.state.crop, { patternId, key })));
      // Render what isn't cached yet: one service call per document.
      for (const d of pattern.docs) {
        const missing = requests.map((r, i) => ({ r, i })).filter(({ r, i }) => !files[i] && row(r.page).doc === d.doc);
        if (!missing.length) continue;
        const rendered = await callPdfService("crops", {
          pdf_url: await pdfUrl(d.doc),
          requests: missing.map(({ r }) => ({ page: row(r.page).docPage, bbox: r.bbox, maxPx: r.maxPx })),
        });
        for (const [j, { i }] of missing.entries()) {
          files[i] = await store(rendered[`crop-${j}.png`], "image/png");
          await ctx.runMutation(internal.pipeline.state.saveCrop, { patternId, key: keys[i], file: files[i]! });
        }
      }
      return await Promise.all(files.map((f) => bytesOf(f!)));
    },

    async chartGrid(page: number, bbox: number[]): Promise<ChartGrid> {
      const r = row(page);
      const files = await callPdfService("grid", { pdf_url: await pdfUrl(r.doc), page: r.docPage, bbox });
      const grid = JSON.parse(text(files["grid.json"]));
      // The service crops with 0.01 of the page around the chart.
      const cropBox = [Math.max(0, bbox[0] - 0.01), Math.max(0, bbox[1] - 0.01), Math.min(1, bbox[2] + 0.01), Math.min(1, bbox[3] + 0.01)];
      return {
        cols: grid.cols,
        rows: grid.rows,
        gridBox: grid.gridBox,
        cells: grid.cells,
        classes: grid.classes.map((k: ChartGrid["classes"][number] & { sample: string }) => ({ ...k, sample: files[k.sample] })),
        image: { png: files["chart.png"], cropBox },
      };
    },
  };
}
