import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePattern, requireProject } from "./access";
import { position } from "./validators";

const MAX_PROJECTS = 100;

/** The signed-in user's projects, most recently worked on first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId_and_lastWorkedAt", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(MAX_PROJECTS);
    return await Promise.all(projects.map(async (p) => ({ ...p, pattern: (await ctx.db.get("patterns", p.patternId))!.slug })));
  },
});

/** A project with its pattern's slug; null if it's gone, someone else's, or not a project id (a mangled link). */
export const get = query({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const projectId = ctx.db.normalizeId("projects", args.projectId);
    const project = projectId && (await ctx.db.get("projects", projectId));
    if (!project || project.ownerId !== userId) return null;
    return { ...project, pattern: (await ctx.db.get("patterns", project.patternId))!.slug };
  },
});

export const start = mutation({
  args: { pattern: v.string(), name: v.string(), size: v.number(), choices: v.array(v.string()) },
  handler: async (ctx, { pattern, ...setup }) => {
    const p = await requirePattern(ctx, pattern);
    return await ctx.db.insert("projects", {
      ownerId: p.ownerId,
      patternId: p._id,
      ...setup,
      position: { step: 0, node: "" },
      lastWorkedAt: Date.now(),
    });
  },
});

export const moveTo = mutation({
  args: { projectId: v.id("projects"), position },
  handler: async (ctx, { projectId, position }) => {
    await requireProject(ctx, projectId);
    await ctx.db.patch("projects", projectId, { position, lastWorkedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProject(ctx, projectId);
    // A project has at most a few hundred of each (see counters.ts and notes.ts).
    for await (const c of ctx.db.query("counters").withIndex("by_projectId", (q) => q.eq("projectId", projectId))) await ctx.db.delete("counters", c._id);
    for await (const n of ctx.db.query("notes").withIndex("by_projectId_and_node", (q) => q.eq("projectId", projectId))) await ctx.db.delete("notes", n._id);
    await ctx.db.delete("projects", projectId);
  },
});
