// KeyAction → display label derivation. Pure functions, no React. Labels for
// character-producing keys follow the active OS locale (see locale.ts).

import type {
  Action,
  HidKeyCode,
  KeyAction,
  KeyCode,
  ModifierCombination,
  Morse,
} from "../model/action-types";
import { activeLocale, characterFor, keycapCharacter } from "./locale";
import { DEFAULT_TAP_HOLD_PROFILE } from "../model/morse";
import { slotsOf } from "../model/key-slots";
import type { FacePart } from "./keyface/keyFace";
import { chordText, modifierText, withModifierText } from "./keyface/modifiers";
import type { Os } from "./preferences";

/** What text needs beyond the action: the computer modifiers are written for
 *  (never assumed to be a Mac) and the layout's layer names. */
export interface TextContext {
  os: Os;
  names?: LayerNames;
}

const NO_MODIFIERS: ModifierCombination = {
  left_ctrl: false, left_shift: false, left_alt: false, left_gui: false,
  right_ctrl: false, right_shift: false, right_alt: false, right_gui: false,
};
/** The modifier keys, as the modifier each one holds. */
const MODIFIER_KEYS: Partial<Record<HidKeyCode, keyof ModifierCombination>> = {
  LCtrl: "left_ctrl", LShift: "left_shift", LAlt: "left_alt", LGui: "left_gui",
  RCtrl: "right_ctrl", RShift: "right_shift", RAlt: "right_alt", RGui: "right_gui",
};

/** Compact keycap symbols for HID codes that deserve better than their name. */
const HID_SYMBOLS: Partial<Record<HidKeyCode, string>> = {
  Kc1: "1",
  Kc2: "2",
  Kc3: "3",
  Kc4: "4",
  Kc5: "5",
  Kc6: "6",
  Kc7: "7",
  Kc8: "8",
  Kc9: "9",
  Kc0: "0",
  Enter: "↵",
  Escape: "Esc",
  Backspace: "⌫",
  Tab: "⇥",
  Space: "␣",
  Minus: "-",
  Equal: "=",
  LeftBracket: "[",
  RightBracket: "]",
  Backslash: "\\",
  NonusHash: "#",
  Semicolon: ";",
  Quote: "'",
  Grave: "`",
  Comma: ",",
  Dot: ".",
  Slash: "/",
  CapsLock: "Caps",
  PrintScreen: "PrtSc",
  ScrollLock: "ScrLk",
  Pause: "Pause",
  Insert: "Ins",
  Home: "Home",
  PageUp: "PgUp",
  Delete: "Del",
  End: "End",
  PageDown: "PgDn",
  Right: "→",
  Left: "←",
  Down: "↓",
  Up: "↑",
  NumLock: "Num",
  KpSlash: "/",
  KpAsterisk: "*",
  KpMinus: "-",
  KpPlus: "+",
  KpEnter: "↵",
  Kp1: "1",
  Kp2: "2",
  Kp3: "3",
  Kp4: "4",
  Kp5: "5",
  Kp6: "6",
  Kp7: "7",
  Kp8: "8",
  Kp9: "9",
  Kp0: "0",
  KpDot: ".",
  NonusBackslash: "\\",
  Application: "Menu",
  AudioMute: "Mute",
  AudioVolUp: "Vol+",
  AudioVolDown: "Vol−",
  MediaNextTrack: "⏭",
  MediaPrevTrack: "⏮",
  MediaStop: "⏹",
  MediaPlayPause: "⏯",
  MediaEject: "⏏",
  MediaFastForward: "⏩",
  MediaRewind: "⏪",
  BrightnessUp: "Brt+",
  BrightnessDown: "Brt−",
  KbMute: "Mute",
  KbVolumeUp: "Vol+",
  KbVolumeDown: "Vol−",
  MouseUp: "🖱↑",
  MouseDown: "🖱↓",
  MouseLeft: "🖱←",
  MouseRight: "🖱→",
  MouseBtn1: "MB1",
  MouseBtn2: "MB2",
  MouseBtn3: "MB3",
  MouseWheelUp: "Whl↑",
  MouseWheelDown: "Whl↓",
};

export function hidLabel(code: HidKeyCode, os: Os): string {
  const held = MODIFIER_KEYS[code];
  return held ? modifierText({ ...NO_MODIFIERS, [held]: true }, os) : capLabel(code);
}

/** A key as its keycap reads under the locale; a modifier key by its name
 *  (`LShift`), so this is for search, not for showing a modifier. */
