// Whether a value is a key action the keyboard can store, for callers that are
// not TypeScript (a Flow, an assistant): a malformed action is refused with a
// plain message instead of reaching the write path. Checks every shape and HID
// key; the names of lighting, consumer, system and steno keys are checked as
// names only, as the firmware's lists are not in the model. Pure.

import { HID_CODES } from "./hid-codes";

const HID = new Set<string>(HID_CODES);
const MODIFIER_KEYS = new Set(["LCtrl", "LShift", "LAlt", "LGui", "RCtrl", "RShift", "RAlt", "RGui"]);
const MODIFIER_FIELDS = ["left_ctrl", "left_shift", "left_alt", "left_gui", "right_ctrl", "right_shift", "right_alt", "right_gui"];
const KEYBOARD_ACTIONS = new Set([
  "Bootloader", "Reboot", "ClearEeprom", "ComboOn", "ComboOff", "ComboToggle", "CapsWordToggle",
  "OutputUsb", "OutputBluetooth", "UnicodeModeCycle", "MaintenanceModeToggle", "CtrlGuiSwapToggle",
]);
const SPECIAL_KEYS = new Set(["GraveEscape", "Repeat"]);

type Check = (value: unknown) => boolean;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count: Check = (value) => Number.isInteger(value) && (value as number) >= 0;
const name: Check = (value) => typeof value === "string" && value.length > 0;
const hid: Check = (value) => typeof value === "string" && HID.has(value);
const modifiers: Check = (value) =>
  isObject(value) && Object.keys(value).length === MODIFIER_FIELDS.length && MODIFIER_FIELDS.every((field) => typeof value[field] === "boolean");
const tuple = (...parts: Check[]): Check => (value) =>
  Array.isArray(value) && value.length === parts.length && parts.every((check, index) => check(value[index]));
const keyCode: Check = (value) =>
  isObject(value) && Object.keys(value).length === 1 &&
  ("Hid" in value ? hid(value.Hid) : "Consumer" in value ? name(value.Consumer) : "SystemControl" in value && name(value.SystemControl));

/** Each tagged Action variant and the check for its content. */
const ACTION_VARIANTS: Record<string, Check> = {
  Key: keyCode,
  Modifier: modifiers,
  KeyWithModifier: tuple(hid, modifiers),
  LayerOn: count,
  LayerOnWithModifier: tuple(count, modifiers),
  LayerOff: count,
  LayerToggle: count,
  DefaultLayer: count,
  LayerToggleOnly: count,
  TriggerMacro: count,
  OneShotLayer: count,
  OneShotModifier: modifiers,
  OneShotKey: hid,
  Light: name,
  KeyboardControl: (value) => typeof value === "string" && KEYBOARD_ACTIONS.has(value),
  Special: (value) => typeof value === "string" && SPECIAL_KEYS.has(value),
  User: count,
  PersistentDefaultLayer: count,
  Unicode: count,
  Steno: name,
};
const BARE_ACTIONS = new Set(["No", "TriLayerLower", "TriLayerUpper"]);

function isAction(value: unknown): boolean {
  if (typeof value === "string") return BARE_ACTIONS.has(value);
  if (!isObject(value) || Object.keys(value).length !== 1) return false;
  const [tag] = Object.keys(value);
  return ACTION_VARIANTS[tag]?.(value[tag]) ?? false;
}

const KEY_ACTION_VARIANTS: Record<string, Check> = {
  Single: isAction,
  Tap: isAction,
  TapHold: tuple(isAction, isAction, count),
  Morse: count,
  LayerModTap: tuple(count, (value) => typeof value === "string" && MODIFIER_KEYS.has(value), hid),
};

/** Whether `value` is a key action the keyboard can store. */
export function isKeyAction(value: unknown): boolean {
  if (value === "No" || value === "Transparent") return true;
  if (!isObject(value) || Object.keys(value).length !== 1) return false;
  const [tag] = Object.keys(value);
  return KEY_ACTION_VARIANTS[tag]?.(value[tag]) ?? false;
}
