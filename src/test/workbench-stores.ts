// Between tests every store made with createWorkbenchStore goes back to its
// initial value, as when a workbench ends (ui/workbench-store.ts), so a pick,
// an open window or trying out never carries into the next test. setup.ts runs
// it after each test; a test needs no reset of its own.

import { endWorkbench } from "../ui/workbench-store";

export function resetWorkbenchStores(): void {
  endWorkbench();
}
