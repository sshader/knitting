import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { writtenPerSize } from "../../extract/docMap";

/** Pick a pattern, a size, and any options, and start knitting. */
export function NewProject({ onStarted }: { onStarted: (id: Id<"projects">) => void }) {
  const maps = useQuery(api.maps.list)?.filter((m) => m.mode === "text");
  const [pattern, setPattern] = useState<string | null>(null);
  const chosenPattern = pattern ?? maps?.find((m) => m.extracted)?.pattern ?? null;
  const saved = useQuery(api.maps.get, chosenPattern ? { pattern: chosenPattern, mode: "text" } : "skip");
  const [size, setSize] = useState(0);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const start = useMutation(api.projects.start);
  const map = saved?.map;
  // A pattern written out per size has only the size its run extracted.
  const extractedSize = useQuery(api.patterns.list)?.find((p) => p.slug === chosenPattern)?.run?.size;
  const only = map && writtenPerSize(map) ? extractedSize : undefined;
  const chosenSize = only ?? size;

  if (!maps?.some((m) => m.extracted)) return <p className="muted">No extracted patterns yet. Run the pipeline (see the README) first.</p>;

  return (
    <form
      className="new-project"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!chosenPattern || !map) return;
        const id = await start({
          pattern: chosenPattern,
          name: map.title,
          size: chosenSize,
          choices: map.options.map((o) => choices[o.name] ?? o.choices[0]),
        });
        onStarted(id);
      }}
    >
      <label>
        <span>Pattern</span>
        <select
          value={chosenPattern ?? ""}
          onChange={(e) => {
            setPattern(e.target.value);
            setSize(0);
            setChoices({});
          }}
        >
          {maps.map((m) => (
            <option key={m.pattern} value={m.pattern} disabled={!m.extracted}>
              {m.title || m.pattern}
              {m.extracted ? "" : " (not extracted yet)"}
            </option>
          ))}
        </select>
      </label>
      {map && (
        <>
          <label>
            <span>Size</span>
            <select value={chosenSize} onChange={(e) => setSize(Number(e.target.value))}>
              {map.sizes.map((s, i) => (
                <option key={i} value={i} disabled={only !== undefined && i !== only}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {map.options.map((o) => (
            <label key={o.name}>
              <span>{o.name}</span>
              <select value={choices[o.name] ?? o.choices[0]} onChange={(e) => setChoices({ ...choices, [o.name]: e.target.value })}>
                {o.choices.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          ))}
        </>
      )}
      <button className="primary" type="submit" disabled={!map}>
        Start knitting
      </button>
    </form>
  );
}
