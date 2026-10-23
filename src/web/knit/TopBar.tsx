import { useKnit } from "./KnitContext";

/** Project, size, how far along, and the big previous/next buttons. */
export function TopBar({ onExit, onResetLayout }: { onExit: () => void; onResetLayout: () => void }) {
  const { project, map, steps, index, step, go } = useKnit();
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
        <button onClick={() => go(index - 1)} disabled={index === 0} title="Previous (← or k)">
          ←
        </button>
        <button className="primary" onClick={() => go(index + 1)} disabled={index >= steps.length - 1} title="Next (→, j, or space)">
          Next →
        </button>
      </div>
      <button className="quiet" onClick={onResetLayout} title="Put the panels back where they started">
        Reset layout
      </button>
    </header>
  );
}
