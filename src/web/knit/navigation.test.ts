import { describe, expect, test } from "vitest";
import type { ExpandedStep } from "../../shared/expand";
import { finishRepeat, next, nextMark, prev, prevMark, rowsIntoRepeat, type Mark, type RowLayout } from "./navigation";

const section = { id: "body", title: "Body" };
const step = (node: string, until?: string): ExpandedStep => ({ section, node, label: node, instruction: "", source: [], ...(until ? { until } : {}) });
// Cast on, then rows 3-4 repeated until 30 cm, then bind off.
const steps = [step("co"), step("r3", "until 30 cm"), step("r4", "until 30 cm"), step("bo")];
const at = (i: number, pass?: number) => ({ step: i, node: steps[i].node, ...(pass ? { pass } : {}) });

describe("open-ended repeats", () => {
  test("next at the end of the block loops back and counts a pass", () => {
    expect(next(steps, at(1))).toEqual(at(2));
    expect(next(steps, at(2))).toEqual(at(1, 1));
    expect(next(steps, at(2, 1))).toEqual(at(1, 2));
  });
  test("prev at the start of a later pass goes to the end of the one before", () => {
    expect(prev(steps, at(1, 2))).toEqual(at(2, 1));
    expect(prev(steps, at(1, 1))).toEqual(at(2));
    expect(prev(steps, at(1))).toEqual(at(0));
  });
  test("finishing leaves the block and forgets the passes", () => expect(finishRepeat(steps, at(1, 3))).toEqual(at(3)));
  test("rows so far count every pass", () => {
    expect(rowsIntoRepeat(steps, at(2, 2))).toBe(6);
    expect(rowsIntoRepeat(steps, at(0))).toBeNull();
  });
});

describe("marking a place in a chart row", () => {
  // k2, *k1, p1*, repeat 3 times, k2
  const layout: RowLayout = { before: 1, repeat: 2, after: 1, times: 3 };
  const walk = (from: Mark | undefined, step: typeof nextMark) => {
    const seen: string[] = [];
    for (let m = step(layout, from); m; m = step(layout, m)) seen.push(`${m.run}.${m.repeat}`);
    return seen;
  };
  test("forward through the repeat each time, then the rest of the row", () => {
    expect(walk(undefined, nextMark)).toEqual(["0.0", "1.1", "2.1", "1.2", "2.2", "1.3", "2.3", "3.0"]);
  });
  test("and back again", () => expect(walk({ run: 3, repeat: 0 }, prevMark)).toEqual(["2.3", "1.3", "2.2", "1.2", "2.1", "1.1", "0.0"]));
  test("a row that starts with its repeat starts on the first time through", () => {
    expect(nextMark({ before: 0, repeat: 2, after: 0, times: 2 }, undefined)).toEqual({ run: 0, repeat: 1 });
  });
});
