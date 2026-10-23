import { z } from "zod";

/**
 * A pattern's abbreviations and the techniques it explains, for looking
 * things up while knitting. Extracted from the pages the map marks as
 * glossary, techniques, or overview (see scripts/glossary.ts).
 */
export const Glossary = z.object({
  /** As the pattern lists them: { abbrev: "CDD", meaning: "central double decrease: slip 2 together knitwise, k1, pass the slipped sts over" }. */
  abbreviations: z.array(z.object({ abbrev: z.string(), meaning: z.string() })),
  /** How-tos the pattern spells out, in its own words; text "" when it only links a video. */
  techniques: z.array(z.object({ name: z.string(), page: z.number().int(), text: z.string() })),
});
export type Glossary = z.infer<typeof Glossary>;
