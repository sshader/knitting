import { useEffect, useState } from "react";

/**
 * The selected pattern, kept in the URL (?p=<slug>) so a reload or a switch
 * between inspectors stays on it. Falls back to the first available pattern.
 */
export function usePatternParam(available: string[] | undefined): [string | null, (p: string) => void] {
  const [chosen, setChosen] = useState(() => new URLSearchParams(location.search).get("p"));
  const pattern = chosen && (!available || available.includes(chosen)) ? chosen : (available?.[0] ?? null);

  useEffect(() => {
    if (!pattern) return;
    const params = new URLSearchParams(location.search);
    params.set("p", pattern);
    history.replaceState(null, "", `?${params}`);
  }, [pattern]);

  return [pattern, setChosen];
}
