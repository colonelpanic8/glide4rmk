// The words the app uses for its own parts, in two voices: technical (the RMK
// and Rynk terms) and friendly (plain descriptions of what the thing does).
// One table drives both, so no screen hard-codes either, and the choice is a
// browser-local preference.
//
// Technical is today's wording and the default. The friendly names are
// proposals, meant to be edited here and nowhere else.

import { useSyncExternalStore } from "react";
import { SETTING_KEYS, createSetting } from "./settings";

export type Wording = "technical" | "friendly";

export const DEFAULT_WORDING: Wording = "technical";

export interface Term {
  technical: string;
  friendly: string;
}

// Area names sit in the narrow rail, so they stay short in both voices.
export const TERMS = {
  "area.layout": { technical: "Keymap", friendly: "Layout" },
  "area.behaviors": { technical: "Behaviors", friendly: "Behaviors" },
  "area.device": { technical: "Device", friendly: "Keyboard" },
  "section.keymap": { technical: "Keymap", friendly: "Keys" },
  "section.combos": { technical: "Combos", friendly: "Combos" },
  "section.morse": { technical: "Morse", friendly: "Tap patterns" },
  "section.macros": { technical: "Macros", friendly: "Macros" },
  "section.forks": { technical: "Forks", friendly: "Conditional keys" },
  "section.profiles": { technical: "Profiles", friendly: "Tap timing" },
  "section.transforms": { technical: "Transforms", friendly: "Quick changes" },
  "section.device": { technical: "Device", friendly: "Keyboard" },
  "section.usage": { technical: "All your behaviors", friendly: "All your behaviors" },
  "section.live": { technical: "Live", friendly: "Live view" },
  // Tap timing (a tap pattern's own, a profile's): RMK's words, and plain ones.
  "timing.mode": { technical: "Mode", friendly: "When a hold wins" },
  "timing.hold": { technical: "Hold timeout", friendly: "Hold after" },
  "timing.gap": { technical: "Gap timeout", friendly: "Next tap within" },
  "timing.unilateral": { technical: "Unilateral tap", friendly: "Same hand types the tap" },
  "timing.flow": { technical: "Flow tap", friendly: "Fast typing types the tap" },
  "timing.idle": { technical: "Flow-tap prior idle", friendly: "Typing pause before a hold" },
  "timing.retro": { technical: "Retro tap", friendly: "Tap when released alone" },
  "timing.release": { technical: "Hold trigger on release", friendly: "Decide on release" },
  "morse.timing": { technical: "Timing", friendly: "Timing" },
  "morse.does": { technical: "Action", friendly: "Does" },
  // What a key is bound to, in the key editor's behavior line.
  "behavior.tapHold": { technical: "Tap-hold", friendly: "Tap or hold" },
  "behavior.layerModTap": { technical: "Layer-mod-tap", friendly: "Layer and modifier on hold" },
  // A fork's parts: RMK's words, and plain ones.
  "fork.trigger": { technical: "Trigger", friendly: "Key" },
  "fork.negative": { technical: "Negative output", friendly: "Normally" },
  "fork.positive": { technical: "Positive output", friendly: "Becomes" },
  "fork.match": { technical: "Match any", friendly: "While any of these" },
  "fork.suppress": { technical: "Match none", friendly: "Unless any of these" },
  "fork.keep": { technical: "Kept modifiers", friendly: "Keep held" },
  // History, in the top bar.
  "history.covers": { technical: "Undo covers every change, in Draft and Live.", friendly: "Undo takes back any change, one at a time." },
  // Review & send: what is on the keyboard already.
  "review.atOnce": {
    technical: "Apply rules, the lighting presets and the Device screen write to the keyboard at once; the rest waits for Send.",
    friendly: "Lighting rules, lighting presets and the Keyboard screen save at once; the rest waits for Send.",
  },
  // The stock Magic layer (RGB Lighting → Advanced, on a Glove80). {layer} is the layer's name.
  "magic.needsFirmware": {
    technical: "Update firmware to install the stock Magic layer: this one cannot show its layer and lock lights.",
    friendly: "Update the keyboard's firmware to get its Magic layer.",
  },
  "magic.title": { technical: "MoErgo stock Magic layer", friendly: "Glove80's own Magic layer" },
  "magic.what": {
    technical:
      "Replaces {layer} with the factory Magic layer: Bluetooth 1–{profiles} and USB on the thumbs, RGB controls on Q–T and A–G, bootloader and reset on the outer keys, F1 and F10 forget pairings. Every other key is unbound.",
    friendly: "Replaces {layer} with the layer a Glove80 ships with: switch computers, change the lights, reset. Its other keys do nothing.",
  },
  "magic.lights": {
    technical: "While held, the left half shows the held layers, lock lights, battery and profile states, for 20 s after release. No output-fallback light.",
    friendly: "While you hold it, the keys show the battery, your connections and the lock keys.",
  },
  "magic.liveOnly": {
    technical: "Installs in Live only: keys, scene and rules are written at once.",
    friendly: "Switch to Live to install it: it changes the keyboard at once.",
  },
  "magic.install": { technical: "Install stock Magic layer on {layer}", friendly: "Make {layer} the Magic layer" },
  "magic.installing": { technical: "Writing keys, scene and rules…", friendly: "Installing…" },
  "magic.installed": {
    technical: "{layer} is the stock Magic layer, verified. Reach it with MO({index}).",
    friendly: "{layer} is the Magic layer now. A key that holds it on opens it.",
  },
} as const satisfies Record<string, Term>;

export type TermId = keyof typeof TERMS;

export function normalizeWording(value: unknown): Wording {
  return value === "friendly" || value === "technical" ? value : DEFAULT_WORDING;
}

/** Values for a term's `{placeholders}`. */
export type TermValues = Readonly<Record<string, string | number>>;

/** A term in the given voice, its `{placeholders}` filled from `values`. */
export function termFor(id: TermId, wording: Wording, values?: TermValues): string {
  const text: string = TERMS[id][wording];
  return values ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole)) : text;
}

const wordingSetting = createSetting(SETTING_KEYS.wording, normalizeWording);

export function getWording(): Wording {
  return wordingSetting.get();
}

export function subscribeWording(listener: () => void): () => void {
  return wordingSetting.subscribe(listener);
}

export function setWording(wording: Wording): void {
  wordingSetting.set(wording);
}

export function useWording(): Wording {
  return useSyncExternalStore(subscribeWording, getWording, () => DEFAULT_WORDING);
}

/** The lookup screens use: `const term = useTerms(); term("mode.keymap")`,
 *  or with values: `term("magic.install", { layer: name })`. */
export function useTerms(): (id: TermId, values?: TermValues) => string {
  const wording = useWording();
  return (id, values) => termFor(id, wording, values);
}
