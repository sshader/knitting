import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findPattern, requirePattern } from "./access";
import { sectionExtraction, usage } from "./validators";

const MAX_SECTIONS = 200;

/** A pattern's stage 2 results, one per extracted section (in no particular order; the map has the order). */
export const forPattern = query({
  args: { pattern: v.string() },
  handler: async (ctx, { pattern }) => {
    const p = await findPattern(ctx, pattern);
    if (!p) return [];
    return await ctx.db
      .query("sections")
      .withIndex("by_patternId_and_sectionId", (q) => q.eq("patternId", p._id))
      .take(MAX_SECTIONS);
  },
});

export const save = mutation({
  args: {
    pattern: v.string(),
    sectionId: v.string(),
    extraction: v.optional(sectionExtraction),
    problems: v.array(v.string()),
    error: v.optional(v.string()),
    model: v.string(),
    seconds: v.number(),
    usage,
  },
  handler: async (ctx, { pattern, ...row }) => {
    const p = await requirePattern(ctx, pattern);
    const existing = await ctx.db
      .query("sections")
      .withIndex("by_patternId_and_sectionId", (q) => q.eq("patternId", p._id).eq("sectionId", row.sectionId))
      .unique();
    if (existing) await ctx.db.replace("sections", existing._id, { patternId: p._id, ...row });
    else await ctx.db.insert("sections", { patternId: p._id, ...row });
  },
});
