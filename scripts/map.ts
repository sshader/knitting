/**
 * Stage 1: build a document map for each pattern with Claude.
 *
 *   npx tsx scripts/map.ts [--dry] [--mode=text|pages] <pattern...>
 *
 * --dry builds the request and counts tokens without generating.
 * --mode picks the input format (see mapInput.ts); default text.
 * Writes data/map/<mode>/<pattern>.json: { map, pages, problems, usage }.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import fs from "node:fs";
import path from "node:path";
import { DocMap } from "../src/extract/docMap";
import { buildMapInput, type MapInputMode, type PageRef } from "../src/extract/mapInput";
import { regionIds, type PageTriage } from "../src/extract/triage";
import { findQuote } from "../src/extract/anchors";
import type { PageData } from "../src/extract/pageData";
import { docsFor } from "../src/extract/patterns";

try {
  process.loadEnvFile(".env");
} catch {}

const MODEL = "claude-opus-5-5";
const MAP_DIR = "data/map";

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

function check(map: DocMap, pages: PageRef[], pattern: string): string[] {
  const problems: string[] = [];
  const pageNums = new Set(pages.map((p) => p.page));
  const regions = new Set<string>();
  for (const d of docsFor(pattern)) {
    const triage: PageTriage[] = JSON.parse(fs.readFileSync(path.join("data/triage", `${d.doc}.json`), "utf8"));
    for (const t of triage) {
      const ids = regionIds({ ...t, page: d.firstPage + t.page - 1 });
      [...ids.charts, ...ids.images].forEach((r) => regions.add(r.id));
    }
  }
  const mapped = new Set(map.pages.map((p) => p.page));
  for (const p of pageNums) if (!mapped.has(p)) problems.push(`page ${p} has no roles`);
  for (const s of map.sections) for (const p of s.pages) if (!pageNums.has(p)) problems.push(`section ${s.id}: no page ${p}`);
  const chartIds = new Set(map.charts.map((c) => c.id));
  for (const s of map.sections) for (const c of s.chartIds) if (!chartIds.has(c)) problems.push(`section ${s.id}: unknown chart ${c}`);
  for (const c of map.charts) {
    for (const r of [...c.regionIds, ...c.legendRegionIds]) if (!regions.has(r) && !/^p\d+$/.test(r)) problems.push(`chart ${c.id}: unknown region ${r}`);
    for (const i of c.sizes) if (i < 0 || i >= map.sizes.length) problems.push(`chart ${c.id}: size index ${i} out of range`);
  }
  for (const s of map.sections) {
    const ref = pages.find((p) => p.page === s.startPage);
    if (!ref) {
      problems.push(`section ${s.id}: start page ${s.startPage} doesn't exist`);
      continue;
    }
    const data: PageData = JSON.parse(fs.readFileSync(path.join("data/raw", ref.doc, "pages", `p${String(ref.docPage).padStart(2, "0")}.json`), "utf8"));
    if (findQuote(data, s.startQuote) < 0) problems.push(`section ${s.id}: start quote not found on p${s.startPage}: "${s.startQuote}"`);
  }
  for (const s of map.sections)
    for (const ch of s.choices) if (!map.options.some((o) => o.choices.includes(ch))) problems.push(`section ${s.id}: unknown choice ${ch}`);
  return problems;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const mode = (args.find((a) => a.startsWith("--mode="))?.slice(7) ?? "text") as MapInputMode;
  const patterns = args.filter((a) => !a.startsWith("--"));
  const OUT = path.join(MAP_DIR, mode);
  const client = new Anthropic();
  fs.mkdirSync(OUT, { recursive: true });

  await Promise.all(
    patterns.map(async (pattern) => {
      const { content, pages } = buildMapInput(pattern, path.join("data/crops", pattern), mode);
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: [...content, { type: "text", text: TASK }] }];
      if (dry) {
        const { input_tokens } = await client.messages.countTokens({ model: MODEL, system: SYSTEM, messages });
        const images = content.filter((b) => b.type === "image").length;
        console.log(`${pattern}: ${pages.length} pages, ${images} images, ${input_tokens} input tokens`);
        return;
      }
      const t0 = Date.now();
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: zodOutputFormat(DocMap) },
        system: SYSTEM,
        messages,
      });
      const msg = await stream.finalMessage();
      const secs = Math.round((Date.now() - t0) / 1000);
      if (msg.stop_reason !== "end_turn" || !msg.parsed_output) {
        console.log(`${pattern}: FAILED stop_reason=${msg.stop_reason} after ${secs}s`);
        fs.writeFileSync(path.join(OUT, `${pattern}.failed.json`), JSON.stringify(msg, null, 1));
        return;
      }
      const map = msg.parsed_output;
      const problems = check(map, pages, pattern);
      fs.writeFileSync(path.join(OUT, `${pattern}.json`), JSON.stringify({ map, pages, problems, usage: msg.usage, model: MODEL }, null, 1));
      console.log(
        `${pattern}: ${secs}s, in=${msg.usage.input_tokens} out=${msg.usage.output_tokens}; ` +
          `${map.sections.length} sections, ${map.charts.length} charts, ${map.reviewNotes.length} review notes, ${problems.length} problems`,
      );
    }),
  );
}

/** The inspector lists maps from this: one entry per mode and pattern. */
function writeIndex() {
  const entries = fs
    .readdirSync(MAP_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      fs
        .readdirSync(path.join(MAP_DIR, d.name))
        .filter((f) => f.endsWith(".json") && !f.endsWith(".failed.json"))
        .map((f) => {
          const { map, problems, usage } = JSON.parse(fs.readFileSync(path.join(MAP_DIR, d.name, f), "utf8"));
          return {
            mode: d.name,
            pattern: f.replace(/\.json$/, ""),
            title: map.title,
            sections: map.sections.length,
            charts: map.charts.length,
            problems: problems.length,
            inputTokens: usage.input_tokens,
          };
        }),
    );
  fs.writeFileSync(path.join(MAP_DIR, "index.json"), JSON.stringify(entries, null, 1));
}

main()
  .then(writeIndex)
  .catch((e) => {
  console.error(e);
  process.exit(1);
});
