// MoErgo's stock Magic layer on RMK lighting rules, for a board's table
// (model/boards/magic-layer.ts): its keys, its half dark, and its status lights
// as MoErgo's firmware shows them (colours from rgb_underglow.c of
// moergo-sc/zmk): which layers are on, the lock lights, each half's battery,
// Bluetooth 1–4 and USB on the keys bound to them, and the maintenance lock.
// Pure; the set_magic_layer operation applies it.

import type { KeyAction, LightingConnectionCondition, LightingEffect, LightingSceneCell } from "../../vendor/rynk-wasm/rynk_wasm";
import type { MagicLayerTable } from "../boards/magic-layer";
import { same } from "../deep-equal";
import type { Lock } from "./status-light";
import type { StatusRule } from "./status-presets";

const rgb = (r: number, g: number, b: number): LightingEffect => ({ Solid: { color: { r, g, b } } });

// ZMK's status palette.
const RED = rgb(255, 0, 0);
const YELLOW = rgb(255, 255, 0);
const GREEN = rgb(0, 255, 0);
const DULL_GREEN = rgb(0, 255, 104);
const MAGENTA = rgb(255, 0, 255);
const WHITE = rgb(255, 255, 255);
const LILAC = rgb(107, 31, 206);
const BLACK = rgb(0, 0, 0);
const MAINTENANCE_UNLOCKED = rgb(0, 128, 0);
const MAINTENANCE_LOCKED = rgb(128, 0, 0);

/** At most this many layers have a light. */
const SHOWN_LAYERS = 6;
const PROFILES = 4;

function rule(layer: number, led: number, effect: LightingEffect): StatusRule {
  return {
    cell: {
      conditions: { layer: { layer, active: true }, battery: undefined, output_mode: undefined },
      led_id: led,
      effect,
    },
    connection: undefined,
    effects: undefined,
    layers: undefined,
    indicators: undefined,
  };
}

function connection(fields: Partial<LightingConnectionCondition>): LightingConnectionCondition {
  return {
    transport: undefined,
    profile: undefined,
    ble_state: undefined,
    bonded: undefined,
    usb_connected: undefined,
    ...fields,
  };
}

/** Six segments at 0, 20, …, 100 percent; the whole bar is green from 40,
 *  yellow from 20, red below, and green throughout while charging. */
function batteryRules(layer: number, node: number, leds: readonly number[]): StatusRule[] {
  const banded = (led: number, effect: LightingEffect, min: number, max: number | undefined, charge: "Any" | "Charging" = "Any"): StatusRule => {
    const entry = rule(layer, led, effect);
    entry.cell.conditions.battery = { node, min_level: min > 0 ? min : undefined, max_level: max, charge };
    return entry;
  };
  const rules: StatusRule[] = [];
  leds.forEach((led, index) => {
    const level = Math.round((index * 100) / (leds.length - 1));
    rules.push(banded(led, GREEN, Math.max(level, 40), undefined));
    if (level < 40) rules.push(banded(led, YELLOW, Math.max(level, 20), 39));
    if (level < 20) rules.push(banded(led, RED, level, 19));
  });
  for (const led of leds) rules.push(banded(led, GREEN, 0, undefined, "Charging"));
  return rules;
}

/** Lilac unpaired, red paired but not connected, dull green connected, white
 *  connected and carrying typing. */
function profileRules(layer: number, led: number, slot: number): StatusRule[] {
  const unpaired = rule(layer, led, LILAC);
  unpaired.connection = connection({ bonded: { slot, bonded: false } });
  const paired = rule(layer, led, RED);
  paired.connection = connection({ bonded: { slot, bonded: true } });
  const connected = rule(layer, led, DULL_GREEN);
  connected.connection = connection({ profile: slot, ble_state: "Connected" });
  const active = rule(layer, led, WHITE);
  active.connection = connection({ profile: slot, ble_state: "Connected", transport: "Ble" });
  return [unpaired, paired, connected, active];
}

function usbRules(layer: number, led: number): StatusRule[] {
  const unplugged = rule(layer, led, LILAC);
  unplugged.connection = connection({ usb_connected: false });
  const plugged = rule(layer, led, DULL_GREEN);
  plugged.connection = connection({ usb_connected: true });
  const active = rule(layer, led, WHITE);
  active.connection = connection({ transport: "Usb" });
  return [unplugged, plugged, active];
}

const ledAt = (table: MagicLayerTable, row: number, col: number): number | undefined =>
  table.places.find((place) => place.row === row && place.col === col)?.led;

/** The keys the layer binds to a Bluetooth profile or to USB, each with its LED: their lights follow the bindings. */
export type ConnectionLight = { led: number; kind: { type: "ble"; slot: number } | { type: "usb" } };

