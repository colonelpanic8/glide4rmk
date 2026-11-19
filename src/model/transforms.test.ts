import { describe, expect, it } from "vitest";
import type { KeyAction, ModifierCombination } from "../vendor/rynk-wasm/rynk_wasm";
import { decodeMacros, encodeMacros, hidStep } from "./macros";
import { emptyFork, noStateBits } from "./slots";
import {
  CTRL_GUI_SWAP,
  mapKeyAction,
  planKeyCount,
  planOsSwap,
  planSize,
  type TransformInput,
} from "./transforms";

const key = (code: string): KeyAction => ({ Single: { Key: { Hid: code as never } } });

const NO_MODS: ModifierCombination = {
  left_ctrl: false,
  left_shift: false,
  left_alt: false,
  left_gui: false,
  right_ctrl: false,
  right_shift: false,
  right_alt: false,
  right_gui: false,
};

function baseInput(overrides: Partial<TransformInput>): TransformInput {
  return {
    layers: [],
    cols: 2,
    combos: [],
    morse: [],
    forks: [],
    macroOps: [],
    ...overrides,
  };
}

describe("CTRL_GUI_SWAP", () => {
  it("swaps bare modifier keycodes and is its own inverse", () => {
    const cases: KeyAction[] = [
      key("LCtrl"),
      { Single: { Modifier: { ...NO_MODS, left_ctrl: true, left_alt: true } } },
      { Single: { KeyWithModifier: ["C", { ...NO_MODS, left_ctrl: true }] } },
      { Single: { OneShotModifier: { ...NO_MODS, right_gui: true } } },
      { LayerModTap: [4, "LCtrl", "Tab"] },
      { TapHold: [{ Key: { Hid: "A" } }, { Modifier: { ...NO_MODS, left_gui: true } }, 255] },
    ];
    for (const before of cases) {
      const once = mapKeyAction(CTRL_GUI_SWAP, before);
      expect(once).not.toEqual(before);
      expect(mapKeyAction(CTRL_GUI_SWAP, once)).toEqual(before);
    }
    // Shift is untouched.
    expect(mapKeyAction(CTRL_GUI_SWAP, key("LShift"))).toEqual(key("LShift"));
  });

  it("plans every site kind and skips unchanged ones", () => {
    const plan = planOsSwap(
      baseInput({
        layers: [
          [key("LCtrl"), key("A")],
          [key("B"), key("LGui")],
        ],
        combos: [
          { Actions: { actions: [key("LCtrl"), key("Q")], output: key("C"), layer: 0 } },
          { Actions: { actions: [key("A"), key("B")], output: key("C"), layer: undefined } },
        ],
        morse: [
          {
            profile: {} as never,
            actions: [[1, { KeyWithModifier: ["C", { ...NO_MODS, left_ctrl: true }] }]],
          },
        ],
        forks: [
          {
            trigger: key("A"),
            negative_output: key("A"),
            positive_output: key("B"),
            match_any: noStateBits(),
            match_none: noStateBits(),
            kept_modifiers: { ...NO_MODS, left_ctrl: true },
            bindable: false,
            layers: 0xffffffff,
          },
        ],
        macroOps: encodeMacros([
          { steps: [hidStep("press", "LCtrl"), hidStep("tap", "C")] },
        ]),
      }),
    );
    expect(plan.keys).toHaveLength(2); // one changed key per layer
    expect(plan.combos).toHaveLength(1); // the LCtrl combo only
    expect(plan.morse).toHaveLength(1);
    expect(plan.forks).toHaveLength(1); // kept_modifiers changed
    expect(plan.macroOps).not.toBeNull();
    const macros = decodeMacros(plan.macroOps!);
    expect(macros[0].steps[0]).toEqual(hidStep("press", "LGui"));
  });

  it("plans nothing on an already-neutral keymap", () => {
    const plan = planOsSwap(baseInput({ layers: [[key("A"), key("LShift")]] }));
    expect(plan.keys).toHaveLength(0);
    expect(plan.macroOps).toBeNull();
  });

  it("swaps fork modifier conditions along with their outputs", () => {
    const fork = emptyFork();
    fork.trigger = key("A");
    fork.match_any.modifiers.left_ctrl = true;
    fork.match_any.modifiers.right_alt = true;
    fork.match_none.modifiers.right_gui = true;
    fork.match_none.leds.caps_lock = true;
    const { after } = planOsSwap(baseInput({ forks: [fork] })).forks[0];

    expect(after.match_any.modifiers).toEqual({ ...NO_MODS, left_gui: true, right_alt: true });
    expect(after.match_none.modifiers).toEqual({ ...NO_MODS, right_ctrl: true });
    expect(after.match_none.leds).toEqual(fork.match_none.leds);
    expect(planOsSwap(baseInput({ forks: [after] })).forks[0].after).toEqual(fork);
  });
});

describe("plan sizing", () => {
  const plan = planOsSwap(
    baseInput({
      layers: [[key("LCtrl"), key("A")]],
      combos: [{ Actions: { actions: [key("LGui")], output: key("C"), layer: undefined } }],
      macroOps: encodeMacros([{ steps: [hidStep("press", "LCtrl")] }]),
    }),
  );

  it("counts every write the run will issue, not only the key cells", () => {
    // The progress bar and the "wrote N changes" summary both use planSize;
    // when it counted the non-key writes but the run did not, the two
    // disagreed by exactly the slot and macro writes.
    expect(planKeyCount(plan)).toBe(1);
    expect(planSize(plan)).toBe(planKeyCount(plan) + plan.combos.length + 1);
  });
});
