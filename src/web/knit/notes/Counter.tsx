import { useState } from "react";
import type { Doc } from "../../../../convex/_generated/dataModel";
import type { useCounters } from "./useCounters";

/** One counter: its name (click to rename), the count with big − and + buttons, and reset and delete. */
export function Counter({ counter, actions }: { counter: Doc<"counters">; actions: ReturnType<typeof useCounters> }) {
  const [label, setLabel] = useState(counter.label);
  const counterId = counter._id;
  const rename = () => {
    if (label.trim() && label !== counter.label) void actions.update({ counterId, label });
    else setLabel(counter.label);
  };
  const confirmFirst = (question: string, act: () => void) => {
    if (counter.count === 0 || confirm(question)) act();
  };

  return (
    <div className="counter">
      <input
        className="counter-label"
        value={label}
        aria-label="Counter name"
        onChange={(e) => setLabel(e.target.value)}
        onBlur={rename}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      <div className="counter-controls">
        <button aria-label="Count down" disabled={counter.count === 0} onClick={() => void actions.bump({ counterId, by: -1 })}>
          −
        </button>
        <span className="counter-count">{counter.count}</span>
        <button className="primary" aria-label="Count up" onClick={() => void actions.bump({ counterId, by: 1 })}>
          +
        </button>
      </div>
      <div className="counter-menu">
        <button className="quiet" title="Reset to 0" disabled={counter.count === 0} onClick={() => confirmFirst(`Reset “${counter.label}” to 0?`, () => void actions.update({ counterId, count: 0 }))}>
          ↺
        </button>
        <button className="quiet" title="Delete counter" onClick={() => confirmFirst(`Delete “${counter.label}” (at ${counter.count})?`, () => void actions.remove({ counterId }))}>
          ×
        </button>
      </div>
    </div>
  );
}
