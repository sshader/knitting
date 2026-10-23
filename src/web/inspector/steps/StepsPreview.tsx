import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { sectionTrees } from "../../../extract/snapshot";
import { expandPattern, type ExpandedStep } from "../../../shared/expand";
import type { StepsFixture } from "../../../shared/steps";
import { ChartGrid } from "../charts/ChartGrid";
import { PdfChart } from "../charts/PdfChart";
import { SourceView } from "../shared/SourceView";
import { usePatternParam } from "../shared/usePatternParam";
import { StepCard } from "./StepCard";
import { StepList } from "./StepList";

/**
 * The knitting view's step format. "Hand-written" shows the expected steps in
 * fixtures/steps; "Generated" expands the whole pattern from its extracted
 * sections and charts for a chosen size and options.
 */

const FIXTURES: Record<string, StepsFixture> = Object.fromEntries(
  Object.values(import.meta.glob<StepsFixture>("/fixtures/steps/*.json", { eager: true, import: "default" })).map((f) => [f.pattern, f]),
);

export function StepsPreview() {
  const [pattern, setPattern] = usePatternParam(Object.keys(FIXTURES));
  const fixture = pattern ? FIXTURES[pattern] : undefined;
  const args = pattern ? { pattern } : "skip";
  const saved = useQuery(api.maps.get, pattern ? { pattern, mode: "text" } : "skip");
  const results = useQuery(api.sections.forPattern, args);
  const charts = useQuery(api.charts.forPattern, args);
  const pages = useQuery(api.pages.forPattern, args);
  const [mode, setMode] = useState<"fixture" | "generated">("fixture");
  const [size, setSize] = useState(fixture?.size ?? 0);
  const [choices, setChoices] = useState<string[]>([]);
  const [i, setI] = useState(0);

  const map = saved?.map;
  // Each option's choice; the first until one is picked.
  const chosen = useMemo(() => map?.options.map((o, k) => choices[k] ?? o.choices[0]) ?? [], [map, choices]);

  const steps: ExpandedStep[] = useMemo(() => {
    if (mode === "fixture") return fixture?.steps ?? [];
    if (!map || !results || !charts) return [];
    const extractions = Object.fromEntries(results.map((r) => [r.sectionId, r.extraction]));
    return expandPattern({ sections: sectionTrees(map, extractions), charts: Object.fromEntries(charts.map((c) => [c.chartId, c.chart])), size, choices: chosen });
  }, [mode, fixture, map, results, charts, size, chosen]);

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
  const chart = step?.chart ? charts?.find((c) => c.chartId === step.chart!.chartId) : undefined;
  const choose = (p: string) => {
    setPattern(p);
    setI(0);
    setSize(FIXTURES[p]?.size ?? 0);
    setChoices([]);
  };

  return (
    <div className="inspector">
      <aside>
        <h1>Steps</h1>
        <ul>
          {Object.keys(FIXTURES).map((p) => (
            <li key={p} className={p === pattern ? "active" : ""} onClick={() => choose(p)}>
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
        {map && mode === "generated" && (
          <div className="small step-options">
            <label>
              Size{" "}
              <select value={size} onChange={(e) => (setSize(Number(e.target.value)), setI(0))}>
                {map.sizes.map((s, k) => (
                  <option key={k} value={k}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {map.options.map((o, k) => (
              <label key={o.name}>
                {o.name}{" "}
                <select value={chosen[k]} onChange={(e) => (setChoices(chosen.map((x, j) => (j === k ? e.target.value : x))), setI(0))}>
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
      {step && (
        <main className="steps-main">
          <StepCard step={step} />
          {chart && step.chart && (
            <div className="step-chart">
              <section>
                <h3>Chart: {chart.chart.title}</h3>
                <ChartGrid chart={chart.chart} row={step.chart.row} onRow={() => {}} />
              </section>
              <section>
                <h3>In the PDF</h3>
                <PdfChart c={chart} row={step.chart.row} onRow={() => {}} />
              </section>
            </div>
          )}
          {step.source.length > 0 && pages && (
            <section>
              <h3>Instruction source</h3>
              <SourceView sources={step.source} pages={pages} />
            </section>
          )}
        </main>
      )}
    </div>
  );
}
