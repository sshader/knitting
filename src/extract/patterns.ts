import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PageData } from "./pageData";
import { triagePage, type PageTriage } from "./triage";

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

/** A page of a pattern: its global number and where it lives in its document. */
export interface PageRef {
  page: number;
  doc: string;
  docPage: number;
}

export function pageRefs(pattern: string): PageRef[] {
  return docsFor(pattern).flatMap((d) => Array.from({ length: d.pageCount }, (_, i) => ({ page: d.firstPage + i, doc: d.doc, docPage: i + 1 })));
}

/** data/raw/<doc>/pages/p07.<ext>, as written by scripts/extract_pdf.py. */
export const pageFile = (doc: string, docPage: number, ext: "json" | "png" | "txt") =>
  path.join(RAW, doc, "pages", `p${String(docPage).padStart(2, "0")}.${ext}`);

export const readPage = (doc: string, docPage: number): PageData => JSON.parse(fs.readFileSync(pageFile(doc, docPage, "json"), "utf8"));

/** Page data by global page number, for code that works on a whole pattern. */
export function pageLoader(refs: PageRef[]): (page: number) => PageData | undefined {
  return (page) => {
    const ref = refs.find((r) => r.page === page);
    return ref && readPage(ref.doc, ref.docPage);
  };
}

/** Stage 0 for one document. Pure code and fast, so it's recomputed rather than cached. */
export function triageDoc(doc: string): PageTriage[] {
  const { pageCount } = JSON.parse(fs.readFileSync(path.join(RAW, doc, "meta.json"), "utf8"));
  return Array.from({ length: pageCount }, (_, i) => triagePage(readPage(doc, i + 1)));
}
