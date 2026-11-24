import { describe, expect, it } from "vitest";
import type { BehaviorOptions, KeyAction, MorseProfile } from "../../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardImage } from "../../sync/image";
import { noLabels } from "../../model/behavior-labels";
import type { OperationFacts } from "../types";
import { GO60_KEY_GROUPS } from "../../model/boards/key-groups";
import type { Board } from "../describe";
import {
  bindChoices,
  flowIsElsewhere,
  checkChoices,
  flowNotFor,
  foldCalls,
  formatFlowLog,
  isPlainFlowMessage,
  logLine,
  newFlowLog,
  readableJqError,
  readFlowFile,
  readFlowFiles,
  readFlowOutput,
  type FlowChoice,
} from ".";

const board = (id: string | null): Board => ({ id, cols: 14, keyCount: 60, groups: id ? GO60_KEY_GROUPS : null });
const mode: FlowChoice = { id: "mode", label: "Mode", type: "select", options: ["a", "b"], default: "a" };
const on: FlowChoice = { id: "on", label: "Turn it on", type: "boolean", default: true };
const count: FlowChoice = { id: "count", label: "How many", type: "number", default: 2 };
const name: FlowChoice = { id: "name", label: "Name", type: "text", default: "x" };

describe("choices", () => {
  it("are checked before anything runs, in GLIDE's words", () => {
    expect(checkChoices([mode], { mode: "c" })).toBe('The choice "Mode" has to be one of: a, b. Nothing was changed.');
    expect(checkChoices([on], { on: "yes" })).toBe('The choice "Turn it on" has to be on or off. Nothing was changed.');
    expect(checkChoices([count], { count: "many" })).toBe('The choice "How many" has to be a number. Nothing was changed.');
    expect(checkChoices([mode, on, count, name], { mode: "b", on: false, count: "", name: "anything" })).toBeNull();
  });

  it("are bound before the script as Flows4JSON binds them, a missing one by its default", () => {
    expect(bindChoices([mode, on, count, name], { count: -3, name: 'say "hi"' }, ".")).toEqual({
      program: '"a" as $mode | \ntrue as $on | \n(-3) as $count | \n"say \\"hi\\"" as $name | \n.',
      lineOffset: 4,
    });
  });
});

const flowText = (extra = "", head = 'runs_on = "glide4rmk"\nuid = "my_flow"\ntitle = "My flow"\nscript = "."\n') => head + extra;

