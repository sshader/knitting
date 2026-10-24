import { v, type Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
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

export const sectionRow = v.object({
  sectionId: v.string(),
  extraction: v.optional(sectionExtraction),
  problems: v.array(v.string()),
  error: v.optional(v.string()),
  model: v.string(),
  seconds: v.number(),
  usage,
});

/** Saves one section's result, replacing any earlier one. */
export async function writeSection(ctx: MutationCtx, patternId: Id<"patterns">, row: Infer<typeof sectionRow>) {
  const existing = await ctx.db
    .query("sections")
    .withIndex("by_patternId_and_sectionId", (q) => q.eq("patternId", patternId).eq("sectionId", row.sectionId))
    .unique();
  if (existing) await ctx.db.replace("sections", existing._id, { patternId, ...row });
  else await ctx.db.insert("sections", { patternId, ...row });
}

export const save = mutation({
  args: { pattern: v.string(), ...sectionRow.fields },
  handler: async (ctx, { pattern, ...row }) => writeSection(ctx, (await requirePattern(ctx, pattern))._id, row),
});
