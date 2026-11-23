// Keys: set several at once, or swap two. Pure.

import type { KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardImage } from "../sync/image";
import { isKeyAction } from "../model/key-action-shape";
import { failed, type Operation } from "./types";

export interface KeyPlace {
  layer: number;
  row: number;
  col: number;
}

export interface KeySet extends KeyPlace {
  action: KeyAction;
}

/** The key's offset in its layer, or a message when there is no such key. */
function offsetOf(image: KeyboardImage, cols: number, { layer, row, col }: KeyPlace): number | string {
  const cells = image.layers[layer];
  if (!cells) return `Layer ${layer} does not exist`;
  const offset = row * cols + col;
  if (col < 0 || col >= cols || row < 0 || offset >= cells.length) return `There is no key at row ${row}, column ${col}`;
  return offset;
}

/** The image with these keys set; a message when one does not exist. */
export function withKeys(image: KeyboardImage, cols: number, keys: readonly KeySet[]): KeyboardImage | string {
  const layers = [...image.layers];
  for (const key of keys) {
    const offset = offsetOf(image, cols, key);
    if (typeof offset === "string") return offset;
    if (layers[key.layer] === image.layers[key.layer]) layers[key.layer] = [...image.layers[key.layer]];
    layers[key.layer][offset] = key.action;
  }
  return { ...image, layers };
}

/** The keys with each tap-hold profile given by name replaced by its slot,
 *  or a sentence naming one that does not exist. */
function withProfileSlots(image: KeyboardImage, keys: readonly KeySet[]): readonly KeySet[] | string {
  const slotOf = new Map((image.morseProfiles ?? []).flatMap((entry) => (entry ? [[entry.name, entry.index] as const] : [])));
  const out: KeySet[] = [];
  for (const key of keys) {
    const action = key?.action as unknown;
    const tapHold = typeof action === "object" && action !== null && "TapHold" in action ? (action as { TapHold: unknown }).TapHold : null;
    if (!Array.isArray(tapHold) || typeof tapHold[2] !== "string") {
      out.push(key);
      continue;
    }
    const slot = slotOf.get(tapHold[2]);
    if (slot === undefined) return `there is no timing profile called ${tapHold[2]}`;
    out.push({ ...key, action: { TapHold: [tapHold[0], tapHold[1], slot] } as KeyAction });
  }
  return out;
}

export const setKeys: Operation<{ keys: readonly KeySet[] }> = {
  name: "set_keys",
  description: "Sets keys to actions, as one change: a paste, a move, a whole layer.",
  inputs: [{ name: "keys", kind: "value", list: true, description: "Each key: { layer, row, col, action }; a tap-hold's profile may be its name." }],
  run(image, input, facts) {
    // A Flow may name a tap-hold's timing profile instead of giving its slot.
    const keys = withProfileSlots(image, input.keys);
    if (typeof keys === "string") return failed(keys);
    // A caller that is not TypeScript (a Flow, an assistant) may send anything.
    const bad = keys.findIndex((key) => ![key.layer, key.row, key.col].every(Number.isInteger) || !isKeyAction(key.action));
    if (bad >= 0) return failed(`set_keys: keys[${bad}] is not { layer, row, col, action } with an action the keyboard can store`);
    const next = withKeys(image, facts.cols, keys);
    return typeof next === "string" ? failed(next) : { ok: true, image: next };
  },
};

export const swapKeys: Operation<{ a: KeyPlace; b: KeyPlace }> = {
  name: "swap_keys",
  description: "Swaps the actions of two keys, on one layer or across layers.",
  inputs: [
    { name: "a", kind: "value", description: "One key: { layer, row, col }." },
    { name: "b", kind: "value", description: "The other key: { layer, row, col }." },
  ],
  run(image, { a, b }, facts) {
    const from = offsetOf(image, facts.cols, a);
    const to = offsetOf(image, facts.cols, b);
    if (typeof from === "string") return failed(from);
    if (typeof to === "string") return failed(to);
    const next = withKeys(image, facts.cols, [
      { ...a, action: image.layers[b.layer][to] },
      { ...b, action: image.layers[a.layer][from] },
    ]);
    return typeof next === "string" ? failed(next) : { ok: true, image: next };
  },
};
