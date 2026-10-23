import { useEffect, useRef, useState, type ReactNode } from "react";

/** A button that opens a small menu below it; clicking outside closes it. */
export function Dropdown({ label, title, children }: { label: ReactNode; title?: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="dropdown" ref={root}>
      <button className="quiet dropdown-button" onClick={() => setOpen(!open)} aria-expanded={open} title={title}>
        {label}
      </button>
      {open && <div className="dropdown-menu">{children(() => setOpen(false))}</div>}
    </div>
  );
}
