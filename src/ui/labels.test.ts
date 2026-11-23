import { afterEach, describe, expect, it } from "vitest";
import type { ModifierCombination } from "../vendor/rynk-wasm/rynk_wasm";
import { actionLabel, hidLabel, keyActionDescription, keyActionGlyph, type TextContext } from "./labels";
import type { Action, KeyAction, Morse } from "../model/action-types";
import { DOUBLE_TAP_PATTERN, HOLD_PATTERN, TAP_PATTERN } from "../model/key-slots";
import { emptyMorse } from "../model/slots";
import { DEFAULT_LOCALE_ID, setLocaleId } from "./locale";
import { DEFAULT_TAP_HOLD_PROFILE } from "../model/morse";
import { noModifiers } from "../model/slots";

const MAC: TextContext = { os: "mac" };
const WIN: TextContext = { os: "win" };
const LINUX: TextContext = { os: "linux" };

function mods(fields: Partial<ModifierCombination>): ModifierCombination {
  return { ...noModifiers(), ...fields };
}

describe("modifier labels", () => {
  it("writes a modifier key the way the chosen computer does, keeping a right-hand one apart", () => {
    expect(hidLabel("LCtrl", MAC.os)).toBe("⌃");
    expect(hidLabel("RShift", MAC.os)).toBe("R⇧");
    expect(hidLabel("LGui", MAC.os)).toBe("⌘");
    expect(hidLabel("LCtrl", WIN.os)).toBe("Ctrl");
    expect(hidLabel("RShift", WIN.os)).toBe("Right Shift");
    expect(hidLabel("LGui", WIN.os)).toBe("Windows");
    expect(hidLabel("RAlt", WIN.os)).toBe("AltGr");
    expect(hidLabel("LGui", LINUX.os)).toBe("Super");
  });

  it("never prints a Mac symbol for Windows or Linux", () => {
    const all = mods({ left_ctrl: true, right_alt: true, left_shift: true, left_gui: true });
    for (const text of [WIN, LINUX]) {
      expect(actionLabel({ Modifier: all }, text)).not.toMatch(/[⌃⌥⇧⌘]/);
      expect(actionLabel({ OneShotModifier: mods({ left_shift: true }) }, text)).toBe("Sticky Shift");
    }
    expect(actionLabel({ OneShotModifier: mods({ left_shift: true }) }, MAC)).toBe("Sticky ⇧");
  });

  it("joins a shortcut the way each computer writes it", () => {
    const copy: Action = { KeyWithModifier: ["C", mods({ left_gui: true })] };
    expect(actionLabel(copy, MAC)).toBe("⌘C");
    expect(actionLabel({ KeyWithModifier: ["C", mods({ left_ctrl: true })] }, WIN)).toBe("Ctrl+C");
  });

  it("shows a modifier on a keycap without its side", () => {
    expect(keyActionGlyph({ Single: { Key: { Hid: "RShift" } } }, [], MAC).text).toBe("⇧");
    expect(keyActionGlyph({ Single: { Key: { Hid: "RShift" } } }, [], WIN).text).toBe("Shift");
  });
});

describe("tap-hold descriptions", () => {
  it("reads the third field as a profile slot, not a timeout", () => {
    const tap = { Key: { Hid: "A" as const } };
    const hold = { LayerOn: 1 };
    expect(keyActionDescription({ TapHold: [tap, hold, DEFAULT_TAP_HOLD_PROFILE] }, MAC)).toBe(
      "Tap A / hold L1 · default timing",
    );
    expect(keyActionDescription({ TapHold: [tap, hold, 0] }, MAC)).toBe(
      "Tap A / hold L1 · timing profile 0",
    );
  });
});

describe("locale-aware labels", () => {
  afterEach(() => setLocaleId(DEFAULT_LOCALE_ID));

  it("renders character-forming modifier combos as the character they type", () => {
    expect(actionLabel({ KeyWithModifier: ["Kc2", mods({ left_shift: true })] }, MAC)).toBe("@");
    // Shift+letter types the same character as the keycap shows — keep the
    // explicit modifier so the binding stays distinguishable from plain A.
    expect(actionLabel({ KeyWithModifier: ["A", mods({ left_shift: true })] }, MAC)).toBe("⇧A");
    // Ctrl combos are shortcuts, not characters.
    expect(
      actionLabel({ KeyWithModifier: ["Kc2", mods({ left_shift: true, left_ctrl: true })] }, MAC),
    ).toBe("⌃⇧2");
  });

  it("relabels keycaps under a non-US locale", () => {
    setLocaleId("de");
    expect(hidLabel("Y", MAC.os)).toBe("Z");
    expect(hidLabel("Semicolon", MAC.os)).toBe("Ö");
    expect(hidLabel("Minus", MAC.os)).toBe("ß");
    expect(actionLabel({ KeyWithModifier: ["Kc2", mods({ left_shift: true })] }, MAC)).toBe('"');
    expect(actionLabel({ KeyWithModifier: ["Q", mods({ right_alt: true })] }, MAC)).toBe("@");
    setLocaleId("fr");
    expect(hidLabel("Q", MAC.os)).toBe("A");
    expect(hidLabel("Kc2", MAC.os)).toBe("é");
  });
});

describe("lighting action labels", () => {
  it("labels the output-policy and named extension actions", () => {
    expect(actionLabel({ Light: "OutputModeCycle" }, MAC)).toBe("OutMode");
    expect(actionLabel({ Light: "RgbModeTwinkle" }, MAC)).toBe("Twinkle");
  });
});

describe("keyActionGlyph", () => {
  const W = { Key: { Hid: "W" } };
  const Q = { Key: { Hid: "Q" } };
  const morse = (...actions: Array<[number, unknown]>) => [{ ...emptyMorse(), actions } as Morse];

  it("draws a key with a double tap by its tap, and the double tap below", () => {
    const key = { Morse: 0 } as KeyAction;
    expect(keyActionGlyph(key, morse([TAP_PATTERN, W], [DOUBLE_TAP_PATTERN, Q]), MAC)).toEqual({ text: "W", sub: "2×Q" });
    expect(keyActionGlyph(key, morse([TAP_PATTERN, W], [HOLD_PATTERN, Q]), MAC)).toEqual({ text: "W", sub: "Q" });
  });

  it("keeps the slot number for any other morse entry", () => {
    expect(keyActionGlyph({ Morse: 0 } as KeyAction, [], MAC)).toEqual({ text: "Mo0" });
  });
});
