// What a Flow run did, as GLIDE's result screen shows it: a mark, the outcome
// in words, the Flow's report, and the run log to open and copy; then Done,
// Undo this, Try again or back to the list (ADR 0025).

import { useState } from "react";
import { formatFlowLog, type Flow, type FlowLog } from "../../operations/flows";
import type { FlowRun } from "../../workbench/flows";
import { Button, cx } from "../kit";

/** The run log, folded away: for asking for help, so it can be copied. */
export function FlowRunLog({ log }: { log: FlowLog }) {
  const [open, setOpen] = useState(false);
  const [verbose, setVerbose] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = formatFlowLog(log, verbose);
  const copy = () => void navigator.clipboard?.writeText(text).then(() => setCopied(true));
  return (
    <div data-testid="flow-log" className="w-full text-left text-small text-mute">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-ink">
        Troubleshooting details
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <pre data-testid="flow-log-text" className="max-h-56 overflow-auto rounded-lg border border-line bg-well p-2.5 font-mono text-caption leading-relaxed whitespace-pre select-text">
            {text}
          </pre>
          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={verbose} onChange={(event) => setVerbose(event.target.checked)} /> Show everything
            </label>
            <Button variant="ghost" onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FlowResultBody({ flow, run, drafted }: { flow: Flow; run: FlowRun; drafted: boolean }) {
  const changed = run.ok && run.log.outcome === "done";
  const headline = changed ? `${flow.title} has been applied to your layout.` : run.ok ? "Nothing was changed." : `${flow.title} was not applied.`;
  return (
    <div data-testid="flow-result" data-ok={run.ok ? "true" : "false"} role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-2 text-center">
      <span className={cx("flex size-12 items-center justify-center rounded-full border-2 text-heading font-bold", run.ok ? "border-ok text-ok" : "border-danger text-danger")}>
        {run.ok ? "✓" : "!"}
      </span>
      <p className="text-title font-semibold text-ink">{headline}</p>
      <p className="text-body text-mute">{run.message}</p>
      {changed && drafted && <p className="text-body text-faint">It waits in the draft until you Review & send.</p>}
      {run.report && run.report.lines.length > 0 && (
        <ul data-testid="flow-report" className="flex w-full flex-col gap-1.5 rounded-xl border border-line bg-raised p-3 text-left">
          {run.report.lines.map((line) => (
            <li key={line.text} className={cx("flex gap-2 text-body", line.ok ? "text-ink" : "text-warn")}>
              <span aria-hidden>{line.ok ? "✓" : "!"}</span> {line.text}
            </li>
          ))}
        </ul>
      )}
      <FlowRunLog log={run.log} />
    </div>
  );
}

export function FlowResultBar({ run, category, onDone, onUndo, onTryAgain, onBack }: {
  run: FlowRun;
  category: string;
  onDone(): void;
  onUndo(): void;
  onTryAgain(): void;
  onBack(): void;
}) {
  const changed = run.ok && run.log.outcome === "done";
  return (
    <div className="flex flex-col gap-2">
      {run.ok
        ? <Button data-testid="flow-done" variant="primary" autoFocus className="w-full py-3" onClick={onDone}>Done</Button>
        : <Button data-testid="flow-retry" variant="primary" autoFocus className="w-full py-3" onClick={onTryAgain}>Try again</Button>}
      <div className="flex gap-2">
        {changed && <Button data-testid="flow-undo" className="flex-1" onClick={onUndo}>Undo this</Button>}
        <Button className="flex-1" onClick={onBack}>← Back to {category}</Button>
      </div>
    </div>
  );
}
