import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { sectionTrees } from "../../src/extract/snapshot";
import { expandPattern } from "../../src/shared/expand";

/**
 * The checks after the last stage: whatever the earlier stages' own checks
 * found, can the pattern be knitted? Expands it for the first size and the
 * default options and looks for steps and sections that didn't come out.
 */
export async function smokeCheck(ctx: QueryCtx, patternId: Id<"patterns">): Promise<string[]> {
  const map = (
    await ctx.db
      .query("maps")
      .withIndex("by_patternId_and_mode", (q) => q.eq("patternId", patternId).eq("mode", "text"))
      .unique()
  )?.map;
  if (!map) return ["no map"];
  const sections = await ctx.db
    .query("sections")
    .withIndex("by_patternId_and_sectionId", (q) => q.eq("patternId", patternId))
    .take(500);
  const charts = await ctx.db
    .query("charts")
    .withIndex("by_patternId_and_chartId", (q) => q.eq("patternId", patternId))
    .take(100);

  const problems: string[] = [];
  const failed = map.sections.filter((s) => !sections.find((r) => r.sectionId === s.id)?.extraction);
  if (failed.length) problems.push(`${failed.length} of ${map.sections.length} sections didn't extract: ${failed.map((s) => s.title).join(", ")}`);
  const steps = expandPattern({
    sections: sectionTrees(map, Object.fromEntries(sections.map((r) => [r.sectionId, r.extraction]))),
    charts: Object.fromEntries(charts.map((c) => [c.chartId, c.chart])),
    size: 0,
    choices: map.options.map((o) => o.choices[0]),
  });
  if (steps.length === 0) problems.push("the pattern expands to no steps");
  return problems;
}
