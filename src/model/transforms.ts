import type { MacroOp } from "../vendor/rynk-wasm/rynk_wasm";
// Keymap-wide transforms: the dual-OS Ctrl↔GUI swap. Pure planning logic; the
// apply_transform operation applies a plan. Switching typing layouts is a
// Flow (flows/shared/alternative-layouts.flows, ADR 0025).

import type {
  Action,
  ComboDefinition,
  Fork,
  HidKeyCode,
  KeyAction,
  KeyCode,
  ModifierCombination,
  Morse,
} from "../vendor/rynk-wasm/rynk_wasm";
import { decodeMacros, encodeMacros, isSendStep } from "./macros";
import { same } from "./deep-equal";

/** Identifier-level HID keycode substitution. */
export type HidMap = Partial<Record<HidKeyCode, HidKeyCode>>;

export interface TransformSpec {
  hid: HidMap;
  /** Also rewrite modifier combinations (the OS swap needs this). */
  modifiers?: (mods: ModifierCombination) => ModifierCombination;
}

/** Ctrl↔GUI everywhere. Its own inverse, so it maps a PC-canonical keymap to
 *  its macOS variant and back. */
export const CTRL_GUI_SWAP: TransformSpec = {
  hid: { LCtrl: "LGui", LGui: "LCtrl", RCtrl: "RGui", RGui: "RCtrl" },
  modifiers: (mods) => ({
    ...mods,
    left_ctrl: mods.left_gui,
    left_gui: mods.left_ctrl,
    right_ctrl: mods.right_gui,
    right_gui: mods.right_ctrl,
  }),
};

function mapHid(spec: TransformSpec, code: HidKeyCode): HidKeyCode {
  return spec.hid[code] ?? code;
}

function mapKeyCode(spec: TransformSpec, code: KeyCode): KeyCode {
  if (typeof code === "object" && "Hid" in code) {
    return { Hid: mapHid(spec, code.Hid) };
  }
  return code;
}

function mapModifiers(spec: TransformSpec, mods: ModifierCombination): ModifierCombination {
  return spec.modifiers ? spec.modifiers(mods) : mods;
}

export function mapAction(spec: TransformSpec, action: Action): Action {
  if (typeof action === "string") return action;
  if ("Key" in action) return { Key: mapKeyCode(spec, action.Key) };
  if ("Modifier" in action) return { Modifier: mapModifiers(spec, action.Modifier) };
  if ("KeyWithModifier" in action) {
    return {
      KeyWithModifier: [
        mapHid(spec, action.KeyWithModifier[0]),
        mapModifiers(spec, action.KeyWithModifier[1]),
      ],
    };
  }
  if ("LayerOnWithModifier" in action) {
    return {
      LayerOnWithModifier: [
        action.LayerOnWithModifier[0],
        mapModifiers(spec, action.LayerOnWithModifier[1]),
      ],
    };
  }
  if ("OneShotModifier" in action) {
    return { OneShotModifier: mapModifiers(spec, action.OneShotModifier) };
  }
  if ("OneShotKey" in action) return { OneShotKey: mapHid(spec, action.OneShotKey) };
  return action;
}

export function mapKeyAction(spec: TransformSpec, keyAction: KeyAction): KeyAction {
  if (typeof keyAction === "string") return keyAction;
  if ("Single" in keyAction) return { Single: mapAction(spec, keyAction.Single) };
  if ("Tap" in keyAction) return { Tap: mapAction(spec, keyAction.Tap) };
  if ("TapHold" in keyAction) {
    return {
      TapHold: [
        mapAction(spec, keyAction.TapHold[0]),
        mapAction(spec, keyAction.TapHold[1]),
        keyAction.TapHold[2],
      ],
    };
  }
  if ("LayerModTap" in keyAction) {
    const [layer, modifier, hid] = keyAction.LayerModTap;
    const mapped = spec.hid[modifier as unknown as HidKeyCode];
    return {
      LayerModTap: [
        layer,
        mapped ? (mapped as unknown as typeof modifier) : modifier,
        mapHid(spec, hid),
      ],
    };
  }
  return keyAction;
}

