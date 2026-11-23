// TailorKey for RMK on a Glove80, opened as a file (the offline Glove80) in a
// workbench in Draft: a real layout with bilateral home-row mods on the base
// layer, a Typing layer without them, an Autoshift layer, shiftdance and its
// fork. For tests that run Flows and operations on something real.

import { readFileSync } from "node:fs";
import "./wasm";
import { parseDocument } from "../config/document";
import { offlineGlove80Catalog, openOfflineGlove80 } from "../session/offline/glove80";
import { openBundle } from "../ui/bundle";
import type { WorkbenchState } from "../model/workbench-state";
import { nodeJq } from "./jq";
import { initialWorkbenchState } from "../workbench/initial-state";
import { ioFeaturesFor, makeIo, type WorkbenchIo } from "../workbench/io";
import { makeWorkbenchReducer } from "../workbench/reducer";
import { flowBoard, type FlowEnvironment } from "../workbench/flows";

export const TAILORKEY = readFileSync("src/test/fixtures/glove80-tailorkey-qwerty.toml", "utf8");

/** Runs `check` on TailorKey in Draft, with a Flow environment for its board. */
export async function withTailorKey(check: (io: WorkbenchIo, state: () => WorkbenchState, env: FlowEnvironment) => Promise<void>) {
  const session = openOfflineGlove80(parseDocument(TAILORKEY, offlineGlove80Catalog()).snapshot);
  try {
    const bundle = await openBundle(session);
    let state: WorkbenchState = { ...initialWorkbenchState(bundle), batchMode: true };
    const reducer = makeWorkbenchReducer(bundle.caps.num_cols);
    const io = makeIo(session, () => state, (action) => { state = reducer(state, action); }, {
      cols: bundle.caps.num_cols, onDisconnect: () => {}, features: ioFeaturesFor(bundle),
    });
    await check(io, () => state, { jq: nodeJq, board: flowBoard(bundle, ["behaviors.profiles"]), has: () => true });
  } finally {
    await session.close();
  }
}
