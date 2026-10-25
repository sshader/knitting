import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  chart,
  chartNaming,
  doc,
  docMap,
  glossary,
  mapMode,
  mapReview,
  pageTriage,
  position,
  runState,
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

  /** Who uploaded each stored file, so a save can only attach your own files. */
  uploads: defineTable({
    ownerId: v.id("users"),
    file: v.id("_storage"),
  }).index("by_file", ["file"]),

  patterns: defineTable({
    ownerId: v.id("users"),
    /** The pattern's name in data/raw and on the command line: "lucky-stars-beanie-v5". */
    slug: v.string(),
    /** The name to show, for patterns uploaded in the app (else the map's title, or the slug). */
    title: v.optional(v.string()),
    docs: v.array(doc),
    /** The docs' sha256s, in order: the same PDFs uploaded again reuse this pattern's results. */
    pdfKey: v.optional(v.string()),
    run: v.optional(runState),
    mapReview: v.optional(mapReview),
    sectionsReview: v.optional(sectionsReview),
  })
    .index("by_ownerId_and_slug", ["ownerId", "slug"])
    .index("by_pdfKey", ["pdfKey"]),

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
    /** The page's text as the model reads it (see src/pipeline/mapInput.ts), saved when the page is preprocessed in Convex. */
    markdown: v.optional(v.string()),
    triageReview: v.optional(triageReview),
  })
    .index("by_patternId_and_page", ["patternId", "page"])
    // Copied patterns share files; these find whether a file is still in use before deleting it.
    .index("by_json", ["json"])
    .index("by_png", ["png"]),

  /** Rendered page regions for the model (thumbnails, chart crops), so re-runs don't render them again. */
  crops: defineTable({
    patternId: v.id("patterns"),
    /** Page, box, and size: see convex/pipeline/convexSource.ts. */
    key: v.string(),
    file: v.id("_storage"),
  }).index("by_patternId_and_key", ["patternId", "key"]),

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
  })
    .index("by_patternId_and_chartId", ["patternId", "chartId"])
    .index("by_image", ["image.file"]),

  /** What each user can spend on extraction, in micro-dollars (millionths of a dollar) of actual model cost. */
  credits: defineTable({
    userId: v.id("users"),
    balance: v.number(),
  }).index("by_userId", ["userId"]),

  /** Every grant, revocation, and charge, so a balance can always be explained. */
  creditLedger: defineTable({
    userId: v.id("users"),
    /** Micro-dollars: positive for grants, negative for charges and revocations. */
    amount: v.number(),
    reason: v.string(),
    patternId: v.optional(v.id("patterns")),
  }).index("by_userId", ["userId"]),

  /** Abbreviations and techniques, one row per pattern. */
  glossaries: defineTable({
    patternId: v.id("patterns"),
    glossary,
    model: v.string(),
    usage,
  }).index("by_patternId", ["patternId"]),

  /** One knit of a pattern: the size and options chosen, and where the knitter is. */
  projects: defineTable({
    ownerId: v.id("users"),
    patternId: v.id("patterns"),
    name: v.string(),
    size: v.number(),
    choices: v.array(v.string()),
    position,
    lastWorkedAt: v.number(),
  }).index("by_ownerId_and_lastWorkedAt", ["ownerId", "lastWorkedAt"]),

  /** Row and stitch counters the knitter adds, on a step's instruction (`node`) or the whole project (null). */
  counters: defineTable({
    projectId: v.id("projects"),
    node: v.union(v.string(), v.null()),
    label: v.string(),
    count: v.number(),
  }).index("by_projectId", ["projectId"]),

  /** The knitter's notes: one per instruction (`node`), and one for the whole project (null). */
  notes: defineTable({
    projectId: v.id("projects"),
    node: v.union(v.string(), v.null()),
    text: v.string(),
  }).index("by_projectId_and_node", ["projectId", "node"]),
});
