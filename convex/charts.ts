import { getAuthUserId } from "@convex-dev/auth/server";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { findPattern, requirePattern } from "./access";
import { deleteIfUnused, requireUpload } from "./files";
import { chart, chartNaming, stitchCountCheck, usage } from "./validators";

const MAX_PATTERNS = 200;
const MAX_CHARTS = 100;

async function chartsOf(ctx: QueryCtx, pattern: Doc<"patterns">) {
  const charts = await ctx.db
    .query("charts")
    .withIndex("by_patternId_and_chartId", (q) => q.eq("patternId", pattern._id))
    .take(MAX_CHARTS);
  return await Promise.all(charts.map(async (c) => ({ ...c, pattern: pattern.slug, imageUrl: (await ctx.storage.getUrl(c.image.file))! })));
}

export type ChartRow = Awaited<ReturnType<typeof chartsOf>>[number];

export const forPattern = query({
  args: { pattern: v.string() },
  handler: async (ctx, { pattern }) => {
    const p = await findPattern(ctx, pattern);
    return p ? await chartsOf(ctx, p) : [];
  },
});

/** Every chart of every pattern, for the charts inspector. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const patterns = await ctx.db
      .query("patterns")
      .withIndex("by_ownerId_and_slug", (q) => q.eq("ownerId", userId))
      .take(MAX_PATTERNS);
    return (await Promise.all(patterns.map((p) => chartsOf(ctx, p)))).flat();
  },
});

export const chartRow = v.object({
  chartId: v.string(),
  chart,
  naming: chartNaming,
  notes: v.array(v.string()),
  image: v.object({ file: v.id("_storage"), page: v.number(), cropBox: v.array(v.number()) }),
  gridBox: v.array(v.number()),
  unassignedCells: v.number(),
  stitchCounts: stitchCountCheck,
  model: v.string(),
  usage,
});

/** Saves one chart, replacing any earlier one; a replaced image is deleted unless another pattern shares it. */
export async function writeChart(ctx: MutationCtx, patternId: Id<"patterns">, row: Infer<typeof chartRow>) {
  const existing = await ctx.db
    .query("charts")
    .withIndex("by_patternId_and_chartId", (q) => q.eq("patternId", patternId).eq("chartId", row.chartId))
    .unique();
  if (!existing) {
    await ctx.db.insert("charts", { patternId, ...row });
    return;
  }
  await ctx.db.replace("charts", existing._id, { patternId, ...row });
  if (existing.image.file !== row.image.file) await deleteIfUnused(ctx, existing.image.file);
}

/** From the scripts: the image must be the caller's upload. */
export const save = mutation({
  args: { pattern: v.string(), ...chartRow.fields },
  handler: async (ctx, { pattern, ...row }) => {
    const p = await requirePattern(ctx, pattern);
    const existing = await ctx.db
      .query("charts")
      .withIndex("by_patternId_and_chartId", (q) => q.eq("patternId", p._id).eq("chartId", row.chartId))
      .unique();
    if (existing?.image.file !== row.image.file) await requireUpload(ctx, p.ownerId, row.image.file);
    await writeChart(ctx, p._id, row);
  },
});
