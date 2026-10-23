/**
 * Stage 0: triage every page of preprocessed patterns, upload the pages to
 * Convex, and print a review table.
 *
 *   npx tsx scripts/triage.ts [--reupload] [pattern...]   (default: every pattern in data/raw)
 *
 * Page files (data/raw/<doc>/pages/pNN.json/.png) are uploaded the first time
 * a page is seen; --reupload replaces them after re-running extract_pdf.py.
 */
import { api } from "../convex/_generated/api";
import { docsFor, pageFile, patternDocs, triageDoc } from "../src/extract/patterns";
import { connect, upload } from "./convex";

const args = process.argv.slice(2);
const reupload = args.includes("--reupload");
const named = args.filter((a) => !a.startsWith("--"));
const patterns = named.length ? named : Object.keys(patternDocs());
const pct = (x: number) => `${Math.round(x * 100)}%`;

const client = await connect();
for (const pattern of patterns) {
  const docs = docsFor(pattern);
  await client.mutation(api.patterns.ensure, { pattern, docs });
  const uploaded = new Set(reupload ? [] : await client.query(api.pages.uploaded, { pattern }));

  console.log(`\n## ${pattern}`);
  for (const d of docs) {
    for (const t of triageDoc(d.doc)) {
      const page = d.firstPage + t.page - 1;
      const files = uploaded.has(page)
        ? undefined
        : { json: await upload(client, pageFile(d.doc, t.page, "json"), "application/json"), png: await upload(client, pageFile(d.doc, t.page, "png"), "image/png") };
      await client.mutation(api.pages.save, { pattern, page, doc: d.doc, docPage: t.page, triage: t, files });

      const bits = [
        t.sendToLlm ? "LLM " : "--- ",
        `prose=${t.proseChars}`.padEnd(11),
        ...t.charts.map((c) => `[${c.form}: ${c.evidence}]`),
        ...t.images.map((i) => `[img ${pct(i.coverage)}]`),
        t.writtenRows.count ? `[rows ${t.writtenRows.first}-${t.writtenRows.last} x${t.writtenRows.count}]` : "",
        t.sendToLlm ? "" : `(${t.reason})`,
        files ? "(uploaded)" : "",
      ];
      console.log(`  p${String(page).padStart(2, "0")} ${bits.filter(Boolean).join(" ")}`);
    }
  }
}
