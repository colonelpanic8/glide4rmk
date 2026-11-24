// Lighting: a key's light on a layer (its scene cell or its status rules, a
// battery bar over several keys), keys each given their own effect, clearing a
// layer of them, a connection key and a battery bar for Flows to place, MoErgo's
// Magic layer on the boards that have one, and the capacity checks every
// lighting operation shares. Pure.

import type { LightingEffect, LightingSceneCell } from "../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardImage } from "../sync/image";
import { planLight, type KeyLight } from "../model/lighting/key-light";
import type { Rules } from "../model/lighting/rules";
import { withoutStatusLights, withStatusLight } from "../model/lighting/status-light";
import { connectionKeyAction, replaceBatteryBar, type BatteryBarPreset, type ConnectionKeyPreset } from "../model/lighting/status-presets";
import { profileById } from "../model/boards/profiles";
import { magicLayerKeys, withMagicLayerRules, withMagicLayerScene, withProfiles } from "../model/lighting/stock-magic-layer";
import { withKeys } from "./keys";
import { failed, reason, type Operation, type OperationFacts, type OperationResult } from "./types";

/** Why a light or a key for this Bluetooth profile (from 0) cannot be: the keyboard has fewer. */
const noProfile = (profile: number, facts: OperationFacts) =>
  facts.bleProfiles === 0
    ? "This keyboard has no Bluetooth."
    : `This keyboard has ${facts.bleProfiles} Bluetooth profile${facts.bleProfiles === 1 ? "" : "s"}: there is no profile ${profile + 1}.`;

/** The image with these scenes and rules, if the keyboard has room for them. */
export function withLighting(
  image: KeyboardImage,
  facts: OperationFacts,
  parts: { scenes?: LightingSceneCell[]; rules?: Rules },
): OperationResult {
  const { scenes, rules } = parts;
  if (scenes && scenes !== image.scenes) {
    if (facts.sceneCapacity === null) return failed("This keyboard cannot store lighting scenes.");
    if (scenes.length > facts.sceneCapacity) {
      return failed(`This layout needs ${scenes.length} scene cells; the keyboard holds ${facts.sceneCapacity}.`);
    }
  }
  if (rules && rules !== image.runtimeConditionalScenes) {
    if (facts.ruleCapacity === null) return failed("This keyboard has no rule table.");
    if (rules.length > facts.ruleCapacity) {
      return failed(`This layout needs ${rules.length} rules; the keyboard holds ${facts.ruleCapacity}.`);
    }
  }
  return {
    ok: true,
    image: { ...image, scenes: scenes ?? image.scenes, runtimeConditionalScenes: rules ?? image.runtimeConditionalScenes },
  };
}

export const setKeyLight: Operation<{ layer: number; leds: readonly number[]; light: KeyLight }> = {
  name: "set_key_light",
  description: "Gives keys a light on a layer: off, a colour with an effect, the layer below, a status light, or together a battery bar (the keys empty to full).",
  inputs: [
    { name: "layer", kind: "integer", min: 0, description: "The layer the keys light on." },
    { name: "leds", kind: "integer", list: true, min: 0, description: "The keys' LEDs." },
    { name: "light", kind: "value", description: "{ kind: off | below | color | lock | battery | bluetooth | usb | effects | policy | bar, … }." },
  ],
  run(image, { layer, leds, light }, facts) {
    if (!image.layers[layer]) return failed(`Layer ${layer} does not exist`);
    if (light.kind === "bluetooth" && light.profile >= facts.bleProfiles) return failed(noProfile(light.profile, facts));
    let plan;
    try {
      plan = planLight(light, leds, layer, image.runtimeConditionalScenes, (led) => facts.ledNodes[led] ?? 0);
    } catch (error) {
      return failed(reason(error));
    }
    const touched = new Set([...plan.erase, ...plan.paint.map((cell) => cell.led_id)]);
    const kept = image.scenes.filter((cell) => cell.layer !== layer || !touched.has(cell.led_id));
    const painted = plan.paint.map((cell): LightingSceneCell => ({ layer, led_id: cell.led_id, effect: cell.effect }));
    const scenes = kept.length === image.scenes.length && painted.length === 0 ? image.scenes : [...kept, ...painted];
    return withLighting(image, facts, { scenes, rules: plan.rules ?? undefined });
  },
};

export const setKeyEffects: Operation<{ layer: number; cells: ReadonlyArray<{ led: number; effect: LightingEffect }> }> = {
  name: "set_key_effects",
  description: "Gives keys on a layer each its own colour and effect, in place of the light each had there, status lights included.",
  inputs: [
    { name: "layer", kind: "integer", min: 0, description: "The layer the keys light on." },
    { name: "cells", kind: "value", list: true, description: "{ led, effect } for each key." },
  ],
  run(image, { layer, cells }, facts) {
    if (!image.layers[layer]) return failed(`Layer ${layer} does not exist`);
    const leds = new Set(cells.map((cell) => cell.led));
    const kept = image.scenes.filter((cell) => cell.layer !== layer || !leds.has(cell.led_id));
    const painted = cells.map((cell): LightingSceneCell => ({ layer, led_id: cell.led, effect: cell.effect }));
    const rules = [...leds].reduce((table, led) => withStatusLight(table, layer, led, null), image.runtimeConditionalScenes);
    const rulesChanged = rules.length !== image.runtimeConditionalScenes.length;
    return withLighting(image, facts, { scenes: [...kept, ...painted], rules: rulesChanged ? rules : undefined });
  },
};

