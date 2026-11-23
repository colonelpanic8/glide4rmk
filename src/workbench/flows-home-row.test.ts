// The home-row and Autoshift Flows on a real layout, TailorKey for RMK on a
// Glove80 (ADR 0027): they find the home row through the board's key groups,
// name their timing profiles, and add a layer. Real jq, real import.

import { beforeAll, describe, expect, it } from "vitest";
import type { KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import type { WorkbenchState } from "../model/workbench-state";
import { flowProgram, readFlowOutput, type Flow } from "../operations/flows";
import { nodeJq } from "../test/jq";
import { withTailorKey } from "../test/tailorkey";
import { shippedFlows } from "./flow-catalog";

const flows: Record<string, Flow> = {};
beforeAll(async () => {
  const shipped = await shippedFlows();
  expect(shipped.problems).toEqual([]);
  for (const flow of shipped.flows) flows[flow.uid] = flow;
});

const HOME = [1, 2, 3, 4, 9, 10, 11, 12];
const home = (state: WorkbenchState, layer: number) => HOME.map((col) => state.layers[layer][3 * 14 + col]);
const key = (hid: string): KeyAction => ({ Single: { Key: { Hid: hid } } }) as KeyAction;
const profile = (state: WorkbenchState, name: string) => state.morseProfiles.find((entry) => entry.name === name);
const lines = (run: { report: { lines: { text: string }[] } | null }) => run.report?.lines.map(({ text }) => text);

describe("Home-row mods removal, then Home-row mods", () => {
  it("takes them off every layer's home row, and puts them back exactly as TailorKey has them", async () => {
    await withTailorKey(async (io, state, env) => {
      const original = state().layers;
      const removed = await io.runFlow(flows.hrm_remove, {}, env);
      expect(removed).toMatchObject({ ok: true, message: "Home-row mods are gone. Your layers type plain letters again." });
      expect(lines(removed)?.[0]).toBe("Turned 8 home-row mod keys back into plain keys on 1 layer: Base");
      expect(home(state(), 0)).toEqual(["A", "S", "D", "F", "J", "K", "L", "Semicolon"].map(key));
      // The Autoshift layer's keys hold Shift as a key, not a modifier: left alone.
      expect(state().layers[2]).toEqual(original[2]);

      const created = await io.runFlow(flows.hrm_create, { mod_preset: "GACS" }, env);
      expect(created).toMatchObject({ ok: true, message: "Home-row mods are ready on your base layer's home row." });
      expect(lines(created)).toEqual([
        "Put home-row mods on all 8 home-row keys of your base layer",
        "Your layout already had the timing profiles they use, so they were kept",
      ]);
      expect(state().layers).toEqual(original);
      expect(state().history.past).toHaveLength(2);
    });
  });

  it("finds nothing to do on a home row that has them, and swaps pinky and middle for macOS", async () => {
    await withTailorKey(async (io, state, env) => {
      expect(await io.runFlow(flows.hrm_create, { mod_preset: "GACS" }, env)).toMatchObject({
        ok: true,
        message: "Nothing was changed: your home row already has these home-row mods.",
      });
      expect(await io.runFlow(flows.hrm_create, { mod_preset: "CAGS" }, env)).toMatchObject({ ok: true });
      const held = home(state(), 0).map((action) => {
        const hold = typeof action === "object" && "TapHold" in action ? action.TapHold[1] : null;
        const mods = typeof hold === "object" && hold !== null && "Modifier" in hold ? hold.Modifier : {};
        return Object.entries(mods).find(([, on]) => on)?.[0];
      });
      expect(held).toEqual(["left_ctrl", "left_alt", "left_gui", "left_shift", "right_shift", "right_gui", "left_alt", "right_ctrl"]);
    });
  });
});

describe("Home-row mods on a layout without their profiles", () => {
  it("adds the four finger profiles and uses them in the same run", async () => {
    await withTailorKey(async (io, state, env) => {
      await io.runFlow(flows.hrm_remove, {}, env);
      // Rename the profiles away, so the layout no longer has them by name.
      for (const name of ["HRM_index_v1_TK", "HRM_middle_v1_TK", "HRM_ring_v1_TK", "HRM_pinky_v1_TK"]) {
        const slot = profile(state(), name)!.index;
        expect(await io.apply("rename_behavior", { kind: "profiles", slot, name: `old_${name}` })).toMatchObject({ ok: true });
      }
      const run = await io.runFlow(flows.hrm_create, { mod_preset: "GACS" }, env);
      expect(lines(run)?.[1]).toBe("Added 4 timing profiles, one for each finger, that make the bilateral behavior work");
      const pinky = profile(state(), "HRM_pinky_v1_TK")!;
      expect(pinky.profile).toMatchObject({ hold_timeout_ms: 270, quick_tap_timeout_ms: 300, prior_idle_time_ms: 80, unilateral_tap: true, mode: "PermissiveHold" });
      expect((home(state(), 0)[0] as { TapHold: unknown[] }).TapHold[2]).toBe(pinky.index);
    });
  });
});

describe("Home-row mods: best-practice tuning", () => {
  it("sets every finger's timing to the chosen level, and nudges", async () => {
    await withTailorKey(async (io, state, env) => {
      const run = await io.runFlow(flows.hrm_timing, { preset: "3", nudge_ms: 20 }, env);
      expect(run).toMatchObject({ ok: true, message: "Timing updated." });
      expect(lines(run)).toEqual(["Updated the timing of 6 of 6 home-row timing profiles", "Nudged the hold timeout by 20 ms (slower)"]);
      expect(profile(state(), "HRM_index_v1_TK")!.profile).toMatchObject({ hold_timeout_ms: 350, quick_tap_timeout_ms: 450, prior_idle_time_ms: 180, mode: "PermissiveHold", unilateral_tap: true });
      expect(profile(state(), "autoshift_v1_TK")!.profile.hold_timeout_ms).toBe(180);
      expect(state().history.past).toHaveLength(1);
    });
  });
});

describe("Autoshift", () => {
  it("finds nothing to do on TailorKey, and says when there is no room for its layer", async () => {
    await withTailorKey(async (io, _state, env) => {
      expect(await io.runFlow(flows.autoshift, {}, env)).toMatchObject({ ok: true, message: "Nothing was changed: the Autoshift layer already matches your base layer." });
      // Its own Autoshift layer renamed, there is no room for a new one.
      expect(await io.renameLayer(2, "Old Autoshift")).toMatchObject({ ok: true });
      expect(await io.runFlow(flows.autoshift, {}, env)).toMatchObject({
        ok: false,
        message: "Every one of your 9 layers is in use, so there is no room for an Autoshift layer. Delete a layer you do not use, then run this again.",
      });

    });
  });
});

describe("Autoshift on a layout without it", () => {
  it("adds the layer after the Typing layer, then the profile, then the keys, which name the profile", async () => {
    const shift = { left_ctrl: false, left_shift: true, left_alt: false, left_gui: false, right_ctrl: false, right_shift: false, right_alt: false, right_gui: false };
    const keys = (row: KeyAction[]) => [row];
    const view = {
      keyboard: null,
      board: { id: null, name: "Plain 4", keys: 4, groups: {}, capabilities: [], extras: [] },
      rows: 1, cols: 4, default_layer: 0, max_layers: 4, profiles: [], combo_count: 0,
      layers: [
        { index: 0, name: "Base", keys: keys([key("A"), key("Kc1"), key("Space"), { TapHold: [{ Key: { Hid: "F" } }, { Modifier: shift }, 0] } as KeyAction]) },
        { index: 1, name: "Typing", keys: keys(["Transparent", "Transparent", "Transparent", "Transparent"]) },
      ],
    };
    const { program, lineOffset } = flowProgram(flows.autoshift.choices, {}, flows.autoshift.script);
    const ran = await nodeJq.run(view, program, { lineOffset, timeoutMs: 0 });
    const output = readFlowOutput(ran.ok ? ran.output : null);
    if (!output.ok) throw new Error(ran.ok ? output.message : ran.message);
    const autoshift = (hid: string) => ({ TapHold: [{ Key: { Hid: hid } }, { KeyWithModifier: [hid, shift] }, "autoshift_v1_TK"] });
    expect(output.calls).toEqual([
      { name: "add_layer", input: { name: "Autoshift", after: 1 } },
      { name: "set_timing_profile", input: { name: "autoshift_v1_TK", timing: { hold_timeout_ms: 180, quick_tap_timeout_ms: 200, enable_flow_tap: false, mode: "TapUnlessInterrupted" } } },
      { name: "set_keys", input: { keys: [
        { layer: 2, row: 0, col: 0, action: autoshift("A") },
        { layer: 2, row: 0, col: 1, action: autoshift("Kc1") },
        { layer: 2, row: 0, col: 2, action: "Transparent" },
        { layer: 2, row: 0, col: 3, action: autoshift("F") },
      ] } },
    ]);
  });
});
