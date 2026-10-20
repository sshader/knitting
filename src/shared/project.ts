import { z } from "zod";
import { Node } from "./schema";

/**
 * A place in a pattern's node tree, stable across edits to unrelated nodes.
 * `path` runs from a Section down to the leaf (Row/ChartWork/Note); `iteration`
 * is 1-based and set on Repeats and multi-times Sections. `row` is 1-based
 * within a multi-row leaf ("Knit 40 rounds" -> row 17 of 40).
 */
export const Position = z.object({
  path: z.array(z.object({ id: z.string(), iteration: z.number().int().positive().optional() })),
  row: z.number().int().positive(),
});
export type Position = z.infer<typeof Position>;

/**
 * A change the knitter made. `change` is structured when we can apply it to the
 * expanded instructions; otherwise it's just a note anchored to a node.
 */
export const Modification = z.object({
  id: z.string(),
  createdAt: z.number(),
  nodeId: z.string(),
  note: z.string(),
  change: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("setTimes"), times: z.number().int().positive() }),
      z.object({ kind: z.literal("setRows"), rows: z.number().int().positive() }),
      z.object({ kind: z.literal("replaceText"), text: z.string() }),
      z.object({ kind: z.literal("skip") }),
      z.object({ kind: z.literal("insertAfter"), node: Node }),
    ])
    .optional(),
});
export type Modification = z.infer<typeof Modification>;

export const Project = z.object({
  id: z.string(),
  patternId: z.string(),
  name: z.string(),
  sizeIndex: z.number().int().nonnegative(),
  status: z.enum(["active", "paused", "done", "frogged"]),
  createdAt: z.number(),
  updatedAt: z.number(),
  /** Cached; the event log is the source of truth. */
  cursor: Position.optional(),
  modifications: z.array(Modification),
});
export type Project = z.infer<typeof Project>;

/** Append-only log; drives undo, time tracking, and (later) activity feeds. */
export const ProjectEvent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("move"), from: Position.optional(), to: Position }),
  z.object({ kind: z.literal("sessionStart") }),
  z.object({ kind: z.literal("sessionEnd") }),
  z.object({ kind: z.literal("note"), text: z.string(), at: Position.optional() }),
  z.object({ kind: z.literal("modification"), modificationId: z.string() }),
  z.object({ kind: z.literal("status"), status: Project.shape.status }),
]);
export type ProjectEvent = z.infer<typeof ProjectEvent> & { id: string; projectId: string; at: number };
