import type { Doc } from "../../../convex/_generated/dataModel";
import type { ExpandedStep } from "../../shared/expand";

/**
 * Moving through a project. Most moves go one step at a time; two things
 * add a layer:
 * - an open-ended repeat ("repeat rounds 3-4 until it measures 30 cm") is one
 *   block of steps worked again and again, so going past its end loops back
 *   and counts a pass, until the knitter says it's done;
 * - within a chart row, a mark says which run of stitches ("k9 A") they're on.
 */

export type Position = Doc<"projects">["position"];

/** The open-ended repeat step `i` is in: its first and last step. */
export function untilBlock(steps: ExpandedStep[], i: number): { start: number; end: number } | null {
  const until = steps[i]?.until;
  if (!until) return null;
  const same = (j: number) => steps[j]?.until === until && steps[j].section.id === steps[i].section.id;
  let start = i;
  while (same(start - 1)) start--;
  let end = i;
  while (same(end + 1)) end++;
  return { start, end };
}

/** A step to land on, keeping the pass count only while still inside the same repeat. */
export function moveTo(steps: ExpandedStep[], from: Position, i: number): Position {
  const step = Math.min(Math.max(0, i), steps.length - 1);
  const block = untilBlock(steps, from.step);
  const stays = block && step >= block.start && step <= block.end;
  return { step, node: steps[step]?.node ?? "", ...(stays && from.pass ? { pass: from.pass } : {}) };
}

/** The next step; at the end of an open-ended repeat, its start again, one pass on. */
export function next(steps: ExpandedStep[], from: Position): Position {
  const block = untilBlock(steps, from.step);
  if (block && from.step === block.end) return { step: block.start, node: steps[block.start].node, pass: (from.pass ?? 0) + 1 };
  return moveTo(steps, from, from.step + 1);
}

/** The previous step; at the start of a repeat's later pass, the end of the pass before. */
export function prev(steps: ExpandedStep[], from: Position): Position {
  const block = untilBlock(steps, from.step);
  if (block && from.step === block.start && from.pass) return { step: block.end, node: steps[block.end].node, pass: from.pass - 1 || undefined };
  return moveTo(steps, from, from.step - 1);
}

/** Leave an open-ended repeat: it measures enough. */
export function finishRepeat(steps: ExpandedStep[], from: Position): Position {
  const block = untilBlock(steps, from.step);
  return moveTo(steps, { step: from.step, node: from.node }, (block?.end ?? from.step) + 1);
}

/** Rows worked so far in the current open-ended repeat, counting this one. */
export function rowsIntoRepeat(steps: ExpandedStep[], at: Position): number | null {
  const block = untilBlock(steps, at.step);
  if (!block) return null;
  return (at.pass ?? 0) * (block.end - block.start + 1) + (at.step - block.start) + 1;
}

/** How a chart row's runs are laid out: runs before the repeat, the repeat (worked `times` times), and after. */
export interface RowLayout {
  before: number;
  repeat: number;
  after: number;
  /** Times the repeat is worked; null if the pattern says "to end" without a count. */
  times: number | null;
}

export type Mark = NonNullable<Position["mark"]>;

/**
 * The run after `mark` in working order (the first run if there's no mark
 * yet), or null at the end of the row. Runs are numbered across the row as
 * before + repeat + after; `repeat` counts times through the repeat, from 1.
 */
export function nextMark(layout: RowLayout, mark: Mark | undefined): Mark | null {
  const { before, repeat, after, times } = layout;
  const firstRepeat = before;
  const lastRepeat = before + repeat - 1;
  const firstAfter = before + repeat;
  const total = before + repeat + after;
  if (!mark) return total ? { run: 0, repeat: before === 0 && repeat ? 1 : 0 } : null;
  const { run, repeat: time } = mark;
  if (repeat && run === lastRepeat && times !== null && time < times) return { run: firstRepeat, repeat: time + 1 };
  if (run + 1 >= total) return null;
  if (run + 1 === firstRepeat && repeat) return { run: run + 1, repeat: 1 };
  if (run + 1 >= firstAfter) return { run: run + 1, repeat: 0 };
  return { run: run + 1, repeat: time };
}

/** The run before `mark`, or null at the start of the row. */
export function prevMark(layout: RowLayout, mark: Mark | undefined): Mark | null {
  if (!mark) return null;
  const { before, repeat, times } = layout;
  const firstRepeat = before;
  const lastRepeat = before + repeat - 1;
  const { run, repeat: time } = mark;
  if (repeat && run === firstRepeat && time > 1) return { run: lastRepeat, repeat: time - 1 };
  if (run === 0) return null;
  if (repeat && run - 1 === lastRepeat) return { run: run - 1, repeat: times ?? 1 };
  if (run - 1 < firstRepeat) return { run: run - 1, repeat: 0 };
  return { run: run - 1, repeat: time };
}
