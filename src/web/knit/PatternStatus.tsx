import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { dollars } from "../../extract/pricing";
import { RunOffer } from "./RunOffer";

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
  const cancel = useMutation(api.pipeline.start.cancel);
  const [error, setError] = useState<string | null>(null);
  const run = p.run;
  const cost = run && run.cost > 0 ? ` · ${dollars(run.cost)}` : "";
  const active = run?.status === "running" || run?.status === "waiting";
  const canRerun = p.docs.every((d) => d.pdf) && !active;

  const label = !run
    ? "Not extracted"
    : run.status === "running"
      ? `${STAGES[run.stage] ?? run.stage}…`
      : run.status === "waiting"
        ? "Mapped; waiting for you"
        : run.status === "canceled"
          ? "Stopped"
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
      {run?.status === "waiting" && run.offer && <RunOffer pattern={p.slug} offer={run.offer} />}
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
            if (confirm(`Extract "${p.name}" again? Mapping it costs a little; you'll see an estimate for the rest before it goes on if it's over $1.`)) rerun({ pattern: p.slug }).catch((e) => setError(String(e.message ?? e)));
          }}
        >
          {run ? "Extract again" : "Extract"}
        </button>
      )}
      {run?.status === "running" && (
        <button className="quiet small" onClick={() => cancel({ pattern: p.slug }).catch((e) => setError(String(e.message ?? e)))}>
          Stop
        </button>
      )}
      {error && <div className="small bad">{error}</div>}
    </li>
  );
}
