import type { BBox } from "../../../extract/pageData";

/** Absolute position for an overlay on a page image, from a normalized 0-1 box. */
export const boxStyle = (b: BBox | number[]) => ({
  left: `${b[0] * 100}%`,
  top: `${b[1] * 100}%`,
  width: `${(b[2] - b[0]) * 100}%`,
  height: `${(b[3] - b[1]) * 100}%`,
});
