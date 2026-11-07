import { useKnit } from "../KnitContext";
import { rowsIn, untilBlock } from "../navigation";
import { CountControls } from "../notes/CountControls";

/**
 * For a step in an open-ended repeat: the condition, the rows worked (counted
 * as you go, and kept if you step away), and at the end of the block, the
 * choice to go again or move on.
 */
export function RepeatUntil() {
  const { steps, index, step, repeats, browsing, next, finishRepeat, countRepeat } = useKnit();
  const block = untilBlock(steps, index);
  if (!block || !step?.until) return null;
  const rows = rowsIn(steps, repeats, block);
  const length = block.end - block.start + 1;
  return (
    <div className="repeat-until">
      <div className="repeat-until-head">
        <span className="step-also-tag">Repeat until</span>
        {length > 1 && <span className="repeat-until-time">Time {Math.floor(rows / length) + 1}</span>}
      </div>
      <div className="repeat-until-goal">{step.until.replace(/^until\s+/i, "")}</div>
      <div className="repeat-until-rows">
        <span>Rows worked</span>
        <CountControls id={`repeat:${steps[block.start].node}`} count={rows} onCount={countRepeat} />
      </div>
      {index === block.end && !browsing && (
        <div className="repeat-until-actions">
          <button onClick={next}>↺ Work {length > 1 ? "the repeat" : "this row"} again</button>
          <button className="primary" onClick={finishRepeat}>
            It's long enough →
          </button>
        </div>
      )}
    </div>
  );
}
