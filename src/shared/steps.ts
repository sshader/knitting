/**
 * One step of the knitting sequence: a single row or round as the knitter
 * works it, for one size and set of options. Steps come from expanding a
 * pattern's sections and filling in chart rows.
 */
export interface Step {
  section: { id: string; title: string };
  /** Section node the step comes from. */
  node: string;
  /** As the knitter would call it: "Round 3", "Row 12 (WS)". */
  label: string;
  /** Position within a node covering several rows: step 2 of 47 in "Rounds 2-48". */
  of?: { index: number; count: number; label: string };
  /** The section's instruction for this size. */
  instruction: string;
  /** The chart row worked on this step, when there is one. */
  chart?: {
    chartId: string;
    row: number;
    /** Generated from the chart: "*k2 cc, m1 cc, ...*, repeat 12 times". */
    text: string;
    /** Stitches one pass of the chart row produces. */
    perRepeat: number;
    /** Times the chart row is worked across the round, when it repeats. */
    repeats?: number;
    /** The pattern's own written version of this row, if it has one. */
    written?: string;
    writtenMatches?: boolean;
  };
  /** Stitch count before and after, when the step changes it or the pattern states it. */
  stitches?: { before?: number; after: number };
  /** Notes to show alongside (e.g. how to work a decrease round). */
  related?: { title: string; text: string }[];
  source: { page: number; quote: string }[];
}

export interface StepsFixture {
  pattern: string;
  size: number;
  /** Hand-written expected steps, for previewing the format before the expander exists. */
  steps: Step[];
}
