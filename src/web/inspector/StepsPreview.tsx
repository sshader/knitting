import { useEffect, useMemo, useRef, useState } from "react";
import type { DocMap } from "../../extract/docMap";
import type { PageRef } from "../../extract/mapInput";
import { expandPattern, type ExpandedStep } from "../../shared/expand";
import type { Chart, Section } from "../../shared/schema";
import type { StepsFixture } from "../../shared/steps";
import { Grid, PdfChart, type ChartFile } from "./ChartsInspector";
import { SourceView } from "./SectionsInspector";

/**
 * The knitting view's step format. "Hand-written" shows the expected steps in
 * fixtures/steps; "Generated" expands the whole pattern from its extracted
 * sections and charts for a chosen size and options.
 */

const PATTERNS = ["lucky-stars-beanie-v5", "moonbun-jumper-by-saskieco"];

interface Loaded {
  map: DocMap;
  pages: PageRef[];
  sections: Section[];
  charts: Record<string, ChartFile>;
  fixture: StepsFixture | null;
}

async function load(pattern: string): Promise<Loaded> {
  const get = async (url: string) => {
    const r = await fetch(url);
    return r.ok ? r.json() : null;
  };
  const { map, pages } = await get(`/data/map/text/${pattern}.json`);
  const sections = await Promise.all(map.sections.map(async (s: { id: string }) => (await get(`/data/sections/${pattern}/${s.id}.json`))?.tree));
  const index: { pattern: string; chartId: string }[] = (await get("/data/charts/index.json")) ?? [];
  const charts = Object.fromEntries(
    await Promise.all(index.filter((e) => e.pattern === pattern).map(async (e) => [e.chartId, await get(`/data/charts/${pattern}/${e.chartId}.json`)] as const)),
  );
  return { map, pages, sections: sections.filter(Boolean), charts, fixture: await get(`/fixtures/steps/${pattern}.json`) };
}

export function StepsPreview() {
  const [pattern, setPattern] = useState(PATTERNS[0]);
  const [data, setData] = useState<Loaded | null>(null);
  const [mode, setMode] = useState<"fixture" | "generated">("fixture");
  const [size, setSize] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    setData(null);
    setI(0);
    load(pattern).then((d) => {
      setData(d);
      setSize(d.fixture?.size ?? 0);
      setChoices(d.map.options.map((o) => o.choices[0]));
    });
  }, [pattern]);

  const steps: ExpandedStep[] = useMemo(() => {
    if (!data) return [];
    if (mode === "fixture") return data.fixture?.steps ?? [];
    const charts: Record<string, Chart> = Object.fromEntries(Object.entries(data.charts).map(([id, f]) => [id, f.chart]));
    return expandPattern({ sections: data.sections, charts, size, choices });
  }, [data, mode, size, choices]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement) return;
      if (e.key === "j" || e.key === "ArrowDown") setI((k) => Math.min(steps.length - 1, k + 1));
      if (e.key === "k" || e.key === "ArrowUp") setI((k) => Math.max(0, k - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  const step = steps[Math.min(i, steps.length - 1)];
  const chart = step?.chart ? data?.charts[step.chart.chartId] : null;

  return (
    <div className="inspector">
      <aside>
        <h1>Steps</h1>
        <ul>
          {PATTERNS.map((p) => (
            <li key={p} className={p === pattern ? "active" : ""} onClick={() => setPattern(p)}>
              <div className="name">{p}</div>
            </li>
          ))}
        </ul>
        <div className="modes">
          <button className={mode === "fixture" ? "on" : ""} onClick={() => (setMode("fixture"), setI(0))}>
            Hand-written
          </button>
          <button className={mode === "generated" ? "on" : ""} onClick={() => (setMode("generated"), setI(0))}>
            Generated
          </button>
        </div>
        {data && mode === "generated" && (
          <div className="small step-options">
            <label>
              Size{" "}
              <select value={size} onChange={(e) => (setSize(Number(e.target.value)), setI(0))}>
                {data.map.sizes.map((s, k) => (
                  <option key={k} value={k}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {data.map.options.map((o, k) => (
              <label key={o.name}>
                {o.name}{" "}
                <select value={choices[k]} onChange={(e) => (setChoices((c) => c.map((x, j) => (j === k ? e.target.value : x))), setI(0))}>
                  {o.choices.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        <StepList steps={steps} i={i} onSelect={setI} />
      </aside>
      {step && data && (
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
          {step.source.length > 0 && (
            <section>
              <h3>Instruction source</h3>
              <SourceView sources={step.source} pages={data.pages} />
            </section>
          )}
        </main>
      )}
    </div>
  );
}

function StepList({ steps, i, onSelect }: { steps: ExpandedStep[]; i: number; onSelect: (k: number) => void }) {
  const selected = useRef<HTMLLIElement>(null);
  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest" });
  }, [i]);
  return (
    <ol className="items step-list">
      {steps.map((s, k) => (
        <li key={k} ref={k === i ? selected : undefined} className={k === i ? "selected" : ""} onClick={() => onSelect(k)}>
          {(k === 0 || steps[k - 1].section.id !== s.section.id) && <div className="small muted step-list-section">{s.section.title}</div>}
          <b>{s.label}</b>
          {s.stitches && <span className="small muted"> · {s.stitches.after} sts</span>}
          {(s.statedStitches !== undefined || (s.chart?.written !== undefined && !s.chart.writtenMatches)) && <span className="bad"> ⚠</span>}
        </li>
      ))}
    </ol>
  );
}

function StepCard({ step }: { step: ExpandedStep }) {
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
      {step.until && <div className="step-until">Repeat until {step.until.replace(/^until\s+/i, "")}</div>}
      {step.chart && (
        <div className="step-chart-row">
          <div className="step-chart-text">{step.chart.text}</div>
          <div className="small muted">
            Chart row {step.chart.row} · {step.chart.perRepeat} sts per {step.chart.repeats ? "repeat" : "round"}
            {step.chart.written !== undefined &&
              (step.chart.writtenMatches ? (
                <span className="good"> · ✓ matches the pattern's written round{/CDD|k2tog/.test(step.chart.text) ? " (each decrease counted as 1 st)" : ""}</span>
              ) : (
                <span className="bad"> · differs from the pattern's written round: {step.chart.written}</span>
              ))}
          </div>
        </div>
      )}
      {step.also?.map((a) => (
        <div key={a} className="step-also">
          At the same time: {a}
        </div>
      ))}
      <div className="step-instruction">{step.instruction}</div>
      {step.stitches && (
        <div className="step-stitches">
          {step.stitches.before !== undefined ? `${step.stitches.before} → ` : ""}
          <b>{step.stitches.after} sts</b>
          {step.statedStitches !== undefined && <span className="bad"> · the pattern says {step.statedStitches} sts here</span>}
        </div>
      )}
      {step.related?.map((r, k) => (
        <details key={k} className="step-related" open>
          <summary>{r.title}</summary>
          {r.text}
        </details>
      ))}
    </div>
  );
}
