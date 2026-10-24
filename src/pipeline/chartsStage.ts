import type Anthropic from "@anthropic-ai/sdk";
import { checkStitchCounts, type StitchCountCheck } from "../extract/chartChecks";
import { ChartNaming } from "../extract/chartSchema";
import type { DocMap } from "../extract/docMap";
import type { FlatNode } from "../extract/sectionSchema";
import { parseWrittenColorRows } from "../extract/writtenChart";
import { formatRuns } from "../shared/chartRows";
import { Chart, type LegendEntry } from "../shared/schema";
import { pngBlock, structured, type Call } from "./llm";
import { buildMapInput, mapContext } from "./mapInput";
import type { ChartGrid, PatternSource } from "./source";

/**
 * Stage 3, for charts drawn as images:
 * 1. code finds each chart's grid and groups its cells by look (raster_grid.py);
 * 2. one call for the whole pattern names every chart's cell types, from
 *    enlarged samples plus the chart images and the pattern text;
 * 3. code builds each Chart and checks it against the stitch counts the
 *    sections state.
 */

const CELL_TYPES = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const SYSTEM = `You help turn knitting charts into data for a row-by-row knitting tracker. You'll get a whole pattern (page text in reading order, detected regions, image thumbnails) and its reviewed map, then its charts. Code has already found each chart's grid and grouped its cells into types by appearance; your job is to say what each type means.

For each chart give its legend: one entry per symbol in the chart's key, plus plain cells the key implies (in colorwork, an unmarked cell is "knit in that color"). Give each entry a single-character key. rs/ws are the stitch in the pattern's own abbreviations ("k", "p", "m1", "k2tog", "2/1 RPC"); for charts worked in the round leave ws "". color is the pattern's own name for the yarn ("MC", "CC", "A") in colorwork, "" otherwise. "No stitch" / decreased-away cells: noStitch true. Then assign every cell type to a legend key.

Also from each chart's image: the number printed on its bottom row (firstRow), reading direction ("rtl" if worked in the round, every row right to left; "alternate" if flat), and any repeat box as printed column numbers (columns are numbered from the right).`;

type MapChart = DocMap["charts"][number];

export interface ChartResult {
  chart: Chart;
  naming: ChartNaming["charts"][number];
  grid: ChartGrid;
  page: number;
  unassignedCells: number;
  stitchCounts: StitchCountCheck;
}

export interface ChartsResult {
  call: Call<ChartNaming>;
  charts: ChartResult[];
  /** Notes from the naming call, shared by all the charts. */
  notes: string[];
  /** Charts the model didn't name. */
  missing: string[];
}

/** The map's charts drawn as images (region "p5.i1"), the only kind this stage handles so far. */
export const rasterCharts = (map: DocMap) => map.charts.filter((c) => /^p\d+\.i\d+$/.test(c.regionIds[0] ?? ""));

export async function runCharts(source: PatternSource, map: DocMap, targets: MapChart[], sectionNodes: FlatNode[], client: Anthropic): Promise<ChartsResult> {
  // 1. Grids, in code.
  const prepared = await Promise.all(
    targets.map(async (c) => {
      const [, pageStr, kind, idx] = /^p(\d+)\.([ci])(\d+)$/.exec(c.regionIds[0] ?? "") ?? [];
      if (kind !== "i") throw new Error(`${c.id}: only raster (image) charts so far; region ${c.regionIds[0]}`);
      const page = Number(pageStr);
      const entry = source.pages.find((p) => p.page === page);
      if (!entry) throw new Error(`${c.id}: no page ${page}`);
      const bbox = entry.triage.images[Number(idx) - 1].bbox;
      return { c, page, grid: await source.chartGrid(page, bbox) };
    }),
  );

  // 2. One naming call for the pattern.
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...(await buildMapInput(source)),
    { ...mapContext(map), cache_control: { type: "ephemeral" } },
    ...prepared.flatMap(({ c, page, grid }): Anthropic.Beta.BetaContentBlockParam[] => [
      {
        type: "text",
        text:
          `=== Chart "${c.id}" (${c.title}), page ${page}: ${grid.cols} columns x ${grid.rows} rows ===` +
          (c.writtenPages.length ? `\nIts rows are also written out on pages ${c.writtenPages.join(", ")} with yarn colors carried by text color; give textColors for those pages' "Text colors" legends.` : ""),
      },
      pngBlock(grid.image.png),
      ...grid.classes.flatMap((k): Anthropic.Beta.BetaContentBlockParam[] => [
        { type: "text", text: `Cell type ${k.id}: ${k.count} cells, fill rgb(${k.rgb.join(", ")})${k.symbol ? ", something drawn on it" : ""}, e.g. row ${k.example[0]} column ${k.example[1]}:` },
        pngBlock(k.sample),
      ]),
    ]),
  ];
  const call = await structured(client, ChartNaming, { system: SYSTEM, effort: "high", maxTokens: 32000, content });
  const naming = call.parsed;
  if (!naming) return { call, charts: [], notes: [], missing: targets.map((c) => c.id) };

  // 3. Build and check.
  const charts: ChartResult[] = [];
  const missing: string[] = [];
  for (const { c, page, grid } of prepared) {
    const named = naming.charts.find((x) => x.chartId === c.id);
    if (!named) {
      missing.push(c.id);
      continue;
    }
    const keyOf = new Map(named.assignments.map((a) => [CELL_TYPES[a.cellType], a.key]));
    const legend: Record<string, LegendEntry> = {};
    for (const e of named.legend) {
      const type = grid.classes.find((k) => keyOf.get(CELL_TYPES[k.id]) === e.key);
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
    const cells = grid.cells.map((row) => [...row].map((ch) => keyOf.get(ch) ?? "?").join(""));

    let writtenRows: Record<string, string> | undefined;
    if (c.writtenPages.length && naming.textColors.length) {
      const written = await Promise.all(c.writtenPages.map((n) => source.pageData(n)));
      const parsed = parseWrittenColorRows(written, Object.fromEntries(naming.textColors.map((t) => [t.hex.toLowerCase(), t.color])));
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
      source: [{ page }],
    });
    charts.push({
      chart,
      naming: named,
      grid,
      page,
      unassignedCells: cells.join("").split("?").length - 1,
      stitchCounts: checkStitchCounts(chart, sectionNodes, map.sizes),
    });
  }
  return { call, charts, notes: naming.notes, missing };
}
