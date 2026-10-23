import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { env } from "./_generated/server";

const maxUsers = () => Number(env.MAX_USERS ?? 10);

/**
 * Email + password, so the pipeline scripts can sign in as the same user as
 * the app. Signing up needs the deployment's INVITE_CODE, and stops at
 * MAX_USERS accounts.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        if (params.flow === "signUp" && params.inviteCode !== env.INVITE_CODE) throw new ConvexError("That invite code isn't right.");
        return { email: String(params.email ?? "").trim().toLowerCase() };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (existingUserId) return existingUserId;
      const users = await ctx.db.query("users").take(maxUsers());
      if (users.length >= maxUsers()) throw new ConvexError("This app isn't taking new accounts right now.");
      return await ctx.db.insert("users", { email: profile.email });
    },
  },
});
