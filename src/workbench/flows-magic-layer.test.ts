// The shipped "MoErgo Magic layer" Flow (ADR 0035), run for real: on the plain
// Glove80 it gives MoErgo's default Glove80 Magic layer with its lights (the
// golden file, the maintenance lock on Z); on the Go60's factory layout, the
// Go60's indicator layout one row up, with the locks on the left thumbs.

import { beforeAll, describe, expect, it } from "vitest";
import type { Flow } from "../operations/flows";
import { flowNotFor } from "../operations/flows";
import { withTestWorkbench } from "../test/harness";
import type { WorkbenchState } from "../model/workbench-state";
import { maskHasLayer } from "../model/lighting/wake-layers";
import { draftOf, wantOf } from "./draft/want";
import { shippedFlows } from "./flow-catalog";

let flow: Flow;
beforeAll(async () => {
  const { flows, problems } = await shippedFlows();
  expect(problems).toEqual([]);
  flow = flows.find(({ uid }) => uid === "moergo_magic_layer")!;
});

/** A layer as a layout file keeps it: its keys, its scene, the rules watching it, whether it wakes the lights. */
function magicOf(state: WorkbenchState, layer: number) {
  const want = wantOf(state);
  return {
    keys: want.layers[layer],
    scene: want.scenes.filter((cell) => cell.layer === layer).sort((a, b) => a.led_id - b.led_id),
    rules: want.runtimeConditionalScenes.filter((rule) => rule.cell.conditions.layer?.layer === layer),
    wakes: maskHasLayer(want.wakeLayers, layer),
  };
}

/** What `led` shows under each kind of condition, read from the rules. */
const conditionsOn = (state: WorkbenchState, layer: number, led: number) =>
  wantOf(state).runtimeConditionalScenes
    .filter((rule) => rule.cell.conditions.layer?.layer === layer && rule.cell.led_id === led)
    .map((rule) =>
      rule.indicators ? "lock" : rule.cell.conditions.battery ? `battery ${rule.cell.conditions.battery.node}` : rule.connection ? "connection" : rule.maintenance ? "maintenance" : rule.layers ? "layer" : "this layer",
    );

describe("MoErgo Magic layer on the Glove80", () => {
  it("gives MoErgo's default Magic layer with its lights, as one step", async () => {
    let golden: ReturnType<typeof magicOf> | undefined;
    await withTestWorkbench({ fixture: "glove80-magic" }, { mode: "draft" }, async ({ state }) => {
      golden = magicOf(state(), 2);
    });
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ io, state, flows }) => {
      const run = await io.runFlow(flow, { layer: "auto" }, flows);
      expect(run).toMatchObject({ ok: true, message: expect.stringContaining("Glove80's Magic layer") });
      expect(magicOf(state(), 2)).toEqual(golden);
      expect(state().history.past).toHaveLength(1);
      expect(draftOf(state()).changes.length).toBeGreaterThan(0);
    });
  });

  it("puts the maintenance lock on Z, so the left battery's 80% segment on R shows the battery", async () => {
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ io, state, flows }) => {
      await io.runFlow(flow, { layer: "auto" }, flows);
      expect(state().layers[2][4 * 14 + 1]).toEqual({ Single: { KeyboardControl: "MaintenanceModeToggle" } });
      expect(state().layers[2][2 * 14 + 4]).toEqual({ Single: { Light: "BacklightUp" } });
      expect(conditionsOn(state(), 2, 32)).toEqual(["maintenance", "maintenance"]);
      expect(new Set(conditionsOn(state(), 2, 12))).toEqual(new Set(["battery 0"]));
    });
  });
});

