// Screens ask what the keyboard can do through capabilities (src/capabilities),
// not by testing what connecting read off the firmware. This guard finds the
// old pattern in src/ui so it can only shrink, the same ratchet as the import
// boundaries (docs/adr/0002-capability-contract.md).
//
// A probe is any of:
//  - any read of a connect-time capability field through `bundle.`, which a
//    screen should take from the capability set instead;
//  - an explicit null test of a capability-backed field, on `bundle.` or on
//    the live `state.`, which asks for presence the long way round; or
//  - any read of a firmware feature field of `caps` (`is_split`, `max_combos`,
//    `ble_enabled` …), however the screen reached `caps`: what a screen offers
//    from it is a capability's to say (docs/architecture-review.md, P4).
//    Geometry (`num_layers`, `num_rows`, `num_cols`, `num_encoders`) is the
//    board's shape, not a feature, and stays allowed.
//
// Not covered: reading a live value (`state.lightingOutputMode.wake_layers`),
// which is use of the value rather than a presence test. `state.tsx` seeds
// that state and is exempt; the connect-time read (`workbench/open.ts`) is
// not a screen.
//
// Pure: it works on file text, so the rule can be tested without a file system.

import type { DeviceCapabilities } from "../vendor/rynk-wasm/rynk_wasm";
import type { Violation } from "./boundaries";

const FIELDS = "sceneStatus|runtimeConditionalStatus|compiledSceneStatus|lightingExtension|pointingConfig|lightingState|lightingOutputMode";

/** Every field of the firmware's capability record, sorted: the board's shape,
 *  or something a screen would decide a feature from. Typed by the record, so a
 *  field the firmware adds must be sorted here before the guard compiles. */
export const CAPS_FIELDS: Record<keyof DeviceCapabilities, "geometry" | "feature"> = {
  num_layers: "geometry",
  num_rows: "geometry",
  num_cols: "geometry",
  num_encoders: "geometry",
  max_combos: "feature",
  max_combo_keys: "feature",
  max_macros: "feature",
  macro_space_size: "feature",
  macros_writable: "feature",
  max_morses: "feature",
  max_patterns_per_key: "feature",
  max_forks: "feature",
  storage_enabled: "feature",
  lighting_enabled: "feature",
  is_split: "feature",
  num_split_peripherals: "feature",
  ble_enabled: "feature",
  num_ble_profiles: "feature",
  max_payload_size: "feature",
  max_bulk_keys: "feature",
  max_bulk_items: "feature",
  bulk_transfer_supported: "feature",
  max_connections: "feature",
  dongle_profile: "feature",
};

const FEATURE_FIELDS = Object.entries(CAPS_FIELDS)
  .filter(([, kind]) => kind === "feature")
  .map(([field]) => field);
const FEATURES = FEATURE_FIELDS.join("|");

export const PROBE_RULE = "ui-never-probes-capability-fields";

export const PROBE_WHY =
  "Ask the capability set (useCapability / useCapabilities) what the keyboard offers, not whether a connect-time read came back null or what a raw firmware field says.";

const BUNDLE_READ = new RegExp(`\\bbundle\\.(?:${FIELDS})\\b`, "g");
const NULL_TEST = new RegExp(`\\b(?:state|bundle)\\.(?:${FIELDS})\\s*(?:!==|===|!=|==)\\s*null\\b`, "g");
// The feature names exist only on the capability record, so any member read
// of one is a read of `caps`, whatever it was called on the way.
const CAPS_READ = new RegExp(`\\.\\s*(${FEATURES})\\b`, "g");
// `const { is_split } = bundle.caps`: the fields are inside the braces.
const CAPS_DESTRUCTURE = /\{([^{}]*)\}\s*=\s*(?:[\w$]+\s*\.\s*)*caps\b/g;
const FEATURE_NAME = new RegExp(`\\b(${FEATURES})\\b`, "g");

const EXEMPT = new Set(["src/ui/state.tsx"]);

/** Whether the guard applies to a file: production code under src/ui. */
export function isProbeChecked(path: string): boolean {
  return (
    path.startsWith("src/ui/") &&
    /\.(ts|tsx)$/.test(path) &&
    !/\.test\.(ts|tsx)$/.test(path) &&
    !EXEMPT.has(path)
  );
}

type Found = { index: number; text: string };

function capsReads(source: string): Found[] {
  const reads: Found[] = [...source.matchAll(CAPS_READ)].map((m) => ({ index: m.index, text: `caps.${m[1]}` }));
  for (const m of source.matchAll(CAPS_DESTRUCTURE)) {
    for (const name of m[1].matchAll(FEATURE_NAME)) reads.push({ index: m.index + 1 + name.index, text: `caps.${name[1]}` });
  }
  return reads;
}

function occurrences(source: string): string[] {
  const nullTests = [...source.matchAll(NULL_TEST)];
  // A null test on `bundle.` also matches the plain read at the same spot;
  // count each place once, as the longer match.
  const testStarts = new Set(nullTests.map((m) => m.index));
  const reads = [...source.matchAll(BUNDLE_READ)].filter((m) => !testStarts.has(m.index));
  const texts = [
    ...[...reads, ...nullTests].map((m): Found => ({ index: m.index, text: m[0].replace(/\s+/g, " ") })),
    ...capsReads(source),
  ]
    .sort((a, b) => a.index - b.index)
    .map((f) => f.text);
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const text of texts) {
    const n = (seen.get(text) ?? 0) + 1;
    seen.set(text, n);
    out.push(`${text}#${n}`);
  }
  return out;
}

/** Every probe in the given files (path to source text), sorted. Repeats of the
 *  same text in one file are numbered, so adding a second one is a new entry. */
export function findProbes(files: Record<string, string>): Violation[] {
  const found: Violation[] = [];
  for (const [from, source] of Object.entries(files)) {
    if (!isProbeChecked(from)) continue;
    for (const to of occurrences(source)) found.push({ rule: PROBE_RULE, from, to });
  }
  return found.sort((a, b) => `${a.from} ${a.to}`.localeCompare(`${b.from} ${b.to}`));
}
