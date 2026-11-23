import { describe, expect, it } from "vitest";
import { GO60_KEYS } from "../../model/boards/go60";
import { go60Template } from "./go60";

describe("the offline Go60 template", () => {
  it("places every Go60 key once, from GLIDE's geometry", () => {
    const keys = go60Template.layout.variants[0].keys;
    expect(keys).toHaveLength(GO60_KEYS.length);
    expect(new Set(keys.map(({ row, col }) => `${row},${col}`)).size).toBe(60);
    // The thumb fans turn about their pivots; the finger keys sit flat.
    expect(keys.find(({ row, col }) => row === 2 && col === 6)?.r).toBe(45);
    expect(keys.find(({ row, col }) => row === 0 && col === 0)?.r).toBe(0);
  });

  it("wires 30 LEDs a half, as go60-rmk declares them", () => {
    const { leds, routes } = go60Template.topology;
    expect(leds.map(({ id }) => id)).toEqual(Array.from({ length: 60 }, (_, id) => id));
    for (const half of [0, 1]) {
      const own = routes.filter(({ node }) => node === half);
      expect(own.map(({ physical_index }) => physical_index)).toEqual(Array.from({ length: 30 }, (_, index) => index));
    }
    // Row 2 column 0 is LED 28 on a connected Go60.
    expect(leds.find(({ key }) => key?.row === 2 && key.col === 0)?.id).toBe(28);
  });

  it("has a 5x14 matrix, both trackpads and the Magic layer waking the lights", () => {
    expect(go60Template.capabilities).toMatchObject({ num_rows: 5, num_cols: 14, num_ble_profiles: 3 });
    expect(go60Template.pointingConfig?.devices.slice(0, 2).map(({ device_id }) => device_id)).toEqual([0, 1]);
    expect(go60Template.lightingControls?.wake_layers).toBe(1 << 3);
  });
});
