import { area, intersect, type BBox, type PageData } from "./pageData";
import { inReadingOrder } from "./readingOrder";

/**
 * A page's text as lightweight markdown, in PDF reading order:
 * - lines set noticeably larger than body text become "#"/"##" headings,
 *   short all-bold lines "###";
 * - text in a color other than the page's main text color is wrapped as
 *   [A:text], with the letters listed in a "Text colors:" line, because some
 *   patterns encode yarn colors in text color (Lucky Stars' written rounds);
 * - text inside `omit` boxes (drawn charts) is replaced by a placeholder line
 *   so chart glyphs don't flood the output.
 */
export function pageMarkdown(page: PageData, omit: { id: string; bbox: BBox }[] = []): string {
  const p = inReadingOrder(page);
  const inside = (b: BBox) => omit.find((o) => area(intersect(o.bbox, b)) > 0.5 * area(b));
  const kept = p.spans.filter((s) => !inside(s.b));

  // Spans come in reading order (block, line, span); start a new line when y moves.
  const lines: PageData["spans"][] = [];
  for (const s of p.spans) {
    const last = lines.at(-1);
    if (last && Math.abs(last[0].b[1] - s.b[1]) < 0.004 && s.b[0] >= last.at(-1)!.b[0]) last.push(s);
    else lines.push([s]);
  }

  // Body size and main color: whatever carries the most characters.
  const body = mostChars(kept, (s) => s.size) ?? 10;
  const mainColor = mostChars(kept, (s) => s.color);
  const letters = new Map<number, string>();
  const colorTag = (c: number) => {
    if (!letters.has(c)) letters.set(c, String.fromCharCode(65 + letters.size));
    return letters.get(c)!;
  };

  const out: string[] = [];
  const placed = new Set<string>();
  for (const line of lines) {
    const hit = inside(line[0].b);
    if (hit) {
      if (!placed.has(hit.id)) out.push(`[chart ${hit.id}]`);
      placed.add(hit.id);
      continue;
    }
    // Spans don't always carry their separating space; add one where there's a visible gap.
    const text = line
      .map((s, i) => {
        const gap = i > 0 && s.b[0] - line[i - 1].b[2] > 0.002 ? " " : "";
        const t = s.t.trim() && !near(s.color, mainColor) ? s.t.replace(/^(\s*)(.*?)(\s*)$/, (_, a, m, z) => `${a}[${colorTag(s.color)}:${m}]${z}`) : s.t;
        return gap + t;
      })
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const size = Math.max(...line.map((s) => s.size));
    if (size >= body * 1.6) out.push(`# ${text}`);
    else if (size >= body * 1.2) out.push(`## ${text}`);
    else if (line.every((s) => s.bold) && text.length < 60) out.push(`### ${text}`);
    else out.push(text);
  }
  for (const o of omit) if (!placed.has(o.id)) out.push(`[chart ${o.id}]`);
  if (letters.size) {
    const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
    out.unshift(`Text colors (main text is ${hex(mainColor!)}): ${[...letters].map(([c, l]) => `${l}=${hex(c)}`).join(", ")}`);
  }
  return out.join("\n");
}

/** Colors a reader wouldn't tell apart (e.g. two near-blacks) count as the same. */
function near(a: number, b: number | undefined) {
  if (b === undefined) return false;
  const d = [16, 8, 0].map((sh) => ((a >> sh) & 255) - ((b >> sh) & 255));
  return Math.hypot(...d) < 40;
}

function mostChars<K>(spans: PageData["spans"], key: (s: PageData["spans"][number]) => K): K | undefined {
  const counts = new Map<K, number>();
  for (const s of spans) counts.set(key(s), (counts.get(key(s)) ?? 0) + s.t.trim().length);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
