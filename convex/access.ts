import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Every pattern belongs to the user who uploaded it, and everything else
 * hangs off a pattern, so access checks come down to these.
 */

export async function requireUser(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  return userId;
}

/** The signed-in user's pattern by slug, or null (also when signed out, so queries render empty). */
export async function findPattern(ctx: QueryCtx, slug: string): Promise<Doc<"patterns"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return await ctx.db
    .query("patterns")
    .withIndex("by_ownerId_and_slug", (q) => q.eq("ownerId", userId).eq("slug", slug))
    .unique();
}

export async function requirePattern(ctx: QueryCtx, slug: string): Promise<Doc<"patterns">> {
  const pattern = await findPattern(ctx, slug);
  if (!pattern) throw new Error(`No pattern "${slug}"; run scripts/triage.ts ${slug} first`);
  return pattern;
}

/** A page, checking it belongs to one of the signed-in user's patterns. */
export async function requirePage(ctx: MutationCtx, pageId: Id<"pages">): Promise<Doc<"pages">> {
  const userId = await requireUser(ctx);
  const page = await ctx.db.get("pages", pageId);
  const pattern = page && (await ctx.db.get("patterns", page.patternId));
  if (!page || pattern?.ownerId !== userId) throw new Error("Page not found");
  return page;
}

/** A project, checking it belongs to the signed-in user. */
export async function requireProject(ctx: QueryCtx, projectId: Id<"projects">): Promise<Doc<"projects">> {
  const userId = await requireUser(ctx);
  const project = await ctx.db.get("projects", projectId);
  if (!project || project.ownerId !== userId) throw new Error("Project not found");
  return project;
}
