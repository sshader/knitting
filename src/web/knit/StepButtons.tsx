import { useKnit } from "./KnitContext";
import { untilBlock } from "./navigation";

/** Previous and next; at the end of an open-ended repeat, "again" and "done" instead of next. */
export function StepButtons() {
  const { steps, index, position, next, prev, finishRepeat } = useKnit();
  const repeatEnds = untilBlock(steps, index)?.end === index;
  return (
    <div className="knit-nav">
      <button onClick={prev} disabled={index === 0 && !position.pass} title="Previous (← or k)" aria-label="Previous step">
        ←
      </button>
      {repeatEnds ? (
        <>
          <button className="primary" onClick={next} title="Work the repeat again (→, j, or space)">
            ↺ Again
          </button>
          <button onClick={finishRepeat} title="It measures enough: go on">
            Done →
          </button>
        </>
      ) : (
        <button className="primary" onClick={next} disabled={index >= steps.length - 1} title="Next (→, j, or space)">
          Next →
        </button>
      )}
    </div>
  );
}
