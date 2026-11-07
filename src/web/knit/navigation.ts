import type { Doc } from "../../../convex/_generated/dataModel";
import type { ExpandedStep } from "../../shared/expand";

/**
 * Moving through a project. Most moves go one step at a time; two things
 * add a layer:
 * - an open-ended repeat ("repeat rounds 3-4 until it measures 30 cm") is one
 *   block of steps worked again and again, so going past its end loops back,
 *   until the knitter says it's done. Its rows are counted as they're worked:
 *   moving on from a row in the block counts it, moving back onto one uncounts it;
 * - within a chart row, a mark says which run of stitches ("k9 A") they're on.
 */

export type Position = Doc<"projects">["position"];
export type Repeats = NonNullable<Doc<"projects">["repeats"]>;

/** Where the knitter is, and the rows they've counted in each open-ended repeat. */
export interface Place {
  position: Position;
  repeats: Repeats;
}

interface Block {
  start: number;
  end: number;
}

/** The open-ended repeat step `i` is in: its first and last step. */
export function untilBlock(steps: ExpandedStep[], i: number): Block | null {
  const until = steps[i]?.until;
  if (!until) return null;
  const same = (j: number) => steps[j]?.until === until && steps[j].section.id === steps[i].section.id;
  let start = i;
  while (same(start - 1)) start--;
  let end = i;
  while (same(end + 1)) end++;
  return { start, end };
}

/** Rows worked so far in a repeat. */
export function rowsIn(steps: ExpandedStep[], repeats: Repeats, block: Block): number {
  const node = steps[block.start].node;
  return repeats.find((r) => r.node === node)?.rows ?? 0;
}

/** The repeats with a block's row count changed by `by` (never below zero). */
export function countRows(steps: ExpandedStep[], repeats: Repeats, block: Block, by: number): Repeats {
  const node = steps[block.start].node;
  const rows = Math.max(0, rowsIn(steps, repeats, block) + by);
  return [...repeats.filter((r) => r.node !== node), { node, rows }];
}

const at = (steps: ExpandedStep[], i: number): Position => ({ step: i, node: steps[i]?.node ?? "" });

/** A step to land on (from the outline, or after reading ahead), leaving the counts alone. */
export function moveTo(steps: ExpandedStep[], from: Place, i: number): Place {
  return { position: at(steps, Math.min(Math.max(0, i), steps.length - 1)), repeats: from.repeats };
}

/** The next step, counting the row just worked if it's in a repeat; at a repeat's end, its start again. Null at the end of the pattern. */
export function next(steps: ExpandedStep[], from: Place): Place | null {
  const i = from.position.step;
  const block = untilBlock(steps, i);
  if (block) return { position: at(steps, i === block.end ? block.start : i + 1), repeats: countRows(steps, from.repeats, block, 1) };
  return i < steps.length - 1 ? moveTo(steps, from, i + 1) : null;
}

/**
 * The previous step, uncounting it if it's in a repeat; at a repeat's start
 * with a whole time through counted, the end of the time before. Null at the
 * start of the pattern.
 */
export function prev(steps: ExpandedStep[], from: Place): Place | null {
  const i = from.position.step;
  const block = untilBlock(steps, i);
  const loops = block && i === block.start && rowsIn(steps, from.repeats, block) >= block.end - block.start + 1;
  const to = loops ? block.end : i - 1;
  if (to < 0) return null;
  const into = untilBlock(steps, to);
  return { position: at(steps, to), repeats: into ? countRows(steps, from.repeats, into, -1) : from.repeats };
}

/** Leave an open-ended repeat, counting the row just worked: it measures enough. */
export function finishRepeat(steps: ExpandedStep[], from: Place): Place {
  const block = untilBlock(steps, from.position.step);
  if (!block) return moveTo(steps, from, from.position.step + 1);
  return moveTo(steps, { ...from, repeats: countRows(steps, from.repeats, block, 1) }, block.end + 1);
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
