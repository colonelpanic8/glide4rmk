import { describe, expect, it } from "vitest";
import type { Action, Fork, KeyAction, Morse } from "./action-types";
import { copyName, forkDoubleTap, keyForks, keyTiming, withForkDoubleTap } from "./key-behavior";
import { HOLD_PATTERN, TAP_PATTERN } from "./key-slots";
import { DEFAULT_TAP_HOLD_PROFILE } from "./morse";
import { emptyFork, emptyMorseProfile, noModifiers } from "./slots";

const key = (hid: "A" | "CapsLock" | "LShift"): Action => ({ Key: { Hid: hid } });
const stickyShift: Action = { OneShotModifier: { ...noModifiers(), left_shift: true } };
const shiftdance: Morse = {
  actions: [[TAP_PATTERN, stickyShift], [HOLD_PATTERN, key("LShift")]],
  profile: { ...emptyMorseProfile(), hold_timeout_ms: 250, mode: "HoldOnOtherPress" },
};
const capsFork = (trigger: KeyAction): Fork => ({
  ...emptyFork(),
  trigger,
  positive_output: { Single: key("CapsLock") },
  match_any: { ...emptyFork().match_any, modifiers: { ...noModifiers(), left_shift: true, right_shift: true } },
});
const hrm = { index: 3, name: "HRM_index", profile: { ...emptyMorseProfile(), hold_timeout_ms: 200 } };
const tapHold = (profile: number): KeyAction => ({ TapHold: [key("A"), key("LShift"), profile] });

describe("a key's timing", () => {
  it("is a tap-hold's profile, counted over every key that uses it", () => {
    const layers = [[tapHold(3), tapHold(3)], [tapHold(3)]];
    expect(keyTiming(tapHold(3), { layers, morse: [], morseProfiles: [hrm] })).toEqual({
      source: { kind: "profile", index: 3, name: "HRM_index" },
      profile: hrm.profile,
      users: 3,
    });
  });

  it("is the keyboard's default for a tap-hold without a profile of its own", () => {
    const timing = keyTiming(tapHold(DEFAULT_TAP_HOLD_PROFILE), { layers: [], morse: [], morseProfiles: [hrm] });
    expect(timing?.source).toEqual({ kind: "default" });
  });

  it("is a morse entry's own timing, shared by the keys bound to it", () => {
    const layers = [[{ Morse: 0 }, { Morse: 0 }]] as KeyAction[][];
    expect(keyTiming({ Morse: 0 }, { layers, morse: [shiftdance], morseProfiles: [] })).toEqual({
      source: { kind: "morse", index: 0 },
      profile: shiftdance.profile,
      users: 2,
    });
  });

  it("is none for a plain key", () => {
    expect(keyTiming({ Single: key("A") }, { layers: [], morse: [], morseProfiles: [] })).toBeNull();
  });
});

describe("a fork-made double tap", () => {
  it("is the fork that turns a sticky Shift's second press into Caps Lock (TailorKey's shiftdance)", () => {
    const forks = [emptyFork(), capsFork({ Morse: 0 })];
    expect(keyForks({ Morse: 0 }, forks)).toEqual([1]);
    expect(forkDoubleTap({ Morse: 0 }, stickyShift, forks)).toEqual({ fork: 1, action: key("CapsLock") });
  });

  it("needs a sticky modifier the fork listens for", () => {
    const forks = [capsFork({ Morse: 0 })];
    expect(forkDoubleTap({ Morse: 0 }, key("A"), forks)).toBeNull();
    const stickyCtrl: Action = { OneShotModifier: { ...noModifiers(), left_ctrl: true } };
    expect(forkDoubleTap({ Morse: 0 }, stickyCtrl, forks)).toBeNull();
  });

  it("belongs to the key the fork fires on only", () => {
    expect(forkDoubleTap({ Morse: 1 }, stickyShift, [capsFork({ Morse: 0 })])).toBeNull();
  });

  it("changes by giving the fork another output", () => {
    expect(withForkDoubleTap(capsFork({ Morse: 0 }), key("A")).positive_output).toEqual({ Single: key("A") });
  });
});

describe("the name of a key's own timing", () => {
  it("is the original's name and the key's place", () => {
    expect(copyName("HRM_index_v1_TK", "LH-C4R3", [])).toBe("HRM_index_v1_TK_LH_C4R3");
    expect(copyName("", "r3c4", [])).toBe("Timing_r3c4");
  });

  it("fits the keyboard's 32 characters, keeping the key's place", () => {
    const name = copyName("a_very_long_profile_name_for_thumbs", "RH-T1", []);
    expect(name.length).toBeLessThanOrEqual(32);
    expect(name.endsWith("_RH_T1")).toBe(true);
  });

  it("is free among the names already taken", () => {
    expect(copyName("shiftdance_v1_TK", "LH-T1", ["shiftdance_v1_TK_LH_T1"])).toBe("shiftdance_v1_TK_LH_T1_2");
  });
});
