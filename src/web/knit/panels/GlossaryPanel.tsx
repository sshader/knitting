import { useState } from "react";
import { symbolFor } from "../../inspector/charts/symbol";
import { useKnit } from "../KnitContext";

/** Abbreviations, the techniques the pattern explains, and the charts' symbols, searchable. */
export function GlossaryPanel() {
  const { glossary, charts, map, pages, project } = useKnit();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = (...texts: string[]) => !q || texts.some((t) => t.toLowerCase().includes(q));

  const abbreviations = glossary?.abbreviations.filter((a) => matches(a.abbrev, a.meaning)) ?? [];
  const techniques = glossary?.techniques.filter((t) => matches(t.name, t.text)) ?? [];
  // The same symbol in several charts (one per size, say) is listed once; swatches can differ slightly between scans.
  const symbols = [
    ...new Map(
      Object.values(charts).flatMap((c) =>
        Object.entries(c.chart.legend)
          .filter(([, e]) => matches(e.label, e.rs ?? "", e.color ?? ""))
          .map(([k, e]) => [`${e.label}|${e.rs}|${e.color}`, { key: k, e }] as const),
      ),
    ).values(),
  ];

  if (!glossary) {
    const glossaryPages = map.pages.filter((p) => p.roles.includes("glossary") || p.roles.includes("techniques")).map((p) => p.page);
    return (
      <div className="glossary-panel">
        <p className="panel-empty">
          Not extracted yet. Run <code>npx tsx scripts/glossary.ts {project.pattern}</code>. Meanwhile, the pattern's own pages:
        </p>
        {pages
          .filter((p) => glossaryPages.includes(p.page))
          .map((p) => (
            <img key={p.page} className="glossary-page" src={p.pngUrl} alt={`page ${p.page}`} />
          ))}
      </div>
    );
  }

  return (
    <div className="glossary-panel">
      <header className="panel-bar">
        <input className="glossary-search" type="search" placeholder="Look up an abbreviation or technique" value={query} onChange={(e) => setQuery(e.target.value)} />
      </header>
      <div className="glossary-scroll">
        {abbreviations.length > 0 && (
          <section>
            <h3>Abbreviations</h3>
            <dl className="abbreviations">
              {abbreviations.map((a) => (
                <div key={a.abbrev}>
                  <dt>{a.abbrev}</dt>
                  <dd>{a.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {techniques.length > 0 && (
          <section>
            <h3>Techniques</h3>
            {techniques.map((t) => (
              <details key={t.name} open={!!q}>
                <summary>
                  {t.name} <span className="muted">p{t.page}</span>
                </summary>
                {t.text ? <p className="technique-text">{t.text}</p> : <p className="muted">The pattern links a video for this one (see page {t.page}).</p>}
              </details>
            ))}
          </section>
        )}
        {symbols.length > 0 && (
          <section>
            <h3>Chart symbols</h3>
            <ul className="chart-legend">
              {symbols.map(({ key, e }) => (
                <li key={`${e.label}-${key}`}>
                  <svg className="legend-cell" viewBox="0 0 16 16" width={22} height={22}>
                    <rect x={0.5} y={0.5} width={15} height={15} fill={e.noStitch ? "var(--chart-no-stitch)" : (e.swatch ?? "#ddd")} />
                    <text x={8} y={11.5} className="cell-symbol" textAnchor="middle">
                      {symbolFor(key, e)}
                    </text>
                  </svg>
                  <span className="legend-text">
                    <span className="legend-label">{e.label}</span>
                    <span className="legend-stitch">
                      {e.noStitch ? "no stitch — skip" : (e.rs ?? "")}
                      {e.color && ` · ${e.color}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {q && abbreviations.length + techniques.length + symbols.length === 0 && <p className="panel-empty">Nothing matches “{query}”.</p>}
      </div>
    </div>
  );
}
