import { DockviewReact, themeLightSpaced, type DockviewApi } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { useRef, useState } from "react";
import { defaultLayout, hidePanel, PANEL_IDS, restoreLayout, saveLayout, showPanel, type PanelId } from "./layout";
import { MaximizeButton } from "./MaximizeButton";
import { PANEL_COMPONENTS } from "./panelComponents";
import { TopBar } from "./TopBar";

/** Laptop: the top bar, and the panels in a layout the knitter can rearrange (remembered in this browser). */
export function DockLayout({ onExit }: { onExit: () => void }) {
  const dock = useRef<DockviewApi | null>(null);
  const [open, setOpen] = useState(new Set<PanelId>());
  const togglePanel = (id: PanelId) => {
    const api = dock.current;
    if (!api) return;
    if (open.has(id)) hidePanel(api, id);
    else showPanel(api, id);
  };

  return (
    <div className="knit">
      <TopBar onExit={onExit} panels={{ open, onToggle: togglePanel, onReset: () => dock.current && defaultLayout(dock.current) }} />
      <DockviewReact
        className="knit-dock"
        theme={themeLightSpaced}
        components={PANEL_COMPONENTS}
        rightHeaderActionsComponent={MaximizeButton}
        disableFloatingGroups
        onReady={({ api }) => {
          dock.current = api;
          restoreLayout(api);
          const track = () => setOpen(new Set(PANEL_IDS.filter((id) => api.getPanel(id))));
          track();
          api.onDidLayoutChange(() => {
            saveLayout(api);
            track();
          });
        }}
      />
    </div>
  );
}
