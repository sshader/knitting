/**
 * Attaches the original PDFs (from PDF_DIR) to patterns preprocessed here,
 * so the app can re-run their extraction, and so uploading the same PDFs
 * later reuses their results.
 *
 *   npx tsx scripts/upload-pdfs.ts [pattern...]   (default: all of yours)
 */
import path from "node:path";
import { api } from "../convex/_generated/api";
import { PDF_DIR } from "../src/extract/patterns";
import { connect, upload } from "./convex";

const convex = await connect();
const named = process.argv.slice(2);
for (const p of await convex.query(api.patterns.list, {})) {
  if (named.length && !named.includes(p.slug)) continue;
  // PDFs already uploaded are attached again rather than re-uploaded.
  const pdfs = [];
  for (const d of p.docs) pdfs.push(d.pdf ?? (await upload(convex, path.join(PDF_DIR, d.source), "application/pdf")));
  await convex.mutation(api.patterns.attachPdfs, { pattern: p.slug, pdfs });
  console.log(`${p.slug}: ${pdfs.length} PDF${pdfs.length > 1 ? "s" : ""} attached`);
}
