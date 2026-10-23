import { useEffect, useRef } from "react";
import type { RowReport } from "../../../extract/chartReport";

/** Generated instructions for every row, top row first, flagged where they differ from the pattern's written rows. */
export function ChartRowList({ rows, row, onRow }: { rows: RowReport[]; row: number; onRow: (r: number) => void }) {
  const selected = useRef<HTMLLIElement>(null);
  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest" });
  }, [row]);
  return (
    <ol className="chart-rows">
      {[...rows].reverse().map((r) => (
        <li
          key={r.row}
          ref={r.row === row ? selected : undefined}
          className={`${r.row === row ? "selected" : ""} ${r.differs ? "wrong" : r.differs === 0 ? "ok" : ""}`}
          onClick={() => onRow(r.row)}
        >
          <div className="row-head">
            <b>Row {r.row}</b> <span className="muted small">{r.side}</span> <span className="muted small">{r.stitches} sts</span>
            {r.differs ? <span className="bad small"> {r.differs} sts differ from written</span> : null}
          </div>
          {r.error ? <div className="bad small">{r.error}</div> : <div>{r.text}</div>}
          {r.written !== undefined && r.differs !== 0 && <div className="small muted">written: {r.written}</div>}
        </li>
      ))}
    </ol>
  );
}
