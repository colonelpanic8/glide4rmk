// The shipped "Glove80 status cluster" Flow, run for real on the plain Glove80:
// the four keys switch to their connection and light by its state, and each
// half gets its battery bar, as one change.

import { beforeAll, describe, expect, it } from "vitest";
import type { Flow } from "../operations/flows";
import { flowNotFor } from "../operations/flows";
import { withTestWorkbench } from "../test/harness";
import { batteryBarRules, connectionKeyAction } from "../model/lighting/status-presets";
import { statusLightOf } from "../model/lighting/status-light";
import { draftOf } from "./draft/want";
import { shippedFlows } from "./flow-catalog";

let flow: Flow;
beforeAll(async () => {
  const { flows, problems } = await shippedFlows();
  expect(problems).toEqual([]);
  flow = flows.find(({ uid }) => uid === "glove80_status_cluster")!;
});

const at = (row: number, col: number) => row * 14 + col;

describe("Glove80 status cluster", () => {
  it("binds and lights the connection keys and both battery bars, as one step", async () => {
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ io, state, flows }) => {
      const run = await io.runFlow(flow, { layer: "2", bars: "outer-columns" }, flows);
      expect(run).toMatchObject({ ok: true, message: expect.stringContaining("outer-column battery bars") });
      const layer = state().layers[2];
      expect(layer[at(3, 6)]).toEqual(connectionKeyAction({ type: "ble", slot: 0 }));
      expect(layer[at(4, 6)]).toEqual(connectionKeyAction({ type: "ble", slot: 1 }));
      expect(layer[at(5, 6)]).toEqual(connectionKeyAction({ type: "ble", slot: 2 }));
      expect(layer[at(0, 6)]).toEqual(connectionKeyAction({ type: "usb" }));
      const rules = state().runtimeConditionalDraft;
      expect(statusLightOf(rules, 2, 3)).toEqual({ kind: "bluetooth", profile: 0 });
      expect(statusLightOf(rules, 2, 5)).toEqual({ kind: "bluetooth", profile: 2 });
      expect(statusLightOf(rules, 2, 0)).toEqual({ kind: "usb" });
      for (const bar of [{ layer: 2, node: 0, leds: [39, 38, 37, 36, 35] }, { layer: 2, node: 1, leds: [79, 78, 77, 76, 75] }]) {
        expect(rules).toEqual(expect.arrayContaining(batteryBarRules(bar)));
      }
      expect(state().history.past).toHaveLength(1);
      expect(draftOf(state()).changes.map(({ item }) => item.kind)).toContain("rules");
    });
  });

  it("puts MoErgo's bars across the left half, and running it again changes nothing more", async () => {
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ io, state, flows }) => {
      await io.runFlow(flow, { layer: "2", bars: "stock" }, flows);
      const rules = state().runtimeConditionalDraft;
      expect(rules).toEqual(expect.arrayContaining(batteryBarRules({ layer: 2, node: 1, leds: [37, 31, 25, 19, 13, 8], style: "stock" })));
      expect(await io.runFlow(flow, { layer: "2", bars: "stock" }, flows)).toMatchObject({ ok: true });
      expect(state().runtimeConditionalDraft).toEqual(rules);
    });
  });

  it("names a layer the layout does not have, and is for the Glove80 only", async () => {
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ io, state, flows }) => {
      const before = state().layers;
      expect(await io.runFlow(flow, { layer: "31", bars: "stock" }, flows)).toMatchObject({ ok: false, message: expect.stringMatching(/^Layer 32 is not in this layout/) });
      expect(state().layers).toBe(before);
    });
    expect(flowNotFor(flow, { id: "go60", cols: 14 }, () => true)).toBe("For the glove80 only.");
  });
});
