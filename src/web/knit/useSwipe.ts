import { useRef } from "react";

/**
 * Horizontal swipe handlers for an element: a quick, mostly sideways drag
 * of at least 60px. Swiping left goes forward, right goes back. Uses touch
 * events, which phones deliver reliably even while deciding whether a
 * gesture is a scroll.
 */
export function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: e.timeStamp } : null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2 || e.timeStamp - s.t > 600) return;
      if (dx < 0) onLeft();
      else onRight();
    },
  };
}
