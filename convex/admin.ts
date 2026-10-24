import { invalidateSessions, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

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