export function capLabel(code: HidKeyCode): string {
  const cap = keycapCharacter(activeLocale(), code);
  if (cap !== null) return cap;
  const sym = HID_SYMBOLS[code];
  if (sym) return sym;
  // F-keys and friends already read well; otherwise fall back to the name.
  return code;
}

/** The character a modified keystroke types under the active locale, when the
 *  modifiers are purely character-forming (Shift/AltGr) and the result differs
 *  from the bare keycap — e.g. ⇧2 → "@" on US, AltGr+Q → "@" on German. */
export function characterWithModifiers(
  code: HidKeyCode,
  mods: ModifierCombination,
): string | null {
  if (mods.left_ctrl || mods.right_ctrl || mods.left_alt || mods.left_gui || mods.right_gui)
    return null;
  const shift = mods.left_shift || mods.right_shift;
  const altgr = mods.right_alt;
  if (!shift && !altgr) return null;
  const character = characterFor(activeLocale(), code, shift, altgr);
  return character !== null && character !== capLabel(code) ? character : null;
}

/** A longer human name for pickers and tooltips. */
export function hidName(code: HidKeyCode): string {
  const sym = HID_SYMBOLS[code];
  if (sym && sym !== code) return `${code} (${sym})`;
  return code;
}

export function anyModifier(mods: ModifierCombination): boolean {
  return (
    mods.left_ctrl ||
    mods.left_shift ||
    mods.left_alt ||
    mods.left_gui ||
    mods.right_ctrl ||
    mods.right_shift ||
    mods.right_alt ||
    mods.right_gui
  );
}

function keyCodeLabel(code: KeyCode, os: Os): string {
  if (typeof code === "object") {
    if ("Hid" in code) return hidLabel(code.Hid, os);
    if ("Consumer" in code) return code.Consumer;
    if ("SystemControl" in code) return code.SystemControl;
  }
  return String(code);
}

const LIGHT_LABELS: Record<string, string> = {
  BacklightOn: "All On",
  BacklightOff: "All Off",
  BacklightToggle: "All RGB",
  BacklightDown: "BL−",
  BacklightUp: "BL+",
  BacklightStep: "BL Step",
  BacklightToggleBreathing: "BL Br",
  RgbTog: "FX RGB",
  RgbModeForward: "RGB→",
  RgbModeReverse: "RGB←",
  RgbHui: "Hue+",
  RgbHud: "Hue−",
  RgbSai: "Sat+",
  RgbSad: "Sat−",
  RgbVai: "Val+",
  RgbVad: "Val−",
  RgbSpi: "Spd+",
  RgbSpd: "Spd−",
  RgbModePlain: "Plain",
  RgbModeBreathe: "Breathe",
  RgbModeRainbow: "Rainbow",
  RgbModeSwirl: "Swirl",
  RgbModeSnake: "Snake",
  RgbModeKnight: "Knight",
  RgbModeXmas: "Xmas",
  RgbModeGradient: "Gradient",
  RgbModeRgbtest: "RGB Test",
  RgbModeTwinkle: "Twinkle",
  OutputModeCycle: "OutMode",
};

const CONTROL_LABELS: Record<string, string> = {
  Bootloader: "Boot",
  Reboot: "Reset",
  ClearEeprom: "ClrEE",
  OutputUsb: "OutUSB",
  OutputBluetooth: "OutBLE",
  ComboOn: "CmbOn",
  ComboOff: "CmbOff",
  ComboToggle: "Combo",
  CapsWordToggle: "CapsWd",
  MaintenanceModeToggle: "Maint",
};

/** The layout's layer names, by layer; an empty name means unnamed. */
export type LayerNames = readonly (string | undefined)[];

/** The layer an action switches to, for the layer actions. */
export function layerOf(action: Action): number | undefined {
  if (typeof action !== "object") return undefined;
  if ("LayerOn" in action) return action.LayerOn;
  if ("LayerOnWithModifier" in action) return action.LayerOnWithModifier[0];
  if ("LayerOff" in action) return action.LayerOff;
  if ("LayerToggle" in action) return action.LayerToggle;
  if ("DefaultLayer" in action) return action.DefaultLayer;
  if ("LayerToggleOnly" in action) return action.LayerToggleOnly;
  if ("OneShotLayer" in action) return action.OneShotLayer;
  if ("PersistentDefaultLayer" in action) return action.PersistentDefaultLayer;
  return undefined;
}

