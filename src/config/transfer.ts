// Moving a configuration document between a file and the keyboard.
//
// A document is parsed and fully validated before anything changes, so a file
// that cannot be represented fails with the exact layer and key it failed on.
// An import is then one commit of what you want (ADR 0019): only differences
// reach the keyboard, so importing a file it already holds changes nothing,
// which is what makes re-importing a file a safe way to check it.

import { boardForTarget, transferSnapshot } from "../model/boards/transfer";
import type { MoErgoBoard } from "../model/boards/transfer";
import type { LightingTopology } from "../session/types";
import {
  hasConnectionEffectsConditions,
  hasLayerIndicatorConditions,
  hasLightingFeature,
  RULES,
} from "../session/lighting-features";
import { ruleFromWire } from "../session/lighting-rules";
import type { ConnectedBundle, WorkbenchState } from "../model/workbench-state";
import { same } from "../model/deep-equal";
import type { KeyboardImage } from "../sync/image";
import { parseDocument, renderDocument, snapshotFromState } from "./document";
import type { ConfigFormat, ExtensionCatalog, ImportNote, RuntimeSnapshot } from "./document";
import { withTomlLabels } from "./behavior-labels";
import { withModules } from "./add-ons";
import { layoutOnto, type ImportedLayout } from "./import-layout";
import { decorationNotes } from "./decorations";
import { checkSaved, type SavedCheck } from "./saved-check";
import { bleProfilesOf, firmwareFactsOf, resolveCapabilities } from "../capabilities";

export type { ImportedLayout } from "./import-layout";

/** A parsed, converted and checked layout file, ready to be put over what you want. */
export interface LayoutImport {
  format: ConfigFormat;
  sourceBoard: MoErgoBoard;
  targetBoard: MoErgoBoard;
  converted: boolean;
  /** How the imported layout differs from its source document: format
   *  approximations plus source-board positions with no target counterpart. */
  notes: ImportNote[];
  /** What must be read from the keyboard first: the pointing configuration
   *  when the workbench has none, and the effects whose parameters the file sets. */
  reads: { pointing: boolean; paramEffects: number[] };
  /** The file over `want`, against the workbench's limits. Pure. */
  onto(state: WorkbenchState, want: KeyboardImage, pointingUnread?: string): ImportedLayout;
}

interface ImportArgs {
  text: string;
  bundle: ConnectedBundle;
  state: WorkbenchState;
  catalog: ExtensionCatalog;
}

export function readImport({ text, bundle, state, catalog }: ImportArgs): LayoutImport {
  boardForTarget(bundle.info, bundle.caps.num_rows, bundle.caps.num_cols);
  const { format, snapshot: sourceSnapshot, notes: parseNotes } = parseDocument(text, catalog, bundle.topology);
  if (sourceSnapshot.layers.length > bundle.caps.num_layers) {
    throw new Error(
      `Layout has ${sourceSnapshot.layers.length} layers; this keyboard supports ${bundle.caps.num_layers}`,
    );
  }
  const converted = transferSnapshot(
    sourceSnapshot,
    bundle.caps.num_rows,
    bundle.caps.num_cols,
    snapshotFromState(state),
    bundle.model,
  );
  const snapshot = converted.snapshot;
  preflightLighting(snapshot, bundle, state);
  return {
    format,
    sourceBoard: converted.source,
    targetBoard: converted.target,
    converted: converted.converted,
    notes: [...parseNotes, ...decorationNotes(text), ...converted.notes],
    reads: {
      pointing: snapshot.pointing !== undefined,
      paramEffects: [...new Set((snapshot.lighting?.effects ? snapshot.lighting.effect_params : []).map(({ effect }) => effect))],
    },
    onto: (current, want, pointingUnread) =>
      layoutOnto(snapshot, want, { caps: bundle.caps, state: current, pointingUnread }),
  };
}

