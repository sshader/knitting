import { useEffect, useRef, useState } from "react";
import type { Chart } from "../../shared/schema";

/**
 * Dev tool for reviewing chart extraction: the chart image from the PDF, the
 * grid we rebuilt from it, and the generated row-by-row instructions, side by
 * side. Selecting a row (click anywhere, or j/k) highlights it in all three.
 */

interface IndexEntry {
  pattern: string;
  chartId: string;
  title: string;
  size: string;
  comparison: { rows: number; identical: number; stitchesDiffering: number } | null;
}

interface RowOut {
  row: number;
  side?: "RS" | "WS";
  text?: string;
  stitches?: number;
  written?: string;
  differs?: number | null;
  error?: string;
}

export interface ChartFile {
  chart: Chart;
  naming: { notes: string[] };
  grid: { gridBox: number[]; cols: number; rows: number };
  image: { file: string; cropBox: number[] };
  rows: RowOut[];
  checks: {
    unassignedCells: number;
    written: IndexEntry["comparison"];
    stitchCounts: { checkpoints: { node: string; row: number; size: number; stated: number; perRepeat: number; repeats: number }[]; problems: string[] };
  };
}

export function ChartsInspector() {
  const [index, setIndex] = useState<IndexEntry[]>([]);
  const [sel, setSel] = useState<{ pattern: string; chartId: string } | null>(null);
  const [file, setFile] = useState<ChartFile | null>(null);
  const [row, setRow] = useState(1);

  useEffect(() => {
    fetch("/data/charts/index.json")
      .then((r) => r.json())
      .then((ix: IndexEntry[]) => {
        setIndex(ix);
        if (ix[0]) setSel({ pattern: ix[0].pattern, chartId: ix[0].chartId });
      });
  }, []);

  useEffect(() => {
    if (!sel) return;
    fetch(`/data/charts/${sel.pattern}/${sel.chartId}.json`)
      .then((r) => r.json())
      .then((f: ChartFile) => {
        setFile(f);
        setRow(f.chart.firstRow ?? 1);
      });
  }, [sel]);

  const first = file?.chart.firstRow ?? 1;
  const last = file ? first + file.chart.cells.length - 1 : 1;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" || e.key === "ArrowUp") setRow((r) => Math.min(last, r + 1));
      if (e.key === "j" || e.key === "ArrowDown") setRow((r) => Math.max(first, r - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [first, last]);

  return (
    <div className="inspector">
      <aside>
        <h1>Charts</h1>
        <ul>
          {index.map((e) => (
            <li
              key={`${e.pattern}/${e.chartId}`}
              className={sel?.pattern === e.pattern && sel.chartId === e.chartId ? "active" : ""}
              onClick={() => setSel({ pattern: e.pattern, chartId: e.chartId })}
            >
              <div className="name">{e.title}</div>
              <div className="meta">
                {e.pattern} · {e.size}
                {e.comparison && (
                  <span className={e.comparison.identical === e.comparison.rows ? "good" : "bad"}>
                    {" "}
                    · {e.comparison.identical}/{e.comparison.rows} rows match written
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
        {file && (
          <>
            <h3>Legend</h3>
            <ul className="legend-list">
              {Object.entries(file.chart.legend).map(([k, e]) => (
                <li key={k}>
                  <span className="swatch" style={{ background: e.noStitch ? "#222" : e.swatch }}>
                    {symbolFor(k, e)}
                  </span>
                  {e.label}
                </li>
              ))}
            </ul>
            {file.chart.cellNote && <p className="small">{file.chart.cellNote}</p>}
            <details className="small">
              <summary>Model notes</summary>
              <ul>
                {file.naming.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </details>
            <h3>Checks</h3>
            <ul className="small">
              {file.checks.unassignedCells > 0 && <li className="bad">{file.checks.unassignedCells} cells not assigned to a legend entry</li>}
              <li className={file.checks.stitchCounts.problems.length ? "bad" : "good"}>
                Stitch counts: {file.checks.stitchCounts.checkpoints.length} checkpoints from the sections,{" "}
                {file.checks.stitchCounts.problems.length ? `${file.checks.stitchCounts.problems.length} problems` : "all consistent"}
              </li>
              {file.checks.stitchCounts.problems.map((p) => (
                <li key={p} className="bad">
                  {p}
                </li>
              ))}
              {file.checks.written && (
                <li className={file.checks.written.identical === file.checks.written.rows ? "good" : "bad"}>
                  Written rows: {file.checks.written.identical}/{file.checks.written.rows} identical
                </li>
              )}
            </ul>
            <p className="small muted">j/k or ↓/↑ to move between rows</p>
          </>
        )}
      </aside>
      {file && sel && (
        <main className="charts-main">
          <section>
            <h3>PDF</h3>
            <PdfChart file={file} row={row} onRow={setRow} />
          </section>
          <section>
            <h3>Rebuilt grid</h3>
            <Grid chart={file.chart} row={row} onRow={setRow} />
          </section>
          <section className="rows-pane">
            <h3>
              Rows{" "}
              {file.checks.written && (
                <span className="small muted">
                  {file.checks.written.identical}/{file.checks.written.rows} match the written rows · {file.checks.written.stitchesDiffering} stitches differ
                </span>
              )}
            </h3>
            <RowList rows={file.rows} row={row} onRow={setRow} />
          </section>
        </main>
      )}
    </div>
  );
}

const symbolFor = (key: string, e: Chart["legend"][string]) => (e.noStitch || /^[kp]$/.test(e.rs ?? "") ? "" : key);

/** The chart image with a band over the selected row; click to select a row. */
export function PdfChart({ file, row, onRow }: { file: ChartFile; row: number; onRow: (r: number) => void }) {
  const [cx0, cy0, cx1, cy1] = file.image.cropBox;
  const [gx0, gy0, gx1, gy1] = file.grid.gridBox;
  const rows = file.grid.rows;
  const first = file.chart.firstRow ?? 1;
  const rel = (v: number, a: number, b: number) => ((v - a) / (b - a)) * 100;
  const rowTop = gy0 + ((rows - (row - first) - 1) / rows) * (gy1 - gy0);
  const rowH = (gy1 - gy0) / rows;
  return (
    <div
      className="page chart-img"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const y = cy0 + ((e.clientY - r.top) / r.height) * (cy1 - cy0);
        const fromTop = Math.floor((y - gy0) / rowH);
        if (fromTop >= 0 && fromTop < rows) onRow(first + rows - 1 - fromTop);
      }}
    >
      <img src={`/${file.image.file}`} alt="chart" />
      <div
        className="row-band"
        style={{
          left: `${rel(gx0, cx0, cx1)}%`,
          width: `${rel(gx1, cx0, cx1) - rel(gx0, cx0, cx1)}%`,
          top: `${rel(rowTop, cy0, cy1)}%`,
          height: `${(rowH / (cy1 - cy0)) * 100}%`,
        }}
      />
    </div>
  );
}

/** The extracted cells drawn from the legend's swatches; row 1 at the bottom, columns numbered from the right. */
export function Grid({ chart, row, onRow }: { chart: Chart; row: number; onRow: (r: number) => void }) {
  const cols = chart.width;
  const rows = chart.cells.length;
  const first = chart.firstRow ?? 1;
  const cw = 10;
  const ch = 10;
  const ref = useRef<SVGSVGElement>(null);
  return (
    <svg ref={ref} className="grid-svg" viewBox={`-18 -12 ${cols * cw + 22} ${rows * ch + 14}`}>
      {chart.cells.map((cells, i) => {
        const r = first + i;
        const y = (rows - 1 - i) * ch;
        return (
          <g key={r} onClick={() => onRow(r)}>
            {[...cells].map((k, c) => {
              const e = chart.legend[k];
              const fill = !e ? "#f0f" : e.noStitch ? "#222" : (e.swatch ?? "#ddd");
              const sym = e ? symbolFor(k, e) : "?";
              return (
                <g key={c}>
                  <rect x={c * cw} y={y} width={cw} height={ch} fill={fill} stroke="#999" strokeWidth={0.3} />
                  {sym && (
                    <text x={c * cw + cw / 2} y={y + ch * 0.75} fontSize={7} textAnchor="middle" fill="#000">
                      {sym}
                    </text>
                  )}
                </g>
              );
            })}
            {r % 5 === 0 || r === first ? (
              <text x={-3} y={y + ch * 0.75} fontSize={6} textAnchor="end" fill="#666">
                {r}
              </text>
            ) : null}
          </g>
        );
      })}
      {Array.from({ length: cols }, (_, c) => cols - c).map((n, c) =>
        n % 5 === 0 || n === 1 ? (
          <text key={n} x={c * cw + cw / 2} y={-3} fontSize={6} textAnchor="middle" fill="#666">
            {n}
          </text>
        ) : null,
      )}
      <rect x={-1} y={(rows - 1 - (row - first)) * ch - 1} width={cols * cw + 2} height={ch + 2} fill="none" stroke="#e0a100" strokeWidth={2} />
    </svg>
  );
}

function RowList({ rows, row, onRow }: { rows: RowOut[]; row: number; onRow: (r: number) => void }) {
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
