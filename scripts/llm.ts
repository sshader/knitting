/**
 * What the LLM stages share: the client, the model, and one structured-output
 * call that streams, times itself, and reports a failed parse as null.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

try {
  process.loadEnvFile(".env");
} catch {}

export const MODEL = "claude-opus-5-5";
export const client = new Anthropic();

export interface Call<T> {
  parsed: T | null;
  msg: Anthropic.Message;
  seconds: number;
}

export async function structured<S extends z.ZodType>(
  format: S,
  req: { system: string; content: Anthropic.ContentBlockParam[]; effort: "low" | "medium" | "high"; maxTokens: number },
): Promise<Call<z.infer<S>>> {
  const t0 = Date.now();
  const msg = await client.messages
    .stream({
      model: MODEL,
      max_tokens: req.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: req.effort, format: zodOutputFormat(format) },
      system: req.system,
      messages: [{ role: "user", content: req.content }],
    })
    .finalMessage();
  const parsed = msg.stop_reason === "end_turn" ? (msg.parsed_output ?? null) : null;
  return { parsed, msg, seconds: Math.round((Date.now() - t0) / 1000) };
}
