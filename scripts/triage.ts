/**
 * Run stage 0 triage over preprocessed patterns and print a review table.
 *
 *   npx tsx scripts/triage.ts [slug...]
 *
 * Writes data/triage/<slug>.json.
 */
import fs from "node:fs";
import path from "node:path";
import type { PageData } from "../src/extract/pageData";
import { triagePage } from "../src/extract/triage";

const RAW = "data/raw";
const OUT = "data/triage";
fs.mkdirSync(OUT, { recursive: true });

const slugs = process.argv.length > 2 ? process.argv.slice(2) : fs.readdirSync(RAW).sort();
const index: { slug: string; title?: string; pageCount: number; sentToLlm: number; charts: Record<string, number> }[] = [];
const pct = (x: number) => `${Math.round(x * 100)}%`;

for (const slug of slugs) {
  const dir = path.join(RAW, slug, "pages");
  const pages = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => triagePage(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as PageData));
  fs.writeFileSync(path.join(OUT, `${slug}.json`), JSON.stringify(pages, null, 1));

  const sent = pages.filter((p) => p.sendToLlm).length;
  const charts: Record<string, number> = {};
  for (const c of pages.flatMap((p) => p.charts)) charts[c.form] = (charts[c.form] ?? 0) + 1;
  const meta = JSON.parse(fs.readFileSync(path.join(RAW, slug, "meta.json"), "utf8"));
  index.push({ slug, title: meta.source, pageCount: pages.length, sentToLlm: sent, charts });
  console.log(`\n## ${slug}  (${sent}/${pages.length} pages to LLM)`);
  for (const p of pages) {
    const bits = [
      p.sendToLlm ? "LLM " : "--- ",
      `prose=${p.proseChars}`.padEnd(11),
      ...p.charts.map((c) => `[${c.form}: ${c.evidence}]`),
      ...p.images.map((i) => `[img ${pct(i.coverage)}]`),
      p.writtenRows.count ? `[rows ${p.writtenRows.first}-${p.writtenRows.last} x${p.writtenRows.count}]` : "",
      p.sendToLlm ? "" : `(${p.reason})`,
    ];
    console.log(`  p${String(p.page).padStart(2, "0")} ${bits.filter(Boolean).join(" ")}`);
  }
}

// The inspector app reads this to list patterns. Merge so a partial run keeps the others.
const indexPath = path.join(OUT, "index.json");
const previous: typeof index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : [];
const merged = [...previous.filter((e) => !slugs.includes(e.slug)), ...index].sort((a, b) => a.slug.localeCompare(b.slug));
fs.writeFileSync(indexPath, JSON.stringify(merged, null, 1));
