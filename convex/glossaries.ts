import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findPattern, requirePattern } from "./access";
import { glossary, usage } from "./validators";

/** The pattern's glossary, or null if it hasn't been extracted. */
export const get = query({
  args: { pattern: v.string() },
  handler: async (ctx, { pattern }) => {
    const p = await findPattern(ctx, pattern);
    if (!p) return null;
    return await ctx.db
      .query("glossaries")
      .withIndex("by_patternId", (q) => q.eq("patternId", p._id))
      .unique();
  },
});

export const save = mutation({
  args: { pattern: v.string(), glossary, model: v.string(), usage },
  handler: async (ctx, { pattern, ...row }) => {
    const p = await requirePattern(ctx, pattern);
    const existing = await ctx.db
      .query("glossaries")
      .withIndex("by_patternId", (q) => q.eq("patternId", p._id))
      .unique();
    if (existing) await ctx.db.replace("glossaries", existing._id, { patternId: p._id, ...row });
    else await ctx.db.insert("glossaries", { patternId: p._id, ...row });
  },
});
