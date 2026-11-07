import { useKnit } from "../KnitContext";

/** A count with big − and + buttons, guarded against double taps; the number pops when it changes. */
export function CountControls({ id, count, onCount }: { id: string; count: number; onCount: (by: number) => void }) {
  const { tap } = useKnit();
  return (
    <div className="counter-controls">
      <button aria-label="Count down" disabled={count === 0} onClick={() => tap(`${id}-`, (times) => onCount(-times))}>
        −
      </button>
      <span key={count} className="counter-count">
        {count}
      </span>
      <button className="primary" aria-label="Count up" onClick={() => tap(`${id}+`, onCount)}>
        +
      </button>
    </div>
  );
}
