import type Anthropic from "@anthropic-ai/sdk";
import type { DocMap } from "../extract/docMap";
import { Glossary } from "../extract/glossarySchema";
import { structured, type Call } from "./llm";
import type { PatternSource } from "./source";

/**
 * Abbreviations and techniques for the viewer's Glossary panel, from just
 * the pages the map marks as glossary, techniques, or overview (all pages if
 * it marks none).
 */

const SYSTEM = `You collect a knitting pattern's reference material for a knitter to look up while knitting. You get the pattern's glossary, technique, and overview pages as text.

- abbreviations: every abbreviation the pattern defines, as printed ("CDD", "m1L", "pm"), with its meaning in the pattern's words, lightly trimmed. Keep the pattern's order. Don't add ones it doesn't define.
- techniques: each technique the pattern explains step by step, with its name, the page it's on, and the explanation copied faithfully (keep numbered steps on their own lines). If the pattern only names a technique and links a video, give text "".`;

export async function runGlossary(source: PatternSource, map: DocMap, client: Anthropic): Promise<{ call: Call<Glossary>; pages: number }> {
  const wanted = map.pages.filter((p) => p.roles.some((r) => r === "glossary" || r === "techniques" || r === "overview")).map((p) => p.page);
  const pages = wanted.length ? source.pages.filter((p) => wanted.includes(p.page)) : source.pages;
  const text = (await Promise.all(pages.map(async (p) => `=== Page ${p.page} ===\n${await source.markdown(p.page)}`))).join("\n\n");
  const techniques = map.techniques.map((t) => `${t.name} (p${t.page})`).join("; ");
  const call = await structured(client, Glossary, {
    system: SYSTEM,
    effort: "low",
    maxTokens: 16000,
    content: [{ type: "text", text: `Pattern: ${map.title}\nTechniques the map found: ${techniques || "none"}\n\n${text}` }],
  });
  return { call, pages: pages.length };
}
