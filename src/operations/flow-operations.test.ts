// The operations Flows lean on (ADR 0027): a new layer after another, a timing
// profile by name, and keys that name their profile.

import { describe, expect, it } from "vitest";
import type { KeyAction, MorseProfile } from "../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardImage } from "../sync/image";
import { noLabels } from "../model/behavior-labels";
import { emptyMorseProfile, noModifiers } from "../model/slots";
import { runOperation, type OperationFacts, type OperationResult } from ".";

const A = { Single: { Key: { Hid: "A" } } } as KeyAction;
const toLayer = (layer: number) => ({ Single: { LayerOn: layer } }) as KeyAction;
const hrm: MorseProfile = { ...emptyMorseProfile(), hold_timeout_ms: 180, mode: "PermissiveHold" };

/** Three layers in use (Base, Typing, Nav) of five; Base's second key holds Nav. */
function image(): KeyboardImage {
  return {
    metadata: [
      { occupied: true, name: "Base" },
      { occupied: true, name: "Typing" },
      { occupied: true, name: "Nav" },
      { occupied: false, name: "" },
      { occupied: false, name: "" },
    ],
    layers: [[A, toLayer(2)], ["Transparent", "Transparent"], [A, A], ["No", "No"], ["No", "No"]],
    encoders: [[], [], [], [], []],
    defaultLayer: 0,
    combos: [],
    morse: [],
    forks: [],
    macroOps: [],
    behaviorOptions: { combo_timeout_ms: 50 } as never,
    autoMouseLayers: [],
    scenes: [],
    runtimeConditionalScenes: [],
    wakeLayers: 0,
    pointing: null,
    morseProfiles: [{ index: 0, name: "HRM_index_v1_TK", profile: hrm }, null],
    holdTriggerPositions: [],
  };
}

const facts: OperationFacts = {
  board: null,
  bleProfiles: 4,
  cols: 2,
  sceneCapacity: null,
  ruleCapacity: null,
  activeLayers: [],
  compiledScenes: [],
  compiledRules: [],
  ledNodes: {},
  labels: noLabels(),
  macroSpace: { slots: 0, bytes: 0 },
};
const run = (name: Parameters<typeof runOperation>[0], input: unknown, on = image()) => runOperation(name, on, input as never, facts);
const ok = (result: OperationResult) => {
  if (!result.ok) throw new Error(result.message);
  return result;
};

describe("add_layer", () => {
  it("puts an empty layer right after another, and the layers above move up with every key that names them", () => {
    const result = ok(run("add_layer", { name: "Autoshift", after: 1 }));
    expect(result.image.metadata.map(({ name, occupied }) => (occupied ? name : null))).toEqual(["Base", "Typing", "Autoshift", "Nav", null]);
    expect(result.image.layers[2]).toEqual(["Transparent", "Transparent"]);
    expect(result.image.layers[0][1]).toEqual(toLayer(3));
  });

  it("adds it in place when it goes after the last layer", () => {
    expect(ok(run("add_layer", { name: "Mouse", after: 2 })).image.metadata[3]).toEqual({ occupied: true, name: "Mouse" });
  });

  it("refuses a name in use and a keyboard with no free layer", () => {
    expect(run("add_layer", { name: "Nav", after: 0 })).toEqual({ ok: false, message: "there is a layer called Nav already" });
    const full = { ...image(), metadata: image().metadata.map((slot, i) => ({ occupied: true, name: slot.name || `L${i}` })) };
    expect(run("add_layer", { name: "More", after: 0 }, full)).toEqual({ ok: false, message: "every one of the keyboard's 5 layers is in use" });
  });
});

describe("set_timing_profile", () => {
  it("changes the profile with that name, the fields left out back to the keyboard's default", () => {
    const result = ok(run("set_timing_profile", { name: "HRM_index_v1_TK", timing: { hold_timeout_ms: 200 } }));
    expect(result.image.morseProfiles?.[0]).toEqual({ index: 0, name: "HRM_index_v1_TK", profile: { ...emptyMorseProfile(), hold_timeout_ms: 200 } });
  });

  it("adds a profile with a new name in the first free slot", () => {
    const result = ok(run("set_timing_profile", { name: "autoshift_v1_TK", timing: { hold_timeout_ms: 180, mode: "TapUnlessInterrupted" } }));
    expect(result.image.morseProfiles?.[1]).toMatchObject({ index: 1, name: "autoshift_v1_TK", profile: { mode: "TapUnlessInterrupted" } });
  });

  it("names the field a script got wrong", () => {
    expect(run("set_timing_profile", { name: "x", timing: { quick_tap_ms: 200 } })).toMatchObject({ ok: false, message: expect.stringContaining("there is no timing field called quick_tap_ms") });
    expect(run("set_timing_profile", { name: "x", timing: { mode: "permissive-hold" } })).toMatchObject({ ok: false, message: expect.stringContaining("mode has to be one of") });
  });
});

describe("set_keys with a profile by name", () => {
  it("stores the profile's slot, so a Flow can add a profile and use it in one run", () => {
    const shift = { Modifier: { ...noModifiers(), left_shift: true } };
    const named = { TapHold: [{ Key: { Hid: "F" } }, shift, "HRM_index_v1_TK"] };
    const result = ok(run("set_keys", { keys: [{ layer: 0, row: 0, col: 0, action: named }] }));
    expect(result.image.layers[0][0]).toEqual({ TapHold: [{ Key: { Hid: "F" } }, shift, 0] });
  });

  it("names a profile that does not exist", () => {
    const named = { TapHold: [{ Key: { Hid: "F" } }, { Key: { Hid: "LShift" } }, "nope"] };
    expect(run("set_keys", { keys: [{ layer: 0, row: 0, col: 0, action: named }] })).toEqual({ ok: false, message: "there is no timing profile called nope" });
  });
});
