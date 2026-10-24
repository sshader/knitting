/**
 * Stage 3: chart extraction for charts drawn as images.
 *
 *   npx tsx scripts/charts.ts <pattern> [chartId...]   (default: all image charts in the map)
 *
 * See src/pipeline/chartsStage.ts. Reads the map and sections from Convex;
 * saves each Chart there with its cropped image.
 */
import { api } from "../convex/_generated/api";
import { chartReport } from "../src/extract/chartReport";
import { dollars } from "../src/extract/pricing";
import { rasterCharts, runCharts } from "../src/pipeline/chartsStage";
import { MODEL } from "../src/pipeline/llm";
import { localSource } from "../src/pipeline/localSource";
import { connect, uploadBytes } from "./convex";
import { client } from "./llm";

const [pattern, ...only] = process.argv.slice(2);
if (!pattern) throw new Error("usage: charts.ts <pattern> [chartId...]");
const convex = await connect();
const saved = await convex.query(api.maps.get, { pattern, mode: "text" });
if (!saved) throw new Error(`${pattern} has no map; run scripts/map.ts ${pattern}`);
const { map } = saved;
const targets = only.length ? map.charts.filter((c) => only.includes(c.id)) : rasterCharts(map);
const sections = await convex.query(api.sections.forPattern, { pattern });

const result = await runCharts(
  localSource(pattern),
  map,
  targets,
  sections.flatMap((s) => s.extraction?.nodes ?? []),
  client,
);
const { call } = result;
if (!call.parsed) throw new Error(`naming: stop_reason ${call.msg.stop_reason}`);
console.log(`naming: ${call.seconds}s, ${dollars(call.cost)}, out=${call.usage.outputTokens}, cache write=${call.usage.cacheWriteTokens} read=${call.usage.cacheReadTokens}`);
for (const id of result.missing) console.log(`${id}: not named by the model`);

for (const c of result.charts) {
  await convex.mutation(api.charts.save, {
    pattern,
    chartId: c.chart.id,
    chart: c.chart,
    naming: c.naming,
    notes: result.notes,
    image: { file: await uploadBytes(c.grid.image.png, "image/png"), page: c.page, cropBox: c.grid.image.cropBox },
    gridBox: c.grid.gridBox,
    unassignedCells: c.unassignedCells,
    stitchCounts: c.stitchCounts,
    model: MODEL,
    usage: call.usage,
  });
  const { written } = chartReport(c.chart);
  console.log(
    `${c.chart.id}: ${c.grid.cols}x${c.grid.rows}, ${Object.keys(c.chart.legend).length} legend keys${c.unassignedCells ? `, ${c.unassignedCells} UNASSIGNED cells` : ""}` +
      (written ? `; written rows: ${written.identical}/${written.rows} identical, ${written.stitchesDiffering} sts differ` : "") +
      `; stitch counts: ${c.stitchCounts.checkpoints.length} checkpoints, ${c.stitchCounts.problems.length} problems` +
      (c.stitchCounts.problems.length ? `\n    ${c.stitchCounts.problems.join("\n    ")}` : ""),
  );
}
