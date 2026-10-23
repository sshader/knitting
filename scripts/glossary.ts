/**
 * Abbreviations and techniques for the viewer's Glossary panel.
 *
 *   npx tsx scripts/glossary.ts <pattern...>
 *
 * Reads the map from Convex and sends just the pages it marks as glossary,
 * techniques, or overview (all pages if it marks none). Saves to Convex.
 */
import { api } from "../convex/_generated/api";
import { Glossary } from "../src/extract/glossarySchema";
import { pageMarkdown } from "../src/extract/pageText";
import { pageRefs, readPage } from "../src/extract/patterns";
import { connect, usageOf } from "./convex";
import { MODEL, structured } from "./llm";

const SYSTEM = `You collect a knitting pattern's reference material for a knitter to look up while knitting. You get the pattern's glossary, technique, and overview pages as text.

- abbreviations: every abbreviation the pattern defines, as printed ("CDD", "m1L", "pm"), with its meaning in the pattern's words, lightly trimmed. Keep the pattern's order. Don't add ones it doesn't define.
- techniques: each technique the pattern explains step by step, with its name, the page it's on, and the explanation copied faithfully (keep numbered steps on their own lines). If the pattern only names a technique and links a video, give text "".`;

const convex = await connect();
for (const pattern of process.argv.slice(2)) {
  const saved = await convex.query(api.maps.get, { pattern, mode: "text" });
  if (!saved) throw new Error(`${pattern} has no map; run scripts/map.ts ${pattern}`);
  const { map } = saved;
  const refs = pageRefs(pattern);
  const wanted = map.pages.filter((p) => p.roles.some((r) => r === "glossary" || r === "techniques" || r === "overview")).map((p) => p.page);
  const pages = wanted.length ? refs.filter((r) => wanted.includes(r.page)) : refs;
  const text = pages.map((r) => `=== Page ${r.page} ===\n${pageMarkdown(readPage(r.doc, r.docPage))}`).join("\n\n");
  const techniques = map.techniques.map((t) => `${t.name} (p${t.page})`).join("; ");

  const { parsed, msg, seconds } = await structured(Glossary, {
    system: SYSTEM,
    effort: "low",
    maxTokens: 16000,
    content: [{ type: "text", text: `Pattern: ${map.title}\nTechniques the map found: ${techniques || "none"}\n\n${text}` }],
  });
  if (!parsed) {
    console.log(`${pattern}: FAILED stop_reason=${msg.stop_reason}`);
    continue;
  }
  await convex.mutation(api.glossaries.save, { pattern, glossary: parsed, model: MODEL, usage: usageOf(msg.usage) });
  console.log(`${pattern}: ${seconds}s, ${pages.length} pages, ${parsed.abbreviations.length} abbreviations, ${parsed.techniques.length} techniques, in=${msg.usage.input_tokens} out=${msg.usage.output_tokens}`);
}
