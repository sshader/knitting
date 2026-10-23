/**
 * Stage 2: extract each section of a mapped pattern into row-level nodes.
 *
 *   npx tsx scripts/sections.ts <pattern> [sectionId...]
 *
 * Every call shares a cached prefix (instructions + the whole pattern's text +
 * the reviewed map), then names one section. The first call runs alone to
 * write the cache; the rest run in parallel and read it.
 * Writes data/sections/<pattern>/<sectionId>.json.
 */
import type Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { locateSections } from "../src/extract/anchors";
import type { DocMap } from "../src/extract/docMap";
import { buildMapInput, mapContext } from "../src/extract/mapInput";
import { pageLoader, type PageRef } from "../src/extract/patterns";
import { checkSection, SectionExtraction, toSection } from "../src/extract/sectionSchema";
import { MODEL, structured } from "./llm";

const PARALLEL = 4;

const SYSTEM = `You convert knitting pattern instructions into structured rows for a row-by-row knitting tracker. You'll get a whole pattern (page text in reading order, headings marked with #, detected chart regions, image thumbnails) and a reviewed map of its sections. Each request names ONE section; extract only that section, from its start up to where the next section starts.

Goal: a knitter steps through your nodes in order and always knows exactly what to do on the current row, for their size and options. Be faithful: never invent or "fix" instructions; keep the designer's wording, lightly trimmed. When something is ambiguous or looks like a pattern error, keep it as written and add a reviewNote.

Nodes (flat list in knitting order; parentId "" for top level, or the id of a containing repeat/subsection)
- row: one instruction worked over consecutive rows/rounds. Numbered rows ("Row 1 (RS)", "Rnd 5", "SR3 (ws)") get one node each, label as printed. An instruction covering several identical rows ("Knit 40 (40) 44 (44) rounds") is one node with rows set. "Next round: ..." / "Dec rnd: ..." are rows. Cast on / bind off are rows.
- note: information or setup at a point in the sequence that isn't a row: change needles, place/move markers, break yarn, try on, "you should now have ...", explanations.
- chart: working a chart, e.g. "Work rows 1-16 of Neck Shaping chart" (chartRefs with chart ids from the map; fromRow/toRow if limited, else []).
- repeat: a block worked several times. "Repeat rows 3-4 another 2 (3) times" -> a repeat whose children are rows 3 and 4 (move them inside it), times = total times the block is worked including the first. Open-ended: until = "until piece measures 30 cm from cast-on", times [].
- section: a subsection with a title, for a group like "Buttonhole 1st side" or a block that only applies to some sizes/options.
- AT THE SAME TIME / "while at the same time": model the main sequence as a repeat (or a repeat around the rows) and the concurrent instruction as an overlay on it: first row it happens, every N rows, count; row numbers count from 1 at the start of that repeat.
- chartRefs (chart nodes, and rows that correspond to a chart row): one entry per chart worked across the row, in the order they're worked. Usually one; several when charts are worked side by side (panels, a sleeve chart and a body chart in the same row). Each entry's ids is [id], or one id per size in size order when the chart differs by size ("" for a size where that position has no chart). E.g. a panel that is A for sizes 1-5 and B for 6-9: {ids: ["a","a","a","a","a","b","b","b","b"]}.
- Rows given both as a chart and written out (the map's writtenPages for a chart): those written rows are the chart in another form and are extracted with the chart, not here. Don't transcribe them; reference the chart instead, with a chart node for a run of chart rows ("work rounds 2-48 of the chart") or, where the section gives per-row instructions on top of the chart (a decrease round), a row node with chartRefs and fromRow = that chart row. For rows that just continue the charts as set ("work 13 rounds in this manner"), give chartRefs with fromRow [].

Sizes and options
- Size order is the map's sizes. In text, write every size-dependent value as {v1|v2|...} with exactly one value per size, in size order, using "-" for sizes a value doesn't apply to. Convert from the pattern's own notation (see the map's sizeNotation), e.g. "84 (84, 84, 88) 96, 96 [100, 100, 100] 104" -> "{84|84|84|88|96|96|100|100|100|104}".
- Numeric fields (rows, stitchCount, times, overlay first/every/count) are arrays: [n] if the same for all sizes, else one value per size.
- sizes: size indices (0-based) a node applies to when the pattern says so ("Size S only", "for sizes 3-9", a block headed "SIZE 2"); [] otherwise.
- choices: option choices from the map a node applies to ("Bracelet"), [] otherwise.

Other fields
- side: "RS"/"WS" when stated, else "none". stitchCount: the stitch count after the row when stated ("= 296 sts", "[96]"), else [].
- Section times: [2] for "make 2" / "work the second sleeve the same", else [].
- Text colors: page text may wrap colored words as [A:k9] with a "Text colors" legend of hex values. In node text, replace that markup with the pattern's own names for those colors (e.g. "k9 MC, k2 CC"), inferred from the pattern; add a reviewNote saying which hex you mapped to which name.
- source: every node (and overlay) needs at least one {page, quote}: the global page number and 4-12 words copied EXACTLY from that page's text where the instruction starts (no color markup, no # heading marks). Quotes are matched against the PDF text, so copy them verbatim.
- ids: short unique slugs prefixed with the section id, e.g. "yoke-sr3", "yoke-repeat-sr3-4".
- reviewNotes: anything ambiguous, inconsistent, or that you had to interpret.`;

