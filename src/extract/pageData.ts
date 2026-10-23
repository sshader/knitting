/** Shape of data/raw/<slug>/pages/pNN.json, written by scripts/extract_pdf.py. All boxes are normalized 0-1. */
export type BBox = [number, number, number, number];

export interface PageData {
  page: number;
  /** Page size in PDF points. */
  width: number;
  height: number;
  words: { t: string; b: BBox; blk: number; ln: number }[];
  spans: { t: string; blk: number; font: string; size: number; bold: boolean; color: number; b: BBox }[];
  drawings: { b: BBox; fill: number[] | null; stroke: number[] | null }[];
  images: {
    /** Placement box; can extend past clips and the page. */
    b: BBox;
    /** What visibly shows: box, fraction of it painted, brightness std dev. Null if nothing showed. */
    visible: { vb: BBox; fill: number; spread: number } | null;
    px: [number, number];
  }[];
}

export const area = (b: BBox) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);

export const union = (bs: BBox[]): BBox => [
  Math.min(...bs.map((b) => b[0])),
  Math.min(...bs.map((b) => b[1])),
  Math.max(...bs.map((b) => b[2])),
  Math.max(...bs.map((b) => b[3])),
];

export const intersect = (a: BBox, b: BBox): BBox => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
