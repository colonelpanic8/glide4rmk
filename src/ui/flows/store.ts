// Whether the Flows window is open, and the category it opens at: the top
// bar's button opens it at its start, a pointer elsewhere (RGB Lighting's
// Advanced) at one category. Both end with the workbench (ui/workbench-store.ts).

import { createWorkbenchStore, useWorkbenchStore } from "../workbench-store";

const open = createWorkbenchStore(false);
const startAt = createWorkbenchStore<string | null>(null);

export function openFlows(category: string | null = null): void {
  startAt.set(category);
  open.set(true);
}

export function closeFlows(): void {
  open.set(false);
}

export function useFlowsOpen(): boolean {
  return useWorkbenchStore(open);
}

/** The category the window opens at; null for its start. */
export function flowsStartCategory(): string | null {
  return startAt.get();
}
