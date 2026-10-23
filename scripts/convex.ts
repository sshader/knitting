/**
 * The pipeline scripts' connection to Convex. They sign in with the same
 * email and password as the inspector (KNITTING_EMAIL / KNITTING_PASSWORD in
 * .env), so everything they write belongs to that user.
 */
import { ConvexHttpClient } from "convex/browser";
import fs from "node:fs";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}

/** The deployment: CONVEX_URL if set (e.g. production), else the dev one from .env.local. */
const url = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
/** HTTP actions are served from the deployment's .site domain. */
const siteUrl = url?.replace(/\.convex\.cloud$/, ".convex.site");

let token: string | undefined;

export async function connect(flow: "signIn" | "signUp" = "signIn"): Promise<ConvexHttpClient> {
  const email = process.env.KNITTING_EMAIL;
  const password = process.env.KNITTING_PASSWORD;
  if (!url) throw new Error("VITE_CONVEX_URL is not set; run `npx convex dev` once");
  if (!email || !password) throw new Error("Set KNITTING_EMAIL and KNITTING_PASSWORD in .env (the account you use in the inspector)");
  const client = new ConvexHttpClient(url);
  const { tokens } = await client.action(api.auth.signIn, { provider: "password", params: { email, password, flow } });
  if (!tokens) throw new Error(`Couldn't sign in as ${email}`);
  client.setAuth(tokens.token);
  token = tokens.token;
  return client;
}

/** Uploads a local file to Convex storage as the signed-in user (see convex/files.ts). */
export async function upload(_client: ConvexHttpClient, file: string, contentType: string): Promise<Id<"_storage">> {
  if (!token) throw new Error("connect() first");
  const res = await fetch(`${siteUrl}/upload`, {
    method: "POST",
    headers: { "Content-Type": contentType, Authorization: `Bearer ${token}` },
    body: fs.readFileSync(file),
  });
  if (!res.ok) throw new Error(`upload ${file}: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
}

/** Anthropic's usage block, as stored with each result. */
export const usageOf = (u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) => ({
  inputTokens: u.input_tokens,
  outputTokens: u.output_tokens,
  cacheReadTokens: u.cache_read_input_tokens ?? 0,
  cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
});
