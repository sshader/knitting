import type Anthropic from "@anthropic-ai/sdk";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PageData } from "./pageData";
import { pageMarkdown } from "./pageText";
import { docsFor, PDF_DIR, RAW, type DocInfo } from "./patterns";
import { regionIds, type PageTriage } from "./triage";

/**
 * Builds the stage 1 request content for a pattern. Pages are numbered
 * globally across the pattern's documents, and detected regions get ids the
 * model can cite.
 *
 * Modes:
 * - "pages": each page triage sends as raw text layer + full page image.
 * - "text": each page as markdown-ish text (headings from font size/bold,
 *   chart glyphs replaced by placeholders) + small thumbnails of its content
 *   images only.
 * Either way, pages triage skips contribute crops of their images.
 */
export type MapInputMode = "pages" | "text";

const THUMB_PX = 400;

export interface PageRef {
  page: number;
  doc: string;
  docPage: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (b: number[]) => `[${b.map((x) => x.toFixed(2)).join(", ")}]`;
const png = (file: string): Anthropic.ImageBlockParam => ({
  type: "image",
  source: { type: "base64", media_type: "image/png", data: fs.readFileSync(file).toString("base64") },
});

export function buildMapInput(pattern: string, cropDir: string, mode: MapInputMode) {
  const docs = docsFor(pattern);
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text:
        `Pattern "${pattern}": ${docs.map((d) => `${d.source} (pages ${d.firstPage}-${d.firstPage + d.pageCount - 1})`).join(", ")}.\n` +
        `Page numbers below are global across documents. Region ids like p7.c1 (chart) and p3.i1 (image) refer to detected regions; boxes are [x0, y0, x1, y1] as fractions of the page.`,
    },
  ];
  const pages: PageRef[] = [];

  for (const d of docs) {
    const triage: PageTriage[] = JSON.parse(fs.readFileSync(path.join("data/triage", `${d.doc}.json`), "utf8"));
    const global = triage.map((t) => ({ t, page: d.firstPage + t.page - 1, ids: regionIds({ ...t, page: d.firstPage + t.page - 1 }) }));
    const crops = global.flatMap(({ t, ids }) =>
      !t.sendToLlm
        ? ids.images.map((im) => ({ page: t.page, bbox: im.bbox, out: path.join(cropDir, `${im.id}.png`) }))
        : mode === "text"
          ? ids.images.map((im) => ({ page: t.page, bbox: im.bbox, out: path.join(cropDir, `${im.id}.thumb.png`), maxPx: THUMB_PX }))
          : [],
    );
    renderCrops(d, crops);

    for (const { t, page, ids } of global) {
      pages.push({ page, doc: d.doc, docPage: t.page });
      const detected = [
        ...ids.charts.map((c) => `${c.id}: ${c.region.form} chart at ${fmt(c.region.bbox)} (${c.region.evidence})`),
        ...ids.images.map((im) => `${im.id}: image at ${fmt(im.bbox)}, ${Math.round(im.coverage * 100)}% of page`),
      ];
      const header = `=== Page ${page} (${d.source} p${t.page}) ===\nDetected: ${detected.length ? "\n  " + detected.join("\n  ") : "nothing"}`;

      if (t.sendToLlm && mode === "pages") {
        const text = fs.readFileSync(path.join(RAW, d.doc, "pages", `p${pad(t.page)}.txt`), "utf8").trim();
        content.push({ type: "text", text: `${header}\nText layer:\n${text || "(none)"}` });
        content.push(png(path.join(RAW, d.doc, "pages", `p${pad(t.page)}.png`)));
      } else if (t.sendToLlm) {
        const data: PageData = JSON.parse(fs.readFileSync(path.join(RAW, d.doc, "pages", `p${pad(t.page)}.json`), "utf8"));
        // Drawn charts become placeholders; written colorwork stays as (color-marked) text.
        const text = pageMarkdown(
          data,
          ids.charts.filter((c) => c.region.form !== "writtenColor").map((c) => ({ id: c.id, bbox: c.region.bbox })),
        );
        content.push({ type: "text", text: `${header}\nText:\n${text || "(none)"}` });
        for (const im of ids.images) content.push({ type: "text", text: `Thumbnail ${im.id}:` }, png(path.join(cropDir, `${im.id}.thumb.png`)));
      } else if (ids.images.length) {
        content.push({ type: "text", text: `${header}\nNot shown whole (${t.reason}); crops of its images follow.` });
        for (const im of ids.images) content.push({ type: "text", text: `Crop ${im.id}:` }, png(path.join(cropDir, `${im.id}.png`)));
      } else {
        content.push({ type: "text", text: `${header}\nNot shown (${t.reason}).` });
      }
    }
  }
  return { content, pages };
}

function renderCrops(d: DocInfo, crops: { page: number; bbox: number[]; out: string; maxPx?: number }[]) {
  if (crops.length === 0) return;
  fs.mkdirSync(path.dirname(crops[0].out), { recursive: true });
  const req = path.join(path.dirname(crops[0].out), `${d.doc}-crops.json`);
  fs.writeFileSync(req, JSON.stringify(crops));
  const r = spawnSync(".venv/bin/python", ["-I", "scripts/render_crops.py", path.join(PDF_DIR, d.source), req], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`render_crops failed: ${r.stderr}`);
}
