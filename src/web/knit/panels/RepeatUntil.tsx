import { useKnit } from "../KnitContext";
import { rowsIntoRepeat, untilBlock } from "../navigation";

/**
 * For a step in an open-ended repeat: the condition, how many times through
 * and rows so far, and at the end of the block, the choice to go again or move on.
 */
export function RepeatUntil() {
  const { steps, index, position, step, next, finishRepeat } = useKnit();
  const block = untilBlock(steps, index);
  if (!block || !step?.until) return null;
  const rows = rowsIntoRepeat(steps, position)!;
  const atEnd = index === block.end;
  const length = block.end - block.start + 1;
  return (
    <div className="repeat-until">
      <div className="repeat-until-head">
        <span className="step-also-tag">Repeat until</span>
        <span className="repeat-until-count">
          {length > 1 && `Time ${(position.pass ?? 0) + 1} · `}
          <b>{rows}</b> {rows === 1 ? "row" : "rows"} so far
        </span>
      </div>
      <div className="repeat-until-goal">{step.until.replace(/^until\s+/i, "")}</div>
      {atEnd && (
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
