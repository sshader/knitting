import { createContext, useContext } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { ExpandedStep } from "../../shared/expand";
import type { KnitData } from "./useKnitData";

/** What every knit panel reads: the project's data and the current step, and how to move. */
export interface Knit extends KnitData {
  project: Doc<"projects"> & { pattern: string };
  index: number;
  step: ExpandedStep | undefined;
  go: (index: number) => void;
}

export const KnitContext = createContext<Knit | null>(null);

export function useKnit(): Knit {
  const knit = useContext(KnitContext);
  if (!knit) throw new Error("useKnit outside a knit workspace");
  return knit;
}
