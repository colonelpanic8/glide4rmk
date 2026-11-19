// What a Flow or an assistant reads (ADR 0025): the image as plain JSON, keys
// as rows of the keyboard's own actions. It grows with the first reader that
// needs more. Pure.

import type { KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardImage } from "../sync/image";
import { layerName } from "../model/layer-names";

export interface DescribedLayer {
  index: number;
  name: string;
  /** Row by row, `cols` actions each. */
  keys: KeyAction[][];
}

export interface Description {
  /** The board's id (`glove80`, `go60`), or null for any other keyboard. */
  keyboard: string | null;
  rows: number;
  cols: number;
  default_layer: number;
  /** The layers in use; a layer slot the firmware marks unused is left out. */
  layers: DescribedLayer[];
}

export interface Board {
  id: string | null;
  cols: number;
}

const used = (image: KeyboardImage, layer: number): boolean =>
  image.metadata.length === 0 || image.metadata[layer]?.occupied === true;

export function describe(image: KeyboardImage, board: Board): Description {
  const { cols } = board;
  const rows = Math.ceil((image.layers[0]?.length ?? 0) / cols);
  const layers = image.layers.flatMap((cells, index) =>
    used(image, index)
      ? [{ index, name: layerName(image.metadata, index), keys: Array.from({ length: rows }, (_, row) => cells.slice(row * cols, (row + 1) * cols)) }]
      : [],
  );
  return { keyboard: board.id, rows, cols, default_layer: image.defaultLayer, layers };
}
