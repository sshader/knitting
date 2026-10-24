import { invalidateSessions, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { userByEmail } from "./credits";
import { smokeCheck } from "./pipeline/checks";

/**
 * Operator tools, run from the CLI (`npx convex run [--prod] admin:<name> '{...}'`);
 * internal, so no client can call them.
 */

/** Sets a user's password and signs them out everywhere, e.g. after the old one leaked. */
export const setPassword = internalAction({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    if (password.length < 8) throw new Error("Use at least 8 characters");
    await modifyAccountCredentials(ctx, { provider: "password", account: { id: email, secret: password } });
    const { user } = await retrieveAccount(ctx, { provider: "password", account: { id: email, secret: password } });
    await invalidateSessions(ctx, { userId: user._id });
    return null;
  },
});

/**
 * For a pattern written out per size whose sections were extracted before
 * maps recorded sizes: says which sizes each section is for, and that `size`
 * is the one extracted. The final checks then run as at the end of a run.
 */
export const markSizeExtracted = internalMutation({
  args: { email: v.string(), pattern: v.string(), size: v.number(), sections: v.array(v.object({ id: v.string(), sizes: v.array(v.number()) })) },
  handler: async (ctx, { email, pattern, size, sections }) => {
    const user = await userByEmail(ctx, email);
    const p = await ctx.db
      .query("patterns")
      .withIndex("by_ownerId_and_slug", (q) => q.eq("ownerId", user._id).eq("slug", pattern))
      .unique();
    if (!p?.run) throw new Error(`${email} has no extracted pattern ${pattern}`);
    if (p.run.status === "running" || p.run.status === "waiting") throw new Error("Stop the run first");
    const row = await ctx.db
      .query("maps")
      .withIndex("by_patternId_and_mode", (q) => q.eq("patternId", p._id).eq("mode", "text"))
      .unique();
    if (!row) throw new Error("no map");
    const sizes = new Map(sections.map((s) => [s.id, s.sizes]));
    const missing = row.map.sections.filter((s) => !sizes.has(s.id)).map((s) => s.id);
    if (missing.length) throw new Error(`no sizes given for ${missing.join(", ")}`);
    await ctx.db.patch("maps", row._id, { map: { ...row.map, sections: row.map.sections.map((s) => ({ ...s, sizes: sizes.get(s.id) })) } });
    const problems = await smokeCheck(ctx, p._id, size);
    await ctx.db.patch("patterns", p._id, {
      run: { ...p.run, status: problems.length ? "review" : "ready", stage: "done", size, problems, error: undefined, offer: undefined },
    });
    return problems;
  },
});
