import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { mismatches } from "../../../extract/triageFixture";
import { useSetTriageReview } from "../shared/reviews";
import { usePatternParam } from "../shared/usePatternParam";
import { FORMS } from "./forms";
import { TriageDetail } from "./TriageDetail";
import { TriagePageCard } from "./TriagePageCard";

/**
 * Reviewing stage 0: every page with its detected regions overlaid. Opening
 * a page lets you record what triage should have found.
 */
export function TriageInspector() {
  const patterns = useQuery(api.patterns.list);
  const [pattern, setPattern] = usePatternParam(patterns?.map((p) => p.slug));
  const pages = useQuery(api.pages.forPattern, pattern ? { pattern } : "skip") ?? [];
  const saveReview = useSetTriageReview(pattern ?? "");
  const [open, setOpen] = useState<number | null>(null);
  const [onlyInteresting, setOnlyInteresting] = useState(false);

  const visible = pages.filter((p) => !onlyInteresting || p.triage.charts.length > 0 || p.triage.images.length > 0 || !p.triage.sendToLlm);
  const reviewed = pages.filter((p) => p.triageReview);
  const failing = reviewed.filter((p) => mismatches(p.triage, p.triageReview!).length > 0).length;
  const toLlm = pages.filter((p) => p.triage.sendToLlm).length;
  const openPage = pages.find((p) => p.page === open);

  return (
    <div className="inspector">
      <aside>
        <h1>Triage</h1>
        {patterns?.length === 0 && <p className="muted small">No patterns yet. Run: npx tsx scripts/triage.ts</p>}
        <ul>
          {patterns?.map((p) => (
            <li key={p.slug} className={p.slug === pattern ? "active" : ""} onClick={() => (setPattern(p.slug), setOpen(null))}>
              <div className="name">{p.docs.map((d) => d.source).join(" + ")}</div>
              <div className="meta">{p.docs.reduce((n, d) => n + d.pageCount, 0)}p</div>
            </li>
          ))}
        </ul>
        <div className="legend">
          {FORMS.map((f) => (
            <span key={f} className={`chip ${f}`}>
              {f === "raster" ? "image" : f}
            </span>
          ))}
        </div>
      </aside>

      <main>
        <header>
          <span>
            {toLlm}/{pages.length} pages to LLM · reviewed {reviewed.length}/{pages.length}
            {failing > 0 && <b className="bad"> · {failing} wrong</b>}
          </span>
          <label>
            <input type="checkbox" checked={onlyInteresting} onChange={(e) => setOnlyInteresting(e.target.checked)} /> Only pages with charts, images, or skipped
          </label>
        </header>
        <div className="grid">
          {visible.map((p) => (
            <TriagePageCard key={p._id} p={p} onOpen={() => setOpen(p.page)} />
          ))}
        </div>
      </main>

      {openPage && (
        <TriageDetail
          p={openPage}
          onSave={(review) => saveReview(openPage._id, review)}
          onMove={(d) => {
            const i = visible.findIndex((x) => x.page === open) + d;
            if (i >= 0 && i < visible.length) setOpen(visible[i].page);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
