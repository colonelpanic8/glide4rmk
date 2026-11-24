// The lighting operations as the workbench applies them (ADR 0019): what a
// change for several keys, or clearing a layer, leaves in the draft and on the
// keyboard, and that Undo takes it back whole.

import { withTestWorkbench } from "../test/harness";
import { describe, expect, it, vi } from "vitest";
import { glove80Board } from "../session/mock/glove80";
import type { WorkbenchState } from "../model/workbench-state";
import type { RynkSession } from "../session/types";
import { statusLightOf } from "../model/lighting/status-light";
import { DEFAULT_TIMING } from "../model/lighting/effect";
import type { KeyLight } from "../model/lighting/key-light";
import { ledNodesOf } from "./apply";
import { draftOf } from "./draft/want";
import { type WorkbenchIo } from "./io";
import { lightingDraftFor } from "./lighting-drafts";

const RED = { r: 255, g: 0, b: 0 };
const red: KeyLight = { kind: "color", color: RED, effect: "Solid", timing: DEFAULT_TIMING };

/** A simulated Glove80 with no lights stored, in Draft or Live. */
async function onBoard(draft: boolean, check: (io: WorkbenchIo, state: () => WorkbenchState, session: RynkSession) => Promise<void>) {
  await withTestWorkbench({ ...glove80Board, seedScenes: [] }, { mode: draft ? "draft" : "live", io: (bundle) => ({ ledNodes: ledNodesOf(bundle) }) },
    ({ io, state, session }) => check(io, state, session));
}

const inDraft = (check: Parameters<typeof onBoard>[1]) => onBoard(true, check);

describe("a light for several keys", () => {
  it("is one change of the layer's lighting and one Undo step", async () => {
    await inDraft(async (io, state) => {
      expect(await io.apply("set_key_light", { layer: 1, leds: [3, 4, 5], light: red })).toEqual({ ok: true });
      expect(Object.keys(lightingDraftFor(state(), 1)).map(Number)).toEqual([3, 4, 5]);
      expect(draftOf(state()).changes.map((change) => change.item)).toEqual([{ kind: "lighting", layer: 1 }]);
      expect(state().history.past).toHaveLength(1);
      expect(await io.travel("undo")).toEqual({ ok: true });
      expect(lightingDraftFor(state(), 1)).toEqual({});
      expect(draftOf(state()).changes).toEqual([]);
    });
  });

  it("puts a status light for keys on both halves in the rules, each watching its own half", async () => {
    await inDraft(async (io, state) => {
      const battery: KeyLight = { kind: "battery", level: 40, below: RED, above: { r: 0, g: 255, b: 0 } };
      // LED 3 is on the left half, LED 43 on the right.
      expect(await io.apply("set_key_light", { layer: 1, leds: [3, 43], light: battery })).toEqual({ ok: true });
      const before = new Set(state().runtimeConditionalScenes);
      const nodes = state().runtimeConditionalDraft.filter((rule) => !before.has(rule)).map((rule) => [rule.cell.led_id, rule.cell.conditions.battery?.node]);
      expect(nodes).toEqual([[3, 0], [3, 0], [43, 1], [43, 1]]);
      expect(state().history.past).toHaveLength(1);
    });
  });
});

describe("clearing a layer's lights", () => {
  const lock: KeyLight = { kind: "lock", lock: "caps_lock", on: RED, off: null };

  it("in Draft: one step that Undo takes back, colours and status lights alike", async () => {
    await inDraft(async (io, state) => {
      await io.apply("set_key_light", { layer: 1, leds: [3, 4], light: red });
      await io.apply("set_key_light", { layer: 1, leds: [5], light: lock });
      await io.apply("set_key_light", { layer: 3, leds: [3], light: red });
      const rules = state().runtimeConditionalDraft;

      expect(await io.apply("clear_layer_lights", { layer: 1 })).toEqual({ ok: true });
      expect(lightingDraftFor(state(), 1)).toEqual({});
      expect(statusLightOf(state().runtimeConditionalDraft, 1, 5)).toBeNull();
      expect(Object.keys(lightingDraftFor(state(), 3))).toEqual(["3"]);
      expect(state().history.past).toHaveLength(4);

      expect(await io.travel("undo")).toEqual({ ok: true });
      expect(Object.keys(lightingDraftFor(state(), 1))).toEqual(["3", "4"]);
      expect(state().runtimeConditionalDraft).toEqual(rules);
    });
  });

  it("in Live: the keyboard's scene and rule tables follow at once", async () => {
    await onBoard(false, async (io, state, session) => {
      const seeded = await session.lighting.conditionalScenes.read();
      await io.apply("set_key_light", { layer: 1, leds: [3, 4], light: red });
      await io.apply("set_key_light", { layer: 1, leds: [5], light: lock });
      expect(await session.lighting.scenes.readScenes()).toHaveLength(2);

      expect(await io.apply("clear_layer_lights", { layer: 1 })).toEqual({ ok: true });
      expect(await session.lighting.scenes.readScenes()).toEqual([]);
      expect(await session.lighting.conditionalScenes.read()).toEqual(seeded);
      expect(draftOf(state()).changes).toEqual([]);
    });
  });
});

describe("a status setup on keys picked on the board", () => {
  it("binds the connection key and lights it as one step, which Undo takes back whole", async () => {
    await inDraft(async (io, state) => {
      const rules = state().runtimeConditionalDraft;
      const bound = state().layers[1][0];
      expect(await io.apply("set_connection_key", { layer: 1, row: 0, col: 0, led: 3, kind: { type: "usb" } })).toEqual({ ok: true });
      expect(state().layers[1][0]).toEqual({ Single: { KeyboardControl: "OutputUsb" } });
      expect(statusLightOf(state().runtimeConditionalDraft, 1, 3)).toEqual({ kind: "usb" });
      expect(draftOf(state()).changes.map((change) => change.item.kind).sort()).toEqual(["key", "rules"]);
      expect(state().history.past).toHaveLength(1);

      expect(await io.travel("undo")).toEqual({ ok: true });
      expect(state().layers[1][0]).toEqual(bound);
      expect(state().runtimeConditionalDraft).toEqual(rules);
    });
  });

  it("in Live: when the rules cannot be written after the key, the key goes back and nothing is changed", async () => {
    await onBoard(false, async (io, state, session) => {
      const bound = (await session.keymap.readAll())[1].actions[0];
      const rules = await session.lighting.conditionalScenes.read();
      // The planner writes keys before rules: the key reaches the keyboard, then the rule table fails.
      const keys = vi.spyOn(session.keymap, "setRows");
      const replace = vi.spyOn(session.lighting.conditionalScenes, "replace").mockRejectedValueOnce(new Error("flash failed"));

      const result = await io.apply("set_connection_key", { layer: 1, row: 0, col: 0, led: 3, kind: { type: "usb" } });
      expect(result).toEqual({ ok: false, message: "The lighting rules (14) did not reach the keyboard: flash failed; nothing was changed" });
      expect(keys.mock.invocationCallOrder[0]).toBeLessThan(replace.mock.invocationCallOrder[0]);
      expect((await session.keymap.readAll())[1].actions[0]).toEqual(bound);
      expect(await session.lighting.conditionalScenes.read()).toEqual(rules);
      expect(state().layers[1][0]).toEqual(bound);
      expect(draftOf(state()).changes).toEqual([]);
    });
  });
});
