import type { IDockviewHeaderActionsProps } from "dockview-react";
import { useEffect, useState } from "react";

/** In each panel's header: fill the workspace with this panel, or put the others back. */
export function MaximizeButton({ containerApi, activePanel }: IDockviewHeaderActionsProps) {
  const [maximized, setMaximized] = useState(containerApi.hasMaximizedGroup());
  useEffect(() => {
    const sub = containerApi.onDidMaximizedGroupChange(() => setMaximized(containerApi.hasMaximizedGroup()));
    return () => sub.dispose();
  }, [containerApi]);
  if (!activePanel || containerApi.panels.length < 2) return null;
  return (
    <button
      className="maximize"
      title={maximized ? "Show all panels" : "Fill the window with this panel"}
      onClick={() => (maximized ? containerApi.exitMaximizedGroup() : containerApi.maximizeGroup(activePanel))}
    >
      {maximized ? "⤡" : "⤢"}
    </button>
  );
}
