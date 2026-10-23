import { useKnit } from "./KnitContext";
import { PanelsMenu } from "./PanelsMenu";
import { untilBlock } from "./navigation";

/** Project, size, how far along, and the big previous/next buttons. */
export function TopBar({ onExit, panels }: { onExit: () => void; panels: Parameters<typeof PanelsMenu>[0] }) {
  const { project, map, steps, index, step, position, next, prev, finishRepeat } = useKnit();
  const repeatEnds = untilBlock(steps, index)?.end === index;
  const done = steps.length ? (index + 1) / steps.length : 0;
  const size = map.sizes[project.size];
  const setup = [/size/i.test(size) ? size : `Size ${size}`, ...project.choices].join(" · ");
  return (
    <header className="knit-bar">
      <button className="quiet" onClick={onExit}>
        ← Projects
      </button>
      <div className="knit-title">
        <b>{project.name}</b>
        <span className="muted">{setup}</span>
      </div>
      <div className="knit-progress" title={`${Math.round(done * 100)}% through the pattern`}>
        <div className="knit-progress-text">
          <span>{step?.section.title}</span>
          <span className="muted">
            Step {index + 1} of {steps.length}
          </span>
        </div>
        <div className="knit-progress-track">
          <div style={{ width: `${done * 100}%` }} />
        </div>
      </div>
      <div className="knit-nav">
        <button onClick={prev} disabled={index === 0 && !position.pass} title="Previous (← or k)">
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
      <PanelsMenu {...panels} />
    </header>
  );
}
