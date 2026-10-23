import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { findPattern, requirePage, requirePattern } from "./access";
import { deleteFile, requireUpload } from "./files";
import { pageTriage, triageReview } from "./validators";

const MAX_PAGES = 500;

async function pagesOf(ctx: QueryCtx, pattern: Doc<"patterns">) {
  return await ctx.db
    .query("pages")
    .withIndex("by_patternId_and_page", (q) => q.eq("patternId", pattern._id))
    .take(MAX_PAGES);
}

/** Every page of a pattern with URLs for its files, in page order. */
export const forPattern = query({
  args: { pattern: v.string() },
  handler: async (ctx, { pattern }) => {
    const p = await findPattern(ctx, pattern);
    if (!p) return [];
    return await Promise.all(
      (await pagesOf(ctx, p)).map(async (page) => ({
        ...page,
        jsonUrl: (await ctx.storage.getUrl(page.json))!,
        pngUrl: (await ctx.storage.getUrl(page.png))!,
      })),
    );
  },
});

/**
 * Saves a page's triage. Files are uploaded only when the page is new or its
 * preprocessing changed; replaced files are deleted.
 */
export const save = mutation({
  args: {
    pattern: v.string(),
    page: v.number(),
    doc: v.string(),
    docPage: v.number(),
    triage: pageTriage,
    files: v.optional(v.object({ json: v.id("_storage"), png: v.id("_storage") })),
  },
  handler: async (ctx, { pattern, files, ...page }) => {
    const p = await requirePattern(ctx, pattern);
    if (files) for (const f of [files.json, files.png]) await requireUpload(ctx, p.ownerId, f);
    const existing = await ctx.db
      .query("pages")
      .withIndex("by_patternId_and_page", (q) => q.eq("patternId", p._id).eq("page", page.page))
      .unique();
    if (!existing) {
      if (!files) throw new Error(`page ${page.page} is new; upload its files`);
      await ctx.db.insert("pages", { patternId: p._id, ...page, ...files });
      return;
    }
    if (files) {
      await deleteFile(ctx, existing.json);
      await deleteFile(ctx, existing.png);
    }
    await ctx.db.patch("pages", existing._id, { ...page, ...files });
  },
});

/** Page numbers that already have files, so a re-run can skip uploading them. */
export const uploaded = query({
  args: { pattern: v.string() },
  handler: async (ctx, { pattern }) => {
    const p = await findPattern(ctx, pattern);
    return p ? (await pagesOf(ctx, p)).map((page) => page.page) : [];
  },
});

export const setTriageReview = mutation({
  args: { pageId: v.id("pages"), review: v.union(triageReview, v.null()) },
  handler: async (ctx, { pageId, review }) => {
    await requirePage(ctx, pageId);
    await ctx.db.patch("pages", pageId, { triageReview: review ?? undefined });
  },
});
