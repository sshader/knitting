/**
 * Draft-extract a pattern from one or more PDFs with Claude and cache the raw
 * result. Run while online; everything downstream works from the cache.
 *
 *   npx tsx scripts/extract-llm.ts <slug> <pdf> [<pdf>...]
 *
 * Writes data/extracted/<slug>.llm.json (raw model output + usage) and, if it
 * validates, data/extracted/<slug>.pattern.json.
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LlmExtraction, toPattern } from "../src/extract/llmSchema";

try {
  process.loadEnvFile(".env");
} catch {}

const SYSTEM = `You convert knitting patterns into structured data for a row-by-row knitting tracker app.

Goals, in priority order:
1. Faithfulness. Never invent instructions. Keep the designer's wording in "text", lightly trimmed. If something is ambiguous, keep it and add a reviewNote.
2. Followability. A knitter should be able to step through nodes in order and always know what to do on the current row.

Structure:
- "nodes" is a flat list in reading order. Top-level sections have parentId null. Children of sections/repeats point at them via parentId.
- Sections: major parts ("Neckline", "Yoke", "Body", "Sleeves"). Use "times" for "work the other sleeve the same way" (times: 2).
- Row: one instruction worked for "rows" consecutive rows/rounds (e.g. "Knit 40 (40) 44 (44) rounds twisted rib" -> rows [40,40,44,44]). Numbered rows ("Row 1 (RS)", "Short row 3") get one node each with "label".
- Note: setup and info that isn't itself a row (switch needles, place markers, break yarn, try on, dividing stitches is a row if it is worked across).
- Chart: "work all rounds of chart B" -> a chart node referencing the chart's id.
- Repeat: "repeat rows 3-4 another 2 (3) 3 (4) times" -> a repeat whose children are those rows; times is the total number of times the block is worked including the first, when the pattern makes that clear (say so in a reviewNote if not). Use "until" for open-ended conditions ("until piece measures 30 cm").
- "AT THE SAME TIME": model the main sequence as a repeat (or a repeat wrapping rows) and the concurrent instruction as an overlay on it: first row it happens, every N rows, count. Row numbers count from 1 at the repeat start.
- "Size S only" blocks: set "sizes" to the size indices (0-based) on those nodes. Otherwise sizes null.

Sizes:
- "sizes" lists size names in order. Size-dependent numbers: a single integer if the same for all sizes, otherwise an array with one value per size.
- In free text, write size-dependent values inline as {a|b|c|d} with exactly one alternative per size, e.g. "Cast on {108|112|116|120} sts".

Sources: every node gets source refs with the 1-based PDF page and a short exact quote (copied verbatim from the PDF text, 4-15 words) that locates it. Quotes are matched against the PDF text layer, so they must be verbatim.

Charts: transcribe each chart. cells[0] is the BOTTOM row (row 1); each string has one character per cell, left to right as drawn; " " = no stitch. Choose single-character legend keys (e.g. "." knit, "-" purl, "A"/"B"/"C" colours). Use one chart entry per size if the pattern has size-specific charts. Large or dense charts are hard to transcribe from images: give your best attempt, set cellsConfidence honestly, and add a reviewNote. readDirection "rtl" for in-the-round, "alternate" for flat.

ids: short, stable, human-readable slugs, e.g. "yoke", "yoke-sr3", "body-stripes".`;

async function main() {
  const [slug, ...pdfs] = process.argv.slice(2);
  if (!slug || pdfs.length === 0) throw new Error("usage: extract-llm.ts <slug> <pdf>...");
  const outDir = "data/extracted";
  fs.mkdirSync(outDir, { recursive: true });

  const client = new Anthropic();
  const content: Anthropic.ContentBlockParam[] = pdfs.map((p) => ({
    type: "document",
    title: path.basename(p),
    source: { type: "base64", media_type: "application/pdf", data: fs.readFileSync(p).toString("base64") },
  }));
  content.push({
    type: "text",
    text:
      pdfs.length > 1
        ? `These ${pdfs.length} PDFs are one pattern. Page numbers in source refs are per document; prefix quotes from document 2+ with nothing, but set reviewNotes if unsure which document a page is in.`
        : "Extract this pattern.",
  });

  const t0 = Date.now();
  const stream = client.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 128000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      // The helper strips constraints the API doesn't support and re-checks them client-side.
      format: zodOutputFormat(LlmExtraction),
    },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  stream.on("text", () => process.stdout.write("."));
  const msg = await stream.finalMessage();
  console.log(`\n${slug}: ${msg.stop_reason} in ${((Date.now() - t0) / 1000).toFixed(0)}s`, msg.usage);

  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  fs.writeFileSync(path.join(outDir, `${slug}.llm.json`), JSON.stringify({ stop_reason: msg.stop_reason, usage: msg.usage, pdfs, text }, null, 1));
  if (msg.stop_reason !== "end_turn") throw new Error(`stopped: ${msg.stop_reason}`);

  const extraction = LlmExtraction.parse(JSON.parse(text));
  const pattern = toPattern(extraction, { filename: path.basename(pdfs[0]), pageCount: 0 });
  fs.writeFileSync(path.join(outDir, `${slug}.pattern.json`), JSON.stringify(pattern, null, 1));
  console.log(`${slug}: ${extraction.nodes.length} nodes, ${extraction.charts.length} charts, ${extraction.reviewNotes.length} review notes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
