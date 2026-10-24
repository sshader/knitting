import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findPattern, requirePattern, requireUser } from "./access";
import { requireUpload } from "./files";
import { doc, mapReview, sectionsReview } from "./validators";

const MAX_PATTERNS = 200;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const patterns = await ctx.db
      .query("patterns")
      .withIndex("by_ownerId_and_slug", (q) => q.eq("ownerId", userId))
      .take(MAX_PATTERNS);
    return await Promise.all(
      patterns.map(async (p) => {
        const map = await ctx.db
          .query("maps")
          .withIndex("by_patternId_and_mode", (q) => q.eq("patternId", p._id).eq("mode", "text"))
          .unique();
        return { slug: p.slug, name: p.title ?? map?.map.title ?? p.slug, docs: p.docs, run: p.run };
      }),
    );
  },
});

export const get = query({
  args: { pattern: v.string() },
  handler: async (ctx, { pattern }) => await findPattern(ctx, pattern),
});

/** Creates the pattern on first upload; afterwards keeps its documents current. */
export const ensure = mutation({
  args: { pattern: v.string(), docs: v.array(doc) },
  handler: async (ctx, { pattern, docs }) => {
    const ownerId = await requireUser(ctx);
    const existing = await findPattern(ctx, pattern);
    if (existing) {
      await ctx.db.patch("patterns", existing._id, { docs });
      return existing._id;
    }
    return await ctx.db.insert("patterns", { ownerId, slug: pattern, docs });
  },
});

export const setMapReview = mutation({
  args: { pattern: v.string(), review: mapReview },
  handler: async (ctx, { pattern, review }) => {
    const p = await requirePattern(ctx, pattern);
    await ctx.db.patch("patterns", p._id, { mapReview: review });
  },
});

export const setSectionsReview = mutation({
  args: { pattern: v.string(), review: sectionsReview },
  handler: async (ctx, { pattern, review }) => {
    const p = await requirePattern(ctx, pattern);
    await ctx.db.patch("patterns", p._id, { sectionsReview: review });
  },
});

/**
 * Attaches the original PDFs to a pattern preprocessed on the command line,
 * so it can be re-run in the app (scripts/upload-pdfs.ts). One file per
 * document, in order; each must be the caller's upload.
 */
export const attachPdfs = mutation({
  args: { pattern: v.string(), pdfs: v.array(v.id("_storage")) },
  handler: async (ctx, { pattern, pdfs }) => {
    const p = await requirePattern(ctx, pattern);
    if (pdfs.length !== p.docs.length) throw new Error(`${pattern} has ${p.docs.length} documents`);
    const docs = [];
    for (const [i, d] of p.docs.entries()) {
      await requireUpload(ctx, p.ownerId, pdfs[i]);
      const meta = await ctx.db.system.get("_storage", pdfs[i]);
      docs.push({ ...d, pdf: pdfs[i], sha256: meta!.sha256 });
    }
    // Only a finished extraction can be reused by a later upload of the same PDFs.
    const extracted = !!(await ctx.db
      .query("sections")
      .withIndex("by_patternId_and_sectionId", (q) => q.eq("patternId", p._id))
      .first());
    const run = extracted ? (p.run ?? { status: "ready" as const, stage: "done", problems: [], cost: 0 }) : undefined;
    await ctx.db.patch("patterns", p._id, { docs, pdfKey: docs.map((d) => d.sha256).join(","), run });
  },
});
