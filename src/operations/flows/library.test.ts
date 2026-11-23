// The jq library in front of every Flow script (ADR 0027), run by real jq.

import { describe, expect, it } from "vitest";
import { nodeJq } from "../../test/jq";
import { GO60_KEY_GROUPS } from "../../model/boards/key-groups";
import { flowProgram } from "./library";

const view = {
  keyboard: "go60",
  board: { id: "go60", name: "Go60", keys: 60, groups: GO60_KEY_GROUPS, capabilities: [], extras: [] },
  rows: 5,
  cols: 14,
  default_layer: 0,
  layers: [{ index: 0, name: "Base", keys: [[], [], [null, { TapHold: [{ Key: { Hid: "A" } }, { Modifier: { left_gui: true } }, 3] }]] }],
  profiles: [{ index: 3, name: "HRM_pinky_v1_TK", timing: {} }],
  combo_count: 0,
};

const run = async (script: string, choices: Record<string, unknown> = {}) => {
  const { program, lineOffset } = flowProgram([], choices, script);
  return nodeJq.run(view, program, { lineOffset, timeoutMs: 1000 });
};

describe("the Flow library", () => {
  it("names the board's key groups and the keys at them, whatever . is", async () => {
    expect(await run('[1, 2] | map(group("home_row")[0])')).toEqual({ ok: true, output: [GO60_KEY_GROUPS.home_row[0], GO60_KEY_GROUPS.home_row[0]] });
    expect(await run('key_at(base_layer; group("home_row")[0]) | [tapped_hid, holds_modifier]')).toEqual({ ok: true, output: ["A", true] });
    expect(await run('[has_group("home_row"), has_group("function"), has_profile("HRM_pinky_v1_TK"), (layer_named("Nav") == null)]')).toEqual({ ok: true, output: [true, false, true, true] });
  });

  it("writes actions and operations as GLIDE4RMK takes them", async () => {
    const out = await run('[tap_hold(key("A"); {Modifier: mods(["left_gui"])}; "HRM_pinky_v1_TK")] | set_keys([{layer: 0, row: 2, col: 1, action: .[0]}])');
    expect(out).toMatchObject({ ok: true, output: { name: "set_keys", input: { keys: [{ action: { TapHold: [{ Key: { Hid: "A" } }, { Modifier: { left_gui: true, left_shift: false } }, "HRM_pinky_v1_TK"] } }] } } });
  });

  it("lets a script's own definition win", async () => {
    expect(await run('def key($hid): "mine"; key("A")')).toEqual({ ok: true, output: "mine" });
  });

  it("counts a script's lines from its own first line", async () => {
    expect(await run(".\n| nope_not_defined")).toMatchObject({ ok: false, message: expect.stringMatching(/^Line 2 of the script/) });
  });
});
