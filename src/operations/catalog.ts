// The catalog (ADR 0019): every operation by name, and what it takes, as plain
// data. WebMCP and Flows will list and call operations through it and
// `io.apply`; nothing is registered, and nothing outside the app reaches it.

import { setKeys, swapKeys } from "./keys";
import { setKeyTiming } from "./key-timing";
import { addLayer, deleteLayer, duplicateLayer, moveLayer, renameLayer } from "./layers";
import { setTimingProfile } from "./timing-profiles";
import { clearLayerLights, setBatteryBar, setConnectionKey, setKeyEffects, setKeyLight, setMagicLayer } from "./lighting";
import { applyTransform } from "./transform";
import { setCombos } from "./combos";
import {
  createBehavior,
  deleteBehavior,
  deleteUnusedBehaviors,
  duplicateBehavior,
  pasteBehaviors,
  renameBehavior,
  setBehavior,
} from "./behaviors";
import { checkInput } from "./inputs";
import type { InputField, OperationFacts, OperationResult } from "./types";
import type { KeyboardImage } from "../sync/image";

// The names are GLIDE's where GLIDE has the operation (set_keys, add_behavior,
// update_behavior, add_layer, rename_layer), so a Flow or a WebMCP tool reads
// the same in both apps (ADR 0031).
const NAMED = {
  set_keys: setKeys,
  swap_keys: swapKeys,
  set_key_timing: setKeyTiming,
  set_combos: setCombos,
  add_layer: addLayer,
  rename_layer: renameLayer,
  move_layer: moveLayer,
  delete_layer: deleteLayer,
  duplicate_layer: duplicateLayer,
  set_key_light: setKeyLight,
  set_key_effects: setKeyEffects,
  clear_layer_lights: clearLayerLights,
  set_connection_key: setConnectionKey,
  set_battery_bar: setBatteryBar,
  set_magic_layer: setMagicLayer,
  apply_transform: applyTransform,
  add_behavior: createBehavior,
  update_behavior: setBehavior,
  set_timing_profile: setTimingProfile,
  rename_behavior: renameBehavior,
  duplicate_behavior: duplicateBehavior,
  delete_behavior: deleteBehavior,
  delete_unused_behaviors: deleteUnusedBehaviors,
  paste_behaviors: pasteBehaviors,
} as const;

/** GLIDE4RMK's first names, still run until ADR 0031 retires them; never listed. */
export const FORMER_NAMES = { create_behavior: "add_behavior", set_behavior: "update_behavior" } as const;

/** Every operation a caller may name: GLIDE's names, and the former ones as aliases. */
export const OPERATIONS = { ...NAMED, create_behavior: NAMED.add_behavior, set_behavior: NAMED.update_behavior } as const;

export type OperationName = keyof typeof OPERATIONS;
export type InputOf<Name extends OperationName> = Parameters<(typeof OPERATIONS)[Name]["run"]>[1];

/** One operation as the catalog lists it. */
export interface OperationInfo {
  name: OperationName;
  description: string;
  inputs: readonly InputField[];
}

/** The operations, by their names (former names are not listed). */
export function catalog(): OperationInfo[] {
  return (Object.keys(NAMED) as (keyof typeof NAMED)[]).map((name) => {
    const { description, inputs } = NAMED[name];
    return { name, description, inputs };
  });
}

/** Runs an operation by name on an image; the input is checked against its fields first. */
export function runOperation<Name extends OperationName>(
  name: Name,
  image: KeyboardImage,
  input: InputOf<Name>,
  facts: OperationFacts,
): OperationResult {
  const operation = OPERATIONS[name] as { inputs: readonly InputField[]; run(image: KeyboardImage, input: unknown, facts: OperationFacts): OperationResult } | undefined;
  if (!operation) return { ok: false, message: `There is no operation called ${String(name)}` };
  const problem = checkInput(operation.inputs, input);
  if (problem) return { ok: false, message: `${name}: ${problem}` };
  return operation.run(image, input, facts);
}
