import { z } from "zod";

/**
 * Pattern schema. A Pattern is the reviewed, canonical form of a PDF and is
 * never mutated while knitting; per-knit state lives on Project (see project.ts).
 *
 * Size-dependent values: patterns list numbers like "108 (112) 116 (120)".
 * - Numbers use `Sized`: a single value for all sizes, or one per size
 *   (index-aligned with `Pattern.sizes`).
 * - Free text uses inline alternatives: "Cast on {108|112|116|120} sts".
 *   A `{...}` group must have exactly one alternative per size.
 */

export const Sized = <T extends z.ZodType>(t: T) => z.union([t, z.array(t)]);
export type Sized<T> = T | T[];

/** Size indices a node applies to ("Size S only"). Omitted = all sizes. */
const Sizes = z.array(z.number().int().nonnegative()).optional();

/** Where in the PDF something came from. bbox is normalized to 0-1 page coords. */
export const SourceRef = z.object({
  page: z.number().int().positive(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  /** Exact source text; used to locate bbox via the PDF text layer. */
  quote: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

const Base = {
  id: z.string(),
  sizes: Sizes,
  /** Option choices a node applies to ("Bracelet", "Tank"); omitted = always. See `Pattern.options`. */
  choices: z.array(z.string()).optional(),
  source: z.array(SourceRef).optional(),
};

/**
 * One chart worked in a row. Charts often come in a version per size, so this
 * is an id or one id per size ("" for sizes without one). A row can work
 * several charts side by side (panels; sleeve and body charts), hence lists.
 */
const ChartRef = Sized(z.string());

/** One instruction worked for `rows` consecutive rows/rounds ("Knit 3 rounds"). */
export const Row = z.object({
  ...Base,
  kind: z.literal("row"),
  /** As printed: "Rnd 5", "Short row 3", "Row 1 (RS)". */
  label: z.string().optional(),
  side: z.enum(["RS", "WS"]).optional(),
  text: z.string(),
  /** Number of rows this instruction covers. Default 1. */
  rows: Sized(z.number().int().positive()).optional(),
  /** Stitch count after this row, if the pattern states it. */
  stitchCount: Sized(z.number().int().nonnegative()).optional(),
  /** Rows from `fromRow` onward in a chart, one chart row per worked row. */
  /**
   * The charts worked on this row and the chart row it corresponds to.
   * fromRow omitted = continue the charts from where they left off ("work 13
   * rounds as set"); the expander tracks the current chart row.
   */
  chart: z.object({ charts: z.array(ChartRef).min(1), fromRow: Sized(z.number().int().positive()).optional() }).optional(),
});

/** Non-row information at a point in the sequence: "Switch to 3.5 mm needle". */
export const Note = z.object({
  ...Base,
  kind: z.literal("note"),
  text: z.string(),
});

/** "Work all rounds in chart B" / "Work rows 1-12 of chart". Expands to one row per chart row. */
export const ChartWork = z.object({
  ...Base,
  kind: z.literal("chart"),
  charts: z.array(ChartRef).min(1),
  fromRow: Sized(z.number().int().positive()).optional(),
  toRow: Sized(z.number().int().positive()).optional(),
  text: z.string().optional(),
});

/**
 * Something that happens on a schedule while a Repeat is being worked
 * ("AT THE SAME TIME decrease on rnd 50 and every 12th rnd, 3 times").
 * Row numbers count from 1 at the start of the enclosing Repeat.
 */
export const Overlay = z.object({
  id: z.string(),
  text: z.string(),
  first: Sized(z.number().int().positive()),
  every: Sized(z.number().int().positive()).optional(),
  count: Sized(z.number().int().positive()).optional(),
  source: z.array(SourceRef).optional(),
});
export type Overlay = z.infer<typeof Overlay>;

const RepeatFields = z.object({
  ...Base,
  kind: z.literal("repeat"),
  label: z.string().optional(),
  /** Fixed repeat count; omit when `until` drives it. */
  times: Sized(z.number().int().positive()).optional(),
  /** Open-ended condition: "until piece measures 30 cm from cast-on". */
  until: z.string().optional(),
  overlays: z.array(Overlay).optional(),
});

const SectionFields = z.object({
  ...Base,
  kind: z.literal("section"),
  title: z.string(),
  /** "Make 2" for sleeves etc. */
  times: Sized(z.number().int().positive()).optional(),
});

// Recursive types are written out by hand; zod can't infer through the cycle.
export type Row = z.infer<typeof Row>;
export type Note = z.infer<typeof Note>;
export type ChartWork = z.infer<typeof ChartWork>;
export type Repeat = z.infer<typeof RepeatFields> & { children: Node[] };
export type Section = z.infer<typeof SectionFields> & { children: Node[] };
export type Node = Row | Note | ChartWork | Repeat | Section;

export const Repeat: z.ZodType<Repeat> = RepeatFields.extend({ children: z.array(z.lazy(() => Node)) });
export const Section: z.ZodType<Section> = SectionFields.extend({ children: z.array(z.lazy(() => Node)) });
export const Node: z.ZodType<Node> = z.union([Row, Note, ChartWork, Repeat, Section]);

/**
 * Charts are stored as strings, one char per cell, so they stay small and
 * hand-editable. `cells[0]` is chart row 1 (the bottom row), read left to right
 * as drawn. Each char is a key into `legend`; " " means no stitch.
 */
export const Chart = z.object({
  id: z.string(),
  title: z.string(),
  sizes: Sizes,
  width: z.number().int().positive(),
  cells: z.array(z.string()),
  legend: z.record(
    z.string().length(1),
    z.object({
      label: z.string(),
      color: z.string().optional(),
      /** Glossary abbreviation this symbol means, e.g. "M1BL". */
      abbrev: z.string().optional(),
      /** Cells covered by one symbol (cables). Default 1. */
      span: z.number().int().positive().optional(),
    }),
  ),
  /** "rtl" = every row right to left (in the round); "alternate" = RS rtl, WS ltr (flat). */
  readDirection: z.enum(["rtl", "alternate"]),
  /** Pattern repeat, as 1-based inclusive column range. */
  repeat: z.object({ fromCol: z.number().int(), toCol: z.number().int() }).optional(),
  /** Row number of cells[0] if the chart doesn't start at 1 (multi-page charts). */
  firstRow: z.number().int().positive().optional(),
  source: z.array(SourceRef).optional(),
});
export type Chart = z.infer<typeof Chart>;

export const Pattern = z.object({
  id: z.string(),
  title: z.string(),
  designer: z.string().optional(),
  sizes: z.array(z.string()).min(1),
  /** Non-size choices the knitter makes, e.g. { name: "Sleeve length", choices: ["Bracelet", "Full"] }. */
  options: z.array(z.object({ name: z.string(), choices: z.array(z.string()) })).optional(),
  construction: z.string().optional(),
  gauge: z.string().optional(),
  needles: z.array(z.string()).optional(),
  yarn: z.array(z.string()).optional(),
  glossary: z.array(z.object({ abbrev: z.string(), meaning: z.string() })),
  techniques: z.array(z.object({ name: z.string(), text: z.string(), source: z.array(SourceRef).optional() })).optional(),
  charts: z.array(Chart),
  sections: z.array(Section),
  sourcePdf: z.object({ filename: z.string(), pageCount: z.number().int() }),
});
export type Pattern = z.infer<typeof Pattern>;
