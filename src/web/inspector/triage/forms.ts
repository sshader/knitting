import type { ExpectedForm, TriagePageExpectation } from "../../../extract/triageFixture";
import { mismatches } from "../../../extract/triageFixture";
import type { PageRow } from "../shared/types";

export const FORMS: ExpectedForm[] = ["vector", "font", "writtenColor", "raster"];

/** How a page's triage compares with its review: card class and badge. */
export function reviewStatus(p: PageRow, review?: TriagePageExpectation) {
  if (!review) return { cls: "unreviewed", label: "" };
  return mismatches(p.triage, review).length ? { cls: "wrong", label: "✗" } : { cls: "ok", label: "✓" };
}
