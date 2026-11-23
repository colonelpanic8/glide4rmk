// Screens change the layout through `io` (ADR 0017), which decides what Guard,
// the draft and the write path say; a screen that dispatches an edit itself
// skips all of that. This guard finds edits dispatched in src/ui so they can
// only shrink while they move onto `io` (docs/architecture-review.md, P5),
// the same ratchet as the import boundaries.
//
// An edit is an action that changes what you want: the ones the reducer makes
// a step of the history (`COMMITS` in workbench/reducer.ts, ADR 0018), plus
// Undo/Redo and putting a kept draft back. A screen's own state (`select`,
// `mode`, `uiLayer`, `hoverLeds`, Draft or Live, a stroke opening) and status
// (reads, progress, errors and their dismissal, live topics, try-out) are not
// edits and stay allowed.
//
// Counted in a screen:
//  - an action literal of an edit type (`{ type: "paint", … }`), wherever it
//    is built; the edit names are not used for anything else in src/ui; and
//  - `dispatch(x)` with an action the screen did not spell out, which may be
//    an edit built elsewhere.
//
// Pure: it works on file text, so the rule can be tested without a file system.

import type { WorkbenchAction } from "../model/workbench-state";
import type { Violation } from "./boundaries";
import { isProbeChecked } from "./probing";

/** The action types that change what you want. */
export const EDIT_ACTIONS: ReadonlyArray<WorkbenchAction["type"]> = [
  // Draft edits and operations.
  "keyStage", "encoderStage", "slotStage", "wantSet", "commit", "notesSet",
  // Lighting and pointing drafts.
  "paint", "erase", "draftReset", "conditionalDraft", "conditionalDraftReset", "pointingDraftSet", "pointingDraftReset",
  // What you want set back, or put back.
  "draftRevert", "batchDiscard", "draftRestore", "historyTravel",
  // Live writes: what you want and what the keyboard holds, at once.
  "keyWriteStart", "encoderWriteStart", "slotWriteStart", "fieldWriteStart", "defaultLayer", "layerMetadataSet",
  "lightingStateSet", "scenePolicySet", "wakeLayersSet", "extensionStateSet",
];

export const DISPATCH_RULE = "ui-never-dispatches-edits";

export const DISPATCH_WHY =
  "Change the layout through io (useWorkbench().io), which asks Guard and keeps Draft and Live; a screen dispatches only its own state.";

const EDIT_LITERAL = new RegExp(`\\btype\\s*:\\s*["'](${EDIT_ACTIONS.join("|")})["']`, "g");
// `dispatch(` followed by anything but an object literal.
const OPAQUE_DISPATCH = /\bdispatch\s*\(\s*(?!\{)([\w$.]+)/g;

/** Whether the guard applies to a file: production code under src/ui, as for probing. */
export const isDispatchChecked = isProbeChecked;

function occurrences(source: string): string[] {
  const texts = [
    ...[...source.matchAll(EDIT_LITERAL)].map((m) => ({ index: m.index, text: m[1] })),
    ...[...source.matchAll(OPAQUE_DISPATCH)].map((m) => ({ index: m.index, text: `dispatch(${m[1]})` })),
  ]
    .sort((a, b) => a.index - b.index)
    .map((f) => f.text);
  const seen = new Map<string, number>();
  return texts.map((text) => {
    const n = (seen.get(text) ?? 0) + 1;
    seen.set(text, n);
    return `${text}#${n}`;
  });
}

/** Every edit dispatched in the given files (path to source text), sorted.
 *  Repeats in one file are numbered, so another one is a new entry. */
export function findEditDispatches(files: Record<string, string>): Violation[] {
  const found: Violation[] = [];
  for (const [from, source] of Object.entries(files)) {
    if (!isDispatchChecked(from)) continue;
    for (const to of occurrences(source)) found.push({ rule: DISPATCH_RULE, from, to });
  }
  return found.sort((a, b) => `${a.from} ${a.to}`.localeCompare(`${b.from} ${b.to}`));
}

/** The action types a reducer source's `COMMITS` set names, to keep EDIT_ACTIONS in step with it. */
export function committedTypes(reducerSource: string): string[] {
  const set = /const COMMITS = new Set<[^>]*>\(\[([^\]]*)\]\)/.exec(reducerSource);
  return set ? [...set[1].matchAll(/["'](\w+)["']/g)].map((m) => m[1]) : [];
}
