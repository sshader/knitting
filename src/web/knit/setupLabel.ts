import type { Doc } from "../../../convex/_generated/dataModel";
import type { DocMap } from "../../extract/docMap";

/** "Size 1 · cropped · bracelet": the size and options a project is knitted in. */
export function setupLabel(map: DocMap, project: Doc<"projects">): string {
  const size = map.sizes[project.size] ?? "";
  return [/size/i.test(size) ? size : `Size ${size}`, ...project.choices].join(" · ");
}
