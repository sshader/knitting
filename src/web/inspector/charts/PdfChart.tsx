import type { ChartRow } from "../shared/types";

/** The chart image from the PDF with a band over the selected row; click to select a row. */
export function PdfChart({ c, row, onRow }: { c: ChartRow; row: number; onRow: (r: number) => void }) {
  const [cx0, cy0, cx1, cy1] = c.image.cropBox;
  const [gx0, gy0, gx1, gy1] = c.gridBox;
  const rows = c.chart.cells.length;
  const first = c.chart.firstRow ?? 1;
  const rel = (v: number, a: number, b: number) => ((v - a) / (b - a)) * 100;
  const rowH = (gy1 - gy0) / rows;
  const rowTop = gy0 + (rows - (row - first) - 1) * rowH;
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
      <img src={c.imageUrl} alt="chart" />
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