export const clearLayerLights: Operation<{ layer: number }> = {
  name: "clear_layer_lights",
  description: "Removes every light set per key on a layer, its colours and its status lights: the firmware's own lights and the layers below show again.",
  inputs: [{ name: "layer", kind: "integer", min: 0, description: "The layer to clear." }],
  run(image, { layer }, facts) {
    if (!image.layers[layer]) return failed(`Layer ${layer} does not exist`);
    const scenes = image.scenes.filter((cell) => cell.layer !== layer);
    return withLighting(image, facts, {
      scenes: scenes.length === image.scenes.length ? image.scenes : scenes,
      rules: withoutStatusLights(image.runtimeConditionalScenes, layer),
    });
  },
};

export const setConnectionKey: Operation<ConnectionKeyPreset> = {
  name: "set_connection_key",
  description: "Makes a key switch to a Bluetooth profile or to USB on a layer, with a status light that shows that connection's state.",
  inputs: [
    { name: "layer", kind: "integer", min: 0, description: "The layer the key is on." },
    { name: "row", kind: "integer", min: 0, description: "The key's row." },
    { name: "col", kind: "integer", min: 0, description: "The key's column." },
    { name: "led", kind: "integer", min: 0, description: "The key's LED." },
    { name: "kind", kind: "value", description: "{ type: ble, slot } for a Bluetooth profile (slots from 0), or { type: usb }." },
  ],
  run(image, { layer, row, col, led, kind }, facts) {
    const profile = kind?.type === "ble" && Number.isInteger(kind.slot) && kind.slot >= 0;
    if (!profile && kind?.type !== "usb") return failed("kind must be { type: ble, slot } or { type: usb }");
    if (kind.type === "ble" && kind.slot >= facts.bleProfiles) return failed(noProfile(kind.slot, facts));
    const bound = withKeys(image, facts.cols, [{ layer, row, col, action: connectionKeyAction(kind) }]);
    if (typeof bound === "string") return failed(bound);
    const light: KeyLight = kind.type === "ble" ? { kind: "bluetooth", profile: kind.slot } : { kind: "usb" };
    return setKeyLight.run(bound, { layer, leds: [led], light }, facts);
  },
};

export const setBatteryBar: Operation<BatteryBarPreset> = {
  name: "set_battery_bar",
  description: "Makes keys a battery bar on a layer: they light one after the other as a half's battery fills. It replaces that half's battery lights on the layer.",
  inputs: [
    { name: "layer", kind: "integer", min: 0, description: "The layer the bar shows on." },
    { name: "node", kind: "integer", min: 0, description: "Whose battery: 0 the keyboard or its left half, 1 the right half." },
    { name: "leds", kind: "integer", list: true, min: 0, description: "The keys' LEDs, empty to full: three to eight." },
    { name: "style", kind: "choice", optional: true, values: ["bands", "stock"], description: "bands: equal bands, amber and red when low. stock: the whole bar green, yellow or red." },
  ],
  run(image, preset, facts) {
    if (!image.layers[preset.layer]) return failed(`Layer ${preset.layer} does not exist`);
    // Each key shows one status light: what a chosen key showed before goes.
    const cleared = preset.leds.reduce((rules, led) => withStatusLight(rules, preset.layer, led, null), image.runtimeConditionalScenes);
    try {
      return withLighting(image, facts, { rules: replaceBatteryBar(cleared, preset) });
    } catch (error) {
      return failed(reason(error));
    }
  },
};

export const setMagicLayer: Operation<{ layer?: number; keys?: boolean }> = {
  name: "set_magic_layer",
  description:
    "Makes a layer MoErgo's Magic layer on a Glove80 or a Go60: its keys, its status lights (layers, locks, batteries, Bluetooth, USB, the maintenance lock), the left half dark, and the layer waking the lights. With keys false, only the status lights and the waking: the layer's keys and its other lights stay.",
  inputs: [
    { name: "layer", kind: "integer", min: 0, optional: true, description: "The layer; the board's own Magic layer when left out." },
    { name: "keys", kind: "boolean", optional: true, description: "False: leave the layer's keys and other lights, add the status lights. True when left out." },
  ],
  run(image, { layer, keys = true }, facts) {
    const board = facts.board === null ? undefined : profileById(facts.board)?.magicLayer;
    if (!board) return failed("Only the Glove80 and the Go60 have MoErgo's Magic layer.");
    const table = withProfiles(board, facts.bleProfiles);
    const target = layer ?? table.layer;
    if (!image.layers[target]) return failed(`Layer ${target} does not exist`);
    const bound = keys ? withKeys(image, facts.cols, magicLayerKeys(table).map((key) => ({ layer: target, ...key }))) : image;
    if (typeof bound === "string") return failed(bound);
    const lit = withLighting(bound, facts, {
      rules: withMagicLayerRules(bound.runtimeConditionalScenes, table, target, image.layers.length, keys),
      scenes: !keys || facts.sceneCapacity === null ? undefined : withMagicLayerScene(bound.scenes, table, target),
    });
    return lit.ok ? { ...lit, image: { ...lit.image, wakeLayers: lit.image.wakeLayers | (1 << target) } } : lit;
  },
};
