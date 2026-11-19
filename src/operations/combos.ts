// Combos: several slots set as one change, so a combo stored once per layer
// changes, moves or goes on every layer together (ADR 0019). Pure.

import type { ComboDefinition } from "../vendor/rynk-wasm/rynk_wasm";
import { failed, type Operation } from "./types";

export interface ComboSet {
  slot: number;
  combo: ComboDefinition;
}

const isCombo = (value: unknown): value is ComboDefinition =>
  typeof value === "object" && value !== null && ("Actions" in value || "Positions" in value);

export const setCombos: Operation<{ combos: readonly ComboSet[] }> = {
  name: "set_combos",
  description: "Sets combo slots, as one change: a combo on several layers, or removing one (an empty combo).",
  inputs: [{ name: "combos", kind: "value", list: true, description: "Each: { slot, combo }." }],
  run(image, { combos }) {
    const next = [...image.combos];
    for (const [index, { slot, combo }] of combos.entries()) {
      if (!Number.isInteger(slot) || slot < 0 || slot >= next.length) return failed(`There is no combo ${slot}`);
      if (!isCombo(combo)) return failed(`set_combos: combos[${index}] is not a combo`);
      next[slot] = combo;
    }
    return { ok: true, image: { ...image, combos: next } };
  },
};
