import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireProject } from "./access";

const MAX_COUNTERS = 200;

/** All of a project's counters, oldest first; the knit view picks out the current step's. */
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProject(ctx, projectId);
    return await ctx.db
      .query("counters")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(MAX_COUNTERS);
  },
});

export const add = mutation({
  args: { projectId: v.id("projects"), node: v.union(v.string(), v.null()), label: v.string() },
  handler: async (ctx, { projectId, node, label }) => {
    await requireProject(ctx, projectId);
    const existing = await ctx.db
      .query("counters")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(MAX_COUNTERS);
    if (existing.length >= MAX_COUNTERS) throw new Error(`A project can have at most ${MAX_COUNTERS} counters`);
    return await ctx.db.insert("counters", { projectId, node, label: label.trim().slice(0, 100), count: 0 });
  },
});

/** Count up or down by `by` (never below zero). */
export const bump = mutation({
  args: { counterId: v.id("counters"), by: v.number() },
  handler: async (ctx, { counterId, by }) => {
    const counter = await requireCounter(ctx, counterId);
    await ctx.db.patch("counters", counterId, { count: Math.max(0, counter.count + by) });
  },
});

export const update = mutation({
  args: { counterId: v.id("counters"), label: v.optional(v.string()), count: v.optional(v.number()) },
  handler: async (ctx, { counterId, label, count }) => {
    await requireCounter(ctx, counterId);
    await ctx.db.patch("counters", counterId, {
      ...(label !== undefined && { label: label.trim().slice(0, 100) }),
      ...(count !== undefined && { count: Math.max(0, Math.round(count)) }),
    });
  },
});

export const remove = mutation({
  args: { counterId: v.id("counters") },
  handler: async (ctx, { counterId }) => {
    await requireCounter(ctx, counterId);
    await ctx.db.delete("counters", counterId);
  },
});

async function requireCounter(ctx: MutationCtx, counterId: Id<"counters">): Promise<Doc<"counters">> {
  const counter = await ctx.db.get("counters", counterId);
  if (!counter) throw new Error("Counter not found");
  await requireProject(ctx, counter.projectId);
  return counter;
}
