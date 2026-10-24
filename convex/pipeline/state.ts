import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { chartRow, writeChart } from "../charts";
import { adjust, balanceOf } from "../credits";
import { deleteIfUnused } from "../files";
import { glossaryRow, writeGlossary } from "../glossaries";
import { mapRow, writeMap } from "../maps";
import { sectionRow, writeSection } from "../sections";
import { doc, pageTriage, runOffer } from "../validators";
import { smokeCheck } from "./checks";

/**
 * What the pipeline's steps read and write. Steps run in the background
 * with no signed-in user, so these are internal and take the pattern's id;
 * whoever started the run was checked when it started (see start.ts).
 */

const MAX_PAGES = 1000;

export const pattern = internalQuery({
  args: { patternId: v.id("patterns") },
  handler: async (ctx, { patternId }) => {
    const p = await ctx.db.get("patterns", patternId);
    if (!p) throw new Error("pattern is gone");
    return p;
  },
});

export const pages = internalQuery({
  args: { patternId: v.id("patterns") },
  handler: async (ctx, { patternId }) =>
    await ctx.db
      .query("pages")
      .withIndex("by_patternId_and_page", (q) => q.eq("patternId", patternId))
      .take(MAX_PAGES),
});

export const map = internalQuery({
  args: { patternId: v.id("patterns") },
  handler: async (ctx, { patternId }) => {
    const row = await ctx.db
      .query("maps")
      .withIndex("by_patternId_and_mode", (q) => q.eq("patternId", patternId).eq("mode", "text"))
      .unique();
    if (!row) throw new Error("no map yet");
    return row.map;
  },
});

export const sectionNodes = internalQuery({
  args: { patternId: v.id("patterns") },
  handler: async (ctx, { patternId }) => {
    const rows = await ctx.db
      .query("sections")
      .withIndex("by_patternId_and_sectionId", (q) => q.eq("patternId", patternId))
      .take(MAX_PAGES);
    return rows.flatMap((r) => r.extraction?.nodes ?? []);
  },
});

export const crop = internalQuery({
  args: { patternId: v.id("patterns"), key: v.string() },
  handler: async (ctx, { patternId, key }) => {
    const row = await ctx.db
      .query("crops")
      .withIndex("by_patternId_and_key", (q) => q.eq("patternId", patternId).eq("key", key))
      .unique();
    return row?.file ?? null;
  },
});

export const saveCrop = internalMutation({
  args: { patternId: v.id("patterns"), key: v.string(), file: v.id("_storage") },
  handler: async (ctx, row) => {
    await ctx.db.insert("crops", row);
  },
});

export const savePage = internalMutation({
  args: {
    patternId: v.id("patterns"),
    page: v.number(),
    doc: v.string(),
    docPage: v.number(),
    json: v.id("_storage"),
    png: v.id("_storage"),
    triage: pageTriage,
    markdown: v.string(),
  },
  handler: async (ctx, row) => {
    await ctx.db.insert("pages", row);
  },
});

/** Removes a pattern's pages (and their files, unless shared), so preprocessing can start over cleanly. */
export const clearPages = internalMutation({
  args: { patternId: v.id("patterns") },
  handler: async (ctx, { patternId }) => {
    const rows = await ctx.db
      .query("pages")
      .withIndex("by_patternId_and_page", (q) => q.eq("patternId", patternId))
      .take(MAX_PAGES);
    for (const r of rows) {
      await ctx.db.delete("pages", r._id);
      await deleteIfUnused(ctx, r.json);
      await deleteIfUnused(ctx, r.png);
    }
  },
});

/** The docs' page counts and numbering, known once they're preprocessed. */
export const setDocs = internalMutation({
  args: { patternId: v.id("patterns"), docs: v.array(doc) },
  handler: async (ctx, { patternId, docs }) => {
    await ctx.db.patch("patterns", patternId, { docs });
  },
});

export const saveMap = internalMutation({
  args: { patternId: v.id("patterns"), row: mapRow },
  handler: async (ctx, { patternId, row }) => writeMap(ctx, patternId, row),
});

export const saveSection = internalMutation({
  args: { patternId: v.id("patterns"), row: sectionRow },
  handler: async (ctx, { patternId, row }) => writeSection(ctx, patternId, row),
});

