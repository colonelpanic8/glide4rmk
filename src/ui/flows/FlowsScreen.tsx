// Flows (ADR 0025), in the top bar for every keyboard: the shipped Flows this keyboard
// can run, one Flow's choices, and what the last run did. The run itself is
// io.runFlow: one change, judged by Guard, one Undo step, Draft or Live.

import { useEffect, useMemo, useState } from "react";
import { flowNotFor, formatFlowLog, type Flow, type FlowChoice, type JqRunner } from "../../operations/flows";
import type { FlowRun } from "../../workbench/flows";
import { shippedFlows } from "../../workbench/flow-catalog";
import { resolveBoardProfile } from "../../model/boards/profiles";
import { useWorkbench } from "../state";
import { useCapabilities } from "../use-capabilities";
import { Button, Chip, cx, ErrorBanner, Panel, SectionLabel, TextInput } from "../kit";
import { CenterScroll } from "../advanced/bits";
import { browserJq } from "./browserJq";

let jq: JqRunner | null = null;
const jqRunner = (): JqRunner => (jq ??= browserJq());

function ChoiceField({ choice, value, onChange, disabled }: { choice: FlowChoice; value: unknown; onChange(value: unknown): void; disabled: boolean }) {
  if (choice.type === "select" || choice.type === "boolean") {
    const options = choice.type === "boolean"
      ? [{ value: true, label: "On" }, { value: false, label: "Off" }]
      : (choice.options ?? []).map((option, index) => ({ value: option, label: choice.labels?.[index] ?? option }));
    return (
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={choice.label}>
        {options.map((option) => (
          <Button key={String(option.value)} role="radio" aria-checked={option.value === value} variant={option.value === value ? "primary" : "outline"} disabled={disabled} onClick={() => onChange(option.value)}>
            {option.label}
          </Button>
        ))}
      </div>
    );
  }
  return <TextInput aria-label={choice.label} value={String(value ?? "")} disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
}

function RunResult({ run }: { run: FlowRun }) {
  const [copied, setCopied] = useState(false);
  const copy = () => void navigator.clipboard?.writeText(formatFlowLog(run.log, true)).then(() => setCopied(true));
  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-line-soft pt-4">
      {run.ok ? <p className="text-body text-ink">{run.message}</p> : <ErrorBanner message={run.message} />}
      {run.report?.lines.map((line) => (
        <p key={line.text} className={cx("text-body", line.ok ? "text-mute" : "text-warn")}>{line.ok ? "✓" : "!"} {line.text}</p>
      ))}
      <div>
        <Button variant="ghost" onClick={copy}>{copied ? "Run log copied" : "Copy run log"}</Button>
      </div>
    </div>
  );
}

export function FlowsScreen() {
  const { bundle, io } = useWorkbench();
  const capabilities = useCapabilities();
  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [run, setRun] = useState<FlowRun | null>(null);
  const [busy, setBusy] = useState(false);

  const board = useMemo(() => ({ id: resolveBoardProfile(bundle.info, bundle.caps)?.id ?? null, cols: bundle.caps.num_cols }), [bundle]);
  const has = (capability: string) => capabilities.list().some(({ id }) => id === capability);

  useEffect(() => {
    let live = true;
    void shippedFlows().then((loaded) => {
      if (!live) return;
      setFlows(loaded.flows);
      setProblems(loaded.problems);
    });
    return () => { live = false; };
  }, []);

  const offered = (flows ?? []).filter((flow) => flowNotFor(flow, board.id, has) === null);
  const flow = offered.find(({ uid }) => uid === picked) ?? offered[0];
  const valueOf = (choice: FlowChoice) => (Object.hasOwn(values, choice.id) ? values[choice.id] : choice.default);

  const pick = (uid: string) => {
    setPicked(uid);
    setValues({});
    setRun(null);
  };
  const start = async () => {
    if (!flow || busy) return;
    setBusy(true);
    const chosen = Object.fromEntries(flow.choices.map((choice) => [choice.id, valueOf(choice)]));
    setRun(await io.runFlow(flow, chosen, { jq: jqRunner(), board, has }));
    setBusy(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <CenterScroll>
        {problems.map((problem) => <ErrorBanner key={problem} message={problem} />)}
        {flows !== null && offered.length === 0 && <Panel className="p-5 text-body text-mute">No Flow is made for this keyboard yet.</Panel>}
        <div className="flex flex-wrap gap-1.5">
          {offered.map((entry) => (
            <Button key={entry.uid} variant={entry.uid === flow?.uid ? "primary" : "outline"} onClick={() => pick(entry.uid)} disabled={busy}>
              {entry.icon} {entry.title}
            </Button>
          ))}
        </div>
        {flow && (
          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <SectionLabel>{flow.title}</SectionLabel>
              <Chip>{flow.category}</Chip>
            </div>
            {flow.subtitle && <p className="mt-1 text-body text-mute">{flow.subtitle}</p>}
            <div className="mt-2 flex flex-col gap-1 text-body leading-relaxed text-faint">
              {flow.description.split("\n").filter((line) => line.trim()).map((line) => <p key={line}>{line.replace(/\*\*|`/g, "")}</p>)}
            </div>
            {flow.choices.map((choice) => (
              <div key={choice.id} className="mt-4 flex flex-col gap-1.5">
                <span className="text-small font-semibold text-mute">{choice.label}</span>
                <ChoiceField choice={choice} value={valueOf(choice)} disabled={busy} onChange={(value) => setValues((current) => ({ ...current, [choice.id]: value }))} />
              </div>
            ))}
            <div className="mt-4 flex items-center gap-2 border-t border-line-soft pt-4">
              <Button variant="primary" disabled={busy} onClick={() => void start()}>{busy ? "Running…" : "Run"}</Button>
            </div>
            {run && <RunResult run={run} />}
          </Panel>
        )}
      </CenterScroll>
    </div>
  );
}
