import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requirePattern, requireUser } from "../access";
import { balanceOf } from "../credits";
import { requireUpload } from "../files";
import type { doc } from "../validators";
import { copyResults } from "./copy";
import { workflow } from "./workflow";

/**
 * Starting an extraction from the app: upload a pattern's PDFs, or re-run
 * one. The same PDFs extracted before (by anyone) are copied instead, at no
 * cost; otherwise the run needs credits and is charged as it goes.
 */

const MAX_PATTERNS = 500;

function newRun(): NonNullable<Doc<"patterns">["run"]> {
  return { status: "running", stage: "starting", problems: [], cost: 0 };
}

async function startWorkflow(ctx: MutationCtx, patternId: Id<"patterns">, preprocess: boolean) {
  await workflow.start(ctx, internal.pipeline.workflow.extract, { patternId, preprocess }, { onComplete: internal.pipeline.workflow.done, context: { patternId } });
}

/** "Lucky Stars Beanie V5.pdf" -> "lucky-stars-beanie-v5", made unique among the owner's patterns. */
async function uniqueSlug(ctx: MutationCtx, ownerId: Id<"users">, name: string) {
  const base =
    name
      .replace(/\.pdf$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pattern";
  const taken = new Set(
    (
      await ctx.db
        .query("patterns")
        .withIndex("by_ownerId_and_slug", (q) => q.eq("ownerId", ownerId))
        .take(MAX_PATTERNS)
    ).map((p) => p.slug),
  );
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!taken.has(slug)) return slug;
  }
}

/**
 * A pattern from uploaded PDFs (in order, for patterns that ship the charts
 * separately). Each file must have been uploaded and claimed by the caller.
 */
export const importPattern = mutation({
  args: { files: v.array(v.object({ file: v.id("_storage"), name: v.string() })), title: v.optional(v.string()) },
  handler: async (ctx, { files, title }) => {
    const ownerId = await requireUser(ctx);
    if (!files.length) throw new Error("Choose at least one PDF");
    const docs: Infer<typeof doc>[] = [];
    for (const [i, f] of files.entries()) {
      await requireUpload(ctx, ownerId, f.file);
      const meta = await ctx.db.system.get("_storage", f.file);
      if (!meta) throw new Error(`${f.name} didn't upload`);
      docs.push({ doc: `doc-${i + 1}`, source: f.name, pageCount: 0, firstPage: 0, pdf: f.file, sha256: meta.sha256 });
    }
    const pdfKey = docs.map((d) => d.sha256).join(",");

    // Already have it? Then that's the pattern.
    const same = await ctx.db
      .query("patterns")
      .withIndex("by_pdfKey", (q) => q.eq("pdfKey", pdfKey))
      .take(MAX_PATTERNS);
    const mine = same.find((p) => p.ownerId === ownerId);
    if (mine) return { slug: mine.slug, copied: false };

    const slug = await uniqueSlug(ctx, ownerId, title ?? files[0].name);
    const donor = same.find((p) => p.run?.status === "ready" || p.run?.status === "review");
    if (donor) {
      // Copied results keep the donor's page numbering and documents, with this user's uploads.
      const patternId = await ctx.db.insert("patterns", {
        ownerId,
        slug,
        title,
        docs: donor.docs.map((d, i) => ({ ...d, pdf: docs[i].pdf })),
        pdfKey,
        run: { ...newRun(), status: donor.run!.status, stage: "done", problems: donor.run!.problems, copiedFrom: donor._id },
      });
      await copyResults(ctx, donor._id, patternId);
      return { slug, copied: true };
    }

    if ((await balanceOf(ctx, ownerId)) <= 0) throw new Error("You're out of credits for extracting new patterns");
    const patternId = await ctx.db.insert("patterns", { ownerId, slug, title, docs, pdfKey, run: newRun() });
    await startWorkflow(ctx, patternId, true);
    return { slug, copied: false };
  },
});

/** Extract an existing pattern again (its pages stay; everything after is redone). */
export const rerun = mutation({
  args: { pattern: v.string() },
  handler: async (ctx, { pattern }) => {
    const p = await requirePattern(ctx, pattern);
    if (p.run?.status === "running") throw new Error("Already running");
    if ((await balanceOf(ctx, p.ownerId)) <= 0) throw new Error("You're out of credits");
    const hasPages = !!(await ctx.db
      .query("pages")
      .withIndex("by_patternId_and_page", (q) => q.eq("patternId", p._id))
      .first());
    await ctx.db.patch("patterns", p._id, { run: newRun() });
    await startWorkflow(ctx, p._id, !hasPages);
  },
});
