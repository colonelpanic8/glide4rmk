// Transforms: the Ctrl ↔ GUI swap over keys, combos, morse, forks and macros
// (model/transforms.ts plans it). Switching typing layouts is a Flow. Pure.

import type { KeyboardImage } from "../sync/image";
import { planOsSwap, type TransformInput, type TransformPlan } from "../model/transforms";
import { withKeys } from "./keys";
import { failed, type Operation } from "./types";

export type TransformChoice = { transform: "ctrl-gui-swap" };

/** What a transform reads of an image. */
export function transformInputOf(image: KeyboardImage, cols: number): TransformInput {
  return { layers: image.layers, cols, combos: image.combos, morse: image.morse, forks: image.forks, macroOps: image.macroOps ?? [] };
}

/** What a transform would change, for a preview. */
export function planTransform(image: KeyboardImage, cols: number): TransformPlan {
  return planOsSwap(transformInputOf(image, cols));
}

/** The image with a transform's plan done. */
export function withPlan(image: KeyboardImage, cols: number, plan: TransformPlan): KeyboardImage | string {
  const keyed = withKeys(image, cols, plan.keys.map(({ after, ...place }) => ({ ...place, action: after })));
  if (typeof keyed === "string") return keyed;
  const slots = <T,>(table: readonly T[], edits: readonly { index: number; after: T }[]) => {
    const next = [...table];
    for (const { index, after } of edits) next[index] = after;
    return next;
  };
  return {
    ...keyed,
    combos: plan.combos.length ? slots(image.combos, plan.combos) : image.combos,
    morse: plan.morse.length ? slots(image.morse, plan.morse) : image.morse,
    forks: plan.forks.length ? slots(image.forks, plan.forks) : image.forks,
    macroOps: plan.macroOps ?? image.macroOps,
  };
}

export const applyTransform: Operation<TransformChoice> = {
  name: "apply_transform",
  description: "Rewrites every binding: swaps Ctrl and GUI on keys, combos, tap patterns, forks and macros.",
  inputs: [{ name: "transform", kind: "choice", values: ["ctrl-gui-swap"], description: "Which transform." }],
  run(image, _choice, facts) {
    const next = withPlan(image, facts.cols, planTransform(image, facts.cols));
    return typeof next === "string" ? failed(next) : { ok: true, image: next };
  },
};
