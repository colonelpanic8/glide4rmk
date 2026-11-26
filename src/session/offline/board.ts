// The offline board: a layout file (or a new one) opened without a keyboard,
// as the board it is for. Each MoErgo board has a template, the simulated
// firmware it is shaped like; the file's keys, behaviors and lights are laid
// over it (ADR 0034).

import type { ExtensionCatalog, RuntimeSnapshot } from "../../config/document";
import type { MoErgoBoard } from "../../model/boards/transfer";
import type { LightingTopology, RynkSession } from "../types";
import { memorySession, type BoardSpec } from "../mock/board";
import { glove80Board } from "../mock/glove80";
import { ruleFromWire } from "../lighting-rules";
import { go60Template } from "./go60";
import { startingProfiles } from "../mock/ble";

const NEW_CONFIG_LAYERS = 6;

interface OfflineTemplate {
  name: string;
  spec: BoardSpec;
}

const TEMPLATES: Record<MoErgoBoard, OfflineTemplate> = {
  glove80: { name: "Glove80", spec: glove80Board },
  go60: { name: "Go60", spec: go60Template },
};

function defaultLayers(template: BoardSpec): RuntimeSnapshot["layers"] {
  const base = structuredClone(template.defaultLayers[0]);
  const transparent = structuredClone(template.defaultLayers[1]);
  return [base, ...Array.from({ length: NEW_CONFIG_LAYERS - 1 }, () => structuredClone(transparent))];
}

/** Catalog compiled into a board's offline template, used to parse names before a session exists. */
export function offlineCatalog(board: MoErgoBoard): ExtensionCatalog {
  const pack = TEMPLATES[board].spec.extensionEffects;
  if (!pack) return { effects: [], palettes: [], params: [] };
  return {
    effects: [...pack.effects],
    palettes: [...pack.palettes],
    params: Object.entries(pack.params ?? {}).map(([effect, params]) => ({
      effect: Number(effect),
      name: pack.effects[Number(effect)],
      params: params.map((param) => ({ ...param, value: param.default })),
    })),
  };
}

/** Topology of a board's offline template, used to lower a document's `key`,
 *  zone and `all` lighting targets before a session exists to advertise them. */
export function offlineTopology(board: MoErgoBoard): LightingTopology {
  return TEMPLATES[board].spec.topology;
}

/** What the offline board has besides keys and behaviors; both on unless
 *  turned off, as a stock board has them. Off, the board is built as firmware
 *  without that surface: no pointing configuration, and a lighting surface
 *  that answers "unsupported". */
export interface OfflineBoardOptions {
  pointing?: boolean;
  lighting?: boolean;
}

/** Build a board's editing surface from a parsed configuration snapshot. */
export function offlineBoard(
  board: MoErgoBoard,
  snapshot?: RuntimeSnapshot,
  options: OfflineBoardOptions = {},
): BoardSpec {
  const spec = surface(TEMPLATES[board], snapshot);
  const { pointing = true, lighting = true } = options;
  if (!pointing) delete spec.pointingConfig;
  if (!lighting) spec.capabilities = { ...spec.capabilities, lighting_enabled: false };
  return spec;
}

export function openOfflineBoard(
  board: MoErgoBoard,
  snapshot?: RuntimeSnapshot,
  options: OfflineBoardOptions = {},
): RynkSession {
  return memorySession(offlineBoard(board, snapshot, options), "offline");
}

const layerMask = (layers: number[]): number => layers.reduce((mask, layer) => mask + 2 ** layer, 0);

