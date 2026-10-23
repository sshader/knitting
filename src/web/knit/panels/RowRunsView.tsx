import type { Chart } from "../../../shared/schema";
import type { Mark, RowLayout } from "../navigation";
import type { RowRun } from "../rowRuns";
import { ColoredRunText } from "./ColoredRunText";

/**
 * A chart row as runs you can mark your place in: tap a run (or press . and ,)
 * and the ones before it fade. The repeat shows which time through it you're on.
 */
export function RowRunsView({
  runs,
  layout,
  mark,
  chart,
  onMark,
}: {
  runs: RowRun[];
  layout: RowLayout;
  mark: Mark | undefined;
  chart: Chart;
  onMark: (mark: Mark | undefined) => void;
}) {
  const chip = (r: RowRun, i: number) => {
    const state = !mark ? "" : i < mark.run ? "done" : i === mark.run ? "current" : "";
    // Tapping a run in the repeat keeps the time through it you're on; tapping the current run clears the mark.
    const tapped = { run: i, repeat: r.part === "repeat" ? Math.max(1, mark?.repeat ?? 1) : 0 };
    return (
      <button key={i} className={`run ${state}`} onClick={() => onMark(state === "current" ? undefined : tapped)}>
        <ColoredRunText text={r.text} chart={chart} />
      </button>
    );
  };
  const indexed = runs.map((r, i) => ({ r, i }));
  const part = (p: RowRun["part"]) => indexed.filter(({ r }) => r.part === p).map(({ r, i }) => chip(r, i));
  const inRepeat = mark && mark.repeat > 0;
  const time = inRepeat ? mark.repeat : mark && mark.run >= layout.before + layout.repeat ? layout.times : null;

  return (
    <div className="row-runs">
      {part("before")}
      {layout.repeat > 0 && (
        <span className="run-repeat">
          <span className="run-star">*</span>
          {part("repeat")}
          <span className="run-star">*</span>
          <span className="run-times">
            repeat {layout.times ? `${layout.times} times` : "to end"}
            {inRepeat && (
              <span className="repeat-counter">
                <button onClick={() => onMark({ ...mark, repeat: Math.max(1, mark.repeat - 1) })} aria-label="One fewer repeat">
                  −
                </button>
                <b>{time}</b>
                {layout.times ? ` of ${layout.times}` : ""}
                <button onClick={() => onMark({ ...mark, repeat: layout.times ? Math.min(layout.times, mark.repeat + 1) : mark.repeat + 1 })} aria-label="One more repeat">
                  +
                </button>
              </span>
            )}
          </span>
        </span>
      )}
      {part("after")}
      {!mark && <div className="run-hint">{matchMedia("(hover: none)").matches ? "Tap where you are in the row" : "Tap where you are, or press . and , to step through the row"}</div>}
    </div>
  );
}
