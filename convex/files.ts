import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction, internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { requireUser } from "./access";

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

/**
 * For the app: a URL to upload a file (a PDF) straight to storage, with no
 * size limit. Then `claim` it, which records it as the caller's upload.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Records a just-uploaded file as the caller's. Storage ids are only returned to the uploader, so the first claim wins. */
export const claim = mutation({
  args: { file: v.id("_storage") },
  handler: async (ctx, { file }) => {
    const ownerId = await requireUser(ctx);
    const existing = await ctx.db
      .query("uploads")
      .withIndex("by_file", (q) => q.eq("file", file))
      .unique();
    if (existing && existing.ownerId !== ownerId) throw new Error("That file isn't one of your uploads");
    if (!existing) await ctx.db.insert("uploads", { ownerId, file });
  },
});

/**
 * Deletes a stored file and its upload record, unless a page or chart still
 * uses it (patterns copied from an earlier extraction share files). Call it
 * after the row that used it points elsewhere.
 */
export async function deleteIfUnused(ctx: MutationCtx, file: Id<"_storage">) {
  const inUse =
    (await ctx.db.query("pages").withIndex("by_json", (q) => q.eq("json", file)).first()) ||
    (await ctx.db.query("pages").withIndex("by_png", (q) => q.eq("png", file)).first()) ||
    (await ctx.db.query("charts").withIndex("by_image", (q) => q.eq("image.file", file)).first());
  if (inUse) return;
  const upload = await ctx.db
    .query("uploads")
    .withIndex("by_file", (q) => q.eq("file", file))
    .unique();
  if (upload) await ctx.db.delete("uploads", upload._id);
  await ctx.storage.delete(file);
}
