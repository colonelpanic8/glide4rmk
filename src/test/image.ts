// A `KeyboardImage` built in a line or two, for unit and operation tests that
// need a small keyboard and say only what they are about:
//
//   layout().layer("Base", row("MO(1) A")).layer("Nav", row("B --")).vacant().build()
//
// Everything not given is empty: no behaviors, no lighting, no pointing.

import type { ComboDefinition, Fork, KeyAction, Morse } from "../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardImage } from "../sync/image";

/** A plain key by its HID name: `key("A")`, `key("LShift")`. */
export const key = (hid: string): KeyAction => ({ Single: { Key: { Hid: hid } } }) as KeyAction;

/** Momentary layer: held, the layer is on. */
export const mo = (layer: number): KeyAction => ({ Single: { LayerOn: layer } }) as KeyAction;

/** Keys from text, space separated: a HID name, `MO(n)`, `--` for none, `__` for transparent. */
export function row(text: string): KeyAction[] {
  return text.trim().split(/\s+/).map((token) => {
    if (token === "--") return "No";
    if (token === "__") return "Transparent";
    const layer = /^MO\((\d+)\)$/.exec(token);
    return layer ? mo(Number(layer[1])) : key(token);
  });
}

export interface ImageBuilder {
  /** A used layer, named, with these keys. */
  layer(name: string, keys: KeyAction[]): ImageBuilder;
  /** An unused layer slot, as wide as the first layer, with no keys. */
  vacant(): ImageBuilder;
  combo(combo: ComboDefinition): ImageBuilder;
  morse(morse: Morse): ImageBuilder;
  fork(fork: Fork): ImageBuilder;
  /** Any other part, as given. */
  with(parts: Partial<KeyboardImage>): ImageBuilder;
  build(): KeyboardImage;
}

/** An empty keyboard to build on. */
export function layout(): ImageBuilder {
  const image: KeyboardImage = {
    metadata: [],
    layers: [],
    encoders: [],
    defaultLayer: 0,
    combos: [],
    morse: [],
    forks: [],
    behaviorOptions: null,
    autoMouseLayers: [],
    scenes: [],
    runtimeConditionalScenes: [],
    wakeLayers: 0,
    pointing: null,
  };
  const builder: ImageBuilder = {
    layer(name, keys) {
      image.metadata.push({ occupied: true, name });
      image.layers.push(keys);
      image.encoders.push([]);
      return builder;
    },
    vacant() {
      image.metadata.push({ occupied: false, name: "" });
      image.layers.push(Array.from({ length: image.layers[0]?.length ?? 0 }, (): KeyAction => "No"));
      image.encoders.push([]);
      return builder;
    },
    combo(combo) {
      image.combos.push(combo);
      return builder;
    },
    morse(morse) {
      image.morse.push(morse);
      return builder;
    },
    fork(fork) {
      image.forks.push(fork);
      return builder;
    },
    with(parts) {
      Object.assign(image, parts);
      return builder;
    },
    build: () => structuredClone(image),
  };
  return builder;
}