/** A layer as text: its name when it has one, else `fallback` (its number by default). */
export function layerRef(names: LayerNames | undefined, layer: number, fallback = String(layer)): string {
  return names?.[layer] || fallback;
}

/** A key's text. With `names`, a layer key reads as its layer's name, as in GLIDE. */
export function actionLabel(action: Action, text: TextContext): string {
  if (action === "No") return "";
  if (action === "TriLayerLower") return "TriL";
  if (action === "TriLayerUpper") return "TriU";
  if (typeof action === "string") return action;
  if ("Key" in action) return keyCodeLabel(action.Key, text.os);
  if ("Modifier" in action) return modifierText(action.Modifier, text.os) || "Mod";
  if ("KeyWithModifier" in action) {
    const [key, mods] = action.KeyWithModifier;
    return characterWithModifiers(key, mods) ?? withModifierText(mods, hidLabel(key, text.os), text.os);
  }
  if ("LayerOn" in action) return layerRef(text.names, action.LayerOn, `L${action.LayerOn}`);
  if ("LayerOnWithModifier" in action) {
    const [layer, mods] = action.LayerOnWithModifier;
    return withModifierText(mods, layerRef(text.names, layer, `L${layer}`), text.os);
  }
  if ("LayerOff" in action) return `${layerRef(text.names, action.LayerOff, `L${action.LayerOff}`)}·off`;
  if ("LayerToggle" in action) return layerRef(text.names, action.LayerToggle, `TG${action.LayerToggle}`);
  if ("DefaultLayer" in action) return layerRef(text.names, action.DefaultLayer, `DF${action.DefaultLayer}`);
  if ("LayerToggleOnly" in action) return layerRef(text.names, action.LayerToggleOnly, `TO${action.LayerToggleOnly}`);
  if ("TriggerMacro" in action) return `M${action.TriggerMacro}`;
  if ("OneShotLayer" in action) return layerRef(text.names, action.OneShotLayer, `OSL${action.OneShotLayer}`);
  if ("OneShotModifier" in action) return `Sticky ${modifierText(action.OneShotModifier, text.os)}`;
  if ("OneShotKey" in action) return `Sticky ${hidLabel(action.OneShotKey, text.os)}`;
  if ("Light" in action) return LIGHT_LABELS[action.Light] ?? action.Light;
  if ("KeyboardControl" in action)
    return CONTROL_LABELS[action.KeyboardControl] ?? action.KeyboardControl;
  if ("Special" in action) return action.Special === "GraveEscape" ? "`Esc" : "Rpt";
  if ("User" in action) return `U${action.User}`;
  if ("PersistentDefaultLayer" in action)
    return layerRef(text.names, action.PersistentDefaultLayer, `PDF${action.PersistentDefaultLayer}`);
  if ("Steno" in action) return `St${action.Steno}`;
  return "?";
}

export interface KeyGlyph {
  /** Primary keycap text. Empty string means a blank cap. */
  text: string;
  /** Secondary line (hold action for tap-holds). */
  sub?: string;
  /** The character Shift gives, drawn small on top (the "@" over "2"). */
  top?: string;
  /** Render dimmed (Transparent). */
  dim?: boolean;
  /** Pictures drawn instead of `text` (keyface/keyFace.ts). */
  face?: FacePart[];
  /** Pictures drawn instead of `sub`. */
  subFace?: FacePart[];
  /** A chord's modifiers, drawn small above the key (⌘ over Z). */
  chord?: FacePart[];
  /** A key that does nothing: GLIDE's faint slash. */
  none?: boolean;
  /** `text` is a layer's name: drawn in the accent colour under the layers mark (GLIDE). */
  layer?: boolean;
  /** `sub` is a layer's name (a hold that switches layer): drawn with the layers mark. */
  subLayer?: boolean;
}

/** The character a plain key types with Shift, when it is not just its own
 *  capital: what GLIDE prints small at the top of the keycap. */
function shiftedOnTop(action: Action): string | undefined {
  if (typeof action !== "object" || !("Key" in action)) return undefined;
  const key = action.Key;
  if (typeof key !== "object" || !("Hid" in key)) return undefined;
  const shifted = characterFor(activeLocale(), key.Hid, true);
  return shifted !== null && shifted !== capLabel(key.Hid) ? shifted : undefined;
}

/** The modifiers a Modifier action or a modifier key holds, else null. */
function heldModifiers(action: Action): ModifierCombination | null {
  if (typeof action !== "object") return null;
  if ("Modifier" in action) return action.Modifier;
  const held = "Key" in action && "Hid" in action.Key ? MODIFIER_KEYS[action.Key.Hid] : undefined;
  return held ? { ...NO_MODIFIERS, [held]: true } : null;
}

