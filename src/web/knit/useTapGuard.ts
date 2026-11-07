import { useCallback, useEffect, useRef, useState } from "react";
import { BURST_MS, onTap, type Burst } from "./tapGuard";

const NOTICE_MS = 5000;

/** A dropped tap, offered back for a few seconds. */
export interface HeldTap {
  keep: () => void;
  dismiss: () => void;
}

/**
 * Guards buttons against double taps (see `onTap`). `tap(key, act)` calls
 * `act(times)` when the tap counts, with a buzz where phones support it. A
 * held tap that no third tap follows is dropped and shown as `held`.
 */
export function useTapGuard() {
  const burst = useRef<Burst | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [dropped, setDropped] = useState<(() => void) | null>(null);

  const tap = useCallback((key: string, act: (times: number) => void) => {
    window.clearTimeout(timer.current);
    setDropped(null);
    const r = onTap(burst.current, key, performance.now());
    burst.current = r.burst;
    if (r.times === 0) {
      timer.current = window.setTimeout(() => {
        setDropped(() => () => act(1));
        timer.current = window.setTimeout(() => setDropped(null), NOTICE_MS);
      }, BURST_MS);
      return;
    }
    act(r.times);
    navigator.vibrate?.(10);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const held: HeldTap | null = dropped && {
    keep: () => {
      window.clearTimeout(timer.current);
      setDropped(null);
      dropped();
    },
    dismiss: () => setDropped(null),
  };
  return { tap, held };
}
