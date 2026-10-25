import { useState } from "react";
import { useKnit } from "../KnitContext";
import { Counter } from "./Counter";
import { useCounters } from "./useCounters";

/** The counters on an instruction (or the project, with a null node), and a way to add one. */
export function CounterList({ node }: { node: string | null }) {
  const { project } = useKnit();
  const actions = useCounters(project._id);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const counters = actions.counters?.filter((c) => c.node === node) ?? [];

  const submit = () => {
    if (label.trim()) actions.add(node, label);
    setLabel("");
    setAdding(false);
  };

  return (
    <div className="counter-list">
      {counters.map((c) => (
        <Counter key={c._id} counter={c} actions={actions} />
      ))}
      {adding ? (
        <form
          className="counter-new"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            autoFocus
            value={label}
            placeholder="What are you counting? (rows, decreases…)"
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => !label.trim() && setAdding(false)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              setLabel("");
              setAdding(false);
            }}
          />
          <button type="submit" className="primary" disabled={!label.trim()}>
            Add
          </button>
        </form>
      ) : (
        <button className="counter-add quiet" onClick={() => setAdding(true)}>
          + Add a counter
        </button>
      )}
    </div>
  );
}
