import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { findPattern, requirePattern } from "./access";
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

export const save = mutation({
  args: {
    pattern: v.string(),
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
  },
  handler: async (ctx, { pattern, ...row }) => {
    const p = await requirePattern(ctx, pattern);
    const existing = await ctx.db
      .query("charts")
      .withIndex("by_patternId_and_chartId", (q) => q.eq("patternId", p._id).eq("chartId", row.chartId))
      .unique();
    if (!existing) {
      await ctx.db.insert("charts", { patternId: p._id, ...row });
      return;
    }
    if (existing.image.file !== row.image.file) await ctx.storage.delete(existing.image.file);
    await ctx.db.replace("charts", existing._id, { patternId: p._id, ...row });
  },
});
