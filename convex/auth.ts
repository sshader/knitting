import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { env } from "./_generated/server";

/** Whether an email is on the deployment's ALLOWED_EMAILS list. */
const isAllowed = (email: string) =>
  env.ALLOWED_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email);

/**
 * Email + password, so the pipeline scripts can sign in as the same user as
 * the app. Only invited emails (ALLOWED_EMAILS) can sign up or sign in.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "")
          .trim()
          .toLowerCase();
        if (!isAllowed(email)) throw new ConvexError("This email hasn't been invited.");
        return { email };
      },
    }),
  ],
});
