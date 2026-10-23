import type { BBox } from "../../../extract/pageData";
import { regionIds } from "../../../extract/triage";
import type { PageRow } from "../shared/types";

/** Every detected region's box by its global id ("p7.c1", "p3.i2"), the ids the map cites. */
export function regionBoxes(pages: PageRow[]): Record<string, BBox> {
  const boxes: Record<string, BBox> = {};
  for (const p of pages) {
    const ids = regionIds({ ...p.triage, page: p.page });
    for (const c of ids.charts) boxes[c.id] = c.region.bbox;
    for (const im of ids.images) boxes[im.id] = im.bbox;
  }
  return boxes;
}

export const onPage = (regions: Record<string, BBox>, page: number) => Object.entries(regions).filter(([id]) => id.startsWith(`p${page}.`));
