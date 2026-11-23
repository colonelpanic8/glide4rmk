// A draft kept from an earlier visit with this keyboard, offered back (by the
// status chip) until it is restored or forgotten. The draft keeper sets it for
// each keyboard, and it ends with the workbench (ui/workbench-store.ts).

import { useWorkbench } from "../state";
import { keptPatch, type KeptDraft } from "../../workbench/draft/changes";
import { createWorkbenchStore, useWorkbenchStore } from "../workbench-store";

/** A draft kept from an earlier visit, offered back until restored or forgotten. */
export const earlierDraft = createWorkbenchStore<KeptDraft | null>(null);
export const setEarlier = (next: KeptDraft | null) => earlierDraft.set(next);
export function useEarlierDraft(): KeptDraft | null {
  return useWorkbenchStore(earlierDraft);
}

/** Puts a kept draft back on top of what the keyboard has now, then forgets the offer. */
export function useRestoreEarlier() {
  const { bundle, state, dispatch } = useWorkbench();
  return {
    restore(kept: KeptDraft) {
      dispatch({ type: "draftRestore", patch: keptPatch(kept, state.base, bundle.caps.num_cols) });
      setEarlier(null);
    },
    forget() {
      setEarlier(null);
    },
  };
}
