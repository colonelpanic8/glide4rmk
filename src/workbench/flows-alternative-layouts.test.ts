// The shipped "Different typing layout" Flow on a real layout: TailorKey for
// RMK on a Glove80, with bilateral home-row mods on the base layer, a Typing
// layer without them and an Autoshift layer. Real jq, real import.

import { beforeAll, describe, expect, it } from "vitest";
import type { KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import type { WorkbenchState } from "../model/workbench-state";
import { flowProgram, readFlowOutput, type Flow } from "../operations/flows";
import { nodeJq } from "../test/jq";
import { withTailorKey } from "../test/tailorkey";
import { GO60_KEY_GROUPS } from "../model/boards/key-groups";
import { shippedFlows } from "./flow-catalog";
import { wantOf } from "./draft/want";


let flow: Flow;
beforeAll(async () => {
  const { flows, problems } = await shippedFlows();
  expect(problems).toEqual([]);
  flow = flows.find(({ uid }) => uid === "alt_layout")!;
});

const mods = (...on: string[]) => Object.fromEntries(
  ["left_ctrl", "left_shift", "left_alt", "left_gui", "right_ctrl", "right_shift", "right_alt", "right_gui"].map((name) => [name, on.includes(name)]),
);
const key = (hid: string): KeyAction => ({ Single: { Key: { Hid: hid } } }) as KeyAction;
const homeRowMod = (hid: string, mod: string, profile: number): KeyAction => ({ TapHold: [{ Key: { Hid: hid } }, { Modifier: mods(mod) }, profile] }) as KeyAction;
const autoshift = (hid: string): KeyAction => ({ TapHold: [{ Key: { Hid: hid } }, { KeyWithModifier: [hid, mods("left_shift")] }, 0] }) as KeyAction;
const row = (state: WorkbenchState, layer: number, r: number) => state.layers[layer].slice(r * 14, r * 14 + 14);
const LETTERS = [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13];

describe("Different typing layout on TailorKey for RMK", () => {
  it("retypes the base, Typing and Autoshift layers; home-row mods keep their finger's modifier and timing", async () => {
    await withTailorKey(async (io, state, env) => {
      const before = wantOf(state());
      const run = await io.runFlow(flow, { layout_name: "colemak-dh" }, env);
      expect(run).toMatchObject({ ok: true, message: "Your base layer now types colemak-dh." });
      expect(run.report?.lines.map(({ text }) => text)).toEqual([
        "Retyped 47 keys to colemak-dh on 3 layers: Base, Typing, Autoshift",
        "7 home-row mods kept their modifier and timing; only the letter changed",
        "Thumb keys, shortcuts, combos and layers like Navigation or Gaming were left alone",
      ]);
      const s = state();
      // 20 keys differ from QWERTY on each full letter layer; the Typing layer has only its home row (7).
      // Base home row: Esc, then A R S T G | M N E I O, then Quote. The profiles are by finger:
      // index 1, middle 2, pinky 3, ring 4.
      expect(LETTERS.map((col) => row(s, 0, 3)[col])).toEqual([
        key("Escape"), homeRowMod("A", "left_gui", 3), homeRowMod("R", "left_alt", 4), homeRowMod("S", "left_ctrl", 2), homeRowMod("T", "left_shift", 1), key("G"),
        key("M"), homeRowMod("N", "right_shift", 1), homeRowMod("E", "right_ctrl", 2), homeRowMod("I", "left_alt", 4), homeRowMod("O", "right_gui", 3), key("Quote"),
      ]);
      expect(LETTERS.map((col) => row(s, 0, 2)[col])).toEqual(["Tab", "Q", "W", "F", "P", "B", "J", "L", "U", "Y", "Semicolon", "Backslash"].map(key));
      expect(LETTERS.map((col) => row(s, 0, 4)[col])).toEqual(["Grave", "Z", "X", "C", "D", "V", "K", "H", "Comma", "Dot", "Slash", "PageUp"].map(key));
      // Thumb keys stay: Lower and Cursor layer-taps, Space with its own profile.
      for (const r of [0, 1, 2, 3, 4, 5]) for (const col of [6, 7]) expect(row(s, 0, r)[col]).toEqual(row({ layers: before.layers } as WorkbenchState, 0, r)[col]);
      // Typing: plain letters on the home row; Autoshift: the new key, shifted on hold.
      expect([1, 2, 3, 4, 9, 10, 11, 12].map((col) => row(s, 1, 3)[col])).toEqual(["A", "R", "S", "T", "N", "E", "I", "O"].map(key));
      expect(LETTERS.map((col) => row(s, 2, 2)[col])).toEqual(["Transparent", ...["Q", "W", "F", "P", "B", "J", "L", "U", "Y", "Semicolon"].map(autoshift), autoshift("Backslash")]);
      // Gaming, Cursor (Ctrl+C stays Ctrl+C), Symbol, Mouse, Lower and Magic are as they were.
      for (const layer of [3, 4, 5, 6, 7, 8]) expect(s.layers[layer]).toEqual(before.layers[layer]);
      // One step, and nothing but keys changed.
      expect(s.history.past).toHaveLength(1);
      expect({ ...wantOf(s), layers: before.layers }).toEqual(before);
    });
  });

  it("goes back to QWERTY exactly, and a second run finds nothing to do", async () => {
    await withTailorKey(async (io, state, env) => {
      const original = state().layers;
      await io.runFlow(flow, { layout_name: "colemak-dh" }, env);
      expect(await io.runFlow(flow, { layout_name: "qwerty" }, env)).toMatchObject({ ok: true });
      expect(state().layers).toEqual(original);
      expect(await io.runFlow(flow, { layout_name: "qwerty" }, env)).toMatchObject({
        ok: true,
        message: "Nothing was changed: your letter layers already type qwerty on these keys.",
        log: { outcome: "nothing to do" },
      });
    });
  });

  it("types a shifted key where a layout has one: Engram's double quote", async () => {
    await withTailorKey(async (io, state, env) => {
      expect(await io.runFlow(flow, { layout_name: "engram" }, env)).toMatchObject({ ok: true });
      const quote = { KeyWithModifier: ["Quote", mods("left_shift")] };
      expect(row(state(), 0, 2)[8]).toEqual({ Single: quote });
      expect(row(state(), 2, 2)[8]).toEqual({ TapHold: [quote, quote, 0] });
    });
  });

  it("refuses a keyboard whose letter keys it does not know, changing nothing", async () => {
    await withTailorKey(async (io, state, env) => {
      const before = state().layers;
      expect(await io.runFlow(flow, {}, { ...env, board: { id: null, cols: 14, keyCount: 80, groups: null } })).toMatchObject({
        ok: false,
        message: "Needs a keyboard that GLIDE4RMK knows the letters and home row of.",
      });
      expect(state().layers).toBe(before);
    });
  });
});

describe("Different typing layout on a Go60", () => {
  it("finds the letter keys one row higher than on the Glove80", async () => {
    const qwerty = ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "A", "S", "D", "F", "G", "H", "J", "K", "L", "Semicolon"];
    const keys = Array.from({ length: 5 }, () => Array.from({ length: 14 }, (): KeyAction => "Transparent"));
    [1, 2, 3, 4, 5, 8, 9, 10, 11, 12].forEach((col, i) => { keys[1][col] = key(qwerty[i]); keys[2][col] = key(qwerty[i + 10]); });
    const board = { id: "go60", name: "Go60", keys: 60, groups: GO60_KEY_GROUPS, capabilities: [], extras: [] };
    const view = { keyboard: "go60", board, rows: 5, cols: 14, default_layer: 0, max_layers: 8, profiles: [], combo_count: 0, layers: [{ index: 0, name: "Base", keys }] };
    const { program, lineOffset } = flowProgram(flow.choices, { layout_name: "colemak-dh" }, flow.script);
    const ran = await nodeJq.run(view, program, { lineOffset, timeoutMs: 0 });
    expect(ran.ok).toBe(true);
    const output = readFlowOutput(ran.ok ? ran.output : null);
    if (!output.ok) throw new Error(output.message);
    const set = (output.calls[0].input as { keys: { row: number; col: number; action: KeyAction }[] }).keys;
    const home = Object.fromEntries(set.filter(({ row }) => row === 2).map(({ col, action }) => [col, action]));
    expect(home).toEqual({ 2: key("R"), 3: key("S"), 4: key("T"), 8: key("M"), 9: key("N"), 10: key("E"), 11: key("I"), 12: key("O") });
  });
});
