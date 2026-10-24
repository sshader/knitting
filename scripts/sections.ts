/**
 * Stage 2: extract each section of a mapped pattern into row-level nodes.
 *
 *   npx tsx scripts/sections.ts <pattern> [sectionId...]
 *
 * The first call runs alone to write the prompt cache; the rest run four at
 * a time and read it. Reads the map from Convex and saves each section there.
 */
import { api } from "../convex/_generated/api";
import { dollars } from "../src/extract/pricing";
import { localSource } from "../src/pipeline/localSource";
import { extractSection, sectionPrefix } from "../src/pipeline/sectionsStage";
import { connect } from "./convex";
import { client } from "./llm";

const PARALLEL = 4;

const [pattern, ...only] = process.argv.slice(2);
if (!pattern) throw new Error("usage: sections.ts <pattern> [sectionId...]");
const convex = await connect();
const saved = await convex.query(api.maps.get, { pattern, mode: "text" });
if (!saved) throw new Error(`${pattern} has no map; run scripts/map.ts ${pattern}`);
const { map } = saved;
const source = localSource(pattern);
const prefix = await sectionPrefix(source, map);
const targets = map.sections.map((s) => s.id).filter((id) => only.length === 0 || only.includes(id));

async function extract(sectionId: string) {
  const { call, problems, error } = await extractSection(source, map, sectionId, prefix, client);
  await convex.mutation(api.sections.save, {
    pattern,
    sectionId,
    extraction: call.parsed ?? undefined,
    problems,
    error,
    model: call.model,
    seconds: call.seconds,
    usage: call.usage,
  });
  const u = call.usage;
  const x = call.parsed;
  console.log(
    `${sectionId.padEnd(28)} ${String(call.seconds).padStart(3)}s ${dollars(call.cost)}  in=${u.inputTokens} cacheRead=${u.cacheReadTokens} cacheWrite=${u.cacheWriteTokens} out=${u.outputTokens}` +
      (x ? `  ${x.nodes.length} nodes, ${problems.length} problems, ${x.reviewNotes.length} notes` : `  FAILED: ${error}`) +
      (error && x ? `  TREE ERROR: ${error}` : ""),
  );
}

// First call writes the prompt cache; the rest read it.
const [first, ...rest] = targets;
if (first) await extract(first);
for (let i = 0; i < rest.length; i += PARALLEL) await Promise.all(rest.slice(i, i + PARALLEL).map(extract));
