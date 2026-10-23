import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({
  env: {
    /** What a new user must enter to sign up. Required, so a new deployment isn't open to anyone. */
    INVITE_CODE: v.string(),
    /** Most accounts the deployment will create (default 10), so a leaked code can't run up usage unnoticed. */
    MAX_USERS: v.optional(v.string()),
  },
});
