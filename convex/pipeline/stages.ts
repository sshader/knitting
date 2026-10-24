"use node";

import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { env, internalAction, type ActionCtx } from "../_generated/server";
import { triagePage } from "../../src/extract/triage";
import { sectionsForSize, writtenPerSize, type DocMap } from "../../src/extract/docMap";
import type { PageData } from "../../src/extract/pageData";
import { rasterCharts, runCharts } from "../../src/pipeline/chartsStage";
import { runGlossary } from "../../src/pipeline/glossaryStage";
import { estimateRest } from "../../src/pipeline/estimate";
import type { Call } from "../../src/pipeline/llm";
import { llmPageText } from "../../src/pipeline/mapInput";
import { runMap } from "../../src/pipeline/mapStage";
import { extractSection, sectionPrefix } from "../../src/pipeline/sectionsStage";
import { convexSource } from "./convexSource";
import { callPdfService, text } from "./pdfService";
import { OUT_OF_CREDITS } from "./state";

/**
 * The pipeline's stages as actions, for the workflow in workflow.ts. Each
 * runs one stage of src/pipeline on the pattern's data in Convex, saves the
 * result, charges the owner for any model call, and returns what its checks
 * found (problems that don't stop the run but mark the pattern for review).
 * A stage that produces nothing usable throws, which stops the run.
 */

const stageResult = v.object({ problems: v.array(v.string()) });
const client = () => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

async function requireCredits(ctx: ActionCtx, patternId: Id<"patterns">) {
  if ((await ctx.runQuery(internal.pipeline.state.balance, { patternId })) <= 0) throw new Error(`${OUT_OF_CREDITS}: add credits and re-run`);
}

const charge = (ctx: ActionCtx, patternId: Id<"patterns">, call: Call<unknown>, reason: string) =>
  ctx.runMutation(internal.pipeline.state.charge, { patternId, micros: call.cost, reason });

/** Pages, renders, and triage for each PDF, from the PDF service. */
export const preprocess = internalAction({
  args: { patternId: v.id("patterns") },
  returns: stageResult,
  handler: async (ctx, { patternId }): Promise<{ problems: string[] }> => {
    const pattern = await ctx.runQuery(internal.pipeline.state.pattern, { patternId });
    // A retry after a partial run starts over.
    await ctx.runMutation(internal.pipeline.state.clearPages, { patternId });
    const docs = [];
    let firstPage = 1;
    for (const d of pattern.docs) {
      if (!d.pdf) throw new Error(`no PDF stored for ${d.source}`);
      const files = await callPdfService("extract", { pdf_url: await ctx.storage.getUrl(d.pdf) });
      const { pageCount } = JSON.parse(text(files["meta.json"]));
      for (let n = 1; n <= pageCount; n++) {
        const name = `pages/p${String(n).padStart(2, "0")}`;
        const data: PageData = JSON.parse(text(files[`${name}.json`]));
        const entry = { page: firstPage + n - 1, doc: d.doc, docPage: n, triage: triagePage(data) };
        await ctx.runMutation(internal.pipeline.state.savePage, {
          patternId,
          ...entry,
          json: await ctx.storage.store(new Blob([new Uint8Array(files[`${name}.json`])], { type: "application/json" })),
          png: await ctx.storage.store(new Blob([new Uint8Array(files[`${name}.png`])], { type: "image/png" })),
          markdown: llmPageText(data, entry),
        });
      }
      docs.push({ ...d, pageCount, firstPage });
      firstPage += pageCount;
    }
    await ctx.runMutation(internal.pipeline.state.setDocs, { patternId, docs });
    if (firstPage === 1) throw new Error("The PDFs have no pages");
    return { problems: [] };
  },
});

const sectionPlan = v.object({ label: v.string(), estimate: v.number(), sectionIds: v.array(v.string()) });
type SectionPlan = typeof sectionPlan.type;

/**
 * The map, and what extracting the rest would cost: for all sections, and
 * for each size's when the pattern writes each size out separately.
 */
