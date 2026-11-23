// The layout's notes (model/history.ts, `LayoutNotes`): what a layout keeps that
// the keyboard does not. Commits, imports, loads and the history carry them as
// one value; this is the one place that maps them onto the state's fields, so a
// new note is a field of `LayoutNotes`, of the state, and a line in each below.

import type { LayoutNotes } from "../model/history";
import type { WorkbenchState } from "../model/workbench-state";
import { sameValue } from "../model/deep-equal";

export const notesOf = (state: WorkbenchState): LayoutNotes => ({ labels: state.labels, modules: state.modules });

/** The state with the notes given; the rest kept. */
export function withNotes(state: WorkbenchState, notes: Partial<LayoutNotes>): WorkbenchState {
  return {
    ...state,
    labels: notes.labels ?? state.labels,
    modules: notes.modules ? [...notes.modules] : state.modules,
  };
}

/** Whether any of the notes given differs from what the state holds. */
export function notesChange(state: WorkbenchState, notes: Partial<LayoutNotes> | undefined): boolean {
  if (!notes) return false;
  const now = notesOf(state);
  return (Object.keys(notes) as (keyof LayoutNotes)[]).some((key) => notes[key] !== undefined && !sameValue(notes[key], now[key]));
}
