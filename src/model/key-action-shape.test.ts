import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import "../test/wasm";
import { parseDocument } from "../config/document";
import { offlineGlove80Catalog } from "../session/offline/glove80";
import { isKeyAction } from "./key-action-shape";

const none = { left_ctrl: false, left_shift: false, left_alt: false, left_gui: false, right_ctrl: false, right_shift: false, right_alt: false, right_gui: false };
const shift = { ...none, left_shift: true };

describe("isKeyAction", () => {
  it("accepts every key of a real layout (TailorKey for RMK)", () => {
    const text = readFileSync("src/test/fixtures/glove80-tailorkey-qwerty.toml", "utf8");
    const { snapshot } = parseDocument(text, offlineGlove80Catalog());
    const refused = snapshot.layers.flat().filter((action) => !isKeyAction(action));
    expect(refused).toEqual([]);
  });

  it("accepts the shapes a Flow writes", () => {
    for (const action of [
      "No",
      "Transparent",
      { Single: { Key: { Hid: "A" } } },
      { Single: { KeyWithModifier: ["Quote", shift] } },
      { TapHold: [{ Key: { Hid: "R" } }, { Modifier: { ...none, left_gui: true } }, 3] },
      { TapHold: [{ Key: { Hid: "F" } }, { KeyWithModifier: ["F", shift] }, 0] },
      { LayerModTap: [4, "LAlt", "Tab"] },
      { Morse: 2 },
    ]) expect(isKeyAction(action), JSON.stringify(action)).toBe(true);
  });

  it("refuses what the keyboard cannot store", () => {
    for (const action of [
      null,
      "Yes",
      { Single: { Key: { Hid: "Banana" } } },
      { Single: { Key: { Hid: "A" }, Extra: 1 } },
      { Single: { KeyWithModifier: ["A", { left_shift: true }] } },
      { TapHold: [{ Key: { Hid: "A" } }, { Modifier: none }] },
      { TapHold: [{ Key: { Hid: "A" } }, { Modifier: none }, -1] },
      { Single: { LayerOn: 1.5 } },
      { LayerModTap: [4, "Hyper", "Tab"] },
      { Single: { KeyboardControl: "Explode" } },
      { Single: "Transparent" },
      { Unknown: 1 },
    ]) expect(isKeyAction(action), JSON.stringify(action)).toBe(false);
  });
});
