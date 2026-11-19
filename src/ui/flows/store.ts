// Whether the Flows window is open: the top bar's button opens it, and it
// ends with the workbench (ui/workbench-end.ts).

import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((listener) => listener());

export function openFlows(): void {
  open = true;
  tell();
}

export function closeFlows(): void {
  open = false;
  tell();
}

export function useFlowsOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
    () => open,
  );
}
