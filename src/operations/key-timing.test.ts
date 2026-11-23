import { describe, expect, it } from "vitest";
import type { Fork, KeyAction, Morse, MorseProfile } from "../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardImage } from "../sync/image";
import { noLabels, withLabel, type BehaviorLabels } from "../model/behavior-labels";
import { emptyFork, emptyMorse, emptyMorseProfile } from "../model/slots";
import { HOLD_PATTERN, TAP_PATTERN } from "../model/key-slots";
import { runOperation, type OperationFacts, type OperationResult } from ".";

const key = (hid: string) => ({ Key: { Hid: hid } }) as never;
const hrm: MorseProfile = { ...emptyMorseProfile(), hold_timeout_ms: 200 };
const faster: MorseProfile = { ...emptyMorseProfile(), hold_timeout_ms: 150 };
const shiftdance: Morse = { ...emptyMorse(), actions: [[TAP_PATTERN, key("A")], [HOLD_PATTERN, key("LShift")]], profile: hrm };
const homeRowMod: KeyAction = { TapHold: [key("A"), key("LShift"), 0] };
const capsFork: Fork = { ...emptyFork(), trigger: { Morse: 0 }, positive_output: { Single: key("CapsLock") } };

/** One layer: two home-row mods on profile 0, two keys on tap pattern 0 (with a fork on it). */
function image(): KeyboardImage {
  return {
    metadata: [],
    layers: [[homeRowMod, homeRowMod, { Morse: 0 }, { Morse: 0 }]],
    encoders: [[]],
    defaultLayer: 0,
    combos: [],
    morse: [shiftdance, emptyMorse(), emptyMorse()],
    forks: [capsFork, emptyFork(), emptyFork()],
    macroOps: [],
    behaviorOptions: null,
    autoMouseLayers: [],
    scenes: [],
    runtimeConditionalScenes: [],
    wakeLayers: 0,
    pointing: null,
    morseProfiles: [{ index: 0, name: "HRM_index", profile: hrm }, null],
    holdTriggerPositions: [],
  };
}

const labels: BehaviorLabels = withLabel(withLabel(noLabels(), "morse", 0, { name: "shiftdance", description: "" }), "forks", 0, { name: "caps", description: "" });
const facts: OperationFacts = {
  cols: 4,
  sceneCapacity: null,
  ruleCapacity: null,
  activeLayers: [],
  compiledScenes: [],
  compiledRules: [],
  ledNodes: {},
  labels,
  macroSpace: { slots: 0, bytes: 0 },
};
const ok = (result: OperationResult) => {
  if (!result.ok) throw new Error(result.message);
  return result;
};
const retime = (col: number, only_this_key: boolean, on = image()) =>
  runOperation("set_key_timing", on, { layer: 0, row: 0, col, timing: faster, only_this_key, key_name: "LH-C2R3" }, facts);

describe("a key's own timing", () => {
  it("is a copy of its profile, named after it and the key, and the key uses it", () => {
    const result = ok(retime(1, true));
    expect(result.image.morseProfiles?.[1]).toEqual({ index: 1, name: "HRM_index_LH_C2R3", profile: faster });
    expect(result.image.layers[0]).toEqual([homeRowMod, { TapHold: [key("A"), key("LShift"), 1] }, { Morse: 0 }, { Morse: 0 }]);
    expect(result.image.morseProfiles?.[0]?.profile).toEqual(hrm);
  });

  it("is a copy of its tap pattern, with the forks on the key copied so it keeps its double tap", () => {
    const result = ok(retime(3, true));
    expect(result.image.morse[1]).toEqual({ ...shiftdance, profile: faster });
    expect(result.labels?.morse[1].name).toBe("shiftdance_LH_C2R3");
    expect(result.image.forks[1]).toEqual({ ...capsFork, trigger: { Morse: 1 } });
    expect(result.labels?.forks[1].name).toBe("caps_LH_C2R3");
    expect(result.image.layers[0][3]).toEqual({ Morse: 1 });
    expect(result.image.layers[0][2]).toEqual({ Morse: 0 });
    expect(result.image.forks[0]).toEqual(capsFork);
  });

  it("says so when there is no free slot for the copy", () => {
    const full = { ...image(), morseProfiles: [image().morseProfiles![0]] };
    expect(retime(1, true, full).ok).toBe(false);
  });
});

describe("a shared timing", () => {
  it("changes for every key that uses it", () => {
    const result = ok(retime(0, false));
    expect(result.image.morseProfiles?.[0]).toEqual({ index: 0, name: "HRM_index", profile: faster });
    expect(result.image.layers).toEqual(image().layers);
  });

  it("changes in the tap pattern itself", () => {
    expect(ok(retime(2, false)).image.morse[0].profile).toEqual(faster);
  });
});

it("refuses a key without tap-hold timing", () => {
  const plain = { ...image(), layers: [[{ Single: key("A") }, "No", "No", "No"] as KeyAction[]] };
  expect(retime(0, true, plain)).toEqual({ ok: false, message: "This key has no tap-hold timing" });
});