export function connectionLights(table: MagicLayerTable): ConnectionLight[] {
  return table.keys.flatMap(({ row, col, action }): ConnectionLight[] => {
    const led = ledAt(table, row, col);
    if (led === undefined) return [];
    if (same(action, { Single: { KeyboardControl: "OutputUsb" } })) return [{ led, kind: { type: "usb" } }];
    const slot = profileSlot(action);
    return slot !== null && slot < PROFILES ? [{ led, kind: { type: "ble", slot } }] : [];
  });
}

const profileSlot = (action: KeyAction): number | null =>
  typeof action === "object" && "Single" in action && typeof action.Single === "object" && "User" in action.Single ? action.Single.User : null;

/** The table for a keyboard with `profiles` Bluetooth profiles: a key for a
 *  later profile is left unbound, and so has no light. The firmware's User
 *  actions after the profiles mean other things (next, previous …), and it
 *  refuses a rule for a profile it does not have. */
export function withProfiles(table: MagicLayerTable, profiles: number): MagicLayerTable {
  const kept = table.keys.filter(({ action }) => {
    const slot = profileSlot(action);
    return slot === null || slot >= PROFILES || slot < profiles;
  });
  return kept.length === table.keys.length ? table : { ...table, keys: kept };
}

/** Every LED the layer lights. */
export function magicLayerLeds(table: MagicLayerTable): Set<number> {
  const maintenance = ledAt(table, table.maintenance.row, table.maintenance.col);
  return new Set([
    ...table.layerLights,
    ...Object.values(table.locks),
    ...table.batteries.flat(),
    ...connectionLights(table).map(({ led }) => led),
    ...(maintenance === undefined ? [] : [maintenance]),
  ]);
}

/** The status rules of a Magic layer on `layer`, on a layout with `numLayers`
 *  layers. Every rule watches the Magic layer; a layer light adds the layer it
 *  shows, a lock light the host's lock. */
export function magicLayerRules(table: MagicLayerTable, layer: number, numLayers: number): StatusRule[] {
  const rules: StatusRule[] = [];
  table.layerLights.slice(0, Math.min(numLayers, SHOWN_LAYERS)).forEach((led, shown) => {
    const entry = rule(layer, led, MAGENTA);
    if (shown !== layer) entry.layers = { active: 2 ** shown, inactive: 0 };
    rules.push(entry);
  });
  for (const lock of ["caps_lock", "num_lock", "scroll_lock"] as const satisfies readonly Lock[]) {
    const entry = rule(layer, table.locks[lock], RED);
    entry.indicators = { num_lock: undefined, caps_lock: undefined, scroll_lock: undefined, [lock]: true };
    rules.push(entry);
  }
  table.batteries.forEach((leds, node) => rules.push(...batteryRules(layer, node, leds)));
  for (const { led, kind } of connectionLights(table)) {
    rules.push(...(kind.type === "usb" ? usbRules(layer, led) : profileRules(layer, led, kind.slot)));
  }
  const maintenance = ledAt(table, table.maintenance.row, table.maintenance.col);
  if (maintenance !== undefined) {
    const unlocked = rule(layer, maintenance, MAINTENANCE_UNLOCKED);
    unlocked.maintenance = { unlocked: true };
    const locked = rule(layer, maintenance, MAINTENANCE_LOCKED);
    locked.maintenance = { unlocked: false };
    rules.push(unlocked, locked);
  }
  return rules;
}

/** `current` with this layer's rules on the table's LEDs and its dark half
 *  replaced (a light an earlier Magic layer put there goes too), everything else kept. */
export function withMagicLayerRules(current: readonly StatusRule[], table: MagicLayerTable, layer: number, numLayers: number): StatusRule[] {
  const owned = new Set([...magicLayerLeds(table), ...table.dark]);
  const kept = current.filter((entry) => entry.cell.conditions.layer?.layer !== layer || !owned.has(entry.cell.led_id));
  return [...kept, ...magicLayerRules(table, layer, numLayers)];
}

/** `current` with this layer's scene the table's dark half, in place of what it had. */
export function withMagicLayerScene(current: readonly LightingSceneCell[], table: MagicLayerTable, layer: number): LightingSceneCell[] {
  return [...current.filter((cell) => cell.layer !== layer), ...table.dark.map((led_id) => ({ layer, led_id, effect: BLACK }))];
}

/** Each key of the board as the layer has it: what the table binds, the rest unbound. */
export function magicLayerKeys(table: MagicLayerTable): { row: number; col: number; action: KeyAction }[] {
  return table.places.map(({ row, col }) => ({
    row,
    col,
    action: table.keys.find((key) => key.row === row && key.col === col)?.action ?? "No",
  }));
}
