// What a Flow or an assistant reads (ADR 0025, 0027): the image as plain JSON,
// keys as rows of the keyboard's own actions, and the board as the registry
// knows it: its key groups (the letter block, the home row with each key's
// finger, the thumbs …), its key count, what it can do and the extras on it,
// so a script asks for `home_row` instead of keeping a table of rows and
// columns per board. It grows with the first reader that needs more. Pure.

import type { KeyAction, MorseProfile } from "../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardImage } from "../sync/image";
import { layerName } from "../model/layer-names";
import type { KeyGroups } from "../model/boards/key-groups";

export interface DescribedLayer {
  index: number;
  name: string;
  /** Row by row, `cols` actions each. */
  keys: KeyAction[][];
}

/** The board as a Flow sees it. */
export interface DescribedBoard {
  /** The registry's id (`glove80`, `go60`), or null for a board it does not know. */
  id: string | null;
  name: string;
  /** How many physical keys it has. */
  keys: number;
  /** Its named key groups; empty for a board without them. */
  groups: Partial<KeyGroups>;
  /** The capabilities it has (`behaviors.morse`, `pointing`, …). */
  capabilities: string[];
  /** What is fitted to it beyond keys: `pointing` (a trackpad, trackball or touchpad). */
  extras: string[];
}

export interface Description {
  /** The board's id: the same as `board.id`, kept for the first Flows. */
  keyboard: string | null;
  board: DescribedBoard;
  rows: number;
  cols: number;
  default_layer: number;
  /** The layers in use; a layer slot the firmware marks unused is left out. */
  layers: DescribedLayer[];
  /** The tap-hold timing profiles, by name (a tap-hold names its profile by slot). */
  profiles: { index: number; name: string; timing: MorseProfile }[];
  /** How many combos the layout has. */
  combo_count: number;
}

/** The board a Flow runs on: the registry's knowledge and what the keyboard reports. */
export interface Board {
  id: string | null;
  name?: string;
  cols: number;
  /** Physical keys; the matrix size when unknown. */
  keyCount?: number;
  groups?: KeyGroups | null;
  /** Capability ids the keyboard has. */
  capabilities?: readonly string[];
}

/** The extras a board has, from its capabilities. */
export const extrasOf = (capabilities: readonly string[]): string[] => (capabilities.includes("pointing") ? ["pointing"] : []);

const used = (image: KeyboardImage, layer: number): boolean =>
  image.metadata.length === 0 || image.metadata[layer]?.occupied === true;

export function describeBoard(board: Board, rows: number): DescribedBoard {
  const capabilities = [...(board.capabilities ?? [])];
  return {
    id: board.id,
    name: board.name ?? board.id ?? "Keyboard",
    keys: board.keyCount ?? rows * board.cols,
    groups: board.groups ? structuredClone(board.groups) : {},
    capabilities,
    extras: extrasOf(capabilities),
  };
}

export function describe(image: KeyboardImage, board: Board): Description {
  const { cols } = board;
  const rows = Math.ceil((image.layers[0]?.length ?? 0) / cols);
  const layers = image.layers.flatMap((cells, index) =>
    used(image, index)
      ? [{ index, name: layerName(image.metadata, index), keys: Array.from({ length: rows }, (_, row) => cells.slice(row * cols, (row + 1) * cols)) }]
      : [],
  );
  const profiles = (image.morseProfiles ?? []).flatMap((entry) => (entry ? [{ index: entry.index, name: entry.name, timing: entry.profile }] : []));
  return {
    keyboard: board.id,
    board: describeBoard(board, rows),
    rows,
    cols,
    default_layer: image.defaultLayer,
    layers,
    profiles,
    combo_count: image.combos.length,
  };
}
