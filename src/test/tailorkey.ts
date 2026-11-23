// TailorKey for RMK on a Glove80, opened as a file (the offline Glove80) in a
// workbench in Draft: a real layout with bilateral home-row mods on the base
// layer, a Typing layer without them, an Autoshift layer, shiftdance and its
// fork. For tests that run Flows and operations on something real; a test
// that needs only a plain board opens `{ fixture: "plain" }` (`harness.ts`).

import type { ConnectedBundle, WorkbenchState } from "../model/workbench-state";
import type { WorkbenchIo } from "../workbench/io";
import type { FlowEnvironment } from "../workbench/flows";
import { fixtureText, withTestWorkbench } from "./harness";

export const TAILORKEY = fixtureText("tailorkey");

/** Runs `check` on TailorKey in Draft, with a Flow environment for its board. */
export async function withTailorKey(
  check: (io: WorkbenchIo, state: () => WorkbenchState, env: FlowEnvironment, bundle: ConnectedBundle) => Promise<void>,
) {
  await withTestWorkbench({ fixture: "tailorkey" }, { mode: "draft" }, ({ io, state, flows, bundle }) => check(io, state, flows, bundle));
}
