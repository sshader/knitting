import { useKnit } from "./KnitContext";
import { untilBlock } from "./navigation";

/**
 * Previous and next, and a bookmark to read ahead; at the end of an
 * open-ended repeat, "again" and "done" instead of next. While reading
 * ahead, previous and next page through the pattern and the bookmark goes back.
 */
export function StepButtons() {
  const { steps, index, browsing, neighbors, next, prev, finishRepeat, readAhead, backToPlace } = useKnit();
  const back = (
    <button onClick={prev} disabled={neighbors.prev === undefined} title="Previous (← or k)" aria-label="Previous step">
      ←
    </button>
  );
  if (browsing) {
    return (
      <div className="knit-nav browsing">
        {back}
        <button className="primary" onClick={backToPlace} title="Back to the step you're knitting (Esc)">
          🔖 Back to my place
        </button>
        <button onClick={next} disabled={neighbors.next === undefined} title="Next (→, j, or space)" aria-label="Next step">
          →
        </button>
      </div>
    );
  }
  const repeatEnds = untilBlock(steps, index)?.end === index;
  return (
    <div className="knit-nav">
      {back}
      <button className="read-ahead" onClick={readAhead} disabled={index >= steps.length - 1} title="Read ahead; your place stays bookmarked" aria-label="Read ahead">
        🔖
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
        <button className="primary" onClick={next} disabled={neighbors.next === undefined} title="Next (→, j, or space)">
          Next →
        </button>
      )}
    </div>
  );
}