/** `morse` is the keyboard's morse table: a key whose entry is tap, hold and
 *  double tap shows its tap, and its hold or double tap below it. */
export function keyActionGlyph(action: KeyAction, morse: readonly Morse[], text: TextContext): KeyGlyph {
  if (action === "No") return { text: "" };
  if (action === "Transparent") return { text: "▽", dim: true };
  const label = (a: Action) => actionLabel(a, text);
  // On a keycap a modifier reads without its side, as in GLIDE: "⇧", not "R⇧".
  const capText = (a: Action) => {
    const held = heldModifiers(a);
    return held ? chordText(held, text.os) : label(a);
  };
  // A layer key, as in GLIDE: the layer's name with the layers mark (`layer`, `subLayer`).
  const tapGlyph = (a: Action): KeyGlyph =>
    layerOf(a) !== undefined ? { text: label(a), layer: true } : { text: capText(a), top: shiftedOnTop(a) };
  const withHold = (glyph: KeyGlyph, hold: Action): KeyGlyph =>
    layerOf(hold) !== undefined ? { ...glyph, sub: label(hold), subLayer: true } : { ...glyph, sub: capText(hold) };
  if ("Single" in action) return tapGlyph(action.Single);
  if ("Tap" in action) return tapGlyph(action.Tap);
  if ("TapHold" in action) {
    const [tap, hold] = action.TapHold;
    return withHold({ text: capText(tap) }, hold);
  }
  if ("Morse" in action) {
    const slots = slotsOf(action, morse);
    if (slots.kind !== "slots") return { text: `Mo${action.Morse}` };
    const glyph = { text: label(slots.tap) };
    return slots.hold !== null ? withHold(glyph, slots.hold) : { ...glyph, sub: `2×${label(slots.doubleTap ?? "No")}` };
  }
  return { text: "?" };
}

/** One-line description for the inspector header. */
export function keyActionDescription(action: KeyAction, text: TextContext): string {
  if (action === "No") return "No action";
  if (action === "Transparent") return "Transparent — falls through to lower layer";
  if ("Single" in action) return actionDescription(action.Single, text);
  if ("Tap" in action) return `Tap: ${actionDescription(action.Tap, text)}`;
  if ("TapHold" in action) {
    const [tap, hold, profile] = action.TapHold;
    const timing =
      profile === DEFAULT_TAP_HOLD_PROFILE ? "default timing" : `timing profile ${profile}`;
    return `Tap ${actionLabel(tap, text) || "·"} / hold ${actionLabel(hold, text) || "·"} · ${timing}`;
  }
  if ("Morse" in action) return `Morse pattern slot ${action.Morse}`;
  return "Unknown action";
}

export function actionDescription(action: Action, text: TextContext): string {
  if (action === "No") return "No action";
  if (typeof action === "string") return action;
  if ("Key" in action) return `Key · ${keyCodeLabel(action.Key, text.os)}`;
  if ("Modifier" in action) return `Modifier · ${modifierText(action.Modifier, text.os)}`;
  if ("KeyWithModifier" in action) {
    const [key, mods] = action.KeyWithModifier;
    const character = characterWithModifiers(key, mods);
    return `Key · ${withModifierText(mods, hidLabel(key, text.os), text.os)}${
      character !== null ? ` — types ${character}` : ""
    }`;
  }
  if ("LayerOn" in action) return `Momentary layer ${layerRef(text.names, action.LayerOn)}`;
  if ("LayerToggle" in action) return `Toggle layer ${layerRef(text.names, action.LayerToggle)}`;
  if ("DefaultLayer" in action) return `Default layer ${layerRef(text.names, action.DefaultLayer)}`;
  if ("OneShotLayer" in action) return `One-shot layer ${layerRef(text.names, action.OneShotLayer)}`;
  if ("LayerToggleOnly" in action) return `Switch to layer ${layerRef(text.names, action.LayerToggleOnly)}`;
  if ("OneShotModifier" in action) return `Sticky ${modifierText(action.OneShotModifier, text.os)}`;
  if ("TriggerMacro" in action) return `Trigger macro ${action.TriggerMacro}`;
  if ("Light" in action) return `Lighting · ${action.Light}`;
  if ("KeyboardControl" in action) return `Control · ${action.KeyboardControl}`;
  return actionLabel(action, text);
}
