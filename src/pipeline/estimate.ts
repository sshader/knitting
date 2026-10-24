import type { DocMap } from "../extract/docMap";
import { attemptCostMicros } from "../extract/pricing";
import { SECTION_MODEL, type Usage } from "./llm";
import { rasterCharts } from "./chartsStage";

/**
 * What the rest of a run will cost once the map is made, in micro-dollars:
 * a rough figure for deciding whether to go ahead. Each section call reads
 * the whole pattern from the prompt cache (written once, by the first) and
 * writes its rows; the output is most of the cost.
 */

/** Output tokens per section call (rows plus thinking), from past runs. */
const SECTION_OUTPUT = 4000;
const GLOSSARY = 30_000;
const CHARTS_BASE = 50_000;
const PER_CHART = 30_000;

/** Tokens in the prefix every section call shares: the pattern (about what the map read) plus the map itself. */
const contextTokens = (map: DocMap, mapUsage: Usage) => mapUsage.inputTokens + Math.round(JSON.stringify(map).length / 3);

export function estimateRest(map: DocMap, mapUsage: Usage, sections: DocMap["sections"]): number {
  const context = contextTokens(map, mapUsage);
  const perSection = attemptCostMicros(SECTION_MODEL, { input_tokens: 0, cache_read_input_tokens: context, output_tokens: SECTION_OUTPUT });
  const cacheWrite = attemptCostMicros(SECTION_MODEL, { input_tokens: 0, cache_creation_input_tokens: context, output_tokens: 0 });
  const charts = rasterCharts(map).length;
  const chartCost = charts ? CHARTS_BASE + charts * PER_CHART : 0;
  return cacheWrite + sections.length * perSection + chartCost + GLOSSARY;
}
