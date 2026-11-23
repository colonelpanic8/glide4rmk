// The status setup that is choosing its keys on the board, if one is
// (model/lighting/key-pick.ts). It starts in Layout properties (RGB Lighting,
// Advanced), which steps aside while it lasts; the keymap's canvas collects
// the keys with its selection, and its banner installs them or cancels. It
// ends with the workbench (ui/workbench-store.ts). The panel, the window and the
// canvas share this.

import type { KeyPick } from "../../model/lighting/key-pick";
import { createWorkbenchStore, useWorkbenchStore } from "../workbench-store";

const pick = createWorkbenchStore<KeyPick | null>(null);

export const keyPick = {
  get: pick.get,
  subscribe: pick.subscribe,
  start: (next: KeyPick) => pick.set(next),
  /** Done or cancelled: Layout properties comes back. */
  stop: () => pick.set(null),
};

export function useKeyPick(): KeyPick | null {
  return useWorkbenchStore(pick);
}
