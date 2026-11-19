import { describe as group, expect, it } from "vitest";
import type { KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardImage } from "../sync/image";
import { describe } from "./describe";

const key = (code: string): KeyAction => ({ Single: { Key: { Hid: code } } }) as KeyAction;

const image = (metadata: KeyboardImage["metadata"]): KeyboardImage => ({
  metadata,
  layers: [
    [key("A"), key("B"), key("C"), key("D")],
    ["Transparent", "No", "No", "Transparent"],
    ["No", "No", "No", "No"],
  ],
  encoders: [[], [], []],
  defaultLayer: 1,
  combos: [],
  morse: [],
  forks: [],
  behaviorOptions: null,
  autoMouseLayers: [],
  scenes: [],
  runtimeConditionalScenes: [],
  wakeLayers: 0,
  pointing: null,
});

group("describe", () => {
  it("gives each used layer by index and name, its keys row by row", () => {
    const described = describe(
      image([{ occupied: true, name: "Base" }, { occupied: true, name: "" }, { occupied: false, name: "" }]),
      { id: "glove80", cols: 2 },
    );
    expect(described).toEqual({
      keyboard: "glove80",
      rows: 2,
      cols: 2,
      default_layer: 1,
      layers: [
        { index: 0, name: "Base", keys: [[key("A"), key("B")], [key("C"), key("D")]] },
        { index: 1, name: "Layer 1", keys: [["Transparent", "No"], ["No", "Transparent"]] },
      ],
    });
  });

  it("keeps every layer when the firmware keeps no layer metadata", () => {
    expect(describe(image([]), { id: null, cols: 4 }).layers.map(({ index }) => index)).toEqual([0, 1, 2]);
  });

  it("is plain JSON: it survives a round trip unchanged", () => {
    const described = describe(image([]), { id: null, cols: 4 });
    expect(JSON.parse(JSON.stringify(described))).toEqual(described);
  });
});
