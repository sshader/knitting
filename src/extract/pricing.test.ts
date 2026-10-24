import { expect, test } from "vitest";
import { callCostMicros } from "./pricing";

const usage = { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 2_000_000, cache_creation_input_tokens: 0 };

test("prices input, output, and cache reads at the model's rates", () => {
  // $4 + $2 + $0.40
  expect(callCostMicros("claude-opus-5-5", usage)).toBe(6_400_000);
});

test("cache writes cost 1.25x input (5 minutes) or 2x (1 hour)", () => {
  const writes = { input_tokens: 0, output_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 1_000_000, ephemeral_1h_input_tokens: 1_000_000 } };
  expect(callCostMicros("claude-opus-5-5", writes)).toBe(5_000_000 + 8_000_000);
});

test("each attempt is priced at its own model, so a fallback costs what it cost", () => {
  const refused = { type: "message", model: null, input_tokens: 1_000_000, output_tokens: 0 };
  const fallback = { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 1_000_000, output_tokens: 0 };
  expect(callCostMicros("claude-opus-5-5", { ...usage, iterations: [refused, fallback] })).toBe(4_000_000 + 5_000_000);
});
