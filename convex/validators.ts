import { zodToConvex } from "convex-helpers/server/zod4";
import { v } from "convex/values";
import { ChartNaming } from "../src/extract/chartSchema";
import { DocMap } from "../src/extract/docMap";
import { Glossary } from "../src/extract/glossarySchema";
import { MapFixture, SectionsFixture } from "../src/extract/mapFixture";
import { SectionExtraction } from "../src/extract/sectionSchema";
import { PageTriage } from "../src/extract/triage";
import { TriagePageExpectation } from "../src/extract/triageFixture";
import { Chart } from "../src/shared/schema";

/**
 * Validators for what the pipeline stores. Each stage's output is defined
 * once, as the zod schema the pipeline already uses, and converted here.
 */

export const pageTriage = zodToConvex(PageTriage);
export const docMap = zodToConvex(DocMap);
export const sectionExtraction = zodToConvex(SectionExtraction);
export const chart = zodToConvex(Chart);
export const glossary = zodToConvex(Glossary);
/** The model's naming of one chart's cell types. */
export const chartNaming = zodToConvex(ChartNaming.shape.charts.element);

export const triageReview = zodToConvex(TriagePageExpectation);
export const mapReview = zodToConvex(MapFixture);
export const sectionsReview = zodToConvex(SectionsFixture);

export const mapMode = v.union(v.literal("text"), v.literal("pages"));

/** Token counts of the LLM call that produced a result. */
export const usage = v.object({
  inputTokens: v.number(),
  outputTokens: v.number(),
  cacheReadTokens: v.number(),
  cacheWriteTokens: v.number(),
});

export const doc = v.object({
  doc: v.string(),
  /** Source PDF filename. */
  source: v.string(),
  pageCount: v.number(),
  /** Global page number of this document's first page. */
  firstPage: v.number(),
});

/** Chart checks against the sections' stated stitch counts (see chartChecks.ts). */
export const stitchCountCheck = v.object({
  checkpoints: v.array(
    v.object({ node: v.string(), row: v.number(), size: v.number(), stated: v.number(), perRepeat: v.number(), repeats: v.number() }),
  ),
  problems: v.array(v.string()),
});

/**
 * Where a knitter is in a project: the current step (an index into the
 * expanded steps) and the node it came from, so the place can be found again
 * if a re-extraction shifts step numbers.
 */
export const position = v.object({
  step: v.number(),
  node: v.string(),
  /** In an open-ended repeat ("until it measures 30 cm"): how many times the block has been worked before this pass. */
  pass: v.optional(v.number()),
  /** Within a chart row: the run being worked, and which time through the row's repeat. */
  mark: v.optional(v.object({ run: v.number(), repeat: v.number() })),
});
