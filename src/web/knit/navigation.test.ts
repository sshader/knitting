import { describe, expect, test } from "vitest";
import type { ExpandedStep } from "../../shared/expand";
import { finishRepeat, next, nextMark, prev, prevMark, type Mark, type Place, type RowLayout } from "./navigation";

const section = { id: "body", title: "Body" };
const step = (node: string, until?: string): ExpandedStep => ({ section, node, label: node, instruction: "", source: [], ...(until ? { until } : {}) });
// Cast on, then rows 3-4 repeated until 30 cm, then bind off.
const steps = [step("co"), step("r3", "until 30 cm"), step("r4", "until 30 cm"), step("bo")];
const at = (i: number, rows?: number): Place => ({ position: { step: i, node: steps[i].node }, repeats: rows === undefined ? [] : [{ node: "r3", rows }] });

describe("open-ended repeats", () => {
  test("next counts the row just worked, and at the end of the block loops back", () => {
    expect(next(steps, at(0))).toEqual(at(1));
    expect(next(steps, at(1))).toEqual(at(2, 1));
    expect(next(steps, at(2, 1))).toEqual(at(1, 2));
    expect(next(steps, at(1, 2))).toEqual(at(2, 3));
  });
  test("prev uncounts, and at the start of a later time through goes to the end of the one before", () => {
    expect(prev(steps, at(1, 2))).toEqual(at(2, 1));
    expect(prev(steps, at(2, 1))).toEqual(at(1, 0));
    expect(prev(steps, at(1))).toEqual(at(0));
  });
  test("finishing counts the last row and leaves the block", () => expect(finishRepeat(steps, at(2, 5))).toEqual(at(3, 6)));
  test("stepping out and back keeps the count", () => {
    expect(prev(steps, at(3, 6))).toEqual(at(2, 5));
    expect(next(steps, { position: at(0).position, repeats: [{ node: "r3", rows: 4 }] })).toEqual(at(1, 4));
  });
  test("nothing before the start or after the end", () => {
    expect(prev(steps, at(0))).toBeNull();
    expect(next(steps, at(3))).toBeNull();
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
