/**
 * Chart extraction for raster charts.
 *
 *   npx tsx scripts/charts.ts <pattern> [chartId...]   (default: all image charts in the map)
 *
 * 1. scripts/raster_grid.py finds each chart's grid and groups its cells by
 *    look (no LLM).
 * 2. One LLM call for the whole pattern names every chart's cell types, from
 *    enlarged samples plus the chart images and the cached pattern text.
 * 3. Build each Chart, generate every row, and check it against the
 *    pattern's written rows and the stitch counts stated in its sections.
 * Writes data/charts/<pattern>/<chartId>.json and data/charts/index.json.
 */
import type Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { checkStitchCounts } from "../src/extract/chartChecks";
import { ChartNaming } from "../src/extract/chartSchema";
import type { DocMap } from "../src/extract/docMap";
import { buildMapInput, mapContext, png } from "../src/extract/mapInput";
import { docsFor, PDF_DIR, readPage, triageDoc, type PageRef } from "../src/extract/patterns";
import { runPython } from "../src/extract/python";
import type { FlatNode } from "../src/extract/sectionSchema";
import { parseWrittenColorRows } from "../src/extract/writtenChart";
import { expand, formatRuns, generateRow, parseRuns } from "../src/shared/chartRows";
import { Chart, type LegendEntry } from "../src/shared/schema";
import { structured } from "./llm";

const CELL_TYPES = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const SYSTEM = `You help turn knitting charts into data for a row-by-row knitting tracker. You'll get a whole pattern (page text in reading order, detected regions, image thumbnails) and its reviewed map, then its charts. Code has already found each chart's grid and grouped its cells into types by appearance; your job is to say what each type means.

For each chart give its legend: one entry per symbol in the chart's key, plus plain cells the key implies (in colorwork, an unmarked cell is "knit in that color"). Give each entry a single-character key. rs/ws are the stitch in the pattern's own abbreviations ("k", "p", "m1", "k2tog", "2/1 RPC"); for charts worked in the round leave ws "". color is the pattern's own name for the yarn ("MC", "CC", "A") in colorwork, "" otherwise. "No stitch" / decreased-away cells: noStitch true. Then assign every cell type to a legend key.

Also from each chart's image: the number printed on its bottom row (firstRow), reading direction ("rtl" if worked in the round, every row right to left; "alternate" if flat), and any repeat box as printed column numbers (columns are numbered from the right).`;

