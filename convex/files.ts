import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction, internalMutation, type MutationCtx } from "./_generated/server";

/**
 * Uploads from the pipeline scripts: POST /upload with the file as the body
 * and the signed-in user's token as a bearer token. The file is stored and
 * recorded as theirs in one go; saves then check the files they attach.
 */
export const upload = httpAction(async (ctx, req) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) return new Response("Not signed in", { status: 401 });
  const file = await ctx.storage.store(await req.blob());
  await ctx.runMutation(internal.files.record, { ownerId: userId, file });
  return Response.json({ storageId: file });
});

export const record = internalMutation({
  args: { ownerId: v.id("users"), file: v.id("_storage") },
  handler: async (ctx, row) => {
    await ctx.db.insert("uploads", row);
  },
});

/** Throws unless `userId` uploaded `file`. */
export async function requireUpload(ctx: MutationCtx, userId: Id<"users">, file: Id<"_storage">) {
  const upload = await ctx.db
    .query("uploads")
    .withIndex("by_file", (q) => q.eq("file", file))
    .unique();
  if (upload?.ownerId !== userId) throw new Error("That file isn't one of your uploads");
}

/** Deletes a stored file and its upload record. */
export async function deleteFile(ctx: MutationCtx, file: Id<"_storage">) {
  const upload = await ctx.db
    .query("uploads")
    .withIndex("by_file", (q) => q.eq("file", file))
    .unique();
  if (upload) await ctx.db.delete("uploads", upload._id);
  await ctx.storage.delete(file);
}
