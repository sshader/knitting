import workflow from "@convex-dev/workflow/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    /** What a new user must enter to sign up. Required, so a new deployment isn't open to anyone. */
    INVITE_CODE: v.string(),
    /** Most accounts the deployment will create (default 10), so a leaked code can't run up usage unnoticed. */
    MAX_USERS: v.optional(v.string()),
    /** The hosted PDF service (pdf_service/), and the token it expects. */
    PDF_SERVICE_URL: v.optional(v.string()),
    PDF_SERVICE_TOKEN: v.optional(v.string()),
    ANTHROPIC_API_KEY: v.optional(v.string()),
  },
});

// Durable multi-step jobs: the extraction pipeline (convex/pipeline/workflow.ts).
app.use(workflow);

export default app;
