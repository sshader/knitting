import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const MAX_ROWS = 1000;

/**
 * Copies a finished extraction to another pattern: pages, map, sections,
 * charts, glossary, and crops. Stored files are shared, not duplicated;
 * deletes check whether a file is still in use (files.ts).
 */
export async function copyResults(ctx: MutationCtx, from: Id<"patterns">, to: Id<"patterns">) {
  for (const p of await ctx.db.query("pages").withIndex("by_patternId_and_page", (q) => q.eq("patternId", from)).take(MAX_ROWS)) {
    const { _id, _creationTime, triageReview: _review, ...row } = p;
    await ctx.db.insert("pages", { ...row, patternId: to });
  }
  for (const m of await ctx.db.query("maps").withIndex("by_patternId_and_mode", (q) => q.eq("patternId", from)).take(MAX_ROWS)) {
    const { _id, _creationTime, ...row } = m;
    await ctx.db.insert("maps", { ...row, patternId: to });
  }
  for (const s of await ctx.db.query("sections").withIndex("by_patternId_and_sectionId", (q) => q.eq("patternId", from)).take(MAX_ROWS)) {
    const { _id, _creationTime, ...row } = s;
    await ctx.db.insert("sections", { ...row, patternId: to });
  }
  for (const c of await ctx.db.query("charts").withIndex("by_patternId_and_chartId", (q) => q.eq("patternId", from)).take(MAX_ROWS)) {
    const { _id, _creationTime, ...row } = c;
    await ctx.db.insert("charts", { ...row, patternId: to });
  }
  for (const c of await ctx.db.query("crops").withIndex("by_patternId_and_key", (q) => q.eq("patternId", from)).take(MAX_ROWS)) {
    const { _id, _creationTime, ...row } = c;
    await ctx.db.insert("crops", { ...row, patternId: to });
  }
  const glossary = await ctx.db.query("glossaries").withIndex("by_patternId", (q) => q.eq("patternId", from)).unique();
  if (glossary) {
    const { _id, _creationTime, ...row } = glossary;
    await ctx.db.insert("glossaries", { ...row, patternId: to });
  }
}