async function main() {
  const [pattern, ...only] = process.argv.slice(2);
  if (!pattern) throw new Error("usage: sections.ts <pattern> [sectionId...]");
  const { map, pages }: { map: DocMap; pages: PageRef[] } = JSON.parse(fs.readFileSync(`data/map/text/${pattern}.json`, "utf8"));
  const outDir = path.join("data/sections", pattern);
  fs.mkdirSync(outDir, { recursive: true });

  const load = pageLoader(pages);

  const { content } = buildMapInput(pattern, path.join("data/crops", pattern), "text");
  const prefix: Anthropic.ContentBlockParam[] = [...content, { ...mapContext(map), cache_control: { type: "ephemeral" } }];

  const starts = locateSections(map.sections, load);
  const targets = map.sections.map((s, i) => ({ s, next: map.sections[i + 1] })).filter(({ s }) => only.length === 0 || only.includes(s.id));

  async function extract({ s, next }: (typeof targets)[number]) {
    const task =
      `Extract section "${s.id}" (${s.title}). It starts on page ${s.startPage} at "${s.startQuote}"` +
      (next ? ` and ends where section "${next.id}" (${next.title}) starts on page ${next.startPage} at "${next.startQuote}".` : " and runs to the end of the pattern's instructions.") +
      (starts[map.sections.indexOf(s)] ? "" : " (Its start quote could not be located automatically; use the map's page numbers.)");
    const { parsed: x, msg, seconds: secs } = await structured(SectionExtraction, {
      system: SYSTEM,
      content: [...prefix, { type: "text", text: task }],
      effort: "high",
      maxTokens: 64000,
    });
    const out: Record<string, unknown> = { section: s.id, model: MODEL, usage: msg.usage, stop_reason: msg.stop_reason, seconds: secs };
    if (!x) {
      out.error = `stop_reason ${msg.stop_reason}`;
      out.raw = msg.content;
    } else {
      out.extraction = x;
      out.problems = checkSection(x, map, load);
      try {
        out.tree = toSection(x, s);
      } catch (e) {
        out.error = String(e);
      }
    }
    fs.writeFileSync(path.join(outDir, `${s.id}.json`), JSON.stringify(out, null, 1));
    const u = msg.usage;
    console.log(
      `${s.id.padEnd(28)} ${String(secs).padStart(3)}s  in=${u.input_tokens} cacheRead=${u.cache_read_input_tokens ?? 0} cacheWrite=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}` +
        (x ? `  ${x.nodes.length} nodes, ${(out.problems as string[]).length} problems, ${x.reviewNotes.length} notes` : `  FAILED: ${out.error}`) +
        (out.error && x ? `  TREE ERROR: ${out.error}` : ""),
    );
  }

  // First call writes the prompt cache; the rest read it.
  const [first, ...rest] = targets;
  if (first) await extract(first);
  for (let i = 0; i < rest.length; i += PARALLEL) await Promise.all(rest.slice(i, i + PARALLEL).map(extract));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
