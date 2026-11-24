// Running a Flow (ADR 0025): describe what you want, run the script, fold the
// operations it gives back, and commit the result as one change: Guard judges
// it once, it is one Undo step, and Draft or Live decides when the keyboard
// gets it (`commitImage`, ADR 0019). Any step can stop the run, and then
// nothing changes.

import { describe, type Board } from "../operations/describe";
import {
  checkChoices,
  endLog,
  flowNotFor,
  flowProgram,
  foldCalls,
  isPlainFlowMessage,
  logLine,
  newFlowLog,
  readFlowOutput,
  TIME_LIMIT_MS,
  type Flow,
  type FlowLog,
  type FlowReport,
  type JqRunner,
} from "../operations/flows";
import { patchBetween } from "../sync";
import { commitImage, factsOf } from "./apply";
import { wantOf } from "./draft/want";
import type { IoContext } from "./io";
import type { ConnectedBundle } from "../model/workbench-state";
import { resolveBoardProfile } from "../model/boards/profiles";
import { addOnKinds } from "../model/boards/add-ons";

/** The board a Flow runs on: what the registry knows of it (its name, key
 *  groups and add-on places), what the keyboard reports (its keys and
 *  capabilities) and what the layout fits (its modules). */
export function flowBoard(bundle: ConnectedBundle, capabilities: readonly string[], modules: readonly string[] = []): Board {
  const profile = resolveBoardProfile(bundle.info, bundle.caps);
  return {
    id: profile?.id ?? null,
    name: profile?.name ?? bundle.info.product_name,
    cols: bundle.caps.num_cols,
    keyCount: bundle.model.keys.length,
    groups: profile?.keyGroups ?? null,
    capabilities,
    extras: profile?.addOns ? addOnKinds(profile.addOns, modules) : undefined,
    magicLayer: profile?.magicLayer?.layer ?? null,
  };
}

export interface FlowEnvironment {
  jq: JqRunner;
  board: Board;
  /** Whether the keyboard has a capability (`capabilities/`). */
  has(capability: string): boolean;
  timeoutMs?: number;
  now?: () => Date;
}

export interface FlowRun {
  /** True when the Flow ran to the end, whether or not it changed anything. */
  ok: boolean;
  /** What to tell the person: the Flow's own words, or why it stopped. */
  message: string;
  /** The Flow's report; null when it stopped. */
  report: FlowReport | null;
  log: FlowLog;
}

export async function runFlow(
  context: IoContext,
  flow: Flow,
  values: Readonly<Record<string, unknown>>,
  env: FlowEnvironment,
): Promise<FlowRun> {
  const now = env.now ?? (() => new Date());
  const started = now();
  const log = newFlowLog(flow, started);
  const stop = (message: string, outcome: "stopped" | "error" = "stopped"): FlowRun => {
    endLog(log, outcome, `Stopped: ${message}`);
    return { ok: false, message, report: null, log };
  };

  const notFor = flowNotFor(flow, env.board, env.has);
  if (notFor) return stop(notFor);
  for (const [id, value] of Object.entries(values)) logLine(log, `Choice ${id} = ${JSON.stringify(value)}`, true);
  const wrongChoice = checkChoices(flow.choices, values);
  if (wrongChoice) return stop(wrongChoice);

  const before = wantOf(context.getState());
  const view = describe(before, env.board);
  logLine(log, `Keyboard: ${view.keyboard ?? "other"}, ${view.layers.length} layers`);
  const { program, lineOffset } = flowProgram(flow.choices, values, flow.script);
  const ran = await env.jq.run(view, program, { lineOffset, timeoutMs: env.timeoutMs ?? TIME_LIMIT_MS });
  log.ms = now().getTime() - started.getTime();
  if (!ran.ok) {
    if (isPlainFlowMessage(ran.message)) return stop(ran.message);
    logLine(log, `jq: ${ran.message}`);
    return stop(`Something went wrong while applying ${flow.title}. Your layout is untouched.`, "error");
  }
  logLine(log, `Script finished in ${log.ms} ms`);

  const output = readFlowOutput(ran.output);
  if (!output.ok) return stop(`${flow.title} gave back something GLIDE4RMK cannot use (${output.message}), so nothing was changed.`, "error");
  const { calls, report } = output;
  for (const line of report.log) logLine(log, line, true);
  if (!report.changed || calls.length === 0) {
    endLog(log, "nothing to do", "Nothing to change");
    return { ok: true, message: report.message || "Nothing was changed.", report, log };
  }

  // The script read what you wanted when it started; if that has changed
  // since, its operations may no longer be what it meant.
  if (patchBetween(before, wantOf(context.getState())).length > 0) {
    return stop(`Your layout changed while ${flow.title} ran, so nothing was changed. Run it again.`);
  }
  const folded = foldCalls(before, calls, factsOf(context.getState(), context));
  if (!folded.ok) return stop(`${flow.title} was stopped, so nothing was changed: ${folded.message}. The automation may need fixing by its author.`, "error");
  logLine(log, `${calls.length} operations: ${[...new Set(calls.map(({ name }) => name))].join(", ")}`);

  const committed = await commitImage(context, folded.image, { layerOrder: folded.layerOrder, notes: folded.labels && { labels: folded.labels } });
  if (!committed.ok) return stop(committed.message);
  endLog(log, "done", "Applied as one change");
  return { ok: true, message: report.message || `${flow.title} is done.`, report, log };
}
