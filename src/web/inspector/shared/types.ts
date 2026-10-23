import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

/** A page as the inspector gets it: triage, review, and URLs for its data and render. */
export type PageRow = FunctionReturnType<typeof api.pages.forPattern>[number];

/** A stage 3 chart with its pattern and image URL. */
export type ChartRow = FunctionReturnType<typeof api.charts.list>[number];
