// The Go60 the offline board is shaped like: what the go60-rmk firmware
// (colonelpanic8/moergo-rmk, crates/go60-rmk) declares, on the board knowledge
// in model/boards. A 5x14 matrix with 60 keys, 30 LEDs a half in one per-key
// zone, two built-in trackpads, three Bluetooth profiles. The firmware also
// caps each LED channel at 40% (102 of 255); that is the firmware's, applied
// after everything the host sets, so nothing here models it.

import type { DeviceCapabilities, DeviceInfo, Key, KeyAction } from "../../vendor/rynk-wasm/rynk_wasm";
import { GO60_COLS, GO60_KEYS, GO60_LABELS, GO60_ROWS } from "../../model/boards/go60";
import { GO60_GLIDE_CENTERS } from "../../model/boards/go60-geometry";
import { addPointingDevice } from "../../model/pointing";
import { profileById } from "../../model/boards/profiles";
import type { BoardSpec } from "../mock/board";
import { actionForLegend, glove80Board } from "../mock/glove80";
import { buildTopology, type SimLed } from "../mock/topology";

const LEDS_PER_HALF = 30;
const PER_KEY_ZONE = 1;
const MAGIC_LAYER = 3;

const centerOf = ({ row, col }: { row: number; col: number }) => {
  const center = GO60_GLIDE_CENTERS[`${row},${col}`];
  if (!center) throw new Error(`Go60 geometry has no key at ${row},${col}`);
  return center;
};

const layoutKeys: Key[] = GO60_KEYS.map((key) => {
  const [x, y, r] = centerOf(key);
  return { row: key.row, col: key.col, rect: { x, y, w: 1, h: 1 }, r, rect2: undefined, pivot: undefined };
});

const simLeds: SimLed[] = GO60_KEYS.map((key): SimLed => {
  const [x, y] = centerOf(key);
  const node = key.led < LEDS_PER_HALF ? 0 : 1;
  return {
    id: key.led,
    row: key.row,
    col: key.col,
    x,
    y,
    node,
    physicalIndex: key.led - node * LEDS_PER_HALF,
    zoneIds: [PER_KEY_ZONE],
  };
}).sort((a, b) => a.id - b.id);

/** The legend's key where it names one; the thumbs and the bottom row start empty. */
function layers(): KeyAction[][] {
  const grid = (fill: (label: string, rightHalf: boolean) => KeyAction): KeyAction[] =>
    Array.from({ length: GO60_ROWS * GO60_COLS }, (_, index) => {
      const col = index % GO60_COLS;
      const label = GO60_LABELS[`${Math.floor(index / GO60_COLS)},${col}`];
      return label === undefined ? "No" : fill(label, col >= 7);
    });
  return [grid(actionForLegend), grid(() => "Transparent")];
}

const capabilities: DeviceCapabilities = {
  ...glove80Board.capabilities,
  num_layers: 2,
  num_rows: GO60_ROWS,
  num_cols: GO60_COLS,
  max_combos: 32,
  max_morse: 64,
  num_ble_profiles: profileById("go60")!.build!.bleProfiles,
};

const info: DeviceInfo = {
  ...glove80Board.info,
  product_name: "Go60",
  serial_number: "OFFLINE",
};

const twoTrackpads = addPointingDevice(
  addPointingDevice({ revision: 1, device_count: 0, devices: [], override_count: 0, overrides: [] }, 0),
  1,
);

export const go60Template: BoardSpec = {
  ...glove80Board,
  title: "Go60",
  description: "Go60 layout workspace.",
  info,
  capabilities,
  layout: { default_variant: 0, variants: [{ name: "Go60", keys: layoutKeys, encoders: [] }] },
  topology: buildTopology(1, [{ id: PER_KEY_ZONE, name: "per-key" }], simLeds),
  defaultLayers: layers(),
  layerNames: ["Base", "Keypad", "Symbol Nav", "Magic"],
  pointingConfig: twoTrackpads,
  lightingControls: { output_toggle_user_action: undefined, wake_layers: 1 << MAGIC_LAYER },
  lightingOutputMode: { ...glove80Board.lightingOutputMode!, wake_layers: 1 << MAGIC_LAYER },
  // The firmware's effect pack is the same PaletteFX build as the Glove80's.
  extensionEffects: glove80Board.extensionEffects,
  seedCombos: [],
  seedMorse: [],
  seedForks: [],
  seedHoldTriggerPositions: [],
  seedScenes: [],
  compiledScenes: [],
  conditionalScenes: [],
  seedRuntimeConditionalScenes: [],
};