describe("a .flows file", () => {
  it("is read with its manifest and choices", () => {
    const read = readFlowFile(
      flowText('[manifest]\nkeyboards = ["glove80"]\nrequires = ["behaviors.morse"]\nicon = "🔠"\n[[param]]\nid = "mode"\nlabel = "Mode"\ntype = "select"\noptions = ["a", "b"]\ndefault = "a"\n'),
      "glove80/my.flows",
    );
    expect(read).toMatchObject({
      ok: true,
      flow: { uid: "my_flow", category: "Utilities", keyboards: ["glove80"], requires: ["behaviors.morse"], icon: "🔠", choices: [mode], file: "glove80/my.flows" },
    });
  });

  it("is refused with a sentence naming it when it breaks a rule", () => {
    const refused = (text: string, file = "shared/x.flows") => {
      const read = readFlowFile(text, file);
      return read.ok ? null : read.message;
    };
    expect(refused('uid = "x_y"\ntitle = "T"\nscript = "."')).toBe('shared/x.flows cannot be used: it is not a GLIDE4RMK Flow (runs_on = "glide4rmk" is missing).');
    expect(refused(flowText("", 'runs_on = "glide4rmk"\nuid = "X"\ntitle = "T"\nscript = "."'))).toMatch(/its uid has to be/);
    expect(refused(flowText("", 'runs_on = "glide4rmk"\nuid = "ab"\ntitle = "T"\nscript = " "'))).toMatch(/its script is empty/);
    expect(refused(flowText('[manifest]\nkeyboards = ["glove80"]\n'), "go60/x.flows")).toMatch(/sits in go60\/ but its keyboards do not list go60/);
    expect(refused(flowText('[manifest]\nneeds_keys = ["home_row", "pinky"]\n'))).toMatch(/its needs_keys have to be key groups: letters, home_row/);
    expect(refused(flowText('[manifest]\nmin_keys = -1\n'))).toMatch(/its min_keys has to be a whole number/);
    expect(refused(flowText(), "other/x.flows")).toMatch(/has to sit in shared\//);
    expect(refused(flowText('[[param]]\nid = "m"\ntype = "select"\noptions = ["a"]\ndefault = "z"\n'))).toMatch(/the default of "m" is not valid/);
    expect(refused(flowText('[[param]]\nid = "my-choice"\ntype = "text"\ndefault = ""\n'))).toMatch(/needs an id that is a jq name/);
    expect(refused("uid = ")).toMatch(/^shared\/x.flows is not valid TOML/);
  });

  it("is left out of a list when broken or when its uid is taken, and named", () => {
    const { flows, problems } = readFlowFiles({ "shared/a.flows": flowText(), "shared/b.flows": flowText(), "shared/c.flows": "nope" });
    expect(flows.map(({ file }) => file)).toEqual(["shared/a.flows"]);
    expect(problems).toHaveLength(2);
  });

  it("is offered when the keyboard is one it names and has what it requires", () => {
    const read = readFlowFile(flowText('[manifest]\nkeyboards = ["glove80", "go60"]\nrequires = ["behaviors.morse"]\n'), "shared/x.flows");
    if (!read.ok) throw new Error(read.message);
    expect(flowNotFor(read.flow, board("glove80"), () => true)).toBeNull();
    expect(flowIsElsewhere(read.flow, null)).toBe(true);
    expect(flowNotFor(read.flow, board(null), () => true)).toBe("For the glove80 and go60 only.");
    expect(flowNotFor(read.flow, board("go60"), () => false)).toBe("Needs what this keyboard does not have: behaviors.morse.");
  });

  it("in a board's own folder is for that board only", () => {
    const read = readFlowFile(flowText(), "go60/x.flows");
    expect(read).toMatchObject({ ok: true, flow: { keyboards: ["go60"] } });
  });

  it("is offered on any board with the key groups and the keys it needs, and says what is missing elsewhere", () => {
    const read = readFlowFile(flowText('[manifest]\nneeds_keys = ["home_row"]\nmin_keys = 30\n'), "shared/x.flows");
    if (!read.ok) throw new Error(read.message);
    expect(read.flow).toMatchObject({ keyboards: null, needsKeys: ["home_row"], minKeys: 30 });
    expect(flowNotFor(read.flow, board("go60"), () => true)).toBeNull();
    expect(flowNotFor(read.flow, { id: null, cols: 12, keyCount: 36, groups: null }, () => true)).toBe("Needs a keyboard that GLIDE4RMK knows the home row of.");
    expect(flowNotFor(read.flow, { ...board("go60"), keyCount: 24 }, () => true)).toBe("Needs a keyboard with at least 30 keys.");
  });
});

const key = (code: string): KeyAction => ({ Single: { Key: { Hid: code } } }) as KeyAction;
const image: KeyboardImage = {
  metadata: [{ occupied: true, name: "A" }, { occupied: true, name: "B" }],
  layers: [[key("A"), key("B")], [key("C"), key("D")]],
  encoders: [[], []],
  defaultLayer: 0,
  combos: [],
  morse: [],
  forks: [],
  behaviorOptions: {
    tri_layer: undefined,
    combo_prior_idle_ms: undefined,
    oneshot_activate_on_keypress: false,
    oneshot_quick_release: false,
    morse_enable_flow_tap: false,
    morse_prior_idle_ms: 0,
    morse_default_profile: {} as MorseProfile,
  } as BehaviorOptions,
  autoMouseLayers: [],
  scenes: [],
  runtimeConditionalScenes: [],
  wakeLayers: 0,
  pointing: null,
};
const facts: OperationFacts = {
  board: null,
  bleProfiles: 4,
  cols: 2, sceneCapacity: null, ruleCapacity: null, activeLayers: [], compiledScenes: [], compiledRules: [], ledNodes: {}, labels: noLabels(), macroSpace: null,
};
const setKey = (layer: number, col: number, code: string) => ({ name: "set_keys", input: { keys: [{ layer, row: 0, col, action: key(code) }] } });

describe("what a script gives back", () => {
  it("is read as calls and a report", () => {
    expect(readFlowOutput({ operations: [setKey(0, 0, "X")], report: { changed: true, message: "Done.", lines: [{ text: "one", ok: false }], log: [3] } })).toEqual({
      ok: true,
      calls: [setKey(0, 0, "X")],
      report: { changed: true, message: "Done.", lines: [{ text: "one", ok: false }], log: ["3"] },
    });
    expect(readFlowOutput({ layers: [] })).toEqual({ ok: false, message: "The script did not give back { operations: [...] }" });
    expect(readFlowOutput({ operations: [{ input: {} }] })).toEqual({ ok: false, message: "Operation 1 has no name" });
  });

  it("runs call after call on the same image", () => {
    const result = foldCalls(image, [setKey(0, 0, "X"), setKey(0, 1, "Y"), setKey(0, 0, "Z")], facts);
    expect(result).toMatchObject({ ok: true, image: { layers: [[key("Z"), key("Y")], image.layers[1]] } });
  });

  it("stops at the first call that fails, naming it", () => {
    expect(foldCalls(image, [setKey(0, 0, "X"), setKey(5, 0, "Y")], facts)).toEqual({ ok: false, message: "Step 2 (set_keys): Layer 5 does not exist" });
    expect(foldCalls(image, [{ name: "format_disk", input: {} }], facts)).toEqual({ ok: false, message: "Step 1: there is no operation called format_disk" });
    expect(foldCalls(image, [{ name: "set_keys", input: {} }], facts)).toEqual({ ok: false, message: "Step 1 (set_keys): set_keys: keys is missing" });
  });

  it("gives two layer moves as one order", () => {
    const moves = [{ name: "move_layer", input: { layer: 0, to: 1 } }, { name: "move_layer", input: { layer: 0, to: 1 } }];
    const result = foldCalls(image, moves, facts);
    expect(result).toMatchObject({ ok: true, layerOrder: [0, 1] });
    expect(foldCalls(image, moves.slice(1), facts)).toMatchObject({ ok: true, layerOrder: [1, 0] });
  });
});

describe("errors and the log", () => {
  it("give jq's compile errors with the line in the Flow's own script", () => {
    const detail = "jq: error: syntax error, unexpected INVALID_CHARACTER (Unix shell quoting issues?) at <top-level>, line 5:\n .a | )\njq: 1 compile error\n";
    expect(readableJqError("1 compile error", detail, 2)).toBe("Line 3 of the script: syntax error, unexpected INVALID_CHARACTER.");
    expect(readableJqError("Cannot iterate over null (null)", "", 0)).toBe("Cannot iterate over null (null)");
  });

  it("keep a Flow's sentence whole, colons and all: jq-web's own message keeps only what follows the last one", () => {
    const detail = "jq: error (at <stdin>:0): Layer 3 is gone: pick another.\n";
    expect(readableJqError("pick another.", detail, 2)).toBe("Layer 3 is gone: pick another.");
    expect(readableJqError("plain.", "jq: error (at <stdin>:0): plain.\n", 0)).toBe("plain.");
    expect(readableJqError("1}", 'jq: error (at <stdin>:0) (not a string): {"x":1}\n', 0)).toBe('{"x":1}');
  });

  it("show a Flow's own sentence as it is, and not jq's complaints", () => {
    expect(isPlainFlowMessage("Your layout has no Base layer, so nothing was changed.")).toBe(true);
    expect(isPlainFlowMessage("Cannot iterate over null (null)")).toBe(false);
    expect(isPlainFlowMessage("jq stopped.")).toBe(false);
  });

  it("keep verbose lines out of the short view", () => {
    const log = newFlowLog({ uid: "u", title: "T", file: "shared/t.flows" }, new Date("2026-11-19T10:00:00Z"));
    logLine(log, "Choice mode = \"a\"", true);
    logLine(log, "Script finished in 3 ms");
    expect(formatFlowLog(log, false)).toBe("Flow: T (u)\nFile: shared/t.flows\nTime: 2026-11-19T10:00:00.000Z\nOutcome: running\n\nScript finished in 3 ms");
    expect(formatFlowLog(log, true)).toContain('  Choice mode = "a"');
  });
});
