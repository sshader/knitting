import { createContext, useContext } from "react";

/**
 * The app has two modes: knitting a project, and reviewing the pattern
 * extraction pipeline (the inspector). Kept in the URL as ?view=.
 */
export type Mode = "knit" | "extract";

export const ModeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({ mode: "knit", setMode: () => {} });

export const useMode = () => useContext(ModeContext);
