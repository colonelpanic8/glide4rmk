import { describe, expect, it } from "vitest";
import { glove80Board } from "../session/mock/glove80";
import { comboIsEmpty } from "../model/combos";
import { withTestWorkbench } from "./harness";
import { key, layout, mo, row } from "./image";

describe("the test workbench", () => {
  it("opens a simulated board in the mode asked, with the real io", async () => {
    await withTestWorkbench(glove80Board, { mode: "live" }, async ({ io, state, session }) => {
      expect(state().batchMode).toBe(false);
      await io.setKey(0, 0, 0, key("F13"));
      expect((await session.keymap.readAll())[0].actions[0]).toEqual(key("F13"));
    });
  });

  it("opens the plain Glove80: three layers, no home-row mods, no combos, no tap dances", async () => {
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ state, flows }) => {
      expect(state().batchMode).toBe(true);
      expect((state().layerMetadata ?? []).filter((layer) => layer.occupied).map((layer) => layer.name)).toEqual(["Base", "Lower", "Upper"]);
      expect(state().layers.flat().some((action) => typeof action === "object" && action !== null && ("TapHold" in action || "Morse" in action))).toBe(false);
      expect(state().combos.every(comboIsEmpty)).toBe(true);
      expect(state().morse.every((morse) => morse.actions.length === 0)).toBe(true);
      expect(flows.board.id).toBe("glove80");
    });
  });

  it("asks the board's real capabilities: the offline Glove80 without pointing or lighting has neither", async () => {
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ capabilities, flows }) => {
      expect(capabilities.has("pointing")).toBe(true);
      expect(capabilities.has("lighting.state")).toBe(true);
      expect(flows.has("behaviors.profiles")).toBe(true);
    });
    await withTestWorkbench({ fixture: "plain", board: { pointing: false, lighting: false } }, { mode: "draft" }, async ({ capabilities, flows }) => {
      expect(capabilities.has("pointing")).toBe(false);
      expect(capabilities.list().some(({ id }) => id.startsWith("lighting."))).toBe(false);
      expect(flows.has("pointing")).toBe(false);
      expect(flows.board.capabilities).not.toContain("pointing");
    });
  });
});

describe("the image builder", () => {
  it("builds named layers, vacant slots and keys from text, and nothing else", () => {
    const image = layout().layer("Base", row("MO(1) A")).layer("Nav", row("__ --")).vacant().build();
    expect(image.metadata).toEqual([{ occupied: true, name: "Base" }, { occupied: true, name: "Nav" }, { occupied: false, name: "" }]);
    expect(image.layers).toEqual([[mo(1), key("A")], ["Transparent", "No"], ["No", "No"]]);
    expect(image.encoders).toEqual([[], [], []]);
    expect([image.combos, image.morse, image.forks, image.scenes]).toEqual([[], [], [], []]);
    expect(image.pointing).toBeNull();
  });

  it("gives each build its own copy", () => {
    const builder = layout().layer("Base", row("A"));
    const first = builder.build();
    first.layers[0][0] = "No";
    expect(builder.build().layers[0][0]).toEqual(key("A"));
  });
});
