import { useEffect, useMemo, useRef } from "react";
import { useKnit } from "../KnitContext";
import { groupSteps } from "../steps";

/**
 * The whole pattern as an outline: sections, and within them each
 * instruction once ("Rounds 2-48") with how far through it you are.
 */
export function StepsPanel() {
  const { steps, index, go } = useKnit();
  const groups = useMemo(() => groupSteps(steps), [steps]);
  const current = useRef<HTMLLIElement>(null);

  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest" });
  }, [index]);

  return (
    <ol className="steps-outline">
      {groups.map((g, k) => {
        const isCurrent = index >= g.start && index < g.start + g.count;
        const done = index >= g.start + g.count;
        const newSection = k === 0 || groups[k - 1].section.id !== g.section.id;
        // Section headings are their own items so they stay pinned while the section scrolls by.
        const heading = newSection && (
          <li key={`h${g.start}`} className="outline-section">
            {g.section.title}
          </li>
        );
        return [
          heading,
          <li key={g.start} ref={isCurrent ? current : undefined} className={`${isCurrent ? "current" : ""} ${done ? "done" : ""}`}>
            <button onClick={() => go(g.start)}>
              <span className="outline-label">{g.label}</span>
              {g.count > 1 && <span className="outline-count">{isCurrent ? `${index - g.start + 1} / ${g.count}` : `${g.count} rows`}</span>}
            </button>
            {isCurrent && g.count > 1 && (
              <div className="outline-progress">
                <div style={{ width: `${((index - g.start + 1) / g.count) * 100}%` }} />
              </div>
            )}
          </li>,
        ];
      })}
    </ol>
  );
}
