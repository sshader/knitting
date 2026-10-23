import type { DockviewApi } from "dockview-react";

/**
 * The workspace layout: a default arrangement, and whatever the knitter
 * makes of it (moved, resized, panels hidden), remembered in this browser.
 */

const KEY = "knit-layout-v1";

export const PANELS = {
  instructions: "Instructions",
  steps: "Steps",
  chart: "Chart",
  pdf: "Pattern",
} as const;
export type PanelId = keyof typeof PANELS;
export const PANEL_IDS = Object.keys(PANELS) as PanelId[];

/** Where each panel goes when shown again: next to the first of these that's open. */
const PLACES: Record<PanelId, { next: PanelId; direction: "left" | "right" | "above" | "below" }[]> = {
  instructions: [
    { next: "steps", direction: "above" },
    { next: "chart", direction: "left" },
    { next: "pdf", direction: "left" },
  ],
  steps: [
    { next: "instructions", direction: "below" },
    { next: "chart", direction: "left" },
    { next: "pdf", direction: "left" },
  ],
  chart: [
    { next: "pdf", direction: "above" },
    { next: "instructions", direction: "right" },
    { next: "steps", direction: "right" },
  ],
  pdf: [
    { next: "chart", direction: "below" },
    { next: "instructions", direction: "right" },
    { next: "steps", direction: "right" },
  ],
};

export function showPanel(api: DockviewApi, id: PanelId) {
  if (api.getPanel(id)) return;
  const place = PLACES[id].find((p) => api.getPanel(p.next));
  api.addPanel({ id, component: id, title: PANELS[id], ...(place ? { position: { referencePanel: place.next, direction: place.direction } } : {}) });
}

export function hidePanel(api: DockviewApi, id: PanelId) {
  const panel = api.getPanel(id);
  if (panel) api.removePanel(panel);
}

/** Instructions over the step outline on the left; the chart over the pattern page on the right. */
export function defaultLayout(api: DockviewApi) {
  api.clear();
  api.addPanel({ id: "instructions", component: "instructions", title: PANELS.instructions });
  api.addPanel({ id: "chart", component: "chart", title: PANELS.chart, position: { referencePanel: "instructions", direction: "right" } });
  api.addPanel({ id: "pdf", component: "pdf", title: PANELS.pdf, position: { referencePanel: "chart", direction: "below" } });
  api.addPanel({ id: "steps", component: "steps", title: PANELS.steps, position: { referencePanel: "instructions", direction: "below" } });
  api.getPanel("instructions")?.api.group.api.setSize({ width: Math.round(api.width * 0.42), height: Math.round(api.height * 0.62) });
  api.getPanel("chart")?.api.group.api.setSize({ height: Math.round(api.height * 0.6) });
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
