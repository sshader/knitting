import { PANEL_IDS, PANELS, type PanelId } from "./layout";

/** In the settings menu: show or hide each panel, or start over with the default layout. */
export function PanelsSection({ open, onToggle, onReset, close }: { open: Set<PanelId>; onToggle: (id: PanelId) => void; onReset: () => void; close: () => void }) {
  return (
    <>
      <div className="menu-heading">Panels</div>
      {PANEL_IDS.map((id) => (
        <label key={id} className="menu-item">
          <input type="checkbox" checked={open.has(id)} disabled={open.size === 1 && open.has(id)} onChange={() => onToggle(id)} />
          {PANELS[id]}
        </label>
      ))}
      <button
        className="menu-item"
        onClick={() => {
          onReset();
          close();
        }}
      >
        Reset layout
      </button>
    </>
  );
}
