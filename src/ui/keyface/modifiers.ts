// How the four modifiers read on each computer, as in GLIDE
// (core/keycodes/modifiers.js there), in the order a chord is read: Ctrl, Alt,
// Shift, then the GUI key. Per OS a word, the symbol text uses, and the picture
// key faces draw: every Mac modifier and the Windows key; none on Linux
// ("Super"). Right Alt is AltGr off the Mac; all four together read "Hyper". Pure.

import type { ModifierCombination } from "../../model/action-types";
import type { Os } from "../preferences";
import type { KeyIconName } from "./keyIconData";

export type Modifier = "ctrl" | "alt" | "shift" | "gui";
export interface ModifierLook {
  word: string;
  symbol: string;
  icon?: KeyIconName;
}

const MODIFIERS: Record<Modifier, Record<Os, ModifierLook>> = {
  ctrl: {
    mac: { word: "Control", symbol: "⌃", icon: "macos-ctrl" },
    win: { word: "Ctrl", symbol: "Ctrl" },
    linux: { word: "Ctrl", symbol: "Ctrl" },
  },
  alt: {
    mac: { word: "Option", symbol: "⌥", icon: "macos-alt" },
    win: { word: "Alt", symbol: "Alt" },
    linux: { word: "Alt", symbol: "Alt" },
  },
  shift: {
    mac: { word: "Shift", symbol: "⇧", icon: "shift" },
    win: { word: "Shift", symbol: "Shift" },
    linux: { word: "Shift", symbol: "Shift" },
  },
  gui: {
    mac: { word: "Command", symbol: "⌘", icon: "command" },
    win: { word: "Windows", symbol: "⊞", icon: "windows" },
    linux: { word: "Super", symbol: "❖" },
  },
};
export const MODIFIER_ORDER: readonly Modifier[] = ["ctrl", "alt", "shift", "gui"];
const ALT_GR: ModifierLook = { word: "AltGr", symbol: "AltGr" };
const HYPER: ModifierLook = { word: "Hyper", symbol: "Hyper" };

/** How one modifier reads on a computer: its word, symbol and picture. */
export function modifierLook(modifier: Modifier, os: Os): ModifierLook {
  return MODIFIERS[modifier][os];
}

/** The modifiers held in `mods`, each once, in chord order. */
export function chordLook(mods: ModifierCombination, os: Os): ModifierLook[] {
  const held = (m: Modifier) => [mods[`left_${m}`], mods[`right_${m}`]];
  const present = MODIFIER_ORDER.filter((m) => held(m).some(Boolean));
  if (present.length === MODIFIER_ORDER.length) return [HYPER];
  return present.map((m) => {
    const [left, right] = held(m);
    return m === "alt" && right && !left && os !== "mac" ? ALT_GR : MODIFIERS[m][os];
  });
}

/** Modifiers as text that keeps a right-hand modifier apart, for lists and the
 *  key editor: "⌃R⇧" on the Mac, "Ctrl+Right Shift" elsewhere. Empty for none. */
export function modifierText(mods: ModifierCombination, os: Os): string {
  const parts = MODIFIER_ORDER.flatMap((m) => {
    const [left, right] = [mods[`left_${m}`], mods[`right_${m}`]];
    if (!left && !right) return [];
    if (m === "alt" && right && !left && os !== "mac") return [ALT_GR.word];
    const look = MODIFIERS[m][os];
    const rightOnly = right && !left;
    return [os === "mac" ? `${rightOnly ? "R" : ""}${look.symbol}` : `${rightOnly ? "Right " : ""}${look.word}`];
  });
  return os === "mac" ? parts.join("") : parts.join("+");
}

/** Modifiers held with a key, as text: "⌘C" on the Mac, "Ctrl+C" elsewhere. */
export function withModifierText(mods: ModifierCombination, key: string, os: Os): string {
  const held = modifierText(mods, os);
  if (!held) return key;
  return os === "mac" ? `${held}${key}` : `${held}+${key}`;
}

/** One of this app's own shortcuts, for the computer the page runs on (not the
 *  one the keyboard types into): "⇧⌘Z" on a Mac, "Ctrl+Shift+Z" elsewhere. */
export function appShortcut(key: string, host: Os, { shift = false } = {}): string {
  const command = host === "mac" ? MODIFIERS.gui.mac.symbol : MODIFIERS.ctrl[host].word;
  if (host === "mac") return `${shift ? MODIFIERS.shift.mac.symbol : ""}${command}${key}`;
  return [command, ...(shift ? [MODIFIERS.shift[host].word] : []), key].join("+");
}

/** A chord as text: "⌃⇧" on the Mac, words elsewhere ("Ctrl+Shift", "Super"). */
export function chordText(mods: ModifierCombination, os: Os): string {
  const looks = chordLook(mods, os);
  return os === "mac" ? looks.map((look) => look.symbol).join("") : looks.map((look) => look.word).join("+");
}
