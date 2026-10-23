import { z } from "zod";
import { area, intersect, union, type BBox, type PageData } from "./pageData";

/**
 * Stage 0: deterministic page triage. Finds chart-like regions and how they're
 * encoded so each can be routed to the right extractor, and decides which
 * pages are worth sending to the LLM. Semantic labels (glossary vs.
 * instructions, photo vs. raster chart) are left to the document-map stage.
 */

const BBoxZ = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const ChartForm = z.enum([
  /** Grid of filled rectangles (Tove). Colors readable exactly from vectors. */
  "vector",
  /** Positioned glyphs in a stitch-symbol font (Wavelength / StitchFiddle). */
  "font",
  /** Colorwork written out as text, color carried by span color (Lucky Stars). */
  "writtenColor",
]);
export type ChartForm = z.infer<typeof ChartForm>;

export const ChartRegion = z.object({
  form: ChartForm,
  bbox: BBoxZ,
  /** Human-readable evidence, for reviewing triage decisions. */
  evidence: z.string(),
});
export type ChartRegion = z.infer<typeof ChartRegion>;

export const PageTriage = z.object({
  page: z.number(),
  textChars: z.number(),
  charts: z.array(ChartRegion),
  /** Images covering a meaningful part of the page: photo, schematic, or raster chart (stage 1 decides). */
  images: z.array(z.object({ bbox: BBoxZ, coverage: z.number() })),
  /** Lines that look like written row instructions ("Rnd 5: ..."). */
  writtenRows: z.object({ count: z.number(), first: z.number().optional(), last: z.number().optional() }),
  /** Text belonging to detected charts (glyphs, cell labels) is excluded. */
  proseChars: z.number(),
  sendToLlm: z.boolean(),
  /**
   * For pages not sent whole: regions to send as image crops instead, e.g. a
   * legend rendered as an image beside a glyph chart (Wavelength).
   */
  llmCrops: z.array(BBoxZ),
  reason: z.string(),
});
export type PageTriage = z.infer<typeof PageTriage>;

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const xs = m.get(k);
  if (xs) xs.push(v);
  else m.set(k, [v]);
}

const clip = (b: BBox): BBox => [Math.max(0, b[0]), Math.max(0, b[1]), Math.min(1, b[2]), Math.min(1, b[3])];

/** Group boxes into spatially connected clusters (boxes within `gap` of each other). */
function cluster(boxes: BBox[], gap: number): BBox[][] {
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a][0] - boxes[b][0]);
  // Sweep by x so we only compare boxes that could be near each other.
  for (let oi = 0; oi < order.length; oi++) {
    const a = boxes[order[oi]];
    for (let oj = oi + 1; oj < order.length; oj++) {
      const b = boxes[order[oj]];
      if (b[0] > a[2] + gap) break;
      if (b[1] <= a[3] + gap && a[1] <= b[3] + gap) parent[find(order[oi])] = find(order[oj]);
    }
  }
  const groups = new Map<number, BBox[]>();
  boxes.forEach((b, i) => push(groups, find(i), b));
  return [...groups.values()];
}

const MIN_CELLS = 40;

/** Non-space characters in a span; one per stitch symbol. A span may hold a single glyph or a whole chart row. */
const glyphCount = (t: string) => t.replace(/\s/g, "").length;

/**
 * Glyphs drawn in grid cells, in any font: count characters of spans centered
 * inside the box, skipping ordinary words.
 */
function glyphsIn(p: PageData, b: BBox) {
  return p.spans
    .filter((s) => {
      const cx = (s.b[0] + s.b[2]) / 2;
      const cy = (s.b[1] + s.b[3]) / 2;
      return cx > b[0] && cx < b[2] && cy > b[1] && cy < b[3] && !/[a-z]{3}/i.test(s.t);
    })
    .reduce((n, s) => n + glyphCount(s.t), 0);
}

/**
 * Grow a cell cluster to the long, thin lines crossing it: the drawn grid,
 * which extends past cells that happen to be empty.
 */
function withGridLines(p: PageData, b: BBox): BBox {
  const lines = p.drawings
    .map((d) => d.b)
    .filter((l) => {
      const w = (l[2] - l[0]) * p.width;
      const h = (l[3] - l[1]) * p.height;
      const thin = Math.min(w, h) < 1.5 && Math.max(w, h) > 30;
      return thin && l[0] <= b[2] && l[2] >= b[0] && l[1] <= b[3] && l[3] >= b[1];
    });
  return lines.length >= 4 ? union([b, ...lines]) : b;
}

