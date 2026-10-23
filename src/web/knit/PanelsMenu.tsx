import { useEffect, useRef, useState } from "react";
import { PANEL_IDS, PANELS, type PanelId } from "./layout";

/** Show or hide each panel; a hidden panel comes back where it was in the default layout. */
export function PanelsMenu({ open, onToggle, onReset }: { open: Set<PanelId>; onToggle: (id: PanelId) => void; onReset: () => void }) {
  const [shown, setShown] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shown) return;
    const close = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) setShown(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [shown]);

  return (
    <div className="panels-menu" ref={menu}>
      <button className="quiet" onClick={() => setShown(!shown)} aria-expanded={shown}>
        Panels ▾
      </button>
      {shown && (
        <div className="panels-popover">
          {PANEL_IDS.map((id) => (
            <label key={id}>
              <input type="checkbox" checked={open.has(id)} disabled={open.size === 1 && open.has(id)} onChange={() => onToggle(id)} />
              {PANELS[id]}
            </label>
          ))}
          <hr />
          <button
            className="quiet"
            onClick={() => {
              onReset();
              setShown(false);
            }}
          >
            Reset layout
          </button>
        </div>
      )}
    </div>
  );
}
