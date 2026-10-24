/**
 * Stage 1: map a pattern's structure with Claude.
 *
 *   npx tsx scripts/map.ts [--dry] <pattern...>
 *
 * --dry builds the request and counts its tokens without generating.
 * Saves the map to Convex (failed calls to data/map/<pattern>.failed.json).
 */
import fs from "node:fs";
import path from "node:path";
import { api } from "../convex/_generated/api";
import { dollars } from "../src/extract/pricing";
import { MODEL } from "../src/pipeline/llm";
import { buildMapInput } from "../src/pipeline/mapInput";
import { runMap } from "../src/pipeline/mapStage";
import { localSource } from "../src/pipeline/localSource";
import { connect } from "./convex";
import { client } from "./llm";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const patterns = args.filter((a) => !a.startsWith("--"));
const convex = await connect();

await Promise.all(
  patterns.map(async (pattern) => {
    const source = localSource(pattern);
    if (dry) {
      const content = await buildMapInput(source);
      const { input_tokens } = await client.messages.countTokens({ model: MODEL, messages: [{ role: "user", content: content as never }] });
      console.log(`${pattern}: ${source.pages.length} pages, ${content.filter((b) => b.type === "image").length} images, ${input_tokens} input tokens`);
      return;
    }
    const { call, problems } = await runMap(source, client);
    if (!call.parsed) {
      const failed = path.join("data/map", `${pattern}.failed.json`);
      fs.mkdirSync(path.dirname(failed), { recursive: true });
      fs.writeFileSync(failed, JSON.stringify(call.msg, null, 1));
      console.log(`${pattern}: FAILED stop_reason=${call.msg.stop_reason} after ${call.seconds}s`);
      return;
    }
    const map = call.parsed;
    await convex.mutation(api.maps.save, { pattern, mode: "text", map, problems, model: MODEL, usage: call.usage });
    console.log(
      `${pattern}: ${call.seconds}s, ${dollars(call.cost)}, in=${call.usage.inputTokens} out=${call.usage.outputTokens}; ` +
        `${map.sections.length} sections, ${map.charts.length} charts, ${map.reviewNotes.length} review notes, ${problems.length} problems`,
    );
  }),
);
