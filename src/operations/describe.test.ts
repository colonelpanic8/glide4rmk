import { describe as group, expect, it } from "vitest";
import type { KeyboardImage } from "../sync/image";
import { describe } from "./describe";
import { key, layout, row } from "../test/image";
import { GLOVE80_KEY_GROUPS } from "../model/boards/key-groups";

const image = (metadata: KeyboardImage["metadata"]): KeyboardImage =>
  layout()
    .layer("", row("A B C D"))
    .layer("", row("__ -- -- __"))
    .layer("", row("-- -- -- --"))
    .with({ metadata, defaultLayer: 1 })
    .build();

group("describe", () => {
  it("gives each used layer by index and name, its keys row by row", () => {
    const described = describe(
      image([{ occupied: true, name: "Base" }, { occupied: true, name: "" }, { occupied: false, name: "" }]),
      { id: "glove80", cols: 2 },
    );
    expect(described).toMatchObject({
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

  it("gives the board as the registry knows it: its groups, keys, capabilities and extras", () => {
    const board = describe(image([]), {
      id: "glove80", name: "Glove80", cols: 2, keyCount: 80, groups: GLOVE80_KEY_GROUPS, capabilities: ["behaviors.morse", "pointing"],
    }).board;
    expect(board).toMatchObject({ id: "glove80", name: "Glove80", keys: 80, capabilities: ["behaviors.morse", "pointing"], extras: ["pointing"] });
    expect(board.groups.home_row?.[0]).toEqual({ row: 3, col: 1, hand: "left", finger: "pinky" });
  });

  it("gives a board the registry does not know no groups, and its matrix as its key count", () => {
    expect(describe(image([]), { id: null, cols: 2 }).board).toEqual({ id: null, name: "Keyboard", keys: 4, groups: {}, capabilities: [], extras: [] });
  });

  it("gives the timing profiles by name and counts the combos", () => {
    const timing = { hold_timeout_ms: 180 } as never;
    const described = describe({ ...image([]), morseProfiles: [null, { index: 1, name: "HRM_index_v1_TK", profile: timing }] }, { id: null, cols: 2 });
    expect(described.profiles).toEqual([{ index: 1, name: "HRM_index_v1_TK", timing }]);
    expect(described.combo_count).toBe(0);
  });

  it("keeps every layer when the firmware keeps no layer metadata", () => {
    expect(describe(image([]), { id: null, cols: 4 }).layers.map(({ index }) => index)).toEqual([0, 1, 2]);
  });

  it("is plain JSON: it survives a round trip unchanged", () => {
    const described = describe(image([]), { id: null, cols: 4 });
    expect(JSON.parse(JSON.stringify(described))).toEqual(described);
  });
});
