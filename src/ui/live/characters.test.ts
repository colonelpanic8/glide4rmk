import { describe, expect, it } from "vitest";
import type { KeyAction, ModifierCombination } from "../../vendor/rynk-wasm/rynk_wasm";
import {
  keyActionHoldsShift,
  liveKeyActionGlyph,
  pressedMatrixIndices,
  reportedShiftState,
} from "./characters";
import { DEFAULT_LOCALE_ID, setLocaleId } from "../locale";

const key = (code: "A" | "Kc1" | "Slash" | "Enter" | "LShift"): KeyAction => ({
  Single: { Key: { Hid: code } },
});

const mods = (shift: boolean): ModifierCombination => ({
  left_ctrl: false,
  left_shift: shift,
  left_alt: false,
  left_gui: false,
  right_ctrl: false,
  right_shift: false,
  right_alt: false,
  right_gui: false,
});

const MAC = { os: "mac" } as const;

describe("live character glyphs", () => {
  it("renders letters as lowercase normally and uppercase while shifted", () => {
    expect(liveKeyActionGlyph(key("A"), false, MAC).text).toBe("a");
    expect(liveKeyActionGlyph(key("A"), true, MAC).text).toBe("A");
  });

  it("renders shifted digit and punctuation characters", () => {
    expect(liveKeyActionGlyph(key("Kc1"), true, MAC).text).toBe("!");
    expect(liveKeyActionGlyph(key("Slash"), true, MAC).text).toBe("?");
  });

  it("applies a binding's own Shift modifier to printable keys", () => {
    const action: KeyAction = { Single: { KeyWithModifier: ["Kc1", mods(true)] } };
    expect(liveKeyActionGlyph(action, false, MAC).text).toBe("!");
  });

  it("leaves non-character key symbols unchanged", () => {
    expect(liveKeyActionGlyph(key("Enter"), true, MAC).text).toBe("↵");
  });

  it("follows the active OS locale", () => {
    setLocaleId("de");
    try {
      const y: KeyAction = { Single: { Key: { Hid: "Y" } } };
      expect(liveKeyActionGlyph(y, false, MAC).text).toBe("z");
      expect(liveKeyActionGlyph(key("Kc1"), true, MAC).text).toBe("!");
      expect(liveKeyActionGlyph(key("Slash"), true, MAC).text).toBe("_");
    } finally {
      setLocaleId(DEFAULT_LOCALE_ID);
    }
  });
});

describe("held Shift detection", () => {
  it("distinguishes authoritative unshifted state from unsupported readback", () => {
    expect(reportedShiftState(mods(false))).toBe(false);
    expect(reportedShiftState(mods(true))).toBe(true);
    expect(reportedShiftState(null)).toBeNull();
  });

  it("recognizes physical Shift and modifier-bearing layer actions", () => {
    expect(keyActionHoldsShift(key("LShift"))).toBe(true);
    expect(
      keyActionHoldsShift({ Single: { LayerOnWithModifier: [2, mods(true)] } }),
    ).toBe(true);
    expect(keyActionHoldsShift(key("A"))).toBe(false);
  });

  it("uses the hold side of tap-hold bindings", () => {
    expect(
      keyActionHoldsShift({ TapHold: [{ Key: { Hid: "A" } }, { Modifier: mods(true) }, 255] }),
    ).toBe(true);
  });
});

describe("matrix bitmap decoding", () => {
  it("honors per-row byte padding", () => {
    expect(pressedMatrixIndices([0b00000010, 0b00000000, 0b00000100, 0], 2, 12)).toEqual([
      1, 14,
    ]);
  });
});
