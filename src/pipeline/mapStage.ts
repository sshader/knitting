import type Anthropic from "@anthropic-ai/sdk";
import { locateSections } from "../extract/anchors";
import { DocMap } from "../extract/docMap";
import { regionIds } from "../extract/triage";
import { structured, type Call } from "./llm";
import { buildMapInput, loadPages } from "./mapInput";
import type { PatternSource } from "./source";

/** Stage 1: one call that maps the pattern: page roles, sizes and options, sections with start anchors, and charts. */

const SYSTEM = `You map the structure of knitting patterns for a row-by-row knitting tracker. You are given every page of a pattern (as text with headings marked, or text plus page images), with regions a layout detector found and images of them. Produce a map; a later step extracts the actual row instructions section by section using your map, so page ranges and chart assignments must be right.

Pages
- Give every page its roles. A page can have several.
  cover: title page. photos: mostly photographs of the finished piece. about: designer bio, story, copyright, shop info.
  overview: sizes, measurements, materials, needles, gauge, notions. schematic: measurement diagram.
  glossary: abbreviations. techniques: explanations of how to do a stitch or method (reference, not steps to follow).
  instructions: steps the knitter follows. chart: a knitting chart. other: anything else.
- summary: one short line saying what's on the page.

Sizes and options
- sizes: size names in the order values are listed ("S (M) L (XL)" -> ["S","M","L","XL"]). If sizes are only numbers or letters, use them as printed.
- sizeNotation: copy how size-dependent values are written, so a later step can parse them.
- options: choices other than size that change the instructions (style variants, length variants, with/without a feature). [] if none.

Sections
- The top-level parts the knitter works, in knitting order (e.g. Neckband, Yoke, Body, Sleeves, Finishing). Prefer the pattern's own headings. Not too fine: a section is roughly a heading-level part, not a single row.
- startPage and startQuote: where the section's text begins, as the page and its first 3-8 words copied exactly from the text (usually the heading). The section is taken to run until the next section's start, so get these exact; omit color markup like [A:...] from quotes.
- pages: every page holding that section's instructions, including continuation pages. Don't include chart pages here; reference charts by id instead.
- choices: option choices the section applies to, [] if always worked. repeat: e.g. "make 2" or "work second sleeve the same", "" otherwise.

Charts
- One entry per distinct chart. If a chart exists in several size versions, one entry per version with its size indices. A chart split across pages is one entry with several regionIds.
- regionIds: ids of detected regions where the chart is drawn. If a chart isn't among the detected chart regions (e.g. it's an image, id p5.i1), use the image id. If it isn't detected at all, use "p<page>" and add a reviewNote.
- legendRegionIds: the key/legend if it's a separate detected region (often an image); [] otherwise.
- writtenPages: pages that give the same chart rows as written-out instructions, [] if none.
- readDirection: "rtl" if every row is read right to left (in the round), "alternate" if RS rows right to left and WS left to right (flat), "unknown" if unclear.
- Images that are photos or schematics are not charts.

Techniques: each named technique explained in the pattern and the page it's on.

reviewNotes: anything ambiguous or that you aren't sure about. Be specific.`;

const TASK = "Map this pattern.";

export interface MapResult {
  call: Call<DocMap>;
  /** What code found wrong with the map (empty if it looks right). */
  problems: string[];
}

export async function runMap(source: PatternSource, client: Anthropic): Promise<MapResult> {
  const content = [...(await buildMapInput(source)), { type: "text" as const, text: TASK }];
  const call = await structured(client, DocMap, { system: SYSTEM, content, effort: "medium", maxTokens: 64000 });
  return { call, problems: call.parsed ? await checkMap(call.parsed, source) : [] };
}

/** Problems with a map that code can find: unknown pages, charts, regions, choices, and start quotes that aren't on their page. */
export async function checkMap(map: DocMap, source: PatternSource): Promise<string[]> {
  const problems: string[] = [];
  const pageNums = new Set(source.pages.map((p) => p.page));
  const regions = new Set(
    source.pages.flatMap((p) => {
      const ids = regionIds({ ...p.triage, page: p.page });
      return [...ids.charts, ...ids.images].map((r) => r.id);
    }),
  );
  const mapped = new Set(map.pages.map((p) => p.page));
  for (const p of pageNums) if (!mapped.has(p)) problems.push(`page ${p} has no roles`);
  for (const s of map.sections) for (const p of s.pages) if (!pageNums.has(p)) problems.push(`section ${s.id}: no page ${p}`);
  const chartIds = new Set(map.charts.map((c) => c.id));
  for (const s of map.sections) for (const c of s.chartIds) if (!chartIds.has(c)) problems.push(`section ${s.id}: unknown chart ${c}`);
  for (const c of map.charts) {
    for (const r of [...c.regionIds, ...c.legendRegionIds]) if (!regions.has(r) && !/^p\d+$/.test(r)) problems.push(`chart ${c.id}: unknown region ${r}`);
    for (const i of c.sizes) if (i < 0 || i >= map.sizes.length) problems.push(`chart ${c.id}: size index ${i} out of range`);
  }
  const page = await loadPages(source, map.sections.map((s) => s.startPage));
  locateSections(map.sections, page).forEach((pos, i) => {
    const s = map.sections[i];
    if (!pos) problems.push(`section ${s.id}: start quote not found on p${s.startPage} (after the previous section): "${s.startQuote}"`);
  });
  for (const s of map.sections)
    for (const ch of s.choices) if (!map.options.some((o) => o.choices.includes(ch))) problems.push(`section ${s.id}: unknown choice ${ch}`);
  return problems;
}