function surface({ name, spec: template }: OfflineTemplate, snapshot?: RuntimeSnapshot): BoardSpec {
  const { num_rows: rows, num_cols: cols } = template.capabilities;
  const size = snapshot?.layers[0]?.length;
  if (size !== undefined && size !== rows * cols) {
    throw new Error(`this layout has ${size} keys a layer; a ${name} has ${rows * cols}`);
  }
  const layers = structuredClone(snapshot?.layers ?? defaultLayers(template));
  const behaviors = snapshot?.behaviors;
  const lighting = snapshot?.lighting;
  const wakeLayers = lighting ? layerMask(lighting.wake_layers) : template.lightingControls?.wake_layers ?? 0;
  const extensionEffects = structuredClone(template.extensionEffects!);
  for (const write of lighting?.effect_params ?? []) {
    const param = extensionEffects.params?.[write.effect]?.[write.index];
    if (param) param.default = write.value;
  }

  return {
    ...template,
    title: `${name} configuration`,
    description: "Local configuration workspace — no keyboard connection.",
    info: {
      ...template.info,
      product_name: name,
      serial_number: "OFFLINE",
    },
    build: { label: "Offline configuration workspace" },
    capabilities: {
      ...template.capabilities,
      num_layers: layers.length,
    },
    connection: {
      usb: "Disabled",
      ...startingProfiles(template.capabilities.num_ble_profiles),
      preferred: "Usb",
    },
    defaultLayers: layers,
    // The file's trackpad settings, or the board's stock ones.
    pointingConfig: structuredClone(snapshot?.pointing ?? template.pointingConfig),
    // A parsed document names its own layers; only a document that says
    // nothing falls back to the board's stock labels.
    layerNames: layers.map(
      (_, layer) =>
        snapshot?.layer_names?.[layer]?.name ||
        template.layerNames?.[layer] ||
        `Layer ${layer}`,
    ),
    defaultEncoders: Array.from({ length: layers.length }, () => []),
    initialDefaultLayer: snapshot?.default_layer ?? 0,
    initialActiveLayers: [snapshot?.default_layer ?? 0],
    battery: "Unavailable",
    peripheralBattery: "Unavailable",
    brightness: lighting?.brightness ?? 255,
    background:
      structuredClone(lighting?.background) ?? {
        enabled: false,
        hue: 0,
        saturation: 0,
        value: 0,
        speed: 128,
        mode: "Solid",
      },
    behavior: structuredClone(behaviors?.config ?? template.behavior),
    behaviorOptions: structuredClone(behaviors?.options ?? template.behaviorOptions),
    morseProfileCount: Math.max(
      16,
      ...(behaviors?.morse_profiles ?? []).map((entry) => entry.index + 1),
    ),
    seedMorseProfiles: structuredClone(behaviors?.morse_profiles ?? []),
    holdTriggerPositionCapacity: Math.max(64, behaviors?.hold_trigger_positions?.length ?? 0),
    seedHoldTriggerPositions: structuredClone(behaviors?.hold_trigger_positions ?? []),
    autoMouseLayerCapacity: Math.max(16, behaviors?.auto_mouse_layers?.length ?? 0),
    seedAutoMouseLayers: structuredClone(behaviors?.auto_mouse_layers ?? []),
    seedCombos: structuredClone(behaviors?.combos ?? []),
    seedMorse: structuredClone(behaviors?.morses ?? []),
    seedForks: structuredClone(behaviors?.forks ?? []),
    seedMacros: structuredClone(behaviors?.macros ?? []),
    seedScenes: structuredClone(lighting?.scenes ?? []),
    sceneCapacity: Math.max(256, lighting?.scenes.length ?? 0),
    compiledScenes: [],
    compiledScenePolicy: "EffectiveOnly",
    initialLayerPolicy: lighting?.scene_policy ?? "EffectiveOnly",
    conditionalScenes: [],
    lightingControls: { output_toggle_user_action: undefined, wake_layers: wakeLayers },
    runtimeConditionalCapacity: Math.max(64, lighting?.conditional_scenes?.length ?? 0),
    runtimeConditionalPredicates: true,
    seedRuntimeConditionalScenes: structuredClone(
      lighting?.conditional_scenes?.map(ruleFromWire) ?? [],
    ),
    lightingOutputMode: {
      ...structuredClone(template.lightingOutputMode!),
      mode: lighting?.output_mode ?? "PoweredOnly",
      powered: false,
      wake_active: false,
      effective_enabled: true,
      wake_layers: wakeLayers,
    },
    extensionEffects: {
      ...extensionEffects,
      initial: structuredClone(lighting?.effects ?? extensionEffects.initial),
      // Tri-state: `undefined` would claim the workspace cannot layer at all.
      overlay: lighting?.overlay ?? null,
    },
  };
}

