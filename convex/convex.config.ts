import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({
  env: {
    /** Comma-separated emails that may sign up and sign in. Required, so a new deployment isn't open to anyone. */
    ALLOWED_EMAILS: v.string(),
  },
});
