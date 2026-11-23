// The screens' module stores that hold what one workbench is doing: a pick of
// keys on the board, the lit view and trying out, the open Layout properties
// and Flows window, the behavior row whose keys are lit, the draft kept from an
// earlier visit (ADR 0024). Each is made with `createWorkbenchStore`, which
// registers it; `endWorkbench` puts every one back to where it started, so the
// next keyboard (and the next test) opens without them. A store that outlives
// the workbench (settings, messages, the link, the behaviors clipboard) is not
// made here.

import { useSyncExternalStore } from "react";

export interface WorkbenchStore<T> {
  get(): T;
  /** Changes the value; listeners hear of it only when it is a different value. */
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}

const registered: WorkbenchStore<unknown>[] = [];
const initials = new Map<WorkbenchStore<unknown>, unknown>();

/** A module store that ends with the workbench, starting at `initial`. */
export function createWorkbenchStore<T>(initial: T): WorkbenchStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  const store: WorkbenchStore<T> = {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  registered.push(store as WorkbenchStore<unknown>);
  initials.set(store as WorkbenchStore<unknown>, initial);
  return store;
}

/** Reads a store in a screen. */
export function useWorkbenchStore<T>(store: WorkbenchStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** The workbench went away: every registered store goes back to its initial value. */
export function endWorkbench(): void {
  for (const store of registered) store.set(initials.get(store));
}

/** Every registered store with the value it started at (for tests). */
export function workbenchStores(): readonly { store: WorkbenchStore<unknown>; initial: unknown }[] {
  return registered.map((store) => ({ store, initial: initials.get(store) }));
}