function vectorGrids(p: PageData): ChartRegion[] {
  // Chart cells or symbols: many shapes sharing one size, a few points to a
  // side. Usually filled cells (Tove); sometimes outlined symbols on a
  // line-drawn grid (dot-top's circles).
  const bySize = new Map<string, BBox[]>();
  for (const d of p.drawings) {
    const w = (d.b[2] - d.b[0]) * p.width;
    const h = (d.b[3] - d.b[1]) * p.height;
    if (w < 3 || h < 3 || w > 30 || h > 30) continue;
    const key = `${d.fill ? "filled" : "outlined"} ${Math.round(w)}x${Math.round(h)}`;
    push(bySize, key, d.b);
  }
  const out: ChartRegion[] = [];
  for (const [size, cells] of bySize) {
    if (cells.length < MIN_CELLS) continue;
    // Filled cells touch; outlined symbols sit apart inside their cells.
    const cellW = cells[0][2] - cells[0][0];
    for (const group of cluster(cells, size.startsWith("filled") ? cellW * 0.5 : cellW * 2)) {
      if (group.length < MIN_CELLS) continue;
      const inGroup = new Set(group);
      const fills = new Set(
        p.drawings.filter((d) => d.fill && inGroup.has(d.b)).map((d) => d.fill!.map((c) => c.toFixed(2)).join(",")),
      );
      const bbox = withGridLines(p, union(group));
      const glyphs = glyphsIn(p, bbox);
      // Stitch symbols set in an ordinary font ("|", "V", "/") still make it a glyph chart.
      out.push({
        form: glyphs >= MIN_CELLS ? "font" : "vector",
        bbox,
        evidence: `${group.length} ${size}pt shapes${fills.size ? `, ${fills.size} fill colors` : ""}${glyphs >= MIN_CELLS ? `, ${glyphs} glyphs inside` : ""}`,
      });
    }
  }
  return out;
}

/**
 * A stitch-symbol font maps stitches to punctuation-like glyphs (",,", "&", "%"),
 * so most of its spans contain no letters or digits. Row numbers and "k3"
 * tokens in ordinary fonts don't qualify.
 */
function symbolFonts(p: PageData): Set<string> {
  const byFont = new Map<string, string[]>();
  for (const s of p.spans) push(byFont, s.font, s.t.trim());
  const out = new Set<string>();
  for (const [font, texts] of byFont) {
    const glyphLike = texts.filter((t) => t.length > 0 && !/[\p{L}\p{N}]/u.test(t)).length / texts.length;
    if (/stitch|knit|symbol/i.test(font) || (texts.length >= 50 && glyphLike > 0.8)) out.add(font);
  }
  return out;
}

function fontCharts(p: PageData, fonts: Set<string>): ChartRegion[] {
  const out: ChartRegion[] = [];
  for (const font of fonts) {
    const spans = p.spans.filter((s) => s.font === font);
    for (const group of cluster(
      spans.map((s) => s.b),
      0.03,
    )) {
      const inGroup = new Set(group);
      const glyphs = spans.filter((s) => inGroup.has(s.b)).reduce((n, s) => n + glyphCount(s.t), 0);
      if (glyphs < MIN_CELLS) continue;
      out.push({ form: "font", bbox: union(group), evidence: `${glyphs} glyphs in font ${font}` });
    }
  }
  return out;
}

const ROW_LABEL = /^\s*(?:rnds?|rounds?|rows?|r)\s*(\d+)(?:\s*[-–]\s*\d+)?\s*(?:\((?:RS|WS)\))?\s*[:.]/i;

/** Group spans into text lines by vertical position. */
function lines(p: PageData) {
  const sorted = [...p.spans].sort((a, b) => a.b[1] - b.b[1] || a.b[0] - b.b[0]);
  const out: (typeof p.spans)[] = [];
  for (const s of sorted) {
    const last = out.at(-1);
    if (last && Math.abs(last[0].b[1] - s.b[1]) < 0.004) last.push(s);
    else out.push([s]);
  }
  return out.map((l) => l.sort((a, b) => a.b[0] - b.b[0]));
}

function writtenRows(p: PageData) {
  const rows: { n: number; line: PageData["spans"] }[] = [];
  for (const line of lines(p)) {
    const m = ROW_LABEL.exec(line.map((s) => s.t).join(""));
    if (m) rows.push({ n: Number(m[1]), line });
  }
  // Written colorwork: within row lines, stitch counts are set in several colors.
  const colors = new Set(rows.flatMap((r) => r.line.slice(1).map((s) => s.color)));
  const region: ChartRegion | null =
    rows.length >= 10 && colors.size >= 2
      ? {
          form: "writtenColor",
          bbox: union(rows.flatMap((r) => r.line.map((s) => s.b))),
          evidence: `${rows.length} row lines using ${colors.size} text colors`,
        }
      : null;
  const ns = rows.map((r) => r.n);
  return {
    summary: { count: rows.length, first: ns.length ? Math.min(...ns) : undefined, last: ns.length ? Math.max(...ns) : undefined },
    region,
  };
}

