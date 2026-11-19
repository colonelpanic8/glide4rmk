// A Flow run's log (ADR 0025): what ran, the choices, how long it took and how
// it ended, for the person to copy when asking for help. Names, counts and
// reasons only, never keys, so a pasted log is safe to share. Pure.

export type FlowOutcome = "running" | "done" | "nothing to do" | "stopped" | "error";

export interface FlowLog {
  uid: string;
  title: string;
  file: string;
  /** ISO time the run started. */
  when: string;
  ms: number | null;
  outcome: FlowOutcome;
  /** `verbose` lines show only in the full view (choices, the script's own notes). */
  lines: { text: string; verbose: boolean }[];
}

export function newFlowLog(flow: { uid: string; title: string; file: string }, when: Date): FlowLog {
  return { uid: flow.uid, title: flow.title, file: flow.file, when: when.toISOString(), ms: null, outcome: "running", lines: [] };
}

export const logLine = (log: FlowLog, text: string, verbose = false): void => {
  log.lines.push({ text, verbose });
};

export function endLog(log: FlowLog, outcome: FlowOutcome, text: string): void {
  log.outcome = outcome;
  logLine(log, text);
}

export function formatFlowLog(log: FlowLog, verbose: boolean): string {
  const head = [
    `Flow: ${log.title} (${log.uid})`,
    `File: ${log.file}`,
    `Time: ${log.when}${log.ms === null ? "" : `, took ${log.ms} ms`}`,
    `Outcome: ${log.outcome}`,
  ];
  const lines = log.lines.filter((line) => verbose || !line.verbose).map((line) => `${line.verbose ? "  " : ""}${line.text}`);
  return [...head, "", ...lines].join("\n");
}
