import type { DocMap } from "../../../extract/docMap";
import type { Verdict } from "../../../extract/mapFixture";
import type { FlatNode } from "../../../extract/sectionSchema";
import { textForSize } from "../../../shared/sized";
import { ReviewButtons } from "../shared/ReviewButtons";

/** Size index meaning "show every size's values as extracted". */
export const ALL_SIZES = -1;

const fmt = (xs: number[], size: number) => (xs.length === 0 ? "" : size === ALL_SIZES || xs.length === 1 ? xs.join("|") : String(xs[size]));

/** One extracted node: its kind, label, the tags that matter for the chosen size, and its text. */
export function NodeRow({
  n,
  depth,
  map,
  size,
  selected,
  verdict,
  onSelect,
  onReview,
}: {
  n: FlatNode;
  depth: number;
  map: DocMap;
  size: number;
  selected: boolean;
  verdict?: Verdict;
  onSelect: () => void;
  onReview: (v: Verdict | undefined) => void;
}) {
  const forSize = (t: string) => (size === ALL_SIZES ? t : textForSize(t, size));
  const chart = n.chartRefs
    .map((r) => (size === ALL_SIZES || r.ids.length === 1 ? (r.ids.length > 1 ? `[${r.ids.join("|")}]` : r.ids[0]) : r.ids[size]))
    .filter(Boolean)
    .join(" + ");
  const rows = [fmt(n.fromRow, size), fmt(n.toRow, size)].filter(Boolean).join("–");
  return (
    <li
      className={`node ${n.kind} ${selected ? "selected" : ""} ${verdict ? (verdict.ok ? "ok" : "wrong") : ""}`}
      style={{ marginLeft: depth * 20 }}
      onClick={onSelect}
    >
      <div className="node-head">
        <span className={`kind ${n.kind}`}>{n.kind}</span>
        {(n.label || n.title) && <b>{n.title || n.label}</b>}
        {n.side !== "none" && <span className="tag">{n.side}</span>}
        {n.rows.length > 0 && fmt(n.rows, size) !== "1" && <span className="tag">× {fmt(n.rows, size)} rows</span>}
        {n.times.length > 0 && <span className="tag">× {fmt(n.times, size)}</span>}
        {n.until && <span className="tag">until {n.until}</span>}
        {chart && (
          <span className="tag chart">
            {chart}
            {rows && ` r${rows}`}
          </span>
        )}
        {n.sizes.length > 0 && <span className="tag">sizes {n.sizes.map((i) => map.sizes[i]).join(", ")}</span>}
        {n.choices.map((c) => (
          <span key={c} className="tag">
            {c}
          </span>
        ))}
        {n.stitchCount.length > 0 && <span className="tag">= {fmt(n.stitchCount, size)} sts</span>}
        <ReviewButtons v={verdict} onChange={onReview} />
      </div>
      {n.text && <div className="node-text">{forSize(n.text)}</div>}
      {n.overlays.map((o) => (
        <div key={o.id} className="overlay small">
          ↳ at the same time: {forSize(o.text)} — first row {fmt(o.first, size)}
          {o.every.length > 0 && `, every ${fmt(o.every, size)}`}
          {o.count.length > 0 && `, ${fmt(o.count, size)} times`}
        </div>
      ))}
    </li>
  );
}
