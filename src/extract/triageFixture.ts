import type { ChartForm, PageTriage } from "./triage";

/**
 * Hand-reviewed expectations for stage 0, saved by the inspector to
 * fixtures/triage/<slug>.json. Only reviewed pages appear.
 */
export type ExpectedForm = ChartForm | "raster";

export interface TriagePageExpectation {
  /** Chart count per form. "raster" = a chart that is an image (stage 0 can't detect these; stage 1 should). */
  charts: Partial<Record<ExpectedForm, number>>;
  sendToLlm: boolean;
  note?: string;
}

export type TriageFixture = Record<string, TriagePageExpectation>;

export function detected(p: PageTriage): TriagePageExpectation {
  const charts: TriagePageExpectation["charts"] = {};
  for (const c of p.charts) charts[c.form] = (charts[c.form] ?? 0) + 1;
  return { charts, sendToLlm: p.sendToLlm };
}

/** Differences stage 0 is responsible for (raster charts are stage 1's job). */
export function mismatches(p: PageTriage, e: TriagePageExpectation): string[] {
  const got = detected(p);
  const out: string[] = [];
  for (const form of ["vector", "font", "writtenColor"] as const) {
    if ((got.charts[form] ?? 0) !== (e.charts[form] ?? 0))
      out.push(`${form}: detected ${got.charts[form] ?? 0}, expected ${e.charts[form] ?? 0}`);
  }
  if (got.sendToLlm !== e.sendToLlm) out.push(`sendToLlm: detected ${got.sendToLlm}, expected ${e.sendToLlm}`);
  return out;
}
