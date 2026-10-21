import { z } from "zod";

/**
 * Stage 1 output: what each page is and how the pattern is organized. Kept
 * small and union-free to stay within structured-output limits; "" and []
 * mean "none" where a field doesn't apply.
 *
 * Region ids refer to stage 0 detections: "p7.c1" is the first chart region on
 * page 7, "p3.i2" the second content image on page 3 (see `regionIds`).
 */

export const PAGE_ROLES = [
  "cover",
  "photos",
  "about",
  "overview",
  "schematic",
  "glossary",
  "techniques",
  "instructions",
  "chart",
  "other",
] as const;
export type PageRole = (typeof PAGE_ROLES)[number];

export const DocMap = z.object({
  title: z.string(),
  designer: z.string(),
  /** Size names in the order the pattern lists values, e.g. ["S", "M", "L", "XL"]. */
  sizes: z.array(z.string()),
  /** How sizes appear in text, e.g. "S (M) L (XL)" or "1 (2, 3, 4) 5, 6 [7, 8, 9] 10". */
  sizeNotation: z.string(),
  /** Non-size choices the knitter makes: [{ name: "Style", choices: ["Longsleeve", "Tank"] }]. */
  options: z.array(z.object({ name: z.string(), choices: z.array(z.string()) })),
  construction: z.string(),
  pages: z.array(
    z.object({
      page: z.number().int(),
      roles: z.array(z.enum(PAGE_ROLES)),
      summary: z.string(),
    }),
  ),
  /** Top-level parts in knitting order. */
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      /** Where the section's text starts: page and a verbatim quote of its first words (usually the heading). */
      startPage: z.number().int(),
      startQuote: z.string(),
      pages: z.array(z.number().int()),
      /** Option choices this section applies to ("Tank"); [] = always. */
      choices: z.array(z.string()),
      /** "make 2" etc.; "" if worked once. */
      repeat: z.string(),
      chartIds: z.array(z.string()),
      summary: z.string(),
    }),
  ),
  charts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      /** Region ids where the chart is drawn; several when split across pages. */
      regionIds: z.array(z.string()),
      /** Region ids of its legend/key, if separate from the chart region. */
      legendRegionIds: z.array(z.string()),
      /** Size indices this chart is for; [] = all sizes. */
      sizes: z.array(z.number().int()),
      /** Pages giving the same rows as written instructions; [] if chart-only. */
      writtenPages: z.array(z.number().int()),
      readDirection: z.enum(["rtl", "alternate", "unknown"]),
    }),
  ),
  techniques: z.array(z.object({ name: z.string(), page: z.number().int() })),
  /** Anything a reviewer should double-check. */
  reviewNotes: z.array(z.string()),
});
export type DocMap = z.infer<typeof DocMap>;