export const map = internalAction({
  args: { patternId: v.id("patterns") },
  returns: v.object({ problems: v.array(v.string()), all: sectionPlan, sizes: v.array(sectionPlan) }),
  handler: async (ctx, { patternId }): Promise<{ problems: string[]; all: SectionPlan; sizes: SectionPlan[] }> => {
    await requireCredits(ctx, patternId);
    const { call, problems } = await runMap(await convexSource(ctx, patternId), client());
    await charge(ctx, patternId, call, "map");
    const map = call.parsed;
    if (!map) throw new Error(`Mapping the pattern failed (stop reason ${call.msg.stop_reason})`);
    if (!map.sections.length) throw new Error("The map found no sections to knit");
    await ctx.runMutation(internal.pipeline.state.saveMap, { patternId, row: { mode: "text", map, problems, model: call.model, usage: call.usage } });
    const plan = (label: string, sections: DocMap["sections"]) => ({ label, estimate: estimateRest(map, call.usage, sections), sectionIds: sections.map((s) => s.id) });
    return {
      problems: problems.map((p) => `map: ${p}`),
      all: plan("All sizes", map.sections),
      sizes: writtenPerSize(map) ? map.sizes.map((label, i) => plan(label, sectionsForSize(map, i))) : [],
    };
  },
});

export const section = internalAction({
  args: { patternId: v.id("patterns"), sectionId: v.string() },
  returns: v.object({ problems: v.array(v.string()), ok: v.boolean() }),
  handler: async (ctx, { patternId, sectionId }): Promise<{ problems: string[]; ok: boolean }> => {
    await requireCredits(ctx, patternId);
    const source = await convexSource(ctx, patternId);
    const map: DocMap = await ctx.runQuery(internal.pipeline.state.map, { patternId });
    const { call, problems, error } = await extractSection(source, map, sectionId, await sectionPrefix(source, map), client());
    await charge(ctx, patternId, call, `section ${sectionId}`);
    await ctx.runMutation(internal.pipeline.state.saveSection, {
      patternId,
      row: { sectionId, extraction: call.parsed ?? undefined, problems, error, model: call.model, seconds: call.seconds, usage: call.usage },
    });
    const title = map.sections.find((s) => s.id === sectionId)?.title ?? sectionId;
    // A summary per section; extraction mode lists them all.
    const found = [...(error ? [`${title}: ${error}`] : []), ...(problems.length ? [`${title}: ${problems.length} problems to check`] : [])];
    return { problems: found, ok: !!call.parsed && !error };
  },
});

/** Charts drawn as images: grids from the PDF service, then one naming call. */
export const charts = internalAction({
  args: { patternId: v.id("patterns") },
  returns: stageResult,
  handler: async (ctx, { patternId }): Promise<{ problems: string[] }> => {
    const map: DocMap = await ctx.runQuery(internal.pipeline.state.map, { patternId });
    const targets = rasterCharts(map);
    if (!targets.length) return { problems: map.charts.length ? [`${map.charts.length} charts aren't images; only image charts are read so far`] : [] };
    await requireCredits(ctx, patternId);
    const nodes = await ctx.runQuery(internal.pipeline.state.sectionNodes, { patternId });
    const result = await runCharts(await convexSource(ctx, patternId), map, targets, nodes, client());
    await charge(ctx, patternId, result.call, "charts");
    if (!result.call.parsed) return { problems: [`Naming the charts failed (stop reason ${result.call.msg.stop_reason})`] };
    for (const c of result.charts) {
      const file = await ctx.storage.store(new Blob([new Uint8Array(c.grid.image.png)], { type: "image/png" }));
      await ctx.runMutation(internal.pipeline.state.saveChart, {
        patternId,
        row: {
          chartId: c.chart.id,
          chart: c.chart,
          naming: c.naming,
          notes: result.notes,
          image: { file, page: c.page, cropBox: c.grid.image.cropBox },
          gridBox: c.grid.gridBox,
          unassignedCells: c.unassignedCells,
          stitchCounts: c.stitchCounts,
          model: result.call.model,
          usage: result.call.usage,
        },
      });
    }
    return {
      problems: [
        ...result.missing.map((id) => `chart ${id}: not named`),
        ...result.charts.filter((c) => c.unassignedCells).map((c) => `chart ${c.chart.id}: ${c.unassignedCells} cells without a symbol`),
        ...result.charts.flatMap((c) => c.stitchCounts.problems.map((p) => `chart ${c.chart.id}: ${p}`)),
      ],
    };
  },
});

export const glossary = internalAction({
  args: { patternId: v.id("patterns") },
  returns: stageResult,
  handler: async (ctx, { patternId }): Promise<{ problems: string[] }> => {
    await requireCredits(ctx, patternId);
    const map: DocMap = await ctx.runQuery(internal.pipeline.state.map, { patternId });
    const { call } = await runGlossary(await convexSource(ctx, patternId), map, client());
    await charge(ctx, patternId, call, "glossary");
    if (!call.parsed) return { problems: ["The glossary couldn't be read"] };
    await ctx.runMutation(internal.pipeline.state.saveGlossary, { patternId, row: { glossary: call.parsed, model: call.model, usage: call.usage } });
    return { problems: [] };
  },
});
