// How a Flow's script runs (ADR 0025): a jq engine behind one call, so the
// browser can run it in a worker with a time limit and tests in Node. The
// errors as a person can read them. Pure.

export const TIME_LIMIT_MS = 10_000;

/** One run: the output, or an error as jq or the Flow wrote it. Never throws. */
export type JqResult = { ok: true; output: unknown } | { ok: false; message: string; timedOut?: true };

export interface JqRunner {
  run(input: unknown, program: string, options: { lineOffset: number; timeoutMs: number }): Promise<JqResult>;
}

export const timedOut = (ms: number): JqResult => ({
  ok: false,
  timedOut: true,
  message: `The automation was stopped after ${Math.round(ms / 1000)} seconds: its script was still running (it may loop forever). Nothing was changed.`,
});

const COMPILE = /^\d+ compile errors?$/;
const WITH_LINE = /^jq: error(?: \(at [^)]*\))?: (.*?)(?: \(Unix shell quoting issues\?\))?(?: at <top-level>)?, line (\d+):?\s*$/;
const WITHOUT_LINE = /^jq: error(?: \(at [^)]*\))?: (.*)$/;

/** jq-web's error as a person reads it: a compile error with its line counted
 *  from the Flow's own script (`lineOffset` lines were put before it); any
 *  other message as jq or the Flow wrote it. */
export function readableJqError(message: string, detail: string, lineOffset: number): string {
  if (!COMPILE.test(message.trim())) return message;
  const lines = detail.split("\n");
  const found = lines.map((line) => line.match(WITH_LINE)).find(Boolean) ?? lines.map((line) => line.match(WITHOUT_LINE)).find(Boolean);
  if (!found) return "The script has a mistake jq could not explain (a compile error).";
  const what = found[1].trimEnd();
  if (!found[2]) return `The script has a mistake: ${what}.`;
  return `Line ${Math.max(1, Number(found[2]) - lineOffset)} of the script: ${what}.`;
}
