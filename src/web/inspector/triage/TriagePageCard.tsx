import type { PageRow } from "../shared/types";
import { reviewStatus } from "./forms";
import { TriageOverlay } from "./TriageOverlay";

export function TriagePageCard({ p, onOpen }: { p: PageRow; onOpen: () => void }) {
  const s = reviewStatus(p, p.triageReview);
  const t = p.triage;
  return (
    <figure className={`card ${s.cls}`} onClick={onOpen}>
      <div className="page">
        <img src={p.pngUrl} loading="lazy" alt={`page ${p.page}`} />
        <TriageOverlay triage={t} />
      </div>
      <figcaption>
        <span>p{p.page}</span>
        <span className={t.sendToLlm ? "llm" : "skip"}>
          {t.sendToLlm ? "LLM" : t.llmCrops.length ? `${t.llmCrops.length} crop${t.llmCrops.length > 1 ? "s" : ""} to LLM` : "skip"}
        </span>
        <span className="status">{s.label}</span>
      </figcaption>
    </figure>
  );
}
