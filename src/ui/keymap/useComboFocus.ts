// The combo open in Focus Mode and what can be done to it: add or remove a
// key, change its action or layer, finish, or discard it. Each change is
// written at once, like a key edit. A combo stored once per layer is one
// combo: a change to its keys or action reaches every copy, as one change. The
// canvas pill and the combo editor below the keyboard share this.

import type { KeyAction } from "../../model/action-types";
import {
  comboCopies,
  comboIsEmpty,
  comboLayer,
  comboNeeds,
  comboTriggerCount,
  comboTwins,
  comboWithLayer,
  comboWithOutput,
  newPositionCombo,
  toggleComboKey,
} from "../../model/combos";
import { emptyCombo } from "../../model/slots";
import { showToast } from "../messages/store";
import { useWorkbench } from "../state";

export function useComboFocus() {
  const { bundle, state, dispatch, io } = useWorkbench();
  const index = state.selection?.type === "combo" ? state.selection.index : null;
  if (index === null) return null;

  const stored = state.combos[index];
  const combo = stored && !comboIsEmpty(stored) ? stored : newPositionCombo();
  const maxKeys = bundle.caps.max_combo_keys;
  const copies = comboCopies(state.combos, index);
  const slots = [index, ...copies];
  /** The change on this slot and on each copy, each keeping its own layer. */
  const write = (next: typeof combo) =>
    copies.length === 0
      ? io.setSlot("combos", index, next)
      : io.apply("set_combos", { combos: slots.map((slot) => ({ slot, combo: comboWithLayer(next, comboLayer(state.combos[slot])) })) });
  const removeAll = () => io.apply("set_combos", { combos: slots.map((slot) => ({ slot, combo: emptyCombo() })) });
  const close = () => dispatch({ type: "select", selection: null });

  return {
    index,
    combo,
    maxKeys,
    keys: comboTriggerCount(combo),
    needs: comboNeeds(combo),
    twins: comboTwins(state.combos, index),
    /** The layers of a combo stored once per layer; empty when it is stored once. */
    layers: copies.length === 0 ? [] : slots.map((slot) => comboLayer(state.combos[slot]) ?? 0).sort((a, b) => a - b),
    /** The layer the combo's keys are shown on: its own, else the one in view. */
    layer: comboLayer(combo) ?? state.uiLayer,

    toggle(key: { row: number; col: number }, action: KeyAction) {
      const result = toggleComboKey(combo, key, action, maxKeys);
      if (result.ok) return void write(result.combo);
      showToast(
        result.reason === "full"
          ? `Key not added: a combo has at most ${maxKeys} keys`
          : "Key not added: it does nothing on this layer, and this combo matches what keys do",
      );
    },
    setOutput: (output: KeyAction) => write(comboWithOutput(combo, output)),
    /** One layer, or every layer: the copies on other layers go, as one change. */
    setLayer: (layer: number | undefined) =>
      copies.length === 0
        ? io.setSlot("combos", index, comboWithLayer(combo, layer))
        : io.apply("set_combos", {
          combos: [{ slot: index, combo: comboWithLayer(combo, layer) }, ...copies.map((slot) => ({ slot, combo: emptyCombo() }))],
        }),

    /** Close Focus Mode. A combo left without keys is removed, so it does not hold a slot unseen. */
    done() {
      if (stored && !comboIsEmpty(stored) && comboTriggerCount(stored) === 0) {
        void io.setSlot("combos", index, emptyCombo());
        showToast("Empty combo removed");
      }
      close();
    },

    /** Remove the combo; the toast can put it back. */
    discard() {
      close();
      if (!stored || comboIsEmpty(stored)) return;
      const before = slots.map((slot) => ({ slot, combo: state.combos[slot] }));
      void removeAll();
      showToast("Combo discarded", { action: { label: "Undo", run: () => void io.apply("set_combos", { combos: before }) } });
    },
  };
}

export type ComboFocus = NonNullable<ReturnType<typeof useComboFocus>>;
