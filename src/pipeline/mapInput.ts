import type Anthropic from "@anthropic-ai/sdk";
import type { DocMap } from "../extract/docMap";
import type { PageData } from "../extract/pageData";
import { pageMarkdown } from "../extract/pageText";
import { regionIds } from "../extract/triage";
import { pngBlock } from "./llm";
import type { CropRequest, PageEntry, PatternSource } from "./source";

/**
 * The pattern as the model reads it in stages 1-3: every page's text in
 * reading order (headings marked, drawn charts as placeholders), the regions
 * triage detected with ids it can cite ("p7.c1", "p3.i2"), thumbnails of
 * content images, and crops of images on pages not sent whole.
 */

const THUMB_PX = 400;
const fmt = (b: number[]) => `[${b.map((x) => x.toFixed(2)).join(", ")}]`;

/** A page's text for the model: drawn charts become placeholders; written colorwork stays as (color-marked) text. */
export function llmPageText(data: PageData, entry: PageEntry): string {
  const ids = regionIds({ ...entry.triage, page: entry.page });
  return pageMarkdown(
    data,
    ids.charts.filter((c) => c.region.form !== "writtenColor").map((c) => ({ id: c.id, bbox: c.region.bbox })),
  );
}

export async function buildMapInput(source: PatternSource): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const { docs, pages } = source;
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    {
      type: "text",
      text:
        `Pattern "${source.name}": ${docs.map((d) => `${d.source} (pages ${d.firstPage}-${d.firstPage + d.pageCount - 1})`).join(", ")}.\n` +
        `Page numbers below are global across documents. Region ids like p7.c1 (chart) and p3.i1 (image) refer to detected regions; boxes are [x0, y0, x1, y1] as fractions of the page.`,
    },
  ];

  // Pages sent whole get thumbnails of their images; pages that aren't get full crops instead.
  const withIds = pages.map((p) => ({ p, ids: regionIds({ ...p.triage, page: p.page }) }));
  const requests: (CropRequest & { id: string })[] = withIds.flatMap(({ p, ids }) =>
    ids.images.map((im) => ({ id: im.id, page: p.page, bbox: im.bbox, ...(p.triage.sendToLlm ? { maxPx: THUMB_PX } : {}) })),
  );
  const rendered = await source.crops(requests);
  const crop = new Map(requests.map((r, i) => [r.id, rendered[i]]));

  for (const { p, ids } of withIds) {
    const doc = docs.find((d) => d.doc === p.doc)!;
    const detected = [
      ...ids.charts.map((c) => `${c.id}: ${c.region.form} chart at ${fmt(c.region.bbox)} (${c.region.evidence})`),
      ...ids.images.map((im) => `${im.id}: image at ${fmt(im.bbox)}, ${Math.round(im.coverage * 100)}% of page`),
    ];
    const header = `=== Page ${p.page} (${doc.source} p${p.docPage}) ===\nDetected: ${detected.length ? "\n  " + detected.join("\n  ") : "nothing"}`;

    if (p.triage.sendToLlm) {
      const text = await source.markdown(p.page);
      content.push({ type: "text", text: `${header}\nText:\n${text || "(none)"}` });
      for (const im of ids.images) content.push({ type: "text", text: `Thumbnail ${im.id}:` }, pngBlock(crop.get(im.id)!));
    } else if (ids.images.length) {
      content.push({ type: "text", text: `${header}\nNot shown whole (${p.triage.reason}); crops of its images follow.` });
      for (const im of ids.images) content.push({ type: "text", text: `Crop ${im.id}:` }, pngBlock(crop.get(im.id)!));
    } else {
      content.push({ type: "text", text: `${header}\nNot shown (${p.triage.reason}).` });
    }
  }
  return content;
}

/** The map as context for later stages; its per-page roles add nothing there. */
export function mapContext(map: DocMap): Anthropic.Beta.BetaTextBlockParam {
  const { pages: _pages, ...rest } = map;
  return { type: "text", text: `=== Reviewed map ===\n${JSON.stringify(rest, null, 1)}` };
}

/** Page data for some pages, loaded up front, for code that looks pages up synchronously. */
export async function loadPages(source: PatternSource, pages: number[]): Promise<(n: number) => PageData | undefined> {
  const known = new Set(source.pages.map((p) => p.page));
  const wanted = [...new Set(pages)].filter((n) => known.has(n));
  const loaded = new Map(await Promise.all(wanted.map(async (n) => [n, await source.pageData(n)] as const)));
  return (n) => loaded.get(n);
}
