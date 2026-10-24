import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { callCostMicros } from "../extract/pricing";

/**
 * The one way the pipeline calls the model: streamed, adaptive thinking,
 * structured output, and the API's server-side refusal fallbacks (a refused
 * request is retried on another model inside the same call). Reports what
 * the call cost, every attempt at its own model's rates.
 */

export const MODEL = "claude-opus-5-5";

export interface Call<T> {
  /** The parsed result, or null if the model didn't finish (see msg.stop_reason). */
  parsed: T | null;
  msg: Anthropic.Beta.BetaMessage;
  seconds: number;
  /** Micro-dollars. */
  cost: number;
  usage: Usage;
}

/** Token counts as stored with each result. */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export async function structured<S extends z.ZodType>(
  client: Anthropic,
  format: S,
  req: { system: string; content: Anthropic.Beta.BetaContentBlockParam[]; effort: "low" | "medium" | "high"; maxTokens: number },
): Promise<Call<z.infer<S>>> {
  const t0 = Date.now();
  const msg = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: req.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: req.effort, format: betaZodOutputFormat(format) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: req.system,
      messages: [{ role: "user", content: req.content }],
    })
    .finalMessage();
  const parsed = msg.stop_reason === "end_turn" ? ((msg.parsed_output as z.infer<S> | null) ?? null) : null;
  return { parsed, msg, seconds: Math.round((Date.now() - t0) / 1000), cost: callCostMicros(MODEL, msg.usage), usage: usageOf(msg.usage) };
}

export function usageOf(u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): Usage {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  };
}

/** A PNG as an image block for the model. */
export const pngBlock = (bytes: Uint8Array): Anthropic.Beta.BetaImageBlockParam => ({
  type: "image",
  source: { type: "base64", media_type: "image/png", data: Buffer.from(bytes).toString("base64") },
});