/** Check device-specific limits before an import changes anything. */
function preflightLighting(
  snapshot: RuntimeSnapshot,
  bundle: ConnectedBundle,
  state: WorkbenchState,
): void {
  const desired = snapshot.lighting;
  if (!desired) return;
  const checkCapacity = (
    label: string,
    count: number,
    status: { capacity: number } | null,
  ) => {
    if (!status) {
      throw new Error(`${label}: runtime support is unavailable; check firmware support and reconnect before importing. No settings were written.`);
    }
    if (count > status.capacity) {
      throw new Error(`${label}: configuration needs ${count} entries, but this keyboard holds ${status.capacity}. No settings were written.`);
    }
  };
  if (!same(desired.scenes, state.scenes)) {
    checkCapacity("Lighting scenes", desired.scenes.length, bundle.sceneStatus);
  }
  const rules = desired.conditional_scenes?.map(ruleFromWire);
  if (rules === undefined || same(rules, state.runtimeConditionalScenes)) return;
  checkCapacity("Conditional lighting", rules.length, bundle.runtimeConditionalStatus);
  // The tagged rule API supersedes the legacy conditional-scene bits and carries
  // every predicate these branches gate on, so it satisfies them all. Firmware
  // that advertises RULES reports its supported tags in the rule status, and the
  // write path rejects unknown tags there with a precise message.
  const tagged = hasLightingFeature(bundle.lightingCaps, RULES);
  const advanced = hasLayerIndicatorConditions(bundle.lightingCaps);
  const extended = advanced || hasConnectionEffectsConditions(bundle.lightingCaps);
  const profiles = bleProfilesOf(resolveCapabilities(firmwareFactsOf(bundle)));
  for (const [index, rule] of rules.entries()) {
    const unsupported = !tagged && (rule.maintenance !== undefined || rule.split_transport !== undefined || (rule.unknown_predicates?.length ?? 0) > 0)
      ? "maintenance, split-transport, or unknown tagged conditions"
      : !advanced && (rule.layers !== undefined || rule.indicators !== undefined)
      ? "layer-set or lock-indicator conditions"
      : !extended && (rule.connection !== undefined || rule.effects !== undefined)
        ? "connection or effects conditions"
        : null;
    if (unsupported) {
      throw new Error(`Conditional rule ${index + 1}: this firmware cannot store ${unsupported}; update firmware or remove the condition. No settings were written.`);
    }
    // The firmware refuses a rule for a profile past its last one (InvalidRequest).
    const profile = rule.connection?.profile ?? rule.connection?.bonded?.slot;
    if (profile !== undefined && profile >= profiles) {
      throw new Error(
        `Conditional rule ${index + 1} shows Bluetooth profile ${profile + 1}, and this keyboard has ${profiles === 0 ? "no Bluetooth" : `${profiles} profile${profiles === 1 ? "" : "s"}`}. No settings were written.`,
      );
    }
  }
}

/** Live state rendered as a document, ready to be written to a file. */
export function exportDocument(
  state: WorkbenchState,
  catalog: ExtensionCatalog,
  format: ConfigFormat,
  previous?: string,
  incompleteReads: string[] = [],
  topology?: LightingTopology,
): string {
  return rendered(state, catalog, format, previous, incompleteReads, topology).text;
}

/** The document a save writes, and what it reads back as (ADR 0036): GLIDE4RMK
 *  Guard's check that the file opens again as what was saved. */
export function exportChecked(
  state: WorkbenchState,
  catalog: ExtensionCatalog,
  format: ConfigFormat,
  previous?: string,
  incompleteReads: string[] = [],
  topology?: LightingTopology,
): { text: string; check: SavedCheck } {
  const { text, snapshot } = rendered(state, catalog, format, previous, incompleteReads, topology);
  return { text, check: checkSaved(text, snapshot, catalog, format, topology) };
}

function rendered(
  state: WorkbenchState,
  catalog: ExtensionCatalog,
  format: ConfigFormat,
  previous: string | undefined,
  incompleteReads: string[],
  topology: LightingTopology | undefined,
): { text: string; snapshot: RuntimeSnapshot } {
  if (incompleteReads.length > 0) {
    throw new Error(
      `Cannot export an incomplete device snapshot. Reconnect and try again.\n\nFailed reads:\n- ${incompleteReads.join("\n- ")}`,
    );
  }
  const snapshot = inUse(snapshotFromState(state, bluetoothNameOf(previous, catalog, topology)));
  const text = renderDocument(snapshot, catalog, format, previous);
  // What the keyboard does not store: the behaviors' names and descriptions
  // (ADR 0020), and the add-on modules the layout turns on (ADR 0028).
  const labelled = format === "toml" ? withTomlLabels(text, state.labels) : text;
  return { text: withModules(labelled, format, state.modules), snapshot };
}

/** A file lists the layers in use: vacant slots after the last one are left out,
 *  as a renderer would name them and reading the file back would occupy them.
 *  Every slot stays when the firmware keeps no layer metadata; a slot that is
 *  the default layer, wakes the lights or holds a scene is kept. */
function inUse(snapshot: RuntimeSnapshot): RuntimeSnapshot {
  const names = snapshot.layer_names;
  if (!names) return snapshot;
  const used = [
    names.findLastIndex((slot) => slot.occupied),
    snapshot.default_layer,
    ...(snapshot.lighting?.wake_layers ?? []),
    ...(snapshot.lighting?.scenes ?? []).map((cell) => cell.layer),
  ];
  const kept = Math.max(0, ...used) + 1;
  if (kept >= snapshot.layers.length) return snapshot;
  return { ...snapshot, layers: snapshot.layers.slice(0, kept), layer_names: names.slice(0, kept) };
}

/** The BLE advertising name the document being replaced carries. The keyboard
 *  does not report it over this seam and the renderer does not take it from
 *  `previous`, so without this an export drops the name a file arrived with.
 *  A `previous` that no longer parses is ignored, as the renderer ignores it. */
function bluetoothNameOf(
  previous: string | undefined,
  catalog: ExtensionCatalog,
  topology?: LightingTopology,
): string | undefined {
  if (previous === undefined) return undefined;
  try {
    return parseDocument(previous, catalog, topology).snapshot.bluetooth_name;
  } catch {
    return undefined;
  }
}
