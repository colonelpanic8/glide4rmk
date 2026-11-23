import { withTestWorkbench } from "../test/harness";
import { describe, expect, it, vi } from "vitest";
import { storedSegmentsOf } from "../session/mock/board";
import { glove80Board } from "../session/mock/glove80";
import type { RynkSession } from "../session/types";
import { type WorkbenchIo } from "./io";
import type { WorkbenchState } from "../model/workbench-state";
import { draftOf } from "./draft/want";

/** A simulated Glove80 in Live (or in Draft) with the io the workbench uses. */
async function withLayers(
  check: (session: RynkSession, io: WorkbenchIo, state: () => WorkbenchState) => Promise<void>,
  painted = false,
  draft = false,
) {
  const board = {
    ...glove80Board,
    defaultLayers: glove80Board.defaultLayers.map((layer) => layer.map(() => "No" as const)),
    initialDefaultLayer: 0,
    seedCombos: [], seedMorse: [], seedForks: [],
    seedScenes: painted ? [{ layer: 1, led_id: 4, effect: { Solid: { color: { r: 1, g: 2, b: 3 } } } }] : [],
    compiledScenes: [], conditionalScenes: [], seedRuntimeConditionalScenes: [],
  };
  await withTestWorkbench(board, { mode: draft ? "draft" : "live" }, ({ session, io, state }) => check(session, io, state));
}

describe("layer transaction preflight", () => {
  it("rejects deleting painted lighting without writing a rollback snapshot", async () => {
    await withLayers(async (session, io) => {
      const write = vi.spyOn(session.keymap, "setRows");
      const rename = vi.spyOn(session.keymap, "setLayerMetadata");
      expect(await io.deleteLayer(1)).toEqual({
        ok: false, message: "Lower still has painted lighting; clear it first",
      });
      expect(write).not.toHaveBeenCalled();
      expect(rename).not.toHaveBeenCalled();
    }, true);
  });

  it("still restores the original snapshot when a write fails after preflight", async () => {
    await withLayers(async (session, io) => {
      const before = await session.keymap.readAll();
      const everything = vi.spyOn(session.keymap, "replaceAll");
      vi.spyOn(session.keymap, "setLayerMetadata").mockRejectedValueOnce(new Error("flash failed"));
      expect(await io.deleteLayer(1)).toEqual({ ok: false, message: "flash failed; nothing was changed" });
      expect(everything).not.toHaveBeenCalled(); // only what changes is written, and written back (ADR 0012)
      expect(await session.keymap.readAll()).toEqual(before);
      expect((await session.keymap.getLayerMetadata(1)).name).toBe("Lower");
    });
  });

  it("stores only the rows whose keys move, not the whole keymap", async () => {
    await withLayers(async (session, io) => {
      const letter = { Single: { Key: { Hid: "A" } } } as const;
      for (const col of [0, 1, 2]) await session.keymap.setKey(1, 0, col, letter as never);
      const before = storedSegmentsOf(session);
      expect(await io.moveLayer(1, 2)).toEqual({ ok: true });
      expect(storedSegmentsOf(session) - before).toBe(2); // the keys leave one row of layer 1 and arrive on one row of layer 2
    });
  });
});

describe("a layer operation in Draft", () => {
  it("rewrites what you want, writes nothing, and Send stores only what differs", async () => {
    await withLayers(async (session, io, state) => {
      const letter = { Single: { Key: { Hid: "A" } } } as const;
      for (const col of [0, 1, 2]) await io.setKey(1, 0, col, letter as never);
      const names = state().layerMetadata!.map((slot) => slot.name);
      const before = storedSegmentsOf(session);
      const rename = vi.spyOn(session.keymap, "setLayerMetadata");
      // The drafted keys move with their layer.
      expect(await io.moveLayer(1, 2)).toEqual({ ok: true });
      expect(storedSegmentsOf(session)).toBe(before);
      expect(rename).not.toHaveBeenCalled();
      expect(state().layerMetadata!.slice(1, 3).map((slot) => slot.name)).toEqual([names[2], names[1]]);
      expect(state().layers[2].slice(0, 3)).toEqual([letter, letter, letter]);
      expect(await io.applyBatch()).toEqual({ ok: true });
      expect(storedSegmentsOf(session) - before).toBe(1); // one row of layer 2: layer 1 never held them on the keyboard
      expect((await session.keymap.getLayerMetadata(2)).name).toBe(names[1]);
      expect(draftOf(state()).changes).toEqual([]);
    }, false, true);
  });

  it("names, macros and settings wait in the draft until Send", async () => {
    await withLayers(async (session, io, state) => {
      expect(await io.renameLayer(1, "Nav")).toEqual({ ok: true });
      io.setDefaultLayer(2);
      expect((await session.keymap.getLayerMetadata(1)).name).not.toBe("Nav");
      expect(draftOf(state()).changes.map(({ item }) => item.kind)).toEqual(["layerMetadata", "defaultLayer"]);
      expect(await io.applyBatch()).toEqual({ ok: true });
      expect((await session.keymap.getLayerMetadata(1)).name).toBe("Nav");
      expect((await session.keymap.layerState()).defaultLayer).toBe(2);
      expect(draftOf(state()).changes).toEqual([]);
    }, false, true);
  });
});

describe("renaming a layer in Live", () => {
  it("is the rename_layer operation: one change through Send's path, read back, and one Undo step", async () => {
    await withLayers(async (session, io, state) => {
      const before = (await session.keymap.getLayerMetadata(1)).name;
      expect(await io.renameLayer(1, "Nav")).toEqual({ ok: true });
      expect((await session.keymap.getLayerMetadata(1)).name).toBe("Nav");
      expect(state().layerMetadata![1].name).toBe("Nav");
      expect(draftOf(state()).changes).toEqual([]);
      expect(state().history.past.at(-1)?.changes.map(({ item }) => item.kind)).toEqual(["layerMetadata"]);
      expect(await io.travel("undo")).toEqual({ ok: true });
      expect((await session.keymap.getLayerMetadata(1)).name).toBe(before);
    });
  });

  it("refuses a taken name and writes nothing", async () => {
    await withLayers(async (session, io, state) => {
      const taken = state().layerMetadata![2].name;
      const write = vi.spyOn(session.keymap, "setLayerMetadata");
      expect(await io.renameLayer(1, taken)).toEqual({ ok: false, message: `there is a layer called ${taken} already` });
      expect(write).not.toHaveBeenCalled();
    });
  });
});
