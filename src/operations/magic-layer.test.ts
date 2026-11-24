// set_magic_layer finds the layout's Magic layer by its name, or by the key
// MoErgo's layout holds it down with, or adds one: no layer number is assumed.

import { describe, expect, it } from "vitest";
import type { BehaviorOptions, KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import { noLabels } from "../model/behavior-labels";
import { layout, mo } from "../test/image";
import { runOperation, type OperationFacts } from ".";

const facts: OperationFacts = {
  board: "glove80",
  bleProfiles: 4,
  cols: 14,
  sceneCapacity: 512,
  ruleCapacity: 512,
  activeLayers: [],
  compiledScenes: [],
  compiledRules: [],
  ledNodes: {},
  labels: noLabels(),
  macroSpace: null,
};
const KEYS = 6 * 14;
const empty = (): KeyAction[] => Array.from({ length: KEYS }, (): KeyAction => "No");
/** The base layer with MoErgo's Magic key (lower left) holding down `layer`. */
const reaching = (layer: number): KeyAction[] => empty().map((key, offset) => (offset === 5 * 14 ? mo(layer) : key));
const usb = { Single: { KeyboardControl: "OutputUsb" } };
const magicKeysOn = (image: { layers: KeyAction[][] }, layer: number) => JSON.stringify(image.layers[layer][5 * 14 + 6]) === JSON.stringify(usb);

describe("set_magic_layer", () => {
  it("refuses on a board without MoErgo's Magic layer", () => {
    const image = layout().layer("Base", empty()).build();
    expect(runOperation("set_magic_layer", image, {}, { ...facts, board: null })).toEqual({ ok: false, message: "Only the Glove80 and the Go60 have MoErgo's Magic layer." });
  });

  it("goes on the layer named Magic, wherever it is, and wakes the lights on it", () => {
    const image = layout().layer("Base", empty()).layer("Autoshift", empty()).layer("Lower", empty()).layer(" magic ", empty()).build();
    const result = runOperation("set_magic_layer", image, {}, facts);
    expect(result.ok && magicKeysOn(result.image, 3)).toBe(true);
    expect(result.ok && result.image.layers[2]).toEqual(image.layers[2]);
    expect(result.ok && result.image.wakeLayers).toBe(1 << 3);
  });

  it("without a layer named Magic, goes on the layer MoErgo's Magic key holds down", () => {
    const image = layout().layer("Base", reaching(2)).layer("Lower", empty()).layer("Fn", empty()).build();
    const result = runOperation("set_magic_layer", image, {}, facts);
    expect(result.ok && magicKeysOn(result.image, 2)).toBe(true);
  });

  it("without either, adds a layer named Magic and gives the free Magic key to it", () => {
    const image = layout().layer("Base", empty()).layer("Lower", empty()).vacant().vacant().with({ behaviorOptions: {} as BehaviorOptions }).build();
    const result = runOperation("set_magic_layer", image, {}, facts);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.image.metadata[2]).toEqual({ occupied: true, name: "Magic" });
    expect(magicKeysOn(result.image, 2)).toBe(true);
    expect(result.image.layers[0][5 * 14]).toEqual(mo(2));
    expect(result.notes).toBeUndefined();
  });

  it("says when the new layer has no key to reach it, and when it cannot be added", () => {
    const taken = empty().map((key, offset) => (offset === 5 * 14 ? ({ Single: { Key: { Hid: "A" } } } as KeyAction) : key));
    const room = layout().layer("Base", taken).vacant().build();
    const added = runOperation("set_magic_layer", room, {}, facts);
    expect(added.ok && added.image.layers[0][5 * 14]).toEqual(taken[5 * 14]);
    expect(added.ok && added.notes).toEqual([expect.stringContaining("give a key on your base layer")]);
    const full = layout().layer("Base", empty()).layer("Lower", empty()).build();
    expect(runOperation("set_magic_layer", full, {}, facts)).toEqual({
      ok: false,
      message: expect.stringMatching(/^There is no layer named Magic, and none can be added \(.+\): free a layer, or pick one\.$/),
    });
  });

  it("starts the layer clean, and leaves the half lit when the scene table has no room for it", () => {
    const red = { Solid: { color: { r: 255, g: 0, b: 0 } } };
    const others = Array.from({ length: 30 }, (_, led) => ({ layer: 0, led_id: led, effect: red }));
    const own = [{ layer: 1, led_id: 70, effect: red }];
    const image = layout().layer("Base", empty()).layer("Magic", empty()).with({ scenes: [...others, ...own] }).build();
    const roomy = runOperation("set_magic_layer", image, {}, facts);
    expect(roomy.ok && roomy.image.scenes.filter((cell) => cell.layer === 1).map((cell) => cell.led_id)).toEqual(Array.from({ length: 40 }, (_, led) => led));
    const tight = runOperation("set_magic_layer", image, {}, { ...facts, sceneCapacity: 60 });
    expect(tight.ok && tight.image.scenes).toEqual(others);
    expect(tight.ok && tight.notes).toEqual([expect.stringContaining("The left half stays lit")]);
  });

  it("goes on a layer picked by number, and says when the rules do not fit", () => {
    const image = layout().layer("Base", empty()).layer("Magic", empty()).layer("Fn", empty()).build();
    expect(runOperation("set_magic_layer", image, { layer: 2 }, facts)).toMatchObject({ ok: true });
    expect(runOperation("set_magic_layer", image, { layer: 2 }, { ...facts, ruleCapacity: 32 })).toMatchObject({
      ok: false,
      message: expect.stringMatching(/^This layout needs \d+ rules; the keyboard holds 32\.$/),
    });
    expect(runOperation("set_magic_layer", image, { layer: 5 }, facts)).toEqual({ ok: false, message: "Layer 5 does not exist" });
  });
});
