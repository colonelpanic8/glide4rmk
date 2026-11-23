// The label functions (labels.ts) bound to the open layout and the chosen
// computer: modifiers read as that computer writes them (never assumed to be a
// Mac), a layer key as its layer's name (as in GLIDE), a morse key from the
// layout's morse table. Screens print keys through this; labels.ts stays pure.

import { useMemo } from "react";
import type { Action, KeyAction } from "../model/action-types";
import { actionDescription, actionLabel, keyActionDescription, keyActionGlyph, layerRef, type TextContext } from "./labels";
import { useLayerNames } from "./layer-names";
import { useOs } from "./preferences";
import { useWorkbench } from "./state";

/** What labels need from the preferences and the layout. */
export function useTextContext(): TextContext {
  const os = useOs();
  const names = useLayerNames();
  return useMemo(() => ({ os, names }), [os, names]);
}

export function useKeyText() {
  const { state } = useWorkbench();
  const text = useTextContext();
  const morse = state.morse;
  return useMemo(
    () => ({
      names: text.names,
      os: text.os,
      /** A key's face as text (`.text`), with its hold below. */
      glyph: (action: KeyAction) => keyActionGlyph(action, morse, text),
      /** A key in a sentence. */
      describe: (action: KeyAction) => keyActionDescription(action, text),
      /** One action (a slot's), short. */
      label: (action: Action) => actionLabel(action, text),
      /** One action (a slot's), in a sentence. */
      describeAction: (action: Action) => actionDescription(action, text),
      /** A layer by its name, else "Layer n". */
      layer: (layer: number) => layerRef(text.names, layer, `Layer ${layer}`),
    }),
    [text, morse],
  );
}
