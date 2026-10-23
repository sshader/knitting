import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  chart,
  chartNaming,
  doc,
  docMap,
  mapMode,
  mapReview,
  pageTriage,
  sectionExtraction,
  sectionsReview,
  stitchCountCheck,
  triageReview,
  usage,
} from "./validators";

/**
 * One row per pattern, plus a row per page and per stage output. The
 * pipeline scripts write stage outputs; the inspector writes reviews, which
 * live apart from the outputs so re-running a stage keeps them.
 */
export default defineSchema({
  ...authTables,

  patterns: defineTable({
    ownerId: v.id("users"),
    /** The pattern's name in data/raw and on the command line: "lucky-stars-beanie-v5". */
    slug: v.string(),
    docs: v.array(doc),
    mapReview: v.optional(mapReview),
    sectionsReview: v.optional(sectionsReview),
  }).index("by_ownerId_and_slug", ["ownerId", "slug"]),

  /** Stage 0, and the preprocessed page files every later stage and the inspector read. */
  pages: defineTable({
    patternId: v.id("patterns"),
    /** Global page number across the pattern's documents. */
    page: v.number(),
    doc: v.string(),
    docPage: v.number(),
    /** PageData (scripts/extract_pdf.py output); too big for a document. */
    json: v.id("_storage"),
    png: v.id("_storage"),
    triage: pageTriage,
    triageReview: v.optional(triageReview),
  }).index("by_patternId_and_page", ["patternId", "page"]),

  /** Stage 1. */
  maps: defineTable({
    patternId: v.id("patterns"),
    mode: mapMode,
    map: docMap,
    problems: v.array(v.string()),
    model: v.string(),
    usage,
  }).index("by_patternId_and_mode", ["patternId", "mode"]),

  /** Stage 2, one row per map section. */
  sections: defineTable({
    patternId: v.id("patterns"),
    sectionId: v.string(),
    /** Missing when the call failed; see `error`. */
    extraction: v.optional(sectionExtraction),
    problems: v.array(v.string()),
    error: v.optional(v.string()),
    model: v.string(),
    seconds: v.number(),
    usage,
  }).index("by_patternId_and_sectionId", ["patternId", "sectionId"]),

  /** Stage 3, one row per chart. */
  charts: defineTable({
    patternId: v.id("patterns"),
    chartId: v.string(),
    chart,
    naming: chartNaming,
    /** The naming call's notes, shared by all the pattern's charts. */
    notes: v.array(v.string()),
    /** The chart image cropped from the PDF, and where the grid sits in it (page coordinates). */
    image: v.object({ file: v.id("_storage"), page: v.number(), cropBox: v.array(v.number()) }),
    gridBox: v.array(v.number()),
    unassignedCells: v.number(),
    stitchCounts: stitchCountCheck,
    model: v.string(),
    usage,
  }).index("by_patternId_and_chartId", ["patternId", "chartId"]),
});
