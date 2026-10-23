import { useEffect } from "react";

/**
 * Keeps the screen on while a project is open, so the phone doesn't lock
 * mid-row. The browser drops the lock when the tab is hidden, so it's taken
 * again on return. Browsers without the API just behave as before.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let live = true;
    const take = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (live) lock = next;
        else void next.release();
      } catch {
        // Refused (battery saver, or not allowed here): the screen sleeps as usual.
      }
    };
    void take();
    document.addEventListener("visibilitychange", take);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", take);
      void lock?.release();
    };
  }, []);
}
