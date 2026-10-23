import { useEffect, useRef } from "react";
import type { ExpandedStep } from "../../../shared/expand";

/** Every step, grouped under section headings, flagging steps whose counts or rows disagree with the pattern. */
export function StepList({ steps, i, onSelect }: { steps: ExpandedStep[]; i: number; onSelect: (k: number) => void }) {
  const selected = useRef<HTMLLIElement>(null);
  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest" });
  }, [i]);
  return (
    <ol className="items step-list">
      {steps.map((s, k) => (
        <li key={k} ref={k === i ? selected : undefined} className={k === i ? "selected" : ""} onClick={() => onSelect(k)}>
          {(k === 0 || steps[k - 1].section.id !== s.section.id) && <div className="small muted step-list-section">{s.section.title}</div>}
          <b>{s.label}</b>
          {s.stitches && <span className="small muted"> · {s.stitches.after} sts</span>}
          {(s.statedStitches !== undefined || (s.chart?.written !== undefined && !s.chart.writtenMatches)) && <span className="bad"> ⚠</span>}
        </li>
      ))}
    </ol>
  );
}
