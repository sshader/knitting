import { describe, expect, test } from "vitest";
import { appliesToSize, textForSize, valueForSize } from "./sized";

describe("sized values", () => {
  test("text picks each group's value for the size", () => {
    expect(textForSize("Cast on {108|112|116|120} sts, k{2|2|3|3}", 2)).toBe("Cast on 116 sts, k3");
  });
  test("numbers and size filters", () => {
    expect(valueForSize([1, 2, 3], 1)).toBe(2);
    expect(valueForSize(7, 1)).toBe(7);
    expect(appliesToSize(undefined, 3)).toBe(true);
    expect(appliesToSize([0, 1], 3)).toBe(false);
  });
});
