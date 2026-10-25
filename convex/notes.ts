import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireProject } from "./access";

const MAX_NOTES = 500;
const MAX_LENGTH = 20_000;

/** All of a project's notes; the knit view picks out the current step's and the project's own. */
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProject(ctx, projectId);
    return await ctx.db
      .query("notes")
      .withIndex("by_projectId_and_node", (q) => q.eq("projectId", projectId))
      .take(MAX_NOTES);
  },
});

/** Write the note for an instruction (or the project, with a null node); an empty note is deleted. */
export const save = mutation({
  args: { projectId: v.id("projects"), node: v.union(v.string(), v.null()), text: v.string() },
  handler: async (ctx, { projectId, node, text }) => {
    await requireProject(ctx, projectId);
    if (text.length > MAX_LENGTH) throw new Error(`Notes can be at most ${MAX_LENGTH} characters`);
    const note = await ctx.db
      .query("notes")
      .withIndex("by_projectId_and_node", (q) => q.eq("projectId", projectId).eq("node", node))
      .unique();
    if (!text.trim()) {
      if (note) await ctx.db.delete("notes", note._id);
    } else if (note) {
      await ctx.db.patch("notes", note._id, { text });
    } else {
      await ctx.db.insert("notes", { projectId, node, text });
    }
  },
});
