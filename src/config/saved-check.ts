// GLIDE4RMK Guard reads every file before it is saved (ADR 0036): the text is
// parsed with the same reader that opens a file, and what it reads back as is
// compared with what was meant to be saved. A file that would not open, or
// would open as something else, never leaves the app unnoticed.
//
// The comparison covers what the format holds. MoErgo JSON holds the keymap and
// the behaviors, not lights, trackpads or timing settings. What the keyboard
// reports but a file does not keep (the trackpads' revision counter, unused
// slots after the last one in each table, the scene table's order, a prior-idle
// time reported twice, fields left unset) is set aside first. Pure.

import { sameValue } from "../model/deep-equal";
import { parseDocument } from "./document";
import type { ConfigFormat, ExtensionCatalog, RuntimeSnapshot } from "./document";
import type { LightingTopology } from "../session/types";

export type SavedCheck =
  | { ok: true }
  /** The reader refuses the file: `reason` is its own words. */
  | { ok: false; opens: false; reason: string }
  /** It opens, but as something else: what differs, in words, the first few. */
  | { ok: false; opens: true; differences: string[] };

/** How many differences a check names; more are counted. */
const NAMED = 5;

/** What the file is read back as, against what was meant (`meant`, the snapshot it was rendered from). */
export function checkSaved(
  text: string,
  meant: RuntimeSnapshot,
  catalog: ExtensionCatalog,
  format: ConfigFormat,
  topology?: LightingTopology,
): SavedCheck {
  let back: RuntimeSnapshot;
  try {
    back = parseDocument(text, catalog, topology).snapshot;
  } catch (error) {
    return { ok: false, opens: false, reason: error instanceof Error ? error.message : String(error) };
  }
  const differences = differencesBetween(comparable(meant, format), comparable(back, format), meant);
  if (differences.length === 0) return { ok: true };
  const named = differences.slice(0, NAMED);
  if (differences.length > NAMED) named.push(`and ${differences.length - NAMED} more`);
  return { ok: false, opens: true, differences: named };
}

type Behaviors = NonNullable<RuntimeSnapshot["behaviors"]>;
type Lighting = NonNullable<RuntimeSnapshot["lighting"]>;

/** An unused slot: nothing in it but empty lists, "No", false and 0. */
function vacant(value: unknown): boolean {
  if (value === null || value === undefined || value === "No" || value === false || value === 0) return true;
  if (Array.isArray(value)) return value.every(vacant);
  if (typeof value === "object") return Object.values(value).every(vacant);
  return false;
}

/** A table without its unused slots after the last one in use. */
function used<T>(table: readonly T[] | undefined, unused: (slot: T) => boolean = vacant): T[] {
  const kept = [...(table ?? [])];
  while (kept.length > 0 && unused(kept.at(-1)!)) kept.pop();
  return kept;
}

/** A fork with no trigger is unused, whatever its defaults (every layer, bindable). */
const noTrigger = (fork: NonNullable<Behaviors["forks"]>[number]) => vacant(fork.trigger);

/** The snapshot as far as the format can hold it, with what a file does not keep set aside. */
function comparable(snapshot: RuntimeSnapshot, format: ConfigFormat): RuntimeSnapshot {
  const behaviors = snapshot.behaviors && comparableBehaviors(snapshot.behaviors, format);
  if (format === "moergo-json") {
    return { ...snapshot, lighting: undefined, pointing: undefined, bluetooth_name: undefined, behaviors };
  }
  return {
    ...snapshot,
    behaviors,
    lighting: snapshot.lighting && comparableLighting(snapshot.lighting),
    pointing: snapshot.pointing && { ...snapshot.pointing, revision: 0 },
  };
}

function comparableBehaviors(behaviors: Behaviors, format: ConfigFormat): Behaviors {
  const kept: Behaviors = {
    ...behaviors,
    morses: used(behaviors.morses),
    combos: used(behaviors.combos),
    forks: used(behaviors.forks, noTrigger),
    macros: used(behaviors.macros),
    morse_profiles: used(behaviors.morse_profiles),
  };
  if (format === "moergo-json") {
    // MoErgo JSON keeps the behaviors a key names, not the keyboard's timing settings.
    return { ...kept, config: undefined, options: undefined, auto_mouse_layers: undefined, hold_trigger_positions: undefined };
  }
  // The keyboard reports the prior-idle time twice; a file keeps it once, as the option.
  const idle = behaviors.options?.morse_prior_idle_ms;
  return { ...kept, config: behaviors.config && idle !== undefined ? { ...behaviors.config, morse_prior_idle_time_ms: idle } : behaviors.config };
}

function comparableLighting(lighting: Lighting): Lighting {
  return { ...lighting, scenes: [...(lighting.scenes ?? [])].sort((a, b) => a.layer - b.layer || a.led_id - b.led_id) };
}

/** What a part of a file is called, for a person. */
const PARTS: Record<string, string> = {
  default_layer: "the default layer",
  layer_names: "the layer names",
  lighting: "the lights",
  pointing: "the trackpad settings",
  bluetooth_name: "the Bluetooth name",
  rows: "the board's size",
  cols: "the board's size",
  "behaviors.morses": "the tap patterns",
  "behaviors.combos": "the combos",
  "behaviors.macros": "the macros",
  "behaviors.forks": "the forks",
  "behaviors.config": "the behavior timing",
  "behaviors.options": "the behavior options",
  "behaviors.morse_profiles": "the tap-hold timing profiles",
  "behaviors.hold_trigger_positions": "the hold-trigger keys",
  "behaviors.auto_mouse_layers": "the automatic mouse layers",
};

function differencesBetween(meant: RuntimeSnapshot, back: RuntimeSnapshot, named: RuntimeSnapshot): string[] {
  const found: string[] = [];
  const layerName = (layer: number) => named.layer_names?.[layer]?.name || `layer ${layer}`;
  const layers = Math.max(meant.layers.length, back.layers.length);
  for (let layer = 0; layer < layers; layer += 1) {
    const want = meant.layers[layer];
    const got = back.layers[layer];
    if (!want || !got) {
      found.push(`${layerName(layer)} ${want ? "is missing" : "appears"} when the file is read back`);
      continue;
    }
    want.forEach((action, offset) => {
      if (sameValue(action, got[offset])) return;
      const row = Math.floor(offset / meant.cols);
      const col = offset % meant.cols;
      found.push(`${layerName(layer)}, key r${row},c${col} reads back as another key`);
    });
  }
  const parts = (snapshot: RuntimeSnapshot): Record<string, unknown> => ({
    default_layer: snapshot.default_layer,
    layer_names: snapshot.layer_names,
    lighting: snapshot.lighting,
    pointing: snapshot.pointing,
    bluetooth_name: snapshot.bluetooth_name,
    rows: snapshot.rows,
    cols: snapshot.cols,
    ...Object.fromEntries(Object.entries(snapshot.behaviors ?? {}).map(([key, value]) => [`behaviors.${key}`, value])),
  });
  const want = parts(meant);
  const got = parts(back);
  const reported = new Set<string>();
  for (const key of new Set([...Object.keys(want), ...Object.keys(got)])) {
    if (sameValue(want[key], got[key])) continue;
    const words = PARTS[key] ?? key;
    if (reported.has(words)) continue;
    reported.add(words);
    found.push(`${words[0].toUpperCase()}${words.slice(1)} read${words.endsWith("s") && !words.endsWith("'s size") ? "" : "s"} back differently`);
  }
  return found;
}