async function main() {
  const [pattern, ...only] = process.argv.slice(2);
  if (!pattern) throw new Error("usage: charts.ts <pattern> [chartId...]");
  const { map, pages }: { map: DocMap; pages: PageRef[] } = JSON.parse(fs.readFileSync(`data/map/text/${pattern}.json`, "utf8"));
  const targets = map.charts.filter((c) => (only.length ? only.includes(c.id) : /^p\d+\.i\d+$/.test(c.regionIds[0] ?? "")));

  // 1. Grids, in code.
  const prepared = targets.map((c) => {
    const [, pageStr, kind, idx] = /^p(\d+)\.([ci])(\d+)$/.exec(c.regionIds[0] ?? "") ?? [];
    if (kind !== "i") throw new Error(`${c.id}: only raster (image) charts so far; region ${c.regionIds[0]}`);
    const ref = pages.find((p) => p.page === Number(pageStr))!;
    const bbox = triageDoc(ref.doc)[ref.docPage - 1].images[Number(idx) - 1].bbox;
    const pdf = path.join(PDF_DIR, docsFor(pattern).find((d) => d.doc === ref.doc)!.source);
    const outDir = path.join("data/charts", pattern, c.id);
    fs.mkdirSync(outDir, { recursive: true });
    const crop = path.join(outDir, "chart.png");
    fs.writeFileSync(path.join(outDir, "crop.json"), JSON.stringify([{ page: ref.docPage, bbox, out: crop, maxPx: 1600 }]));
    runPython("render_crops.py", [pdf, path.join(outDir, "crop.json")]);
    runPython("raster_grid.py", [pdf, String(ref.docPage), bbox.join(","), outDir]);
    const grid = JSON.parse(fs.readFileSync(path.join(outDir, "grid.json"), "utf8"));
    const pad = 0.01;
    const cropBox = [Math.max(0, bbox[0] - pad), Math.max(0, bbox[1] - pad), Math.min(1, bbox[2] + pad), Math.min(1, bbox[3] + pad)];
    console.log(`${c.id}: grid ${grid.cols}x${grid.rows}, ${grid.classes.length} cell types`);
    return { c, ref, grid, crop, cropBox };
  });

  // 2. One naming call for the pattern.
  const { content } = buildMapInput(pattern, path.join("data/crops", pattern), "text");
  const { parsed: naming, msg, seconds: secs } = await structured(ChartNaming, {
    system: SYSTEM,
    effort: "high",
    maxTokens: 32000,
    content: [
      ...content,
      { ...mapContext(map), cache_control: { type: "ephemeral" } },
      ...prepared.flatMap(({ c, ref, grid, crop }): Anthropic.ContentBlockParam[] => [
        {
          type: "text",
          text:
            `=== Chart "${c.id}" (${c.title}), page ${ref.page}: ${grid.cols} columns x ${grid.rows} rows ===` +
            (c.writtenPages.length ? `\nIts rows are also written out on pages ${c.writtenPages.join(", ")} with yarn colors carried by text color; give textColors for those pages' "Text colors" legends.` : ""),
        },
        png(crop),
        ...grid.classes.flatMap((k: any): Anthropic.ContentBlockParam[] => [
          { type: "text", text: `Cell type ${k.id}: ${k.count} cells, fill rgb(${k.rgb.join(", ")})${k.symbol ? ", something drawn on it" : ""}, e.g. row ${k.example[0]} column ${k.example[1]}:` },
          png(k.sample),
        ]),
      ]),
    ],
  });
  if (!naming) throw new Error(`naming: stop_reason ${msg.stop_reason}`);
  console.log(`naming: ${secs}s, out=${msg.usage.output_tokens}, cache write=${msg.usage.cache_creation_input_tokens ?? 0} read=${msg.usage.cache_read_input_tokens ?? 0}`);

  // 3. Build, generate, check.
  const sectionNodes: FlatNode[] = fs.existsSync(`data/sections/${pattern}`)
    ? fs.readdirSync(`data/sections/${pattern}`).flatMap((f) => JSON.parse(fs.readFileSync(`data/sections/${pattern}/${f}`, "utf8")).extraction?.nodes ?? [])
    : [];
  for (const { c, ref, grid, crop, cropBox } of prepared) {
    const named = naming.charts.find((x) => x.chartId === c.id);
    if (!named) {
      console.log(`${c.id}: not named by the model`);
      continue;
    }
    const keyOf = new Map(named.assignments.map((a) => [CELL_TYPES[a.cellType], a.key]));
    const legend: Record<string, LegendEntry> = {};
    for (const e of named.legend) {
      const type = grid.classes.find((k: any) => keyOf.get(CELL_TYPES[k.id]) === e.key);
      legend[e.key] = {
        label: e.label,
        rs: e.rs || undefined,
        ws: e.ws || undefined,
        color: e.color || undefined,
        swatch: type ? `rgb(${type.rgb.join(",")})` : undefined,
        noStitch: e.noStitch || undefined,
        span: e.span > 1 ? e.span : undefined,
      };
    }
    const cells: string[] = grid.cells.map((row: string) => [...row].map((ch) => keyOf.get(ch) ?? "?").join(""));

    let writtenRows: Record<string, string> | undefined;
    if (c.writtenPages.length && naming.textColors.length) {
      const wp = c.writtenPages.map((n) => pages.find((p) => p.page === n)!).map((r) => readPage(r.doc, r.docPage));
      const parsed = parseWrittenColorRows(wp, Object.fromEntries(naming.textColors.map((t) => [t.hex.toLowerCase(), t.color])));
      const best = parsed.sort((a, b) => b.rows.size - a.rows.size)[0];
      if (best) writtenRows = Object.fromEntries([...best.rows].map(([n, runs]) => [String(n), formatRuns(runs)]));
    }

    const chart = Chart.parse({
      id: c.id,
      title: c.title,
      sizes: c.sizes.length ? c.sizes : undefined,
      width: grid.cols,
      cells,
      legend,
      readDirection: named.readDirection,
      repeat: named.repeatFromCol && named.repeatToCol ? { fromCol: named.repeatFromCol, toCol: named.repeatToCol } : undefined,
      firstRow: named.firstRow > 1 ? named.firstRow : undefined,
      cellNote: named.cellNote || undefined,
      writtenRows,
      source: [{ page: ref.page }],
    });

    const rows = cells.map((_, i) => {
      const n = i + (chart.firstRow ?? 1);
      try {
        const g = generateRow(chart, n);
        const written = writtenRows?.[String(n)];
        const gen = expand(g.runs);
        const want = written ? expand(parseRuns(written)) : null;
        const differs = want ? Math.max(gen.length, want.length) - gen.filter((s, j) => s === want[j]).length : null;
        return { row: n, side: g.side, text: g.text, stitches: gen.length, written, differs };
      } catch (e) {
        return { row: n, error: String(e) };
      }
    });
    const compared = rows.filter((r) => "differs" in r && r.differs !== null);
    const stitchCounts = checkStitchCounts(chart, sectionNodes, map.sizes);
    const out = {
      chart,
      naming: { ...named, notes: naming.notes },
      grid: { gridBox: grid.gridBox, cols: grid.cols, rows: grid.rows, classes: grid.classes },
      image: { file: crop, page: ref.page, cropBox },
      rows,
      checks: {
        unassignedCells: cells.join("").split("?").length - 1,
        written: compared.length
          ? { rows: compared.length, identical: compared.filter((r: any) => r.differs === 0).length, stitchesDiffering: compared.reduce((n, r: any) => n + r.differs, 0) }
          : null,
        stitchCounts,
      },
      usage: { naming: msg.usage, sharedAcross: prepared.length },
    };
    fs.writeFileSync(path.join("data/charts", pattern, `${c.id}.json`), JSON.stringify(out, null, 1));
    const ck = out.checks;
    console.log(
      `${c.id}: ${grid.cols}x${grid.rows}, ${new Set(keyOf.values()).size} legend keys${ck.unassignedCells ? `, ${ck.unassignedCells} UNASSIGNED cells` : ""}` +
        (ck.written ? `; written rows: ${ck.written.identical}/${ck.written.rows} identical, ${ck.written.stitchesDiffering} sts differ` : "") +
        `; stitch counts: ${stitchCounts.checkpoints.length} checkpoints, ${stitchCounts.problems.length} problems` +
        (stitchCounts.problems.length ? `\n    ${stitchCounts.problems.join("\n    ")}` : ""),
    );
  }
}

/** The inspector lists charts from this. */
function writeIndex() {
  const root = "data/charts";
  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      fs
        .readdirSync(path.join(root, d.name))
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          const j = JSON.parse(fs.readFileSync(path.join(root, d.name, f), "utf8"));
          return { pattern: d.name, chartId: j.chart.id, title: j.chart.title, size: `${j.chart.width}x${j.chart.cells.length}`, comparison: j.checks.written };
        }),
    );
  fs.writeFileSync(path.join(root, "index.json"), JSON.stringify(entries, null, 1));
}

main()
  .then(writeIndex)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
