// While the key editor's Key Lighting tab is open the canvas shows the real board
// under its lights (GLIDE's lit view). With Paint on, clicking or dragging over
// keys gives them the tab's light; with Select on, it selects them, so one
// choice in the tab reaches them all. While trying out, the tab, Paint and
// the selection give keys try-out lights (useTryOut.ts); trying out outlasts
// the tab, as the lights it put on the keyboard do, but not the workbench
// (ui/workbench-store.ts). The tab and the canvas share this.

import type { KeyLight } from "../../model/lighting/key-light";
import { createWorkbenchStore, useWorkbenchStore } from "../workbench-store";

export interface LightView {
  open: boolean;
  /** The light Paint gives keys; null while Paint is off. */
  brush: KeyLight | null;
  /** Select is on: a press or a drag over keys adds them to the selection, or
   *  removes them when it starts on a selected key. Never on with Paint. */
  selecting: boolean;
  /** Trying out: lights go on the keyboard at once and are never stored. */
  tryingOut: boolean;
  /** How long each try-out light stays on; null until it is cleared or the keyboard restarts. */
  lifetimeMs: number | null;
}

const CLOSED: LightView = { open: false, brush: null, selecting: false, tryingOut: false, lifetimeMs: null };
/** Ends with the workbench: the next keyboard starts closed, with trying out off. */
const store = createWorkbenchStore(CLOSED);
const change = (part: Partial<LightView>) => store.set({ ...store.get(), ...part });

export const lightView = {
  get: store.get,
  subscribe: store.subscribe,
  /** Leaving the tab closes the lit view and stops painting and selecting. */
  setOpen: (open: boolean) => {
    const view = store.get();
    store.set(open ? { ...view, open } : { ...CLOSED, tryingOut: view.tryingOut, lifetimeMs: view.lifetimeMs });
  },
  setTryingOut: (tryingOut: boolean) => change({ tryingOut }),
  setLifetime: (lifetimeMs: number | null) => change({ lifetimeMs }),
  setBrush: (brush: KeyLight | null) => change({ brush, selecting: brush ? false : store.get().selecting }),
  setSelecting: (selecting: boolean) => change({ selecting, brush: selecting ? null : store.get().brush }),
};

export function useLightView(): LightView {
  return useWorkbenchStore(store);
}
