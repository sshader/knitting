/**
 * Abbreviations and techniques for the viewer's Glossary panel.
 *
 *   npx tsx scripts/glossary.ts <pattern...>
 *
 * Reads the map from Convex; saves to Convex. See src/pipeline/glossaryStage.ts.
 */
import { api } from "../convex/_generated/api";
import { dollars } from "../src/extract/pricing";
import { runGlossary } from "../src/pipeline/glossaryStage";
import { MODEL } from "../src/pipeline/llm";
import { localSource } from "../src/pipeline/localSource";
import { connect } from "./convex";
import { client } from "./llm";

const convex = await connect();
for (const pattern of process.argv.slice(2)) {
  const saved = await convex.query(api.maps.get, { pattern, mode: "text" });
  if (!saved) throw new Error(`${pattern} has no map; run scripts/map.ts ${pattern}`);
  const { call, pages } = await runGlossary(localSource(pattern), saved.map, client);
  if (!call.parsed) {
    console.log(`${pattern}: FAILED stop_reason=${call.msg.stop_reason}`);
    continue;
  }
  await convex.mutation(api.glossaries.save, { pattern, glossary: call.parsed, model: MODEL, usage: call.usage });
  console.log(`${pattern}: ${call.seconds}s, ${dollars(call.cost)}, ${pages} pages, ${call.parsed.abbreviations.length} abbreviations, ${call.parsed.techniques.length} techniques`);
}