describe("MoErgo Magic layer on the Go60", () => {
  it("gives the Magic layer of MoErgo's default Go60 layout with its lights, as GLIDE4RMK saves it", async () => {
    let golden: ReturnType<typeof magicOf> | undefined;
    await withTestWorkbench({ fixture: "go60-magic" }, { mode: "draft" }, async ({ state }) => {
      golden = magicOf(state(), 3);
    });
    await withTestWorkbench({ fixture: "go60" }, { mode: "draft" }, async ({ io, state, flows }) => {
      expect(await io.runFlow(flow, { layer: "auto" }, flows)).toMatchObject({ ok: true });
      expect(magicOf(state(), 3)).toEqual(golden);
    });
  });

  it("lights MoErgo's Go60 indicator layout on its Magic layer, layer 4", async () => {
    await withTestWorkbench({ fixture: "go60" }, { mode: "draft" }, async ({ io, state, flows }) => {
      const before = state().layers[3];
      const run = await io.runFlow(flow, { layer: "auto" }, flows);
      expect(run).toMatchObject({ ok: true, message: expect.stringContaining("Go60's Magic layer") });
      const at = (row: number, col: number) => row * 14 + col;
      const after = state().layers[3];
      // The factory keys stay; R and its neighbours become Backlight's, Z the maintenance lock,
      // and B, MoErgo's fourth profile, is unbound: the Go60's RMK firmware has three.
      const changed = after.flatMap((action, offset) => (JSON.stringify(action) === JSON.stringify(before[offset]) ? [] : [offset]));
      expect(changed).toEqual([at(1, 4), at(1, 5), at(2, 4), at(3, 1), at(3, 5)]);
      expect(after[at(3, 5)]).toBe("No");
      expect(after[at(3, 1)]).toEqual({ Single: { KeyboardControl: "MaintenanceModeToggle" } });

      const show = (led: number) => conditionsOn(state(), 3, led);
      // R1: the layers; the Magic layer's own light needs no layer set.
      expect([26, 22, 17, 12].map(show)).toEqual([["layer"], ["layer"], ["layer"], ["this layer"]]);
      // R2, R3: the left and right batteries, C6 to C1.
      for (const led of [27, 23, 18, 13, 8, 4]) expect(new Set(show(led))).toEqual(new Set(["battery 0"]));
      for (const led of [28, 24, 19, 14, 9, 5]) expect(new Set(show(led))).toEqual(new Set(["battery 1"]));
      // R4 C4–C2: Bluetooth 1–3 (the Go60 has three); R5 C4: USB; the left thumbs: the locks; Z: the maintenance lock.
      for (const led of [20, 15, 10, 21]) expect(new Set(show(led))).toEqual(new Set(["connection"]));
      expect(show(6)).toEqual([]);
      for (const led of [0, 1, 2]) expect(show(led)).toEqual(["lock"]);
      expect(show(25)).toEqual(["maintenance", "maintenance"]);
      // R5 C2, output fallback in MoErgo's firmware, has no rule that could show it.
      expect(show(11)).toEqual([]);

      const magic = magicOf(state(), 3);
      expect(magic.scene.map((cell) => cell.led_id)).toEqual(Array.from({ length: 30 }, (_, led) => led));
      expect(magic.wakes).toBe(true);
    });
  });
});

describe("MoErgo Magic layer sent to a Go60", () => {
  it("reaches the keyboard: no light for a Bluetooth profile the Go60's three do not include", async () => {
    await withTestWorkbench({ fixture: "go60" }, { mode: "live" }, async ({ io, state, flows, session }) => {
      expect(await io.runFlow(flow, { layer: "auto" }, flows)).toMatchObject({ ok: true });
      const rules = await session.lighting.conditionalScenes.read();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some((rule) => (rule.connection?.profile ?? rule.connection?.bonded?.slot ?? 0) >= 3)).toBe(false);
      expect(draftOf(state()).changes).toEqual([]);
    });
  });
});

describe("MoErgo Magic layer elsewhere", () => {
  it("is offered on the Glove80 and the Go60 only, and names a layer the layout lacks", async () => {
    expect(flowNotFor(flow, { id: "glove80", cols: 14 }, () => true)).toBeNull();
    expect(flowNotFor(flow, { id: "go60", cols: 14 }, () => true)).toBeNull();
    expect(flowNotFor(flow, { id: null, cols: 12 }, () => true)).toMatch(/^For the glove80 and go60 only/);
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ io, state, flows }) => {
      const before = state().layers;
      expect(await io.runFlow(flow, { layer: "31" }, flows)).toMatchObject({ ok: false, message: expect.stringMatching(/^Layer 32 is not in this layout/) });
      expect(state().layers).toBe(before);
    });
  });
});
