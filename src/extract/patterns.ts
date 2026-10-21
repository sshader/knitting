import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Which preprocessed documents (data/raw/<doc>) make up each pattern. Most
 * patterns are one PDF; some ship the charts separately. Stage 0 works per
 * document; stage 1 onward per pattern, numbering pages across documents.
 */
const GROUPS: Record<string, string[]> = {
  "wavelength-cardigan": ["wavelengthcardiganpattern", "wavelengthcardigancharts"],
};

export const RAW = "data/raw";
/** Where the source PDFs live. */
export const PDF_DIR = process.env.KNITTING_PDFS ?? path.join(os.homedir(), "knitting-patterns");

export function patternDocs(): Record<string, string[]> {
  const grouped = new Set(Object.values(GROUPS).flat());
  const singles = fs
    .readdirSync(RAW)
    .filter((d) => !grouped.has(d))
    .map((d) => [d, [d]] as const);
  return Object.fromEntries([...singles, ...Object.entries(GROUPS)].sort(([a], [b]) => a.localeCompare(b)));
}

export interface DocInfo {
  doc: string;
  /** Source PDF filename. */
  source: string;
  pageCount: number;
  /** Global page number of this document's first page. */
  firstPage: number;
}

export function docsFor(pattern: string): DocInfo[] {
  const docs = patternDocs()[pattern];
  if (!docs) throw new Error(`unknown pattern ${pattern}`);
  let next = 1;
  return docs.map((doc) => {
    const meta = JSON.parse(fs.readFileSync(path.join(RAW, doc, "meta.json"), "utf8"));
    const info = { doc, source: meta.source as string, pageCount: meta.pageCount as number, firstPage: next };
    next += info.pageCount;
    return info;
  });
}
