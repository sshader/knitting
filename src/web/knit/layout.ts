import type { DockviewApi } from "dockview-react";

/**
 * The workspace layout: a default arrangement, and whatever the knitter
 * makes of it (moved, resized, panels hidden), remembered in this browser.
 */

// Bumped when the default layout changes, so an old saved arrangement doesn't hide the new one.
const KEY = "knit-layout-v3";

export const PANELS = {
  instructions: "Instructions",
  chart: "Chart",
  pdf: "Pattern",
  steps: "Steps",
  glossary: "Glossary",
  notes: "Notes",
} as const;
export type PanelId = keyof typeof PANELS;
export const PANEL_IDS = Object.keys(PANELS) as PanelId[];

/** Everything but the instructions shares one tab group on the right. */
const TABBED: PanelId[] = ["chart", "pdf", "steps", "glossary", "notes"];

export function showPanel(api: DockviewApi, id: PanelId) {
  if (api.getPanel(id)) return;
  const add = (position?: { referencePanel: string; direction: "left" | "right" | "within" }) =>
    api.addPanel({ id, component: id, title: PANELS[id], ...(position ? { position } : {}) });
  if (id === "instructions") {
    const right = TABBED.find((p) => api.getPanel(p));
    return add(right ? { referencePanel: right, direction: "left" } : undefined);
  }
  // Rejoin the tab group, or start one to the right of the instructions.
  const sibling = TABBED.find((p) => p !== id && api.getPanel(p));
  if (sibling) add({ referencePanel: sibling, direction: "within" });
  else add(api.getPanel("instructions") ? { referencePanel: "instructions", direction: "right" } : undefined);
}

export function hidePanel(api: DockviewApi, id: PanelId) {
  const panel = api.getPanel(id);
  if (panel) api.removePanel(panel);
}

/** The instructions on the left; the chart, the pattern page, the outline, the glossary, and notes as tabs on the right, chart in front. */
export function defaultLayout(api: DockviewApi) {
  api.clear();
  api.addPanel({ id: "instructions", component: "instructions", title: PANELS.instructions });
  api.addPanel({ id: "chart", component: "chart", title: PANELS.chart, position: { referencePanel: "instructions", direction: "right" } });
  for (const id of TABBED.slice(1)) api.addPanel({ id, component: id, title: PANELS[id], position: { referencePanel: "chart", direction: "within" }, inactive: true });
  api.getPanel("chart")?.api.setActive();
  api.getPanel("instructions")?.api.group.api.setSize({ width: Math.round(api.width * 0.42) });
}

export function restoreLayout(api: DockviewApi) {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      api.fromJSON(JSON.parse(saved));
      if (api.panels.length > 0) return;
    }
  } catch {
    // A layout from an older version, or storage unavailable: start fresh.
  }
  defaultLayout(api);
}

export function saveLayout(api: DockviewApi) {
  try {
    localStorage.setItem(KEY, JSON.stringify(api.toJSON()));
  } catch {
    // Storage unavailable (private window): the layout just won't be remembered.
  }
}
