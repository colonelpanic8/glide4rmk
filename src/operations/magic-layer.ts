// MoErgo's Magic layer on the boards that have one (ADR 0035, 0038): found by
// its name, or by the key MoErgo's layout holds it down with, or added when the
// layout has none; then MoErgo's keys on it (a layer you have keeps your other
// keys), its status lights, the left half dark and the layer waking the lights.
// Pure.

import type { KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardImage } from "../sync/image";
import { profileById } from "../model/boards/profiles";
import type { MagicLayerTable } from "../model/boards/magic-layer";
import {
  findMagicLayer,
  MAGIC_LAYER_NAME,
  magicLayerKeys,
  magicLayerOwnKeys,
  withMagicLayerRules,
  withMagicLayerScene,
  withProfiles,
} from "../model/lighting/stock-magic-layer";
import { withKeys } from "./keys";
import { addLayer } from "./layers";
import { withLighting } from "./lighting";
import { failed, type Operation, type OperationFacts, type OperationResult } from "./types";

const isFree = (action: KeyAction | undefined) => action === "No" || action === "Transparent";

/** The layout with a new Magic layer after its last one, held down by MoErgo's
 *  key on the default layer when that key is free; the new layer's slot and
 *  what to tell the person. */
function addMagicLayer(image: KeyboardImage, table: MagicLayerTable, facts: OperationFacts): { image: KeyboardImage; layer: number; notes: string[] } | string {
  const last = image.metadata.findLastIndex((slot) => slot.occupied);
  if (last < 0) return `There is no layer named ${MAGIC_LAYER_NAME}, and this keyboard keeps no layer names to add one: pick the layer.`;
  const added = addLayer.run(image, { name: MAGIC_LAYER_NAME, after: last }, facts);
  if (!added.ok) return `There is no layer named ${MAGIC_LAYER_NAME}, and none can be added (${added.message}): free a layer, or pick one.`;
  const layer = last + 1;
  const { row, col } = table.reach;
  if (!isFree(added.image.layers[image.defaultLayer]?.[row * facts.cols + col])) {
    return { image: added.image, layer, notes: [`${MAGIC_LAYER_NAME} is a new layer: give a key on your base layer "hold ${MAGIC_LAYER_NAME}" to reach it`] };
  }
  const reached = withKeys(added.image, facts.cols, [{ layer: image.defaultLayer, row, col, action: { Single: { LayerOn: layer } } }]);
  return typeof reached === "string" ? reached : { image: reached, layer, notes: [] };
}

export const setMagicLayer: Operation<{ layer?: number; keys?: boolean }> = {
  name: "set_magic_layer",
  description:
    "Makes a layer MoErgo's Magic layer on a Glove80 or a Go60: MoErgo's keys on it (on a new layer every other key unbound; on yours, your other keys stay), its status lights (layers, locks, batteries, Bluetooth, USB, the maintenance lock), the left half dark, and the layer waking the lights; the layer's own earlier lights go first. With keys false, only the status lights and the waking: the layer's keys and its other lights stay.",
  inputs: [
    {
      name: "layer",
      kind: "integer",
      min: 0,
      optional: true,
      description: "The layer. Left out: the layer named Magic, else the one MoErgo's Magic key holds down, else a new layer named Magic.",
    },
    { name: "keys", kind: "boolean", optional: true, description: "False: leave the layer's keys and other lights, add the status lights. True when left out." },
  ],
  run(image, { layer, keys = true }, facts): OperationResult {
    const board = facts.board === null ? undefined : profileById(facts.board)?.magicLayer;
    if (!board) return failed("Only the Glove80 and the Go60 have MoErgo's Magic layer.");
    const table = withProfiles(board, facts.bleProfiles);
    let base = image;
    let target = layer ?? findMagicLayer(image, table, facts.cols);
    const notes: string[] = [];
    const created = target === null;
    if (target === null) {
      const added = addMagicLayer(image, table, facts);
      if (typeof added === "string") return failed(added);
      ({ image: base, layer: target } = added);
      notes.push(...added.notes);
    }
    if (!base.layers[target]) return failed(`Layer ${target} does not exist`);
    // A new layer gets MoErgo's whole layer; one you have keeps your other keys (a TO(1) of yours among them).
    const written = created ? magicLayerKeys(table) : magicLayerOwnKeys(board, table);
    const bound = keys ? withKeys(base, facts.cols, written.map((key) => ({ layer: target, ...key }))) : base;
    if (typeof bound === "string") return failed(bound);
    const rules = withMagicLayerRules(bound.runtimeConditionalScenes, table, target, base.layers.length, keys);
    let scenes = !keys || facts.sceneCapacity === null ? undefined : withMagicLayerScene(bound.scenes, table, target);
    if (scenes && scenes.length > facts.sceneCapacity!) {
      // The dark half is how it looks, not what it does: without room, the half stays lit.
      scenes = withMagicLayerScene(bound.scenes, table, target, false);
      notes.push(`The left half stays lit: the keyboard holds ${facts.sceneCapacity} scene cells, and your other layers' lights use them`);
    }
    const lit = withLighting(bound, facts, { rules, scenes });
    if (!lit.ok) return lit;
    return { ...lit, image: { ...lit.image, wakeLayers: lit.image.wakeLayers | (1 << target) }, ...(notes.length > 0 ? { notes } : {}) };
  },
};
