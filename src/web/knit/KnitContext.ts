import { createContext, useContext } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { ExpandedStep } from "../../shared/expand";
import type { Mark, Position, Repeats } from "./navigation";
import type { KnitData } from "./useKnitData";

/**
 * What every knit panel reads: the project's data, where the knitter is, and
 * how to move. The saved place is a bookmark; reading ahead (or back) shows
 * another step without moving it.
 */
export interface Knit extends KnitData {
  project: Doc<"projects"> & { pattern: string };
  /** The saved position, resolved against the current steps. */
  position: Position;
  repeats: Repeats;
  /** The step the knitter is on. */
  place: number;
  /** The step shown: the place, or the one being read. */
  index: number;
  step: ExpandedStep | undefined;
  /** Whether a step other than the place is being read. */
  browsing: boolean;
  /** Where previous and next lead from the step shown; undefined at either end. */
  neighbors: { prev: number | undefined; next: number | undefined };
  /** Read a step (from the outline, the chart, or a note) without moving the place. */
  go: (index: number) => void;
  /** Start reading ahead from the place. */
  readAhead: () => void;
  backToPlace: () => void;
  /** Move the place to the step being read. */
  knitFromHere: () => void;
  /** Next and previous step: of the place, or while reading, of the step shown. Guarded against double taps. */
  next: () => void;
  prev: () => void;
  /** Leave the open-ended repeat the place is in. */
  finishRepeat: () => void;
  /** Change the row count of the open-ended repeat the shown step is in. */
  countRepeat: (by: number) => void;
  /** Mark (or clear) the run being worked in the place's chart row. */
  setMark: (mark: Mark | undefined) => void;
  /** Act on a tap, guarded against double taps: see useTapGuard. */
  tap: (key: string, act: (times: number) => void) => void;
}

export const KnitContext = createContext<Knit | null>(null);

export function useKnit(): Knit {
  const knit = useContext(KnitContext);
  if (!knit) throw new Error("useKnit outside a knit workspace");
  return knit;
}
