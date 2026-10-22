import { useEffect, useState } from "react";
import type { PageRef } from "../../extract/mapInput";
import type { Step, StepsFixture } from "../../shared/steps";
import { Grid, PdfChart, type ChartFile } from "./ChartsInspector";
import { SourceView } from "./SectionsInspector";

/**
 * Preview of the knitting view's step format, from hand-written fixtures
 * (fixtures/steps). For settling what a step should show before building the
 * expander that produces steps from sections and charts.
 */

const PATTERNS = ["lucky-stars-beanie-v5", "moonbun-jumper-by-saskieco"];

export function StepsPreview() {
  const [pattern, setPattern] = useState(PATTERNS[0]);
  const [fixture, setFixture] = useState<StepsFixture | null>(null);
  const [pages, setPages] = useState<PageRef[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [charts, setCharts] = useState<Record<string, ChartFile>>({});
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
    (async () => {
      const f: StepsFixture = await (await fetch(`/fixtures/steps/${pattern}.json`)).json();
      const m = await (await fetch(`/data/map/text/${pattern}.json`)).json();
      const ids = [...new Set(f.steps.flatMap((s) => (s.chart ? [s.chart.chartId] : [])))];
      const loaded = await Promise.all(ids.map(async (id) => [id, await (await fetch(`/data/charts/${pattern}/${id}.json`)).json()] as const));
      setFixture(f);
      setPages(m.pages);
      setSizes(m.map.sizes);
      setCharts(Object.fromEntries(loaded));
    })();
  }, [pattern]);

  const step = fixture?.steps[i];
  const chart = step?.chart ? charts[step.chart.chartId] : null;

  return (
    <div className="inspector">
      <aside>
        <h1>Steps preview</h1>
        <ul>
          {PATTERNS.map((p) => (
            <li key={p} className={p === pattern ? "active" : ""} onClick={() => setPattern(p)}>
              <div className="name">{p}</div>
            </li>
          ))}
        </ul>
        {fixture && (
          <>
            <h3>Size {sizes[fixture.size]}</h3>
            <ol className="items">
              {fixture.steps.map((s, k) => (
                <li key={k} className={k === i ? "selected" : ""} onClick={() => setI(k)}>
                  <b>{s.label}</b>
                  <div className="small muted">{s.section.title}</div>
                </li>
              ))}
            </ol>
            <p className="small muted">Hand-written examples from fixtures/steps.</p>
          </>
        )}
      </aside>
      {step && (
        <main className="steps-main">
          <StepCard step={step} />
          {chart && step.chart && (
            <div className="step-chart">
              <section>
                <h3>Chart: {chart.chart.title}</h3>
                <Grid chart={chart.chart} row={step.chart.row} onRow={() => {}} />
              </section>
              <section>
                <h3>In the PDF</h3>
                <PdfChart file={chart} row={step.chart.row} onRow={() => {}} />
              </section>
            </div>
          )}
          <section>
            <h3>Instruction source</h3>
            <SourceView sources={step.source} pages={pages} />
          </section>
        </main>
      )}
    </div>
  );
}

function StepCard({ step }: { step: Step }) {
  return (
    <div className="step-card">
      <div className="step-where">
        {step.section.title}
        {step.of && (
          <>
            {" "}
            · step {step.of.index} of {step.of.count} in <i>{step.of.label}</i>
          </>
        )}
      </div>
      <h2>{step.label}</h2>
      {step.chart && (
        <div className="step-chart-row">
          <div className="step-chart-text">{step.chart.text}</div>
          <div className="small muted">
            Chart row {step.chart.row} · {step.chart.perRepeat} sts per {step.chart.repeats ? "repeat" : "round"}
            {step.chart.written !== undefined &&
              (step.chart.writtenMatches ? (
                <span className="good"> · ✓ matches the pattern's written round</span>
              ) : (
                <span className="bad"> · differs from the pattern's written round: {step.chart.written}</span>
              ))}
          </div>
        </div>
      )}
      <div className="step-instruction">{step.instruction}</div>
      {step.stitches && (
        <div className="step-stitches">
          {step.stitches.before !== undefined ? `${step.stitches.before} → ` : ""}
          <b>{step.stitches.after} sts</b>
        </div>
      )}
      {step.related?.map((r) => (
        <details key={r.title} className="step-related" open>
          <summary>{r.title}</summary>
          {r.text}
        </details>
      ))}
    </div>
  );
}
