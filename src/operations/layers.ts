// Layers: move, delete and duplicate, with every reference to a layer
// rewritten (layers/management.ts plans them). Pure.

import type { KeyboardImage } from "../sync/image";
import {
  planLayerDuplicate,
  planLayerRewrite,
  type LayerRewrite,
  type LayerRewriteSnapshot,
  type LayerStructureOperation,
} from "../layers/management";
import { failed, reason, type Operation, type OperationFacts, type OperationResult } from "./types";

/** The planners' view of an image: the image with what the keyboard is. */
function snapshotOf(image: KeyboardImage, facts: OperationFacts): LayerRewriteSnapshot | string {
  if (image.metadata.length === 0) return "this firmware does not support persistent layer metadata";
  if (image.behaviorOptions === null) {
    return "behavior options could not be read, so layer references cannot be rewritten safely";
  }
  return {
    ...image,
    activeLayers: [...facts.activeLayers],
    compiledScenes: [...facts.compiledScenes],
    compiledConditionalScenes: [...facts.compiledRules],
  };
}

/** The image a rewrite leaves: every part the planner rewrote, the rest as it was. */
function rewritten(image: KeyboardImage, rewrite: LayerRewrite): OperationResult {
  const {
    order,
    activeLayers: _active,
    compiledScenes: _compiled,
    compiledConditionalScenes: _compiledRules,
    ...parts
  } = rewrite;
  return { ok: true, image: { ...image, ...parts }, layerOrder: order };
}

function restructure(image: KeyboardImage, facts: OperationFacts, plan: (snapshot: LayerRewriteSnapshot) => LayerRewrite): OperationResult {
  const snapshot = snapshotOf(image, facts);
  if (typeof snapshot === "string") return failed(snapshot);
  try {
    return rewritten(image, plan(snapshot));
  } catch (error) {
    return failed(reason(error));
  }
}

const layerField = { name: "layer", kind: "integer", min: 0, description: "The layer's slot, from 0." } as const;

const structural = (operation: LayerStructureOperation) => (image: KeyboardImage, facts: OperationFacts) =>
  restructure(image, facts, (snapshot) => planLayerRewrite(snapshot, operation));

export const moveLayer: Operation<{ layer: number; to: number }> = {
  name: "move_layer",
  description: "Moves a layer to another slot; keys, combos, lighting and settings that name a layer follow it.",
  inputs: [layerField, { name: "to", kind: "integer", min: 0, description: "The slot it moves to." }],
  run: (image, { layer, to }, facts) => structural({ type: "move", layer, to })(image, facts),
};

export const deleteLayer: Operation<{ layer: number }> = {
  name: "delete_layer",
  description: "Deletes a layer; the layers above it move down one slot.",
  inputs: [layerField],
  run: (image, { layer }, facts) => structural({ type: "delete", layer })(image, facts),
};

/** "Nav copy", or "Nav copy 2" when that name is taken. */
export function copyName(image: KeyboardImage, layer: number): string | null {
  const baseName = image.metadata[layer]?.name;
  if (!baseName) return null;
  const existing = new Set(image.metadata.filter((slot) => slot.occupied).map((slot) => slot.name));
  let name = `${baseName} copy`;
  for (let suffix = 2; existing.has(name); suffix += 1) name = `${baseName} copy ${suffix}`;
  return name;
}

export const duplicateLayer: Operation<{ layer: number; name?: string }> = {
  name: "duplicate_layer",
  description: "Copies a layer, with its lighting, into the next free slot.",
  inputs: [layerField, { name: "name", kind: "string", optional: true, description: "The copy's name; \"<name> copy\" when left out." }],
  run(image, { layer, name }, facts) {
    const named = name ?? copyName(image, layer);
    if (named === null) return failed(`layer ${layer} is not occupied`);
    return restructure(image, facts, (snapshot) =>
      planLayerDuplicate(snapshot, layer, named, facts.sceneCapacity, facts.ruleCapacity),
    );
  },
};

/** Why a new layer cannot have this name, or null. */
function layerNameProblem(image: KeyboardImage, name: string): string | null {
  if (!name) return "a layer needs a name";
  if (new TextEncoder().encode(name).length > 32) return "a layer's name has at most 32 UTF-8 bytes";
  return image.metadata.some((slot) => slot.occupied && slot.name === name) ? `there is a layer called ${name} already` : null;
}

export const addLayer: Operation<{ name: string; after: number }> = {
  name: "add_layer",
  description: "Adds an empty layer (every key the same as the layer below) right after another; the layers above move up one slot, and every reference to them follows.",
  inputs: [
    { name: "name", kind: "string", description: "The new layer's name." },
    { name: "after", kind: "integer", min: 0, description: "The layer it comes right after." },
  ],
  run(image, { name, after }, facts) {
    const trimmed = name.trim();
    const problem = layerNameProblem(image, trimmed);
    if (problem) return failed(problem);
    if (image.metadata.length === 0) return failed("this firmware does not support persistent layer metadata");
    const occupied = image.metadata.findIndex((slot) => !slot.occupied);
    if (occupied < 0) return failed(`every one of the keyboard's ${image.metadata.length} layers is in use`);
    if (after >= occupied) return failed(`layer ${after} is not in use`);
    // The free slot after the last layer becomes the new one, then moves into place.
    const metadata = image.metadata.map((slot, index) => (index === occupied ? { occupied: true, name: trimmed } : slot));
    const layers = image.layers.map((cells, index) => (index === occupied ? cells.map(() => "Transparent" as const) : cells));
    const encoders = image.encoders.map((cells, index) =>
      index === occupied ? cells.map(() => ({ clockwise: "Transparent" as const, counter_clockwise: "Transparent" as const })) : cells,
    );
    const added = { ...image, metadata, layers, encoders };
    if (after + 1 === occupied) return { ok: true, image: added };
    return structural({ type: "move", layer: occupied, to: after + 1 })(added, facts);
  },
};
