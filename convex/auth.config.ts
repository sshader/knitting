import type { AuthConfig } from "convex/server";

// The CLI reads `process.env` here when pushing; Convex code otherwise has no Node types.
declare const process: { env: Record<string, string | undefined> };

export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
