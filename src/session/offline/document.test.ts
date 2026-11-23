import { describe, expect, it } from "vitest";
import { exportDocument } from "../../config/transfer";
import { GO60_KEYS } from "../../model/boards/go60";
import { fixtureText, withTestWorkbench } from "../../test/harness";
import { offlineCatalog } from "./board";
import { openOfflineDocument } from "./document";

const GO60_KEY_RULE = `rows = 5
default_layer = 0

[[layer]]
id = "base"
name = "Base"
keys = """
KC_A KC_B KC_C KC_D KC_E KC_F KC_G KC_H KC_I KC_J KC_K KC_L KC_M KC_N
KC_A KC_B KC_C KC_D KC_E KC_F KC_G KC_H KC_I KC_J KC_K KC_L KC_M KC_N
KC_A KC_B KC_C KC_D KC_E KC_F KC_G KC_H KC_I KC_J KC_K KC_L KC_M KC_N
KC_A KC_B KC_C KC_D KC_E KC_F -- -- KC_I KC_J KC_K KC_L KC_M KC_N
-- -- KC_C KC_D KC_E -- -- -- -- KC_J KC_K KC_L -- --
"""

[lighting]
brightness = 255
output_mode = "powered-only"
scene_policy = "active-stack"
conditional_scene = [
  { key = [2, 0], color = "#ff2000", indicators = { caps_lock = true } },
]

[lighting.background]
enabled = false
hue = 0
saturation = 0
value = 0
speed = 128
mode = "solid"
`;

const keyIds = (keys: { row: number; col: number }[]) => keys.map(({ row, col }) => `${row},${col}`).sort();

describe("opening a layout file", () => {
  it("opens MoErgo's Go60 factory layout as a Go60, and saves it back as one", async () => {
    await withTestWorkbench({ fixture: "go60" }, { mode: "draft" }, async ({ bundle, state }) => {
      expect(bundle.info.product_name).toBe("Go60");
      expect(bundle.boardProfile?.id).toBe("go60");
      expect(bundle.caps).toMatchObject({ num_rows: 5, num_cols: 14, num_layers: 4 });
      expect(keyIds(bundle.model.keys)).toEqual(keyIds([...GO60_KEYS]));
      expect(bundle.model.pointingDevices.map(({ label }) => label)).toEqual(["Left trackpad", "Right trackpad"]);
      expect(bundle.topology.leds).toHaveLength(60);

      const factory = fixtureText("go60");
      const saved = exportDocument(state(), offlineCatalog("go60"), "moergo-json", factory, [], bundle.topology);
      expect((JSON.parse(saved) as { keyboard: string }).keyboard).toBe("go60");
    });
  });

  it("still opens a Glove80 file as a Glove80", async () => {
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ bundle }) => {
      expect(bundle.info.product_name).toBe("Glove80");
      expect(bundle.caps).toMatchObject({ num_rows: 6, num_cols: 14 });
    });
  });

  it("lowers a Go60 file's key-addressed lights onto the Go60's LEDs", () => {
    const { board, parsed } = openOfflineDocument(GO60_KEY_RULE);
    expect(board).toBe("go60");
    // Row 2 column 0 is LED 28 on a Go60; on a Glove80 that key is another LED.
    expect(parsed?.snapshot.lighting?.conditional_scenes).toMatchObject([{ led_id: 28 }]);
  });

  it("keeps a Go60 file's trackpad settings", async () => {
    const withPads = `${GO60_KEY_RULE}
[pointing]

[[pointing.device]]
device_id = 0
mode = "scroll"

[[pointing.device]]
device_id = 1
mode = "cursor"
`;
    const { session } = openOfflineDocument(withPads);
    try {
      const config = await session.pointing.get();
      expect(config.devices.slice(0, config.device_count).map(({ device_id, mode }) => [device_id, Object.keys(mode)[0]]))
        .toEqual([[0, "Scroll"], [1, "Cursor"]]);
    } finally {
      await session.close();
    }
  });

  it("opens a new file as a Glove80", () => {
    const { board, parsed } = openOfflineDocument(null);
    expect(board).toBe("glove80");
    expect(parsed).toBeNull();
  });

  it("opens nothing for a file for another board", () => {
    expect(() => openOfflineDocument(JSON.stringify({ keyboard: "corne", layers: [[]] }))).toThrow(/corne/);
  });
});
