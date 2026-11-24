// What a Flow's script gives back (ADR 0025): operation calls and a report.
// The calls run one after the other on the same image, each checked by the
// catalog; the first that fails stops the run, so a Flow changes all it asked
// for or nothing. Pure.

import type { KeyboardImage } from "../../sync/image";
import { OPERATIONS, runOperation, type OperationName } from "../catalog";
import type { OperationFacts, OperationResult } from "../types";

export interface FlowCall {
  name: string;
  input: unknown;
}

export interface FlowReport {
  /** False: the Flow found nothing to do; `message` says why. */
  changed: boolean;
  /** Shown after the run, or as the reason nothing changed. */
  message: string;
  /** One line per thing done (`ok`) or to look at (not `ok`). */
  lines: { text: string; ok: boolean }[];
  /** For the run log: names and counts, never keys. */
  log: string[];
}

export type FlowOutput = { ok: true; calls: FlowCall[]; report: FlowReport } | { ok: false; message: string };

const isTable = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function readReport(raw: unknown): FlowReport {
  const report = isTable(raw) ? raw : {};
  const lines = Array.isArray(report.lines) ? report.lines.filter(isTable) : [];
  return {
    changed: report.changed !== false,
    message: typeof report.message === "string" ? report.message : "",
    lines: lines.map((line) => ({ text: String(line.text ?? ""), ok: line.ok !== false })),
    log: Array.isArray(report.log) ? report.log.map(String) : [],
  };
}

/** The script's output as calls and a report, or what is wrong with it. */
export function readFlowOutput(output: unknown): FlowOutput {
  if (!isTable(output) || !Array.isArray(output.operations)) {
    return { ok: false, message: "The script did not give back { operations: [...] }" };
  }
  const calls: FlowCall[] = [];
  for (const [index, call] of output.operations.entries()) {
    if (!isTable(call) || typeof call.name !== "string") return { ok: false, message: `Operation ${index + 1} has no name` };
    calls.push({ name: call.name, input: call.input });
  }
  return { ok: true, calls, report: readReport(output.report) };
}

/** Two layer rewrites, one after the other, as one (destination → source slot). */
function thenOrder(first: number[] | undefined, second: number[] | undefined): number[] | undefined {
  if (!first) return second;
  if (!second) return first;
  return second.map((source) => first[source]);
}

/** A step that failed: `said` is the operation's own sentence for the person,
 *  when it gave one (a fact of the layout, not a fault of the Flow). */
export type FoldResult = OperationResult | { ok: false; message: string; said?: string };

/** Runs the calls in order on `image`; the result of the last, or the first failure. */
export function foldCalls(image: KeyboardImage, calls: readonly FlowCall[], facts: OperationFacts): FoldResult {
  let result: Extract<OperationResult, { ok: true }> = { ok: true, image };
  for (const [index, call] of calls.entries()) {
    if (!Object.hasOwn(OPERATIONS, call.name)) return { ok: false, message: `Step ${index + 1}: there is no operation called ${call.name}` };
    const next = runOperation(call.name as OperationName, result.image, call.input as never, { ...facts, labels: result.labels ?? facts.labels });
    if (!next.ok) {
      const message = `Step ${index + 1} (${call.name}): ${next.message}`;
      return isPlainFlowMessage(next.message) ? { ok: false, message, said: next.message } : { ok: false, message };
    }
    const notes = [...(result.notes ?? []), ...(next.notes ?? [])];
    result = {
      ok: true,
      image: next.image,
      layerOrder: thenOrder(result.layerOrder, next.layerOrder),
      labels: next.labels ?? result.labels,
      ...(notes.length > 0 ? { notes } : {}),
    };
  }
  return result;
}

/** Whether an error is a Flow's own sentence for the person, shown as it is:
 *  a full sentence, not one of jq's own complaints. */
export function isPlainFlowMessage(message: string): boolean {
  const text = message.trim();
  return text.length >= 12 && /[.!?]$/.test(text) && !/\bjq\b|\(at <|compile error|\(null\)/i.test(text);
}
