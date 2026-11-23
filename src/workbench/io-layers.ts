// The io's layers: the default layer, a layer's name (the rename_layer
// operation), and the structural operations (duplicate, move, delete). Those
// are operations (ADR 0019) on what you want after a fresh read, which brings
// every encoder and the layer state the rewrite needs; their result is one
// commit, sent at once in Live (all or nothing) and on Send in Draft.

import type { WorkbenchState } from "../model/workbench-state";
import { partsOf, readImage, type KeyboardImage } from "../sync";
import { runOperation, type OperationFacts, type OperationResult } from "../operations";
import { errorMessage } from "../session/errors";
import { applyOperation, commitImage, factsOf } from "./apply";
import { draftEditCount, pointingDraftDirty } from "./draft/selectors";
import { draftOf, wantOf } from "./draft/want";
import type { IoContext, IoFeatures, IoWriteResult, WorkbenchIo } from "./io";

type LayerIo = Pick<
  WorkbenchIo,
  "setDefaultLayer" | "renameLayer" | "duplicateLayer" | "moveLayer" | "deleteLayer" | "refreshLayerState"
>;

/** A layer operation on an image, by name and input. */
type LayerOperation = (image: KeyboardImage, facts: OperationFacts) => OperationResult;

/** Why the keyboard's layers cannot be rewritten safely now; null when they can. */
function unsafeToRewrite(state: WorkbenchState, features: IoFeatures): string | null {
  if (state.layerMetadata === null) return "this firmware does not support persistent layer metadata";
  if (state.behaviorOptions === null) {
    return "behavior options could not be read, so layer references cannot be rewritten safely";
  }
  if (!features.pointingSupported) {
    return "pointing configuration could not be read, so layer references cannot be rewritten safely";
  }
  if (state.lightingState !== null && !features.lightingOutputSupported) {
    return "lighting wake layers could not be read, so layer references cannot be rewritten safely";
  }
  return null;
}

/** Why a Live layer operation must wait; null when it may go. */
function liveBlocked(state: WorkbenchState): string | null {
  if (draftEditCount(state) > 0) return "apply or discard staged batch edits before editing layers";
  if (pointingDraftDirty(state)) return "apply or discard staged pointing edits before editing layers";
  const drafted = draftOf(state).changes.map(({ item }) => item.kind);
  if (drafted.includes("lighting")) return "apply or discard staged layer lighting before editing layers";
  if (drafted.includes("rules")) return "apply or discard staged conditional lighting before editing layers";
  return null;
}

export function layerIo(context: IoContext): LayerIo {
  const { session, getState, dispatch, features, draft } = context;

  const rejectLayerOperation = (message: string): IoWriteResult => {
    dispatch({ type: "layerOperationError", message });
    return { ok: false, message };
  };

  /** What you want on a fresh read, and the layers on now. */
  const wantedOnRead = async (): Promise<{ image: KeyboardImage; activeLayers: number[] }> => {
    const unsafe = unsafeToRewrite(getState(), features);
    if (unsafe) throw new Error(unsafe);
    const { layerStateComplete, activeLayers, ...read } = await readImage(session, { ...features, layerMetadata: true, ...partsOf(getState().base) });
    if (!layerStateComplete) throw new Error("complete active-layer state is required before editing layer structure");
    // The keyboard holds the read: what you want follows it where you had not changed it.
    dispatch({ type: "draftStored", image: read });
    return { image: wantOf(getState()), activeLayers };
  };

  const runLayerStructure = async (operation: LayerOperation): Promise<IoWriteResult> => {
    const before = getState();
    if (before.layerBusy) return { ok: false, message: "another layer operation is running" };
    if (before.lightingBusy || Object.values(before.pending).some((item) => item.status === "pending")) {
      return rejectLayerOperation("wait for pending device writes before editing layers");
    }
    const blocked = before.batchMode ? null : liveBlocked(before);
    if (blocked) return rejectLayerOperation(blocked);
    dispatch({ type: "layerOperationStart" });
    try {
      const { image, activeLayers } = await wantedOnRead();
      const facts = { ...factsOf(getState(), context), activeLayers: activeLayers.filter((layer) => layer !== image.defaultLayer) };
      const result = operation(image, facts);
      if (!result.ok) return rejectLayerOperation(result.message);
      const applied = await commitImage(context, result.image, { layerOrder: result.layerOrder });
      if (!applied.ok) return rejectLayerOperation(applied.message);
      dispatch({ type: "layerOperationDone" });
      return applied;
    } catch (error) {
      return rejectLayerOperation(errorMessage(error));
    }
  };

  return {
    setDefaultLayer(layer) {
      if (draft([{ item: { kind: "defaultLayer" }, value: layer }])) return;
      const prev = getState().defaultLayer;
      dispatch({ type: "defaultLayer", layer });
      session.keymap.setDefaultLayer(layer).catch(() => {
        dispatch({ type: "defaultLayer", layer: prev });
      });
    },
    // A name is part of what you want: the operation, judged and undone as
    // one change, waits in Draft and goes through Send's path in Live.
    async renameLayer(layer, name) {
      if (getState().layerBusy) return { ok: false, message: "another layer operation is running" };
      const result = await applyOperation(context, "rename_layer", { layer, name });
      return result.ok || result.guarded ? result : rejectLayerOperation(result.message);
    },
    duplicateLayer(layer) {
      return runLayerStructure((image, facts) => runOperation("duplicate_layer", image, { layer }, facts));
    },
    moveLayer(layer, to) {
      return runLayerStructure((image, facts) => runOperation("move_layer", image, { layer, to }, facts));
    },
    deleteLayer(layer) {
      return runLayerStructure((image, facts) => runOperation("delete_layer", image, { layer }, facts));
    },
    refreshLayerState() {
      session.keymap.layerState().then(
        (snapshot) =>
          dispatch({
            type: "topicLayers",
            defaultLayer: snapshot.defaultLayer,
            activeLayers: snapshot.activeLayers,
            complete: snapshot.complete,
          }),
        () => {},
      );
    },
  };
}
