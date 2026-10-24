import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { dollars } from "../../extract/pricing";

type Offer = NonNullable<NonNullable<FunctionReturnType<typeof api.patterns.list>[number]["run"]>["offer"]>;

/** A run waiting after its map: choose the size (when each is written out separately), see the estimate, go ahead or stop. */
export function RunOffer({ pattern, offer }: { pattern: string; offer: Offer }) {
  const proceed = useMutation(api.pipeline.start.proceed);
  const cancel = useMutation(api.pipeline.start.cancel);
  const balance = useQuery(api.credits.mine);
  const [size, setSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const sized = offer.sizes.length > 0;
  const estimate = sized ? offer.sizes[size].estimate : offer.estimate;
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  return (
    <div className="run-offer small">
      {sized && (
        <label>
          This pattern writes out each size separately. Extract size{" "}
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {offer.sizes.map((s, i) => (
              <option key={i} value={i}>
                {s.label} (about {dollars(s.estimate)})
              </option>
            ))}
          </select>
        </label>
      )}
      <div>
        The rest will cost about {dollars(estimate)}
        {balance != null && ` of your $${balance.toFixed(2)}`}.
      </div>
      <div className="run-offer-buttons">
        <button className="primary small" onClick={() => proceed({ pattern, size: sized ? size : undefined }).catch(fail)}>
          Extract
        </button>
        <button className="quiet small" onClick={() => cancel({ pattern }).catch(fail)}>
          Stop
        </button>
      </div>
      {error && <div className="bad">{error}</div>}
    </div>
  );
}
