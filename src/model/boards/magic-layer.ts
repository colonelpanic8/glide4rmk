// MoErgo's Magic layer on each board that has one (ADR 0035): the keys MoErgo's
// default layout binds there and where its status lights are, as the
// `underglow_indicators` of MoErgo's firmware put them. The Go60's lights sit
// one row up from the Glove80's, as its keys do (transfer.ts); the Bluetooth
// and USB lights are on whichever keys the layer binds to them. The maintenance
// lock (an RMK addition) is on Z on both boards, a key the layer leaves free.
// Data only, on each board's profile; model/lighting/stock-magic-layer.ts
// builds the rules from it.

import type { KeyAction, KeyboardAction, LightAction } from "../../vendor/rynk-wasm/rynk_wasm";
import type { Lock } from "../lighting/status-light";
import { GLOVE80_BOARD_KEYS, GLOVE80_COLS, GLOVE80_GRID } from "./glove80";
import { GO60_KEYS } from "./go60";

/** A key of the board, with its LED. */
export interface LitPlace {
  row: number;
  col: number;
  led: number;
}

export interface MagicLayerTable {
  /** The key on the default layer that MoErgo's layout holds the Magic layer down with. */
  reach: { row: number; col: number };
  /** Every key of the board: each one the layer does not bind is left unbound there. */
  places: readonly LitPlace[];
  /** What the layer binds. */
  keys: readonly { row: number; col: number; action: KeyAction }[];
  /** The left half's LEDs, dark on the layer as under ZMK's status view. */
  dark: readonly number[];
  /** The LEDs that show layers 0, 1, 2 … while the layer is held. */
  layerLights: readonly number[];
  /** Each half's battery, left then right: LEDs empty to full. */
  batteries: readonly (readonly number[])[];
  locks: Readonly<Record<Lock, number>>;
  /** The maintenance lock's key and its light. */
  maintenance: { row: number; col: number };
}

const light = (action: LightAction): KeyAction => ({ Single: { Light: action } });
const control = (action: KeyboardAction): KeyAction => ({ Single: { KeyboardControl: action } });
const user = (id: number): KeyAction => ({ Single: { User: id } });
const hid = (code: string): KeyAction => ({ Single: { Key: { Hid: code } } }) as KeyAction;
const MAINTENANCE = control("MaintenanceModeToggle");

/** Board-reserved User actions (`profiles/moergo.ts`): 0–3 select a Bluetooth profile. */
const CLEAR_ACTIVE_PROFILE = 10;
const CLEAR_ALL_PROFILES = 11;
const PERIPHERAL_BOOTLOADER = 12;

/** The RGB keys both boards share, on the left hand's C5 to C1 of two rows from `top`
 *  (Q to T and A to G on the Glove80, Tab's and Ctrl's rows' on the Go60 one row up). */
function rgbBlock(top: number): { row: number; col: number; action: KeyAction }[] {
  // RGB_TOG turns all underglow off; on this firmware that is the output toggle,
  // and the output has the brightness, so the toggle and brightness are Backlight's.
  const upper: LightAction[] = ["RgbSpi", "RgbSai", "RgbHui", "BacklightUp", "BacklightToggle"];
  const lower: LightAction[] = ["RgbSpd", "RgbSad", "RgbHud", "BacklightDown", "RgbModeForward"];
  return [
    ...upper.map((action, index) => ({ row: top, col: index + 1, action: light(action) })),
    ...lower.map((action, index) => ({ row: top + 1, col: index + 1, action: light(action) })),
  ];
}

/** A row's six left-hand keys, outer column first (MoErgo's C6 to C1). */
const leftRow = (places: readonly LitPlace[], row: number): number[] =>
  [0, 1, 2, 3, 4, 5].map((col) => places.find((place) => place.row === row && place.col === col)!.led);

