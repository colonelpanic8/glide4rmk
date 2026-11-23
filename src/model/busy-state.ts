// What the workbench is busy writing, and why the last write of each kind
// failed: Send, a layer operation, a lighting transaction, the pointing
// configuration. Never drafted, never sent, outside the history
// (docs/adr/0032-workbench-state-groups.md). Pure.

export interface BusyFlags {
  /** Send is writing the draft to the keyboard. */
  batchBusy: boolean;
  /** Why the last send left changes in the draft; null once it left none, and
   *  after the next edit. */
  batchError: string | null;
  layerBusy: boolean;
  layerError: string | null;
  lightingBusy: boolean;
  lightingError: string | null;
  pointingBusy: boolean;
  /** Why the last pointing read or write failed (the read at connect included). */
  pointingError: string | null;
}

/** The busy and error flags, as screens and io read them. */
export function busyOf(state: { readonly busy: BusyFlags }): BusyFlags {
  return state.busy;
}

/** The flags with `parts` set. */
export function withBusy<S extends { readonly busy: BusyFlags }>(state: S, parts: Partial<BusyFlags>): S {
  return { ...state, busy: { ...state.busy, ...parts } };
}
