import type {
  Combo,
  ComboDefinition,
  KeyAction,
  MatrixPosition,
  PositionCombo,
} from "../vendor/rynk-wasm/rynk_wasm";
import { same } from "./deep-equal";

export function comboIsActions(definition: ComboDefinition): definition is { Actions: Combo } {
  return "Actions" in definition;
}

export function comboIsPositions(
  definition: ComboDefinition,
): definition is { Positions: PositionCombo } {
  return "Positions" in definition;
}

export function comboOutput(definition: ComboDefinition): KeyAction {
  return comboIsActions(definition) ? definition.Actions.output : definition.Positions.output;
}

/** The layer mask RMK stores for a combo when it works on every layer. */
export const EVERY_LAYER = 0xffffffff;

/** The combo's layer mask, unsigned: bit N is layer N. */
export function comboMask(definition: ComboDefinition): number {
  return (comboIsActions(definition) ? definition.Actions.layers : definition.Positions.layers) >>> 0;
}

/** The layers a combo works on, lowest first; undefined when it works on every layer. */
export function comboLayers(definition: ComboDefinition): number[] | undefined {
  const mask = comboMask(definition);
  if (mask === EVERY_LAYER) return undefined;
  return Array.from({ length: 32 }, (_, layer) => layer).filter((layer) => ((mask >>> layer) & 1) === 1);
}

/** The combo's own layer (its lowest one), or undefined when it works on every layer. */
export function comboLayer(definition: ComboDefinition): number | undefined {
  return comboLayers(definition)?.[0];
}

/** The mask for one layer, or for every layer. */
export function layerMask(layer: number | undefined): number {
  return layer === undefined ? EVERY_LAYER : (1 << layer) >>> 0;
}

export function comboTriggerCount(definition: ComboDefinition): number {
  return comboIsActions(definition)
    ? definition.Actions.actions.length
    : definition.Positions.positions.length;
}

export function comboIsEmpty(definition: ComboDefinition): boolean {
  return comboOutput(definition) === "No" && comboTriggerCount(definition) === 0;
}

export function comboWithOutput(
  definition: ComboDefinition,
  output: KeyAction,
): ComboDefinition {
  return comboIsActions(definition)
    ? { Actions: { ...definition.Actions, output } }
    : { Positions: { ...definition.Positions, output } };
}

export function comboWithMask(definition: ComboDefinition, mask: number): ComboDefinition {
  const layers = mask >>> 0;
  return comboIsActions(definition)
    ? { Actions: { ...definition.Actions, layers } }
    : { Positions: { ...definition.Positions, layers } };
}

export function comboWithLayer(
  definition: ComboDefinition,
  layer: number | undefined,
): ComboDefinition {
  return comboWithMask(definition, layerMask(layer));
}

export function samePosition(a: MatrixPosition, b: MatrixPosition): boolean {
  return a.row === b.row && a.col === b.col;
}

/** A new combo made on the canvas: it matches keys by their place. */
export function newPositionCombo(): ComboDefinition {
  return { Positions: { positions: [], output: "No", layers: EVERY_LAYER } };
}

/** Whether the key is one of the combo's keys: by its place, or, for a combo
 *  that matches actions, by what the key does on the combo's layer. */
export function comboHasKey(definition: ComboDefinition, key: MatrixPosition, action: KeyAction): boolean {
  return comboIsActions(definition)
    ? definition.Actions.actions.some((candidate) => same(candidate, action))
    : definition.Positions.positions.some((position) => samePosition(position, key));
}

/** What a key does on a layer, looking through keys that are the same as the
 *  layer below to the first layer that gives it an action of its own. */
export function actionThrough(layers: readonly (readonly KeyAction[])[], layer: number, offset: number): KeyAction {
  for (let index = Math.min(layer, layers.length - 1); index >= 0; index--) {
    const action = layers[index]?.[offset] ?? "No";
    if (action !== "Transparent") return action;
  }
  return "No";
}

export type ComboToggle =
  | { ok: true; combo: ComboDefinition }
  | { ok: false; reason: "full" | "no-action" };

/** The combo with the key added, or taken out when it is in already. An empty
 *  combo starts as a new one that matches places. A combo that matches actions
 *  cannot take a key that does nothing. */
