import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findPattern, requirePattern, requireUser } from "./access";
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
    return patterns.map((p) => ({ slug: p.slug, docs: p.docs }));
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
