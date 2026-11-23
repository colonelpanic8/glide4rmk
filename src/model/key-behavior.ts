// What a key's binding is made of, for the key editor's behavior line and its
// timing panel: which behavior (a plain key, a tap-hold and its timing profile,
// a morse entry and its own timing), how many keys share that timing, and the
// forks that fire on the key. A fork that turns a sticky modifier's second
// press into something else (TailorKey's shiftdance: tap is a sticky Shift,
// Shift then tap again is Caps Lock) is the key's double tap. Pure.

import type { Action, Fork, KeyAction, ModifierCombination, Morse, MorseProfile, MorseProfileEntry } from "./action-types";
import { same } from "./deep-equal";
import { DEFAULT_TAP_HOLD_PROFILE } from "./morse";
import { emptyMorseProfile } from "./slots";

/** Where a key's tap-hold timing lives. */
export type TimingSource =
  /** The keyboard's default timing: no profile of its own. */
  | { kind: "default" }
  /** A named tap-hold profile (a tap-hold binding's third field). */
  | { kind: "profile"; index: number; name: string }
  /** A morse entry's own timing. */
  | { kind: "morse"; index: number };

export interface KeyTiming {
  source: TimingSource;
  profile: MorseProfile;
  /** Keys, on every layer, that share this timing (this one included). */
  users: number;
}

export interface TimingInput {
  layers: readonly (readonly KeyAction[])[];
  morse: readonly Morse[];
  morseProfiles: readonly MorseProfileEntry[];
}

const count = (layers: TimingInput["layers"], test: (action: KeyAction) => boolean) =>
  layers.reduce((total, layer) => total + layer.filter(test).length, 0);

/** The timing a key's hold or tap pattern is decided by, or null for a key
 *  that has none (a plain key, a key that falls through). */
export function keyTiming(action: KeyAction, input: TimingInput): KeyTiming | null {
  if (typeof action !== "object") return null;
  if ("TapHold" in action) {
    const index = action.TapHold[2];
    const entry = input.morseProfiles.find((candidate) => candidate.index === index);
    if (index === DEFAULT_TAP_HOLD_PROFILE || !entry) return { source: { kind: "default" }, profile: emptyMorseProfile(), users: 1 };
    const users = count(input.layers, (other) => typeof other === "object" && "TapHold" in other && other.TapHold[2] === index);
    return { source: { kind: "profile", index, name: entry.name }, profile: entry.profile, users };
  }
  if ("Morse" in action) {
    const index = action.Morse;
    const entry = input.morse[index];
    if (!entry) return null;
    const users = count(input.layers, (other) => typeof other === "object" && "Morse" in other && other.Morse === index);
    return { source: { kind: "morse", index }, profile: entry.profile, users };
  }
  return null;
}

/** The forks that fire on this binding, by slot. */
export function keyForks(action: KeyAction, forks: readonly Fork[]): number[] {
  if (action === "No" || action === "Transparent") return [];
  return forks.flatMap((fork, index) => (same(fork.trigger, action) ? [index] : []));
}

/** A double tap made by a fork, and the fork that makes it. */
export interface ForkDoubleTap {
  fork: number;
  action: Action;
}

const MODIFIER_FIELDS = [
  "left_ctrl", "left_shift", "left_alt", "left_gui", "right_ctrl", "right_shift", "right_alt", "right_gui",
] as const satisfies readonly (keyof ModifierCombination)[];
const shares = (a: ModifierCombination, b: ModifierCombination) => MODIFIER_FIELDS.some((field) => a[field] && b[field]);

/** The one action a fork's output gives, or null for anything richer. */
function outputAction(output: KeyAction): Action | null {
  if (typeof output !== "object") return null;
  if ("Single" in output) return output.Single;
  if ("Tap" in output) return output.Tap;
  return null;
}

/** The fork that gives this key its double tap: the key's tap is a sticky
 *  modifier, and a fork on the key turns the next press, made while that
 *  modifier is still active, into one action. Null when there is none. */
export function forkDoubleTap(action: KeyAction, tap: Action, forks: readonly Fork[]): ForkDoubleTap | null {
  if (typeof tap !== "object" || !("OneShotModifier" in tap)) return null;
  for (const index of keyForks(action, forks)) {
    const fork = forks[index];
    const output = outputAction(fork.positive_output);
    if (output !== null && output !== "No" && shares(fork.match_any.modifiers, tap.OneShotModifier)) return { fork: index, action: output };
  }
  return null;
}

/** The fork with a new double tap: the key it gives on the second press. */
export function withForkDoubleTap(fork: Fork, action: Action): Fork {
  return { ...fork, positive_output: { Single: action } };
}

/** The name of a key's own copy of a shared timing: the original's name and
 *  the key's place, so the two read as related (`HRM_index_v1_TK_LH_C4R3`).
 *  Kept to a name the keyboard and a layout file can hold (letters, digits,
 *  `_`, at most `max`), and made free among `taken` with `_2`, `_3` … */
export function copyName(original: string, key: string, taken: Iterable<string>, max = 32): string {
  const clean = (text: string) => text.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  const place = clean(key) || "key";
  const used = new Set([...taken].map((name) => name.toLowerCase()));
  for (let n = 1; ; n += 1) {
    const tail = `_${place}${n === 1 ? "" : `_${n}`}`;
    const stem = (clean(original) || "Timing").slice(0, Math.max(1, max - tail.length));
    const name = `${stem}${tail}`;
    if (!used.has(name.toLowerCase())) return name;
  }
}
