import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { dollars } from "../../extract/pricing";

type PatternRow = FunctionReturnType<typeof api.patterns.list>[number];

const STAGES: Record<string, string> = {
  starting: "Starting",
  preprocess: "Reading the PDF",
  map: "Mapping the pattern",
  sections: "Extracting the rows",
  charts: "Reading the charts",
  glossary: "Collecting abbreviations",
  checks: "Checking",
};

/** One of your patterns and where its extraction is, with a way to run it again. */
export function PatternStatus({ p }: { p: PatternRow }) {
  const rerun = useMutation(api.pipeline.start.rerun);
  const [error, setError] = useState<string | null>(null);
  const run = p.run;
  const cost = run && run.cost > 0 ? ` · ${dollars(run.cost)}` : "";
  const canRerun = p.docs.every((d) => d.pdf) && run?.status !== "running";

  const label = !run
    ? "Not extracted"
    : run.status === "running"
      ? `${STAGES[run.stage] ?? run.stage}…`
      : run.status === "ready"
        ? run.copiedFrom
          ? "Ready (reused)"
          : "Ready"
        : run.status === "review"
          ? `Ready, ${run.problems.length} thing${run.problems.length > 1 ? "s" : ""} to check`
          : run.status === "outOfCredits"
            ? "Stopped: out of credits"
            : "Failed";

  return (
    <li className={`pattern-status ${run?.status ?? "none"}`}>
      <div>
        <b>{p.name}</b>
        <span className="muted small">
          {" "}
          {label}
          {cost}
        </span>
      </div>
      {run?.error && <div className="small bad">{run.error}</div>}
      {run?.status === "review" && (
        <details className="small">
          <summary>What to check</summary>
          <ul>
            {run.problems.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </details>
      )}
      {canRerun && (
        <button
          className="quiet small"
          onClick={() => {
            if (confirm(`Extract "${p.name}" again? It's charged at cost.`)) rerun({ pattern: p.slug }).catch((e) => setError(String(e.message ?? e)));
          }}
        >
          {run ? "Extract again" : "Extract"}
        </button>
      )}
      {error && <div className="small bad">{error}</div>}
    </li>
  );
}
