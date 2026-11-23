// A tap-hold timing profile by its name, as a Flow sets one: the profile with
// that name gets this timing, or a new one is made in the first free slot. The
// timing is the whole profile: a field left out follows the keyboard's
// default. Field names and values are checked, so a script that spells one
// wrong is told which. Pure.

import type { MorseMode, MorseProfile } from "../vendor/rynk-wasm/rynk_wasm";
import { emptyMorseProfile } from "../model/slots";
import { createBehavior, setBehavior } from "./behaviors";
import { failed, type Operation } from "./types";

const NUMBERS = ["hold_timeout_ms", "gap_timeout_ms", "quick_tap_timeout_ms", "prior_idle_time_ms"] as const;
const SWITCHES = ["unilateral_tap", "opposite_hand_hold", "enable_flow_tap", "retro_tap", "hold_trigger_on_release"] as const;
const MODES: readonly MorseMode[] = ["PermissiveHold", "HoldOnOtherPress", "Normal", "TapUnlessInterrupted"];

/** The timing as the keyboard stores it, or why it cannot be. */
export function readTiming(raw: unknown): MorseProfile | string {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return "the timing has to be an object";
  const timing = emptyMorseProfile();
  for (const [field, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    if ((NUMBERS as readonly string[]).includes(field)) {
      if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 65535) return `${field} has to be a whole number of milliseconds`;
      timing[field as (typeof NUMBERS)[number]] = value as number;
    } else if ((SWITCHES as readonly string[]).includes(field)) {
      if (typeof value !== "boolean") return `${field} has to be true or false`;
      timing[field as (typeof SWITCHES)[number]] = value;
    } else if (field === "mode") {
      if (!MODES.includes(value as MorseMode)) return `mode has to be one of ${MODES.join(", ")}`;
      timing.mode = value as MorseMode;
    } else {
      return `there is no timing field called ${field} (there are ${[...NUMBERS, ...SWITCHES, "mode"].join(", ")})`;
    }
  }
  return timing;
}

export const setTimingProfile: Operation<{ name: string; timing: unknown }> = {
  name: "set_timing_profile",
  description: "Gives the tap-hold timing profile with this name this timing, or adds one with it in the first free slot.",
  inputs: [
    { name: "name", kind: "string", description: "The profile's name, which tap-hold keys use." },
    { name: "timing", kind: "value", description: "Its timing: hold_timeout_ms, mode … ; a field left out follows the keyboard's default." },
  ],
  run(image, { name, timing }, facts) {
    const value = readTiming(timing);
    if (typeof value === "string") return failed(`${name}: ${value}`);
    const slot = (image.morseProfiles ?? []).find((entry) => entry?.name === name.trim())?.index;
    return slot === undefined
      ? createBehavior.run(image, { kind: "profiles", value, name: name.trim() }, facts)
      : setBehavior.run(image, { kind: "profiles", slot, value }, facts);
  },
};
