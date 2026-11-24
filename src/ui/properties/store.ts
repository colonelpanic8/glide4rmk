// Whether Layout properties is open, and on which tab: one small store, so the
// top bar's button and links elsewhere (Combos' "set in Layout properties")
// open the same window. It ends with the workbench (ui/workbench-store.ts).

import { createWorkbenchStore, useWorkbenchStore } from "../workbench-store";

export type PropertiesTab = "details" | "options" | "lighting" | "effects" | "insights";

const shown = createWorkbenchStore<PropertiesTab | null>(null);

export function openProperties(tab: PropertiesTab = "details"): void {
  shown.set(tab);
}

export function closeProperties(): void {
  shown.set(null);
}

/** The open tab, or null while the window is closed. */
export function usePropertiesTab(): PropertiesTab | null {
  return useWorkbenchStore(shown);
}
