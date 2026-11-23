// A key's tap-hold timing, as the key editor's timing panel changes it: the
// timing every key sharing it uses, or a copy for this key only (a new profile
// for a tap-hold, a new tap pattern for a morse key) named after the original
// and the key, so the two read as related. The forks that fire on the key are
// copied with it, so the key keeps doing what it did (TailorKey's shiftdance
// keeps its double tap). One change, judged once, one Undo step. Pure.

import type { KeyAction, MorseProfile } from "../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardImage } from "../sync/image";
import { copyName, keyForks, keyTiming, type TimingSource } from "../model/key-behavior";
import { labelAt, namesOf, type BehaviorKind, type BehaviorLabels } from "../model/behavior-labels";
import { createBehavior, setBehavior } from "./behaviors";
import type { AnyBehavior } from "./behavior-slots";
import { setKeys, type KeyPlace } from "./keys";
import { failed, type Operation, type OperationFacts, type OperationResult } from "./types";

export interface KeyTimingInput extends KeyPlace {
  timing: MorseProfile;
  /** The key gets a copy; else the timing it shares changes for every key. */
  only_this_key: boolean;
  /** The key's place (`LH-C4R3`), which a copy's name ends in. */
  key_name: string;
}

interface Step {
  image: KeyboardImage;
  labels: BehaviorLabels;
}

/** One operation more on the same image, the labels carried along. */
function then(step: Step | string, facts: OperationFacts, run: (image: KeyboardImage, facts: OperationFacts) => OperationResult): Step | string {
  if (typeof step === "string") return step;
  const result = run(step.image, { ...facts, labels: step.labels });
  return result.ok ? { image: result.image, labels: result.labels ?? step.labels } : result.message;
}

const taken = (step: Step, kind: BehaviorKind): string[] =>
  kind === "profiles" ? (step.image.morseProfiles ?? []).flatMap((entry) => (entry ? [entry.name] : [])) : namesOf(step.labels, kind);

/** Adds a copy named after `original` and the key; the slot it took, or why not. */
function addCopy(step: Step | string, facts: OperationFacts, behavior: AnyBehavior, original: string, key: string): { step: Step; slot: number } | string {
  if (typeof step === "string") return step;
  const name = copyName(original, key, taken(step, behavior.kind));
  const next = then(step, facts, (image, f) => createBehavior.run(image, { ...behavior, name }, f));
  if (typeof next === "string") return next;
  const before = step.image;
  const slot =
    behavior.kind === "profiles"
      ? (next.image.morseProfiles ?? []).findIndex((entry, i) => entry !== (before.morseProfiles ?? [])[i])
      : behavior.kind === "morse"
        ? next.image.morse.findIndex((entry, i) => entry !== before.morse[i])
        : next.image.forks.findIndex((entry, i) => entry !== before.forks[i]);
  return { step: next, slot };
}

function sourceName(step: Step, source: TimingSource): string {
  if (source.kind === "profile") return source.name;
  if (source.kind === "morse") return labelAt(step.labels, "morse", source.index)?.name ?? "";
  return "";
}

export const setKeyTiming: Operation<KeyTimingInput> = {
  name: "set_key_timing",
  description: "Changes the tap-hold timing of one key: a copy for this key only, or the timing every key sharing it uses.",
  inputs: [
    { name: "layer", kind: "integer", min: 0, description: "The key's layer." },
    { name: "row", kind: "integer", min: 0, description: "The key's row." },
    { name: "col", kind: "integer", min: 0, description: "The key's column." },
    { name: "timing", kind: "value", description: "The timing: a profile's fields; an empty one follows the keyboard's default." },
    { name: "only_this_key", kind: "boolean", description: "Give this key a copy of its own; false changes it for every key sharing it." },
    { name: "key_name", kind: "string", description: "The key's place, which a copy's name ends in." },
  ],
  run(image, input, facts) {
    const action = image.layers[input.layer]?.[input.row * facts.cols + input.col];
    if (action === undefined) return failed(`There is no key at row ${input.row}, column ${input.col}`);
    const profiles = (image.morseProfiles ?? []).flatMap((entry) => (entry ? [entry] : []));
    const timing = keyTiming(action, { layers: image.layers, morse: image.morse, morseProfiles: profiles });
    if (!timing) return failed("This key has no tap-hold timing");
    const { source } = timing;
    const start: Step = { image, labels: facts.labels };

    // Every key that shares it: the profile or the tap pattern itself changes.
    if (!input.only_this_key && source.kind !== "default") {
      const behavior: AnyBehavior & { slot: number } =
        source.kind === "profile"
          ? { kind: "profiles", slot: source.index, value: input.timing }
          : { kind: "morse", slot: source.index, value: { ...image.morse[source.index], profile: input.timing } };
      const next = then(start, facts, (img, f) => setBehavior.run(img, behavior, f));
      return typeof next === "string" ? failed(next) : { ok: true, ...next };
    }

    // This key only: a copy, the key bound to it, and its forks copied along.
    const original = sourceName(start, source);
    const copy =
      source.kind === "morse"
        ? addCopy(start, facts, { kind: "morse", value: { ...image.morse[source.index], profile: input.timing } }, original, input.key_name)
        : addCopy(start, facts, { kind: "profiles", value: input.timing }, original, input.key_name);
    if (typeof copy === "string") return failed(copy);
    if (typeof action !== "object" || (!("Morse" in action) && !("TapHold" in action))) return failed("This key has no tap-hold timing");
    const binding: KeyAction = "Morse" in action ? { Morse: copy.slot } : { TapHold: [action.TapHold[0], action.TapHold[1], copy.slot] };

    let step: Step | string = copy.step;
    for (const index of keyForks(action, image.forks)) {
      const fork = { ...image.forks[index], trigger: binding };
      const forkName = labelAt(facts.labels, "forks", index)?.name ?? "";
      const added = addCopy(step, facts, { kind: "forks", value: fork }, forkName || `Fork_${index}`, input.key_name);
      step = typeof added === "string" ? added : added.step;
    }
    step = then(step, facts, (img, f) =>
      setKeys.run(img, { keys: [{ layer: input.layer, row: input.row, col: input.col, action: binding }] }, f),
    );
    return typeof step === "string" ? failed(step) : { ok: true, ...step };
  },
};
