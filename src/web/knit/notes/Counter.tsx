import { useState } from "react";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { CountControls } from "./CountControls";
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
      <CountControls id={counterId} count={counter.count} onCount={(by) => void actions.bump({ counterId, by })} />
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
