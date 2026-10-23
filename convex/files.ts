import { mutation } from "./_generated/server";
import { requireUser } from "./access";

/** For the pipeline scripts: where to POST a file (page data, renders, chart crops) before saving its id. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
