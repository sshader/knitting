import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { FlatNode } from "../../../extract/sectionSchema";
import { appliesToSize } from "../../../shared/sized";
import { ReviewButtons } from "../shared/ReviewButtons";
import { useSectionsReview } from "../shared/reviews";
import { SourceView } from "../shared/SourceView";
import { usePatternParam } from "../shared/usePatternParam";
import { ALL_SIZES, NodeRow } from "./NodeRow";

/**
 * Reviewing stage 2: a section's extracted nodes next to the page each one
 * came from, with its quote highlighted. A size picker shows the
 * instructions as a knitter of that size would read them.
 */
export function SectionsInspector() {
  const index = useQuery(api.maps.list);
  const [pattern, setPattern] = usePatternParam(index?.filter((e) => e.mode === "text").map((e) => e.pattern));
  const saved = useQuery(api.maps.get, pattern ? { pattern, mode: "text" } : "skip");
  const results = useQuery(api.sections.forPattern, pattern ? { pattern } : "skip");
  const pages = useQuery(api.pages.forPattern, pattern ? { pattern } : "skip");
  const [review, setReview] = useSectionsReview(pattern);
  const [chosenSection, setSectionId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [size, setSize] = useState(ALL_SIZES);

  const map = saved?.map;
  const sectionId = chosenSection && map?.sections.some((s) => s.id === chosenSection) ? chosenSection : (map?.sections[0]?.id ?? null);
  const result = results?.find((r) => r.sectionId === sectionId);
  const x = result?.extraction;
  const nodes = x?.nodes ?? [];
  const node = nodes.find((n) => n.id === nodeId);

  const choose = (p: string) => {
    setPattern(p);
    setSectionId(null);
    setNodeId(null);
    setSize(ALL_SIZES);
  };

  return (
    <div className="inspector">
      <aside>
        <h1>Sections</h1>
        <ul>
          {index
            ?.filter((e) => e.mode === "text")
            .map((e) => (
              <li key={e.pattern} className={e.pattern === pattern ? "active" : ""} onClick={() => choose(e.pattern)}>
                <div className="name">{e.title || e.pattern}</div>
              </li>
            ))}
        </ul>
        {map && (
          <>
            <h3>Sections</h3>
            <ol className="items">
              {map.sections.map((s) => {
                const r = results?.find((r) => r.sectionId === s.id);
                const v = review[`section:${s.id}`];
                return (
                  <li key={s.id} className={s.id === sectionId ? "selected" : ""} onClick={() => (setSectionId(s.id), setNodeId(null))}>
                    <b>{s.title}</b> {v && <span className={v.ok ? "good" : "bad"}>{v.ok ? "✓" : "✗"}</span>}
                    <div className="small muted">
                      {r?.extraction
                        ? `${r.extraction.nodes.length} nodes · ${r.problems.length} problems · ${r.extraction.reviewNotes.length} notes`
                        : r?.error
                          ? `failed: ${r.error}`
                          : "not extracted"}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </aside>

      <main className="sections-main">
        <div className="nodes">
          {map && sectionId && (
            <>
              <header className="nodes-header">
                <b>{map.sections.find((s) => s.id === sectionId)?.title}</b>
                <label>
                  Size{" "}
                  <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
                    <option value={ALL_SIZES}>all (raw)</option>
                    {map.sizes.map((s, i) => (
                      <option key={i} value={i}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <ReviewButtons label="Section" v={review[`section:${sectionId}`]} onChange={(v) => setReview(`section:${sectionId}`, v)} />
              </header>
              {x && x.times.length > 0 && <p className="small">Section worked {JSON.stringify(x.times)} times</p>}
              {result?.error && <p className="small bad">{result.error}</p>}
              {result && result.problems.length > 0 && (
                <ul className="small bad">
                  {result.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {x && x.reviewNotes.length > 0 && (
                <details className="small" open>
                  <summary>Model's review notes ({x.reviewNotes.length})</summary>
                  <ul>
                    {x.reviewNotes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </details>
              )}
              <ol className="node-list">
                {nodes
                  .filter((n) => size === ALL_SIZES || appliesToSize(n.sizes, size))
                  .map((n) => (
                    <NodeRow
                      key={n.id}
                      n={n}
                      depth={depth(nodes, n)}
                      map={map}
                      size={size}
                      selected={n.id === nodeId}
                      verdict={review[n.id]}
                      onSelect={() => setNodeId(n.id)}
                      onReview={(v) => setReview(n.id, v)}
                    />
                  ))}
              </ol>
            </>
          )}
        </div>
        <div className="source">
          {node && pages ? (
            <SourceView sources={[...node.source, ...node.overlays.flatMap((o) => o.source)]} pages={pages} />
          ) : (
            <p className="muted">Select a node to see where it came from.</p>
          )}
        </div>
      </main>
    </div>
  );
}

/** Nesting depth from the parent links. */
function depth(nodes: FlatNode[], n: FlatNode): number {
  let d = 0;
  for (let p = n.parentId; p; p = nodes.find((x) => x.id === p)?.parentId ?? "") d++;
  return d;
}