/**
 * Images that carry content, by their visible area. Drops images that show
 * almost nothing or a flat fill (panels, tints), near-full-page backgrounds
 * behind prose, and images mostly inside a larger kept one (frames, shadows).
 */
function contentImages(p: PageData, proseChars: number) {
  const candidates = p.images
    .flatMap((i) => (i.visible ? [{ ...i.visible, bbox: clip(i.visible.vb) }] : []))
    .map((v) => ({ ...v, coverage: area(v.bbox) }))
    .filter((v) => v.coverage > 0.015 && v.fill >= 0.03 && !(v.fill > 0.9 && v.spread < 8))
    .filter((v) => !(v.coverage > 0.9 && proseChars > 200))
    .sort((a, b) => b.coverage - a.coverage);
  const kept: typeof candidates = [];
  for (const c of candidates) if (!kept.some((k) => area(intersect(k.bbox, c.bbox)) > 0.8 * c.coverage)) kept.push(c);
  return kept.map((v) => ({ bbox: v.bbox, coverage: Math.round(v.coverage * 100) / 100 }));
}

export function triagePage(p: PageData): PageTriage {
  const fonts = symbolFonts(p);
  const written = writtenRows(p);
  // PDFs can carry artwork outside the crop box; ignore regions mostly off-page.
  const onPage = (c: ChartRegion) => area(clip(c.bbox)) > 0.5 * area(c.bbox);
  const deduped = [
    ...mergeRegions([...vectorGrids(p), ...fontCharts(p, fonts)].filter(onPage)),
    ...(written.region ? [written.region] : []),
  ];

  const textChars = p.spans.reduce((n, s) => n + s.t.length, 0);
  // Pad chart boxes so row/column numbers along the edges count as chart labels.
  const PAD = 0.03;
  const chartBoxes = deduped
    .filter((c) => c.form !== "writtenColor")
    .map((c): BBox => [c.bbox[0] - PAD, c.bbox[1] - PAD, c.bbox[2] + PAD, c.bbox[3] + PAD]);
  const proseChars = p.spans
    .filter((s) => !fonts.has(s.font) && !chartBoxes.some((b) => area(intersect(b, s.b)) > 0.5 * area(s.b)))
    .reduce((n, s) => n + s.t.length, 0);
  const images = contentImages(p, proseChars);

  // Chart glyph text is expensive and useless to the LLM; send the page only
  // if there's prose or an image the LLM must interpret.
  const glyphHeavy = textChars > 0 && proseChars / textChars < 0.3 && deduped.some((c) => c.form === "font");
  const sendToLlm = !glyphHeavy && (proseChars > 0 || images.length > 0);
  const reason = glyphHeavy
    ? "symbol-font chart page; extracted in code"
    : sendToLlm
      ? proseChars > 0
        ? "has prose"
        : "image only"
      : "empty";

  const llmCrops = sendToLlm ? [] : images.map((i) => i.bbox);

  return { page: p.page, textChars, charts: deduped, images, writtenRows: written.summary, proseChars, sendToLlm, llmCrops, reason };
}

/**
 * Symbol-font charts are drawn on vector grids, and both the grid (split by
 * cell size) and the glyphs (split by blank cells) come out fragmented. Merge
 * overlapping regions into one chart; it's a font chart if any glyphs are in it.
 */
function mergeRegions(regions: ChartRegion[]): ChartRegion[] {
  const merged = cluster(
    regions.map((r) => r.bbox),
    0,
  );
  return merged.map((boxes) => {
    const members = regions.filter((r) => boxes.includes(r.bbox));
    const font = members.filter((m) => m.form === "font");
    return {
      form: font.length ? "font" : "vector",
      bbox: union(boxes),
      evidence: [...font, ...members.filter((m) => m.form !== "font")].map((m) => m.evidence).join(" + "),
    };
  });
}

/** Stable ids for a page's detected regions: "p7.c1" for charts, "p3.i2" for content images. */
export function regionIds(p: PageTriage) {
  return {
    charts: p.charts.map((c, i) => ({ id: `p${p.page}.c${i + 1}`, region: c })),
    images: p.images.map((im, i) => ({ id: `p${p.page}.i${i + 1}`, bbox: im.bbox, coverage: im.coverage })),
  };
}
