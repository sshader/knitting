import { describe, expect, test } from "vitest";
import { onTap, type Burst } from "./tapGuard";

/** The times each tap acts, for taps at these moments. */
const run = (taps: [key: string, at: number][]) => {
  let burst: Burst | null = null;
  return taps.map(([key, at]) => {
    const r = onTap(burst, key, at);
    burst = r.burst;
    return r.times;
  });
};

describe("tap guard", () => {
  test("a quick second tap is held", () => expect(run([["next", 0], ["next", 200]])).toEqual([1, 0]));
  test("a third quick tap counts the held one too, and later taps count once", () => {
    expect(run([["next", 0], ["next", 700], ["next", 1400], ["next", 2100]])).toEqual([1, 0, 2, 1]);
  });
  test("unhurried taps all count", () => expect(run([["next", 0], ["next", 1200], ["next", 2400]])).toEqual([1, 1, 1]));
  test("a different button starts a new burst", () => expect(run([["next", 0], ["prev", 100], ["next", 200]])).toEqual([1, 1, 1]));
});
