import { createContext, useContext } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { ExpandedStep } from "../../shared/expand";
import type { Mark, Position } from "./navigation";
import type { KnitData } from "./useKnitData";

/** What every knit panel reads: the project's data, where the knitter is, and how to move. */
export interface Knit extends KnitData {
  project: Doc<"projects"> & { pattern: string };
  /** The saved position, resolved against the current steps. */
  position: Position;
  index: number;
  step: ExpandedStep | undefined;
  /** Jump to a step (from the outline or the chart). */
  go: (index: number) => void;
  next: () => void;
  prev: () => void;
  /** Leave the open-ended repeat the current step is in. */
  finishRepeat: () => void;
  /** Mark (or clear) the run being worked in the current chart row. */
  setMark: (mark: Mark | undefined) => void;
}

export const KnitContext = createContext<Knit | null>(null);

export function useKnit(): Knit {
  const knit = useContext(KnitContext);
  if (!knit) throw new Error("useKnit outside a knit workspace");
  return knit;
}
