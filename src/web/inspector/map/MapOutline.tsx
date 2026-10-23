import type { Doc } from "../../../../convex/_generated/dataModel";
import type { MapFixture, Verdict } from "../../../extract/mapFixture";
import { ReviewButtons } from "../shared/ReviewButtons";
import { MapScore } from "./MapScore";

export type Selection = { kind: "section" | "chart"; id: string } | null;

/** The map's metadata, sections, and charts, each with a review verdict. */
export function MapOutline({
  saved,
  review,
  onReview,
  selected,
  onSelect,
}: {
  saved: Doc<"maps">;
  review: MapFixture;
  onReview: (change: (r: MapFixture) => MapFixture) => void;
  selected: Selection;
  onSelect: (s: Selection) => void;
}) {
  const { map, usage, problems } = saved;
  const isSelected = (kind: "section" | "chart", id: string) => selected?.kind === kind && selected.id === id;
  return (
    <div className="outline">
      <h2>{map.title}</h2>
      <p className="meta">
        {map.designer} · {usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out
      </p>
      <MapScore map={map} review={review} />
      <ReviewButtons label="Metadata" v={review.meta} onChange={(v) => onReview((r) => ({ ...r, meta: v }))} />
      <dl>
        <dt>Sizes</dt>
        <dd>
          {map.sizes.join(" · ")} <span className="muted">({map.sizeNotation})</span>
        </dd>
        {map.options.length > 0 && (
          <>
            <dt>Options</dt>
            <dd>
              {map.options.map((o) => (
                <div key={o.name}>
                  {o.name}: {o.choices.join(" / ")}
                </div>
              ))}
            </dd>
          </>
        )}
        <dt>Construction</dt>
        <dd>{map.construction}</dd>
      </dl>

      <h3>Sections</h3>
      <ol className="items">
        {map.sections.map((s) => (
          <li key={s.id} className={isSelected("section", s.id) ? "selected" : ""} onClick={() => onSelect({ kind: "section", id: s.id })}>
            <div>
              <b>{s.title}</b> <span className="muted">p{s.pages.join(", ")}</span>
              {s.repeat && <span className="tag">{s.repeat}</span>}
              {s.choices.map((c) => (
                <span key={c} className="tag">
                  {c}
                </span>
              ))}
              {s.chartIds.map((c) => (
                <span key={c} className="tag chart">
                  {c}
                </span>
              ))}
            </div>
            <div className="muted small">{s.summary}</div>
            <ReviewButtons v={review.sections?.[s.id]} onChange={(v) => onReview((r) => ({ ...r, sections: withVerdict(r.sections, s.id, v) }))} />
          </li>
        ))}
      </ol>

      <h3>Charts</h3>
      <ul className="items">
        {map.charts.map((c) => (
          <li key={c.id} className={isSelected("chart", c.id) ? "selected" : ""} onClick={() => onSelect({ kind: "chart", id: c.id })}>
            <div>
              <b>{c.title}</b> <span className="tag chart">{c.id}</span>
            </div>
            <div className="muted small">
              regions {c.regionIds.join(", ") || "—"} · legend {c.legendRegionIds.join(", ") || "—"} · sizes{" "}
              {c.sizes.length ? c.sizes.map((i) => map.sizes[i] ?? `#${i}`).join(", ") : "all"} · {c.readDirection}
              {c.writtenPages.length > 0 && ` · written on p${c.writtenPages.join(", ")}`}
            </div>
            <ReviewButtons v={review.charts?.[c.id]} onChange={(v) => onReview((r) => ({ ...r, charts: withVerdict(r.charts, c.id, v) }))} />
          </li>
        ))}
      </ul>

      {map.techniques.length > 0 && (
        <>
          <h3>Techniques</h3>
          <p className="small">{map.techniques.map((t) => `${t.name} (p${t.page})`).join(" · ")}</p>
        </>
      )}
      {(map.reviewNotes.length > 0 || problems.length > 0) && (
        <>
          <h3>Notes</h3>
          <ul className="small">
            {problems.map((p) => (
              <li key={p} className="bad">
                {p}
              </li>
            ))}
            {map.reviewNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}
      <textarea placeholder="Overall notes on this map" value={review.note ?? ""} onChange={(e) => onReview((r) => ({ ...r, note: e.target.value || undefined }))} />
    </div>
  );
}

function withVerdict(prev: Record<string, Verdict> | undefined, id: string, v: Verdict | undefined) {
  const { [id]: _old, ...rest } = prev ?? {};
  return v ? { ...rest, [id]: v } : rest;
}
