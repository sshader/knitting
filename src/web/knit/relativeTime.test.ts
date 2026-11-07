import { expect, test } from "vitest";
import { timeAgo } from "./relativeTime";

test("time ago in the largest whole unit", () => {
  const now = 10_000_000;
  expect(timeAgo(now - 5_000, now)).toBe("5s ago");
  expect(timeAgo(now - 3 * 60_000, now)).toBe("3m ago");
  expect(timeAgo(now - 2 * 3_600_000, now)).toBe("2h ago");
  expect(timeAgo(now - 4 * 86_400_000, now)).toBe("4d ago");
  // A server clock a little ahead of this one.
  expect(timeAgo(now + 500, now)).toBe("0s ago");
});