export function toggleComboKey(
  definition: ComboDefinition,
  key: MatrixPosition,
  action: KeyAction,
  maxKeys: number,
): ComboToggle {
  const combo = comboIsEmpty(definition) ? newPositionCombo() : definition;
  const full = comboTriggerCount(combo) >= maxKeys;
  if (comboIsActions(combo)) {
    const { actions } = combo.Actions;
    if (actions.some((candidate) => same(candidate, action))) {
      return { ok: true, combo: { Actions: { ...combo.Actions, actions: actions.filter((a) => !same(a, action)) } } };
    }
    if (action === "No" || action === "Transparent") return { ok: false, reason: "no-action" };
    if (full) return { ok: false, reason: "full" };
    return { ok: true, combo: { Actions: { ...combo.Actions, actions: [...actions, action] } } };
  }
  const { positions } = combo.Positions;
  if (positions.some((position) => samePosition(position, key))) {
    const rest = positions.filter((position) => !samePosition(position, key));
    return { ok: true, combo: { Positions: { ...combo.Positions, positions: rest } } };
  }
  if (full) return { ok: false, reason: "full" };
  const place = { row: key.row, col: key.col };
  return { ok: true, combo: { Positions: { ...combo.Positions, positions: [...positions, place] } } };
}

/** What a combo still needs before it does anything: a second key, then an action. */
export function comboNeeds(definition: ComboDefinition): "keys" | "action" | null {
  if (comboTriggerCount(definition) < 2) return "keys";
  if (comboOutput(definition) === "No") return "action";
  return null;
}

/** Combos that use the same keys as the one at `index` (same layer or every layer). */
export function comboTwins(combos: readonly ComboDefinition[], index: number): number[] {
  const own = combos[index];
  if (!own || comboTriggerCount(own) === 0) return [];
  const keyOf = (definition: ComboDefinition) =>
    comboIsActions(definition)
      ? definition.Actions.actions.map((action) => JSON.stringify(action)).sort().join("|")
      : definition.Positions.positions.map((p) => `${p.row}:${p.col}`).sort().join("|");
  return combos.flatMap((other, i) =>
    i !== index &&
    comboIsActions(other) === comboIsActions(own) &&
    keyOf(other) === keyOf(own) &&
    (comboMask(other) & comboMask(own)) !== 0
      ? [i]
      : [],
  );
}

/** What a combo is apart from its layer: its kind, its keys in any order and its action. */
function comboShape(definition: ComboDefinition): string {
  const keys = comboIsActions(definition)
    ? definition.Actions.actions.map((action) => JSON.stringify(action))
    : definition.Positions.positions.map((p) => `${p.row}:${p.col}`);
  return JSON.stringify([comboIsActions(definition), [...keys].sort(), comboOutput(definition)]);
}

/** The combos as a person sees them: one combo on several layers, as GLIDE
 *  shows a combo with its layers. A slot can name several layers, and a
 *  layout file may also repeat a combo per layer, so slots with the same keys
 *  and action on layers of their own are one group; a combo on every layer
 *  stays alone. Each group lists its slots in order, the first leading. Empty
 *  slots are left out. */
export function comboGroups(combos: readonly ComboDefinition[]): number[][] {
  const groups: number[][] = [];
  const byShape = new Map<string, number[]>();
  combos.forEach((combo, index) => {
    if (comboIsEmpty(combo)) return;
    const mask = comboMask(combo);
    const shape = mask === EVERY_LAYER ? null : comboShape(combo);
    const group = shape === null ? undefined : byShape.get(shape);
    if (group && !group.some((slot) => (comboMask(combos[slot]) & mask) !== 0)) {
      group.push(index);
      return;
    }
    const fresh = [index];
    groups.push(fresh);
    if (shape !== null && !group) byShape.set(shape, fresh);
  });
  return groups;
}

/** The layers of the combo stored in `slots`, lowest first; undefined when it works on every layer. */
export function groupLayers(combos: readonly ComboDefinition[], slots: readonly number[]): number[] | undefined {
  const layers: number[] = [];
  for (const slot of slots) {
    const own = comboLayers(combos[slot]);
    if (own === undefined) return undefined;
    layers.push(...own);
  }
  return [...new Set(layers)].sort((a, b) => a - b);
}

/** The other slots of the combo at `index` (its copies on other layers). */
export function comboCopies(combos: readonly ComboDefinition[], index: number): number[] {
  return (comboGroups(combos).find((group) => group.includes(index)) ?? []).filter((slot) => slot !== index);
}
