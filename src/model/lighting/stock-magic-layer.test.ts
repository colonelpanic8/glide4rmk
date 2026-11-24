import { describe, expect, it } from "vitest";
import { GLOVE80_MAGIC_LAYER, GO60_MAGIC_LAYER } from "../boards/magic-layer";
import { batteryBarRules } from "./status-presets";
import {
  connectionLights,
  magicLayerKeys,
  magicLayerLeds,
  magicLayerRules,
  withMagicLayerRules,
  withMagicLayerScene,
  withProfiles,
} from "./stock-magic-layer";

describe("the Magic layer tables", () => {
  it("put the Glove80's lights where MoErgo's firmware has them", () => {
    expect(GLOVE80_MAGIC_LAYER.layerLights).toEqual([35, 29, 23, 17, 11, 6]);
    expect(GLOVE80_MAGIC_LAYER.batteries).toEqual([[36, 30, 24, 18, 12, 7], [37, 31, 25, 19, 13, 8]]);
    expect(GLOVE80_MAGIC_LAYER.locks).toEqual({ caps_lock: 22, num_lock: 16, scroll_lock: 10 });
  });

  it("put the Go60's one row up, with the locks on the left thumbs", () => {
    expect(GO60_MAGIC_LAYER.layerLights).toEqual([26, 22, 17, 12, 7, 3]);
    expect(GO60_MAGIC_LAYER.batteries).toEqual([[27, 23, 18, 13, 8, 4], [28, 24, 19, 14, 9, 5]]);
    expect(GO60_MAGIC_LAYER.locks).toEqual({ caps_lock: 0, num_lock: 1, scroll_lock: 2 });
  });

  it("light Bluetooth 1–4 and USB on the keys the layer binds to them", () => {
    const leds = (table: typeof GLOVE80_MAGIC_LAYER) => connectionLights(table).map(({ led, kind }) => [led, kind.type === "ble" ? kind.slot : "usb"]);
    expect(leds(GLOVE80_MAGIC_LAYER)).toEqual([[3, 0], [4, 1], [0, 2], [1, 3], [5, "usb"]]);
    expect(leds(GO60_MAGIC_LAYER)).toEqual([[20, 0], [15, 1], [10, 2], [6, 3], [21, "usb"]]);
  });

  it("give the maintenance lock a key no other light uses, Z on both boards", () => {
    for (const table of [GLOVE80_MAGIC_LAYER, GO60_MAGIC_LAYER]) {
      const rules = magicLayerRules(table, table.layer, 6);
      const maintenance = rules.filter((rule) => rule.maintenance).map((rule) => rule.cell.led_id);
      const others = new Set(rules.filter((rule) => !rule.maintenance).map((rule) => rule.cell.led_id));
      expect(maintenance).toHaveLength(2);
      expect(others.has(maintenance[0])).toBe(false);
      expect(table.maintenance).toEqual(table === GLOVE80_MAGIC_LAYER ? { row: 4, col: 1 } : { row: 3, col: 1 });
    }
  });

  it("bind every key of the board, the ones the layer leaves free unbound, and no hole in the matrix", () => {
    expect(magicLayerKeys(GLOVE80_MAGIC_LAYER)).toHaveLength(80);
    expect(magicLayerKeys(GO60_MAGIC_LAYER)).toHaveLength(60);
    expect(magicLayerKeys(GO60_MAGIC_LAYER).filter(({ action }) => action !== "No")).toHaveLength(GO60_MAGIC_LAYER.keys.length);
  });
});

describe("the Magic layer's rules", () => {
  it("show a held layer only through the layer set; the Magic layer's own light needs none", () => {
    const rules = magicLayerRules(GLOVE80_MAGIC_LAYER, 2, 3);
    const layerLights = rules.filter((rule) => GLOVE80_MAGIC_LAYER.layerLights.includes(rule.cell.led_id) && !rule.cell.conditions.battery);
    expect(layerLights.map((rule) => [rule.cell.led_id, rule.layers?.active])).toEqual([[35, 1], [29, 2], [23, undefined]]);
  });

  it("replace their own rules on the layer and keep every other rule", () => {
    const elsewhere = batteryBarRules({ layer: 1, node: 0, leds: [36, 30, 24] })[0];
    const otherLed = batteryBarRules({ layer: 2, node: 0, leds: [60, 61, 62] })[0];
    const stale = batteryBarRules({ layer: 2, node: 0, leds: [36, 30, 24] })[0];
    const once = withMagicLayerRules([elsewhere, otherLed, stale], GLOVE80_MAGIC_LAYER, 2, 3);
    expect(once.slice(0, 2)).toEqual([elsewhere, otherLed]);
    expect(once).not.toContain(stale);
    expect(withMagicLayerRules(once, GLOVE80_MAGIC_LAYER, 2, 3)).toEqual(once);
    expect([...magicLayerLeds(GLOVE80_MAGIC_LAYER)].every((led) => led < 40)).toBe(true);
  });

  it("leave a profile the keyboard does not have unbound and unlit, and clear a light an earlier Magic layer put on the dark half", () => {
    const three = withProfiles(GO60_MAGIC_LAYER, 3);
    expect(connectionLights(three).map(({ led }) => led)).toEqual([20, 15, 10, 21]);
    expect(magicLayerKeys(three).find((key) => key.row === 3 && key.col === 5)?.action).toBe("No");
    expect(withProfiles(GLOVE80_MAGIC_LAYER, 4)).toBe(GLOVE80_MAGIC_LAYER);
    // Profile 4's lights, as the Magic layer made them before it knew the profile count.
    const stale = magicLayerRules(GO60_MAGIC_LAYER, 3, 4).filter((rule) => rule.cell.led_id === 6);
    expect(stale).toHaveLength(4);
    const rules = withMagicLayerRules(stale, three, 3, 4);
    expect(rules.some((rule) => rule.cell.led_id === 6)).toBe(false);
  });

  it("darken the left half on their own layer only", () => {
    const other = { layer: 1, led_id: 3, effect: { Solid: { color: { r: 255, g: 0, b: 0 } } } };
    const mine = { layer: 3, led_id: 45, effect: other.effect };
    const scene = withMagicLayerScene([other, mine], GO60_MAGIC_LAYER, 3);
    expect(scene[0]).toEqual(other);
    expect(scene).not.toContain(mine);
    expect(scene.filter((cell) => cell.layer === 3).map((cell) => cell.led_id)).toEqual(Array.from({ length: 30 }, (_, led) => led));
  });
});
