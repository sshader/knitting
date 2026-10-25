import type { FunctionComponent } from "react";
import type { PanelId } from "./layout";
import { ChartPanel } from "./panels/ChartPanel";
import { GlossaryPanel } from "./panels/GlossaryPanel";
import { InstructionsPanel } from "./panels/InstructionsPanel";
import { NotesPanel } from "./panels/NotesPanel";
import { PdfPanel } from "./panels/PdfPanel";
import { StepsPanel } from "./panels/StepsPanel";

/** The workspace's panels; both layouts show these same components. */
export const PANEL_COMPONENTS: Record<PanelId, FunctionComponent> = {
  instructions: InstructionsPanel,
  chart: ChartPanel,
  pdf: PdfPanel,
  steps: StepsPanel,
  glossary: GlossaryPanel,
  notes: NotesPanel,
};