export const saveChart = internalMutation({
  args: { patternId: v.id("patterns"), row: chartRow },
  handler: async (ctx, { patternId, row }) => writeChart(ctx, patternId, row),
});

export const saveGlossary = internalMutation({
  args: { patternId: v.id("patterns"), row: glossaryRow },
  handler: async (ctx, { patternId, row }) => writeGlossary(ctx, patternId, row),
});

/** The pattern owner's credit balance, in micro-dollars. */
export const balance = internalQuery({
  args: { patternId: v.id("patterns") },
  handler: async (ctx, { patternId }) => {
    const p = await ctx.db.get("patterns", patternId);
    return p ? await balanceOf(ctx, p.ownerId) : 0;
  },
});

/** Charges the owner for a model call, and adds it to the run's cost. */
export const charge = internalMutation({
  args: { patternId: v.id("patterns"), micros: v.number(), reason: v.string() },
  handler: async (ctx, { patternId, micros, reason }) => {
    const p = await ctx.db.get("patterns", patternId);
    if (!p?.run) throw new Error("no run to charge");
    await adjust(ctx, p.ownerId, -micros, reason, patternId);
    await ctx.db.patch("patterns", patternId, { run: { ...p.run, cost: p.run.cost + micros } });
  },
});

type Run = NonNullable<Doc<"patterns">["run"]>;

async function patchRun(ctx: MutationCtx, patternId: Id<"patterns">, change: (run: Run) => Partial<Run>) {
  const run = (await ctx.db.get("patterns", patternId))?.run;
  if (run) await ctx.db.patch("patterns", patternId, { run: { ...run, ...change(run) } });
}

/** The stage now running; problems the last stage's checks found are added. */
export const setStage = internalMutation({
  args: { patternId: v.id("patterns"), stage: v.string(), problems: v.optional(v.array(v.string())) },
  handler: async (ctx, { patternId, stage, problems }) =>
    patchRun(ctx, patternId, (run) => ({ stage, problems: [...run.problems, ...(problems ?? [])] })),
});

/** The last check: can the pattern be knitted? Then the run is "ready", or "review" if any check found something. */
export const finish = internalMutation({
  args: { patternId: v.id("patterns") },
  handler: async (ctx, { patternId }) => {
    const problems = await smokeCheck(ctx, patternId, (await ctx.db.get("patterns", patternId))?.run?.size);
    await patchRun(ctx, patternId, (run) => {
      const all = [...run.problems, ...problems];
      return { stage: "done", problems: all, status: all.length ? "review" : "ready" };
    });
  },
});

/** Above this, a run waits for the owner to accept the estimate before extracting sections. */
const CONFIRM_ABOVE = 1_000_000;

/**
 * After the map: what the rest would cost. The run waits for the owner when
 * there's a size to choose, the estimate is over CONFIRM_ABOVE, or it's more
 * than they have; returns whether it waits. The map's problems are recorded
 * here when it does, since the sections stage starts later.
 */
export const offer = internalMutation({
  args: { patternId: v.id("patterns"), offer: runOffer, problems: v.array(v.string()) },
  handler: async (ctx, { patternId, offer, problems }) => {
    const p = await ctx.db.get("patterns", patternId);
    if (!p) throw new Error("pattern is gone");
    const balance = await balanceOf(ctx, p.ownerId);
    const wait = offer.sizes.length > 0 || offer.estimate > CONFIRM_ABOVE || offer.estimate > balance;
    if (wait) await patchRun(ctx, patternId, (run) => ({ status: "waiting", stage: "offer", offer, problems: [...run.problems, ...problems] }));
    return wait;
  },
});

export const OUT_OF_CREDITS = "Out of credits";
export const CANCELED = "Canceled";

/** The run stopped: out of credits (resumable once topped up), canceled by the owner, or failed. */
export const stop = internalMutation({
  args: { patternId: v.id("patterns"), error: v.string() },
  handler: async (ctx, { patternId, error }) =>
    patchRun(ctx, patternId, () =>
      error === CANCELED
        ? { status: "canceled", error: undefined, offer: undefined }
        : { status: error.includes(OUT_OF_CREDITS) ? "outOfCredits" : "failed", error, offer: undefined },
    ),
});
