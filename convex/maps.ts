import { getAuthUserId } from "@convex-dev/auth/server";
import { v, type Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { findPattern, requirePattern } from "./access";
import { docMap, mapMode, usage } from "./validators";

const MAX_PATTERNS = 200;

export const get = query({
  args: { pattern: v.string(), mode: mapMode },
  handler: async (ctx, { pattern, mode }) => {
    const p = await findPattern(ctx, pattern);
    if (!p) return null;
    return await ctx.db
      .query("maps")
      .withIndex("by_patternId_and_mode", (q) => q.eq("patternId", p._id).eq("mode", mode))
      .unique();
  },
});

/** One line per map for the inspector's pattern lists. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const patterns = await ctx.db
      .query("patterns")
      .withIndex("by_ownerId_and_slug", (q) => q.eq("ownerId", userId))
      .take(MAX_PATTERNS);
    const rows = await Promise.all(
      patterns.map(async (p) => {
        const maps = await ctx.db
          .query("maps")
          .withIndex("by_patternId_and_mode", (q) => q.eq("patternId", p._id))
          .take(2);
        const extracted = (await ctx.db
          .query("sections")
          .withIndex("by_patternId_and_sectionId", (q) => q.eq("patternId", p._id))
          .first()) !== null;
        return maps.map((m) => ({
          pattern: p.slug,
          mode: m.mode,
          title: m.map.title,
          sections: m.map.sections.length,
          charts: m.map.charts.length,
          problems: m.problems.length,
          inputTokens: m.usage.inputTokens,
          /** Whether stage 2 has run, so there are steps to knit. */
          extracted,
        }));
      }),
    );
    return rows.flat();
  },
});

export const mapRow = v.object({ mode: mapMode, map: docMap, problems: v.array(v.string()), model: v.string(), usage });

/** Saves a pattern's map, replacing the one for that mode. */
export async function writeMap(ctx: MutationCtx, patternId: Id<"patterns">, row: Infer<typeof mapRow>) {
  const existing = await ctx.db
    .query("maps")
    .withIndex("by_patternId_and_mode", (q) => q.eq("patternId", patternId).eq("mode", row.mode))
    .unique();
  if (existing) await ctx.db.replace("maps", existing._id, { patternId, ...row });
  else await ctx.db.insert("maps", { patternId, ...row });
}

export const save = mutation({
  args: { pattern: v.string(), ...mapRow.fields },
  handler: async (ctx, { pattern, ...row }) => writeMap(ctx, (await requirePattern(ctx, pattern))._id, row),
});