export interface KeyEdit {
  layer: number;
  row: number;
  col: number;
  after: KeyAction;
}

export interface SlotEdit<T> {
  index: number;
  after: T;
}

export interface TransformPlan {
  keys: KeyEdit[];
  combos: SlotEdit<ComboDefinition>[];
  morse: SlotEdit<Morse>[];
  forks: SlotEdit<Fork>[];
  /** Re-encoded macro region, when any step changed. */
  macroOps: MacroOp[][] | null;
}

/** Every write the plan will issue: keys, slot tables, and the macro region. */
export function planSize(plan: TransformPlan): number {
  return (
    planKeyCount(plan) +
    plan.combos.length +
    plan.morse.length +
    plan.forks.length +
    (plan.macroOps ? 1 : 0)
  );
}

/** Just the keymap cells, reported apart from the slot and macro writes. */
export function planKeyCount(plan: TransformPlan): number {
  return plan.keys.length;
}

export interface TransformInput {
  layers: KeyAction[][];
  cols: number;
  combos: ComboDefinition[];
  morse: Morse[];
  forks: Fork[];
  macroOps: MacroOp[][];
}

function planKeys(layers: KeyAction[][], cols: number, spec: TransformSpec): KeyEdit[] {
  const edits: KeyEdit[] = [];
  layers.forEach((cells, layer) => {
    cells.forEach((keyAction, offset) => {
      const after = mapKeyAction(spec, keyAction);
      if (!same(keyAction, after)) {
        edits.push({ layer, row: Math.floor(offset / cols), col: offset % cols, after });
      }
    });
  });
  return edits;
}

function mapCombo(spec: TransformSpec, combo: ComboDefinition): ComboDefinition {
  if ("Actions" in combo) {
    return {
      Actions: {
        actions: combo.Actions.actions.map((a) => mapKeyAction(spec, a)),
        output: mapKeyAction(spec, combo.Actions.output),
        layer: combo.Actions.layer,
      },
    };
  }
  return {
    Positions: { ...combo.Positions, output: mapKeyAction(spec, combo.Positions.output) },
  };
}

function mapFork(spec: TransformSpec, fork: Fork): Fork {
  return {
    ...fork,
    trigger: mapKeyAction(spec, fork.trigger),
    negative_output: mapKeyAction(spec, fork.negative_output),
    positive_output: mapKeyAction(spec, fork.positive_output),
    match_any: { ...fork.match_any, modifiers: mapModifiers(spec, fork.match_any.modifiers) },
    match_none: { ...fork.match_none, modifiers: mapModifiers(spec, fork.match_none.modifiers) },
    kept_modifiers: mapModifiers(spec, fork.kept_modifiers),
  };
}

function mapMorse(spec: TransformSpec, morse: Morse): Morse {
  return {
    ...morse,
    actions: morse.actions.map(([pattern, action]) => [pattern, mapAction(spec, action)]),
  };
}

function planSlots<T>(slots: T[], map: (value: T) => T): SlotEdit<T>[] {
  const edits: SlotEdit<T>[] = [];
  slots.forEach((value, index) => {
    const after = map(value);
    if (!same(value, after)) edits.push({ index, after });
  });
  return edits;
}

/** The OS swap touches everything an action can live in: every layer's keys,
 *  combos, morse slots, forks, and macro steps. */
export function planOsSwap(input: TransformInput): TransformPlan {
  const spec = CTRL_GUI_SWAP;
  const macros = decodeMacros(input.macroOps);
  const mappedMacros = macros.map((macro) => ({
    steps: macro.steps.map((step) =>
      isSendStep(step) ? { ...step, action: mapAction(spec, step.action) } : step,
    ),
  }));
  const macroOps = same(macros, mappedMacros) ? null : encodeMacros(mappedMacros);
  return {
    keys: planKeys(input.layers, input.cols, spec),
    combos: planSlots(input.combos, (combo) => mapCombo(spec, combo)),
    morse: planSlots(input.morse, (morse) => mapMorse(spec, morse)),
    forks: planSlots(input.forks, (fork) => mapFork(spec, fork)),
    macroOps,
  };
}
