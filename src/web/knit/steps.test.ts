import { describe, expect, test } from "vitest";
import type { ExpandedStep } from "../../shared/expand";
import { chartFocus, groupSteps, resolveStep, stepForChartRow } from "./steps";

const section = { id: "body", title: "Body" };
const step = (node: string, extra: Partial<ExpandedStep> = {}): ExpandedStep => ({ section, node, label: node, instruction: "", source: [], ...extra });
const rounds = (node: string, from: number, to: number, chartId?: string) =>
  Array.from({ length: to - from + 1 }, (_, k) =>
    step(node, {
      label: `Round ${from + k}`,
      of: { index: k + 1, count: to - from + 1, label: `Rounds ${from}-${to}` },
      ...(chartId ? { chart: { chartId, row: from + k, text: "", perRepeat: 1 } } : {}),
    }),
  );

const steps = [step("cast-on"), ...rounds("chart-rounds", 1, 4, "a"), step("dec"), ...rounds("chart-rounds-2", 5, 6, "a")];

describe("resolveStep", () => {
  test("keeps a position that still points at its node", () => expect(resolveStep(steps, { step: 2, node: "chart-rounds" })).toBe(2));
  test("finds the node again when step numbers shifted", () => expect(resolveStep(steps, { step: 0, node: "dec" })).toBe(5));
  test("clamps a position past the end", () => expect(resolveStep(steps, { step: 99, node: "" })).toBe(steps.length - 1));
});

test("groupSteps folds a multi-row instruction into one outline item", () => {
  expect(groupSteps(steps).map((g) => [g.start, g.count, g.label])).toEqual([
    [0, 1, "cast-on"],
    [1, 4, "Rounds 1-4"],
    [5, 1, "dec"],
    [6, 2, "Rounds 5-6"],
  ]);
});

describe("chartFocus", () => {
  test("a chart step shows its own row", () => expect(chartFocus(steps, 2)).toEqual({ chartId: "a", row: 2 }));
  test("a plain step shows the chart coming up", () => expect(chartFocus(steps, 0)).toEqual({ chartId: "a", row: null, upcoming: { step: 1, row: 1 } }));
});

test("stepForChartRow picks the step working that row", () => {
  expect(stepForChartRow(steps, 0, "a", 6)).toBe(7);
  expect(stepForChartRow(steps, 0, "b", 6)).toBeNull();
});
