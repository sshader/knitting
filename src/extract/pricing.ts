/**
 * What an LLM call costs, in micro-dollars (millionths of a dollar), so
 * credits can be charged at cost. Prices are $ per million tokens, which is
 * the same number as micro-dollars per token.
 *
 * Source: Anthropic's published rates (Claude API reference, 2026-10). Cache
 * writes cost 1.25x input for the 5-minute TTL and 2x for the 1-hour TTL; cache
 * reads 0.1x input except where the reference gives a rate (Opus 5.5, Sonnet
 * 5.5, Fable 5.1). Only models the pipeline uses or falls back to are listed.
 */

interface Rates {
  input: number;
  output: number;
  cacheRead: number;
}

const RATES: Record<string, Rates> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
};
/** A model missing from the table (a fallback we didn't expect) is priced at the top rate rather than undercharged. */
const UNKNOWN = RATES["claude-fable-5-1"];

/** One attempt's token counts, as the API reports them (top-level usage or a usage.iterations entry). */
export interface AttemptUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens: number; ephemeral_1h_input_tokens: number } | null;
}

export function attemptCostMicros(model: string, u: AttemptUsage): number {
  const r = RATES[model] ?? UNKNOWN;
  const writes5m = u.cache_creation?.ephemeral_5m_input_tokens ?? u.cache_creation_input_tokens ?? 0;
  const writes1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const cost =
    u.input_tokens * r.input + u.output_tokens * r.output + (u.cache_read_input_tokens ?? 0) * r.cacheRead + writes5m * r.input * 1.25 + writes1h * r.input * 2;
  return Math.ceil(cost);
}

/**
 * The whole call: every attempt in usage.iterations (a refused attempt and the
 * fallback that answered, each at its own model's rates), or the top-level
 * usage when there are no iterations.
 */
export function callCostMicros(
  requestModel: string,
  usage: AttemptUsage & { iterations?: ({ model?: string | null } & AttemptUsage)[] | null },
): number {
  if (usage.iterations?.length) return usage.iterations.reduce((sum, it) => sum + attemptCostMicros(it.model ?? requestModel, it), 0);
  return attemptCostMicros(requestModel, usage);
}

export const dollars = (micros: number) => `$${(micros / 1e6).toFixed(2)}`;
