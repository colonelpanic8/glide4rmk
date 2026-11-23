import type {
  Action,
  HidKeyCode,
  KeyAction,
  ModifierCombination,
} from "../../vendor/rynk-wasm/rynk_wasm";
import { actionLabel, keyActionGlyph, type KeyGlyph, type TextContext } from "../labels";
import { withModifierText } from "../keyface/modifiers";
import type { Os } from "../preferences";
import { activeLocale, characterFor } from "../locale";

function shifted(mods: ModifierCombination): boolean {
  return mods.left_shift || mods.right_shift;
}

/** Authoritative Shift state, or null when the firmware cannot report it. */
export function reportedShiftState(mods: ModifierCombination | null): boolean | null {
  return mods === null ? null : shifted(mods);
}

function printableCharacter(code: HidKeyCode, shift: boolean, altgr = false): string | null {
  return characterFor(activeLocale(), code, shift, altgr);
}

function printableActionLabel(action: Action, shift: boolean, os: Os): string | null {
  if (typeof action === "string") return null;
  if ("Key" in action && "Hid" in action.Key) {
    return printableCharacter(action.Key.Hid, shift);
  }
  if ("KeyWithModifier" in action) {
    const [code, mods] = action.KeyWithModifier;
    const character = printableCharacter(code, shift || shifted(mods), mods.right_alt);
    if (character === null) return null;
    const nonCharacterModifiers = { ...mods, left_shift: false, right_shift: false, right_alt: false };
    return withModifierText(nonCharacterModifiers, character, os);
  }
  return null;
}

/** Live-only key glyph that displays the character produced under Shift. */
export function liveKeyActionGlyph(action: KeyAction, shift: boolean, text: TextContext): KeyGlyph {
  if (action === "No" || action === "Transparent" || "Morse" in action) {
    return keyActionGlyph(action, [], text);
  }
  if ("Single" in action) {
    return { text: printableActionLabel(action.Single, shift, text.os) ?? actionLabel(action.Single, text) };
  }
  if ("Tap" in action) {
    return { text: printableActionLabel(action.Tap, shift, text.os) ?? actionLabel(action.Tap, text) };
  }
  if ("LayerModTap" in action) return keyActionGlyph(action, [], text);
  const [tap, hold] = action.TapHold;
  return {
    text: printableActionLabel(tap, shift, text.os) ?? actionLabel(tap, text),
    sub: printableActionLabel(hold, shift, text.os) ?? actionLabel(hold, text),
  };
}

function actionHoldsShift(action: Action): boolean {
  if (typeof action === "string") return false;
  if ("Key" in action && "Hid" in action.Key) {
    return action.Key.Hid === "LShift" || action.Key.Hid === "RShift";
  }
  if ("Modifier" in action) return shifted(action.Modifier);
  if ("LayerOnWithModifier" in action) return shifted(action.LayerOnWithModifier[1]);
  return false;
}

/** Whether holding this resolved binding contributes a Shift modifier. */
export function keyActionHoldsShift(action: KeyAction): boolean {
  if (action === "No" || action === "Transparent" || "Morse" in action) return false;
  if ("Single" in action) return actionHoldsShift(action.Single);
  if ("TapHold" in action) return actionHoldsShift(action.TapHold[1]);
  return false;
}

/** Decode RMK's row-padded matrix bitmap into row-major key indices. */
export function pressedMatrixIndices(bitmap: number[], rows: number, cols: number): number[] {
  const bytesPerRow = Math.ceil(cols / 8);
  const pressed: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const byte = bitmap[row * bytesPerRow + (col >> 3)] ?? 0;
      if ((byte & (1 << (col & 7))) !== 0) pressed.push(row * cols + col);
    }
  }
  return pressed;
}
