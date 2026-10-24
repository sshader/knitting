import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

/**
 * Extraction is paid for with credits held in micro-dollars of actual model
 * cost: each LLM call is charged what it cost, as it finishes. You grant and
 * revoke credits from the CLI:
 *
 *   npx convex run --prod credits:grant '{"email": "friend@example.com", "dollars": 5}'
 *   npx convex run --prod credits:revoke '{"email": "friend@example.com"}'
 */

const MICROS = 1_000_000;

export async function balanceOf(ctx: QueryCtx, userId: Id<"users">): Promise<number> {
  const row = await ctx.db
    .query("credits")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  return row?.balance ?? 0;
}

/** Adds `amount` micro-dollars (negative to take away) and records why. */
export async function adjust(ctx: MutationCtx, userId: Id<"users">, amount: number, reason: string, patternId?: Id<"patterns">) {
  const row = await ctx.db
    .query("credits")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (row) await ctx.db.patch("credits", row._id, { balance: row.balance + amount });
  else await ctx.db.insert("credits", { userId, balance: amount });
  await ctx.db.insert("creditLedger", { userId, amount, reason, patternId });
}

export async function userByEmail(ctx: QueryCtx, email: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email.trim().toLowerCase()))
    .unique();
  if (!user) throw new Error(`No user with email ${email}`);
  return user;
}

/** The signed-in user's balance in dollars, for the settings menu. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId ? (await balanceOf(ctx, userId)) / MICROS : null;
  },
});

export const grant = internalMutation({
  args: { email: v.string(), dollars: v.number(), note: v.optional(v.string()) },
  handler: async (ctx, { email, dollars, note }) => {
    if (dollars <= 0) throw new Error("Grant a positive amount");
    const user = await userByEmail(ctx, email);
    await adjust(ctx, user._id, Math.round(dollars * MICROS), note ?? "granted");
    return (await balanceOf(ctx, user._id)) / MICROS;
  },
});

/** Takes away `dollars`, or the whole balance if omitted. */
export const revoke = internalMutation({
  args: { email: v.string(), dollars: v.optional(v.number()), note: v.optional(v.string()) },
  handler: async (ctx, { email, dollars, note }) => {
    const user = await userByEmail(ctx, email);
    const balance = await balanceOf(ctx, user._id);
    const amount = dollars === undefined ? balance : Math.min(balance, Math.round(dollars * MICROS));
    if (amount > 0) await adjust(ctx, user._id, -amount, note ?? "revoked");
    return (await balanceOf(ctx, user._id)) / MICROS;
  },
});
