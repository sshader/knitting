import { useEffect } from "react";

/** → / j / space for the next step, ← / k for the previous; ignored while typing in a field. */
export function useStepKeys(index: number, go: (index: number) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const delta = e.key === "ArrowRight" || e.key === "j" || e.key === " " ? 1 : e.key === "ArrowLeft" || e.key === "k" ? -1 : 0;
      if (!delta) return;
      // Also stops space from scrolling a panel or pressing a focused button.
      e.preventDefault();
      go(index + delta);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);
}
