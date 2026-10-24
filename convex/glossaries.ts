import { v, type Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
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

export const glossaryRow = v.object({ glossary, model: v.string(), usage });

export async function writeGlossary(ctx: MutationCtx, patternId: Id<"patterns">, row: Infer<typeof glossaryRow>) {
  const existing = await ctx.db
    .query("glossaries")
    .withIndex("by_patternId", (q) => q.eq("patternId", patternId))
    .unique();
  if (existing) await ctx.db.replace("glossaries", existing._id, { patternId, ...row });
  else await ctx.db.insert("glossaries", { patternId, ...row });
}

export const save = mutation({
  args: { pattern: v.string(), ...glossaryRow.fields },
  handler: async (ctx, { pattern, ...row }) => writeGlossary(ctx, (await requirePattern(ctx, pattern))._id, row),
});
