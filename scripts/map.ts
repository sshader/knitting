/**
 * Stage 1: build a document map for each pattern with Claude.
 *
 *   npx tsx scripts/map.ts [--dry] [--mode=text|pages] <pattern...>
 *
 * --dry builds the request and counts tokens without generating.
 * --mode picks the input format (see mapInput.ts); default text.
 * Saves the map to Convex (failed calls to data/map/<mode>/<pattern>.failed.json).
 */
import fs from "node:fs";
import path from "node:path";
import { api } from "../convex/_generated/api";
import { DocMap } from "../src/extract/docMap";
import { checkMap } from "../src/extract/mapChecks";
import { buildMapInput, type MapInputMode } from "../src/extract/mapInput";
import { connect, usageOf } from "./convex";
import { client, MODEL, structured } from "./llm";

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

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const mode = (args.find((a) => a.startsWith("--mode="))?.slice(7) ?? "text") as MapInputMode;
  const patterns = args.filter((a) => !a.startsWith("--"));
  const convex = await connect();

  await Promise.all(
    patterns.map(async (pattern) => {
      const { content, pages } = buildMapInput(pattern, path.join("data/crops", pattern), mode);
      const request = [...content, { type: "text" as const, text: TASK }];
      if (dry) {
        const { input_tokens } = await client.messages.countTokens({ model: MODEL, system: SYSTEM, messages: [{ role: "user", content: request }] });
        const images = content.filter((b) => b.type === "image").length;
        console.log(`${pattern}: ${pages.length} pages, ${images} images, ${input_tokens} input tokens`);
        return;
      }
      const { parsed: map, msg, seconds: secs } = await structured(DocMap, { system: SYSTEM, content: request, effort: "medium", maxTokens: 64000 });
      if (!map) {
        console.log(`${pattern}: FAILED stop_reason=${msg.stop_reason} after ${secs}s`);
        const failed = path.join("data/map", mode, `${pattern}.failed.json`);
        fs.mkdirSync(path.dirname(failed), { recursive: true });
        fs.writeFileSync(failed, JSON.stringify(msg, null, 1));
        return;
      }
      const problems = checkMap(map, pages, pattern);
      await convex.mutation(api.maps.save, { pattern, mode, map, problems, model: MODEL, usage: usageOf(msg.usage) });
      console.log(
        `${pattern}: ${secs}s, in=${msg.usage.input_tokens} out=${msg.usage.output_tokens}; ` +
          `${map.sections.length} sections, ${map.charts.length} charts, ${map.reviewNotes.length} review notes, ${problems.length} problems`,
      );
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