function glove80Places(): LitPlace[] {
  return GLOVE80_GRID.flatMap((logical, index) =>
    logical === null ? [] : [{ row: Math.floor(index / GLOVE80_COLS), col: index % GLOVE80_COLS, led: GLOVE80_BOARD_KEYS.get(logical)!.led }],
  );
}

function glove80(): MagicLayerTable {
  const places = glove80Places();
  const z = { row: 4, col: 1 };
  return {
    reach: { row: 5, col: 0 },
    places,
    keys: [
      { row: 0, col: 0, action: user(CLEAR_ACTIVE_PROFILE) },
      { row: 0, col: 13, action: user(CLEAR_ALL_PROFILES) },
      ...rgbBlock(2),
      { row: 3, col: 0, action: control("Bootloader") },
      { row: 3, col: 13, action: user(PERIPHERAL_BOOTLOADER) },
      { row: 4, col: 0, action: control("Reboot") },
      { row: 4, col: 13, action: control("Reboot") },
      // The upper fan's inner keys, then the lower fan's outer two: Bluetooth 1–4; the lower fan's inner key: USB.
      { row: 3, col: 6, action: user(0) },
      { row: 4, col: 6, action: user(1) },
      { row: 0, col: 6, action: user(2) },
      { row: 1, col: 6, action: user(3) },
      { row: 5, col: 6, action: control("OutputUsb") },
      { ...z, action: MAINTENANCE },
    ],
    dark: Array.from({ length: 40 }, (_, led) => led),
    layerLights: leftRow(places, 1),
    batteries: [leftRow(places, 2), leftRow(places, 3)],
    locks: { caps_lock: 22, num_lock: 16, scroll_lock: 10 },
    maintenance: z,
  };
}

function go60(): MagicLayerTable {
  const places = GO60_KEYS.map(({ row, col, led }) => ({ row, col, led }));
  const z = { row: 3, col: 1 };
  return {
    reach: { row: 3, col: 0 },
    places,
    keys: [
      { row: 0, col: 0, action: user(CLEAR_ACTIVE_PROFILE) },
      { row: 0, col: 1, action: hid("BrightnessDown") },
      { row: 0, col: 2, action: hid("BrightnessUp") },
      { row: 0, col: 3, action: hid("MediaPrevTrack") },
      { row: 0, col: 4, action: hid("MediaNextTrack") },
      { row: 0, col: 5, action: hid("MediaPlayPause") },
      { row: 0, col: 8, action: hid("AudioMute") },
      { row: 0, col: 9, action: hid("AudioVolDown") },
      { row: 0, col: 10, action: hid("AudioVolUp") },
      { row: 0, col: 13, action: user(CLEAR_ALL_PROFILES) },
      { row: 1, col: 0, action: control("Bootloader") },
      { row: 1, col: 13, action: user(PERIPHERAL_BOOTLOADER) },
      { row: 2, col: 0, action: control("Reboot") },
      { row: 2, col: 13, action: control("Reboot") },
      ...rgbBlock(1),
      // X C V B: Bluetooth 1–4 as MoErgo has them; below them, the lower-left
      // outer key: USB. The Go60's RMK firmware has three profiles, so B is
      // left unbound there (set_magic_layer, withProfiles).
      { row: 3, col: 2, action: user(0) },
      { row: 3, col: 3, action: user(1) },
      { row: 3, col: 4, action: user(2) },
      { row: 3, col: 5, action: user(3) },
      { row: 4, col: 2, action: control("OutputUsb") },
      { ...z, action: MAINTENANCE },
    ],
    dark: Array.from({ length: 30 }, (_, led) => led),
    layerLights: leftRow(places, 0),
    batteries: [leftRow(places, 1), leftRow(places, 2)],
    // The left thumb fan, T1 to T3.
    locks: { caps_lock: 0, num_lock: 1, scroll_lock: 2 },
    maintenance: z,
  };
}

export const GLOVE80_MAGIC_LAYER = glove80();
export const GO60_MAGIC_LAYER = go60();
