// Whether the Flows window is open: the top bar's button opens it, and it
// ends with the workbench (ui/workbench-store.ts).

import { createWorkbenchStore, useWorkbenchStore } from "../workbench-store";

const open = createWorkbenchStore(false);

export function openFlows(): void {
  open.set(true);
}

export function closeFlows(): void {
  open.set(false);
}

export function useFlowsOpen(): boolean {
  return useWorkbenchStore(open);
}
