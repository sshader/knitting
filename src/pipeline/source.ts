import type { PageData } from "../extract/pageData";
import type { PageTriage } from "../extract/triage";

/**
 * Everything the pipeline stages read about a pattern, wherever it's kept:
 * local files and Python on this machine (localSource.ts) or Convex storage
 * and the hosted PDF service (convex/pipeline). Pages are numbered globally
 * across the pattern's documents.
 */
export interface PatternSource {
  /** How the pattern is named to the model: its slug or title. */
  name: string;
  docs: DocInfo[];
  pages: PageEntry[];
  /** A page's words, spans, drawings, and images (extract_pdf.py output). */
  pageData(page: number): Promise<PageData>;
  /** A page's text as the model sees it (see pageText.ts). */
  markdown(page: number): Promise<string>;
  /** PNG renders of page regions; maxPx caps the longer side for thumbnails. */
  crops(requests: CropRequest[]): Promise<Uint8Array[]>;
  /** A raster chart's cell grid, found in code (raster_grid.py). */
  chartGrid(page: number, bbox: number[]): Promise<ChartGrid>;
}

export interface DocInfo {
  doc: string;
  /** Source PDF filename. */
  source: string;
  pageCount: number;
  /** Global page number of this document's first page. */
  firstPage: number;
}

export interface PageEntry {
  page: number;
  doc: string;
  docPage: number;
  triage: PageTriage;
}

export interface CropRequest {
  page: number;
  bbox: number[];
  maxPx?: number;
}

export interface ChartGrid {
  cols: number;
  rows: number;
  /** Where the grid sits on the page (0-1). */
  gridBox: number[];
  /** One string per row, bottom row first; each char a cell type ("0", "1", ...). */
  cells: string[];
  classes: { id: number; rgb: number[]; symbol: boolean; count: number; example: [number, number]; sample: Uint8Array }[];
  /** The chart cropped from the page, and the crop's box on the page (0-1). */
  image: { png: Uint8Array; cropBox: number[] };
}
