// The Flows window, as GLIDE's (ADR 0025): an app store of ready-made
// changes. Three screens in one window: the categories as tiles, a category's
// Flows (or what a search finds), and one Flow with its choices and Apply;
// after Apply, what it did. The run is io.runFlow: one change, judged by
// Guard, one Undo step, Draft or Live.

import { useEffect, useMemo, useState } from "react";
import {
  categoryTiles,
  flowIsElsewhere,
  flowNotFor,
  flowsIn,
  searchFlows,
  splitDescription,
  type Flow,
  type FlowChoice,
  type JqRunner,
} from "../../operations/flows";
import { flowBoard, type FlowRun } from "../../workbench/flows";
import { shippedFlows } from "../../workbench/flow-catalog";
import { useWorkbench } from "../state";
import { useCapabilities } from "../use-capabilities";
import { Button, ErrorBanner, SectionLabel, TextInput, cx } from "../kit";
import { CloseIcon, FlowsIcon, SearchIcon } from "../icons";
import { browserJq } from "./browserJq";
import { FlowResultBar, FlowResultBody } from "./FlowResult";
import { closeFlows, flowsStartCategory } from "./store";

let jq: JqRunner | null = null;
const jqRunner = (): JqRunner => (jq ??= browserJq());

function AdvancedBadge() {
  return <span className="ml-2 rounded border border-line-strong px-1.5 py-0.5 align-middle text-caption font-semibold uppercase tracking-widest text-mute">Advanced</span>;
}

function ChoiceField({ choice, value, onChange }: { choice: FlowChoice; value: unknown; onChange(value: unknown): void }) {
  if (choice.type === "number" || choice.type === "text") {
    return <TextInput aria-label={choice.label} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
  }
  const options = choice.type === "boolean"
    ? [{ value: true, label: "On" }, { value: false, label: "Off" }]
    : (choice.options ?? []).map((option, index) => ({ value: option, label: choice.labels?.[index] ?? option }));
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={choice.label}>
      {options.map((option) => (
        <Button key={String(option.value)} role="radio" aria-checked={option.value === value} variant={option.value === value ? "primary" : "outline"} onClick={() => onChange(option.value)}>
          {option.label}
        </Button>
      ))}
    </div>
  );
}

/** A description's lines: a paragraph each, a list item for "- ". Markdown's bold and code marks are dropped. */
function Description({ text }: { text: string }) {
  const lines = text.split("\n").map((line) => line.replace(/\*\*|`/g, "").trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line) => (line.startsWith("- ") ? <p key={line} className="pl-3 -indent-3">• {line.slice(2)}</p> : <p key={line}>{line}</p>))}
    </div>
  );
}

function FlowDetail({ flow, values, onChange }: { flow: Flow; values: Record<string, unknown>; onChange(id: string, value: unknown): void }) {
  const [showFile, setShowFile] = useState(false);
  const { tagline, more } = splitDescription(flow.description);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="w-8 shrink-0 text-center text-heading">{flow.icon}</span>
        <div className="min-w-0 flex-1">
          <h4 className="text-title font-bold text-ink">{flow.title}{flow.advanced && <AdvancedBadge />}</h4>
          {flow.subtitle && <p className="text-body text-mute">{flow.subtitle}</p>}
        </div>
        <button type="button" aria-label="Show which file this comes from" title="Which file is this?" onClick={() => setShowFile(!showFile)} className="shrink-0 cursor-pointer rounded-full border border-line px-1.5 text-caption text-mute hover:text-ink">
          i
        </button>
      </div>
      {showFile && <p data-testid="flow-file" className="break-all font-mono text-caption text-mute select-text">flows/{flow.file}{flow.author && ` · ${flow.author}`}</p>}
      {tagline && <p data-testid="flow-tagline" className="text-ui leading-relaxed text-ink">{tagline}</p>}
      {more && (
        <details data-testid="flow-more" className="text-body leading-relaxed text-mute">
          <summary className="cursor-pointer font-semibold text-ink">More details</summary>
          <div className="mt-2"><Description text={more} /></div>
        </details>
      )}
      {flow.choices.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionLabel>Your choices</SectionLabel>
          {flow.choices.map((choice) => (
            <div key={choice.id} className="flex flex-col gap-1.5">
              <span className="text-small font-semibold text-mute">{choice.label}</span>
              <ChoiceField choice={choice} value={Object.hasOwn(values, choice.id) ? values[choice.id] : choice.default} onChange={(value) => onChange(choice.id, value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A Flow in a list; one this keyboard cannot run is greyed and says why. */
function FlowRow({ flow, showCategory, notFor, onOpen }: { flow: Flow; showCategory: boolean; notFor: string | null; onOpen(): void }) {
  return (
    <button type="button" onClick={onOpen} className={cx("flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent p-2.5 text-left text-body transition-all hover:border-line-strong hover:bg-raised", notFor && "opacity-55")}>
      <span className="w-7 shrink-0 text-center text-heading">{flow.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{flow.title}{flow.advanced && <AdvancedBadge />}</span>
        {flow.subtitle && <span className="block truncate text-mute">{flow.subtitle}</span>}
        {showCategory && <span className="block truncate text-faint">{flow.category}</span>}
        {notFor && <span className="block truncate text-small text-mute">{notFor}</span>}
      </span>
    </button>
  );
}

export function FlowsWindow() {
  const { bundle, state, io } = useWorkbench();
  const capabilities = useCapabilities();
  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(flowsStartCategory);
  const [uid, setUid] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>({});
  const [runs, setRuns] = useState<Record<string, FlowRun>>({});
  const [busy, setBusy] = useState(false);

  const capabilityIds = useMemo(() => capabilities.list().map(({ id }) => id as string), [capabilities]);
  const board = useMemo(() => flowBoard(bundle, capabilityIds, state.modules), [bundle, capabilityIds, state.modules]);
  const has = (capability: string) => capabilityIds.includes(capability);

  useEffect(() => {
    let live = true;
    void shippedFlows().then((loaded) => {
      if (!live) return;
      setFlows(loaded.flows);
      setProblems(loaded.problems);
    });
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && closeFlows();
    window.addEventListener("keydown", onKey);
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // A Flow for another keyboard is not listed; one this keyboard cannot run is, greyed, with why.
  const offered = (flows ?? []).filter((flow) => !flowIsElsewhere(flow, board.id));
  const notFor = (flow: Flow) => flowNotFor(flow, board, has);
  const selected = offered.find((flow) => flow.uid === uid) ?? null;
  const searching = search.trim().length > 0;
  const run = selected ? runs[selected.uid] : undefined;

  const apply = async (flow: Flow) => {
    setBusy(true);
    const chosen = Object.fromEntries(flow.choices.map((choice) => [choice.id, values[flow.uid]?.[choice.id] ?? choice.default]));
    const result = await io.runFlow(flow, chosen, { jq: jqRunner(), board, has });
    setRuns((current) => ({ ...current, [flow.uid]: result }));
    setBusy(false);
  };
  const clearRun = (flowUid: string) => setRuns(({ [flowUid]: _, ...rest }) => rest);
  const undo = async (flow: Flow) => {
    await io.travel("undo");
    clearRun(flow.uid);
  };
  const back = () => (selected ? setUid(null) : (setCategory(null), setSearch("")));

  let body;
  let footer = null;
  if (flows === null) {
    body = <p className="py-6 text-center text-body italic text-mute">Loading Flows…</p>;
  } else if (selected) {
    body = run
      ? <FlowResultBody flow={selected} run={run} drafted={state.batchMode} />
      : <FlowDetail flow={selected} values={values[selected.uid] ?? {}} onChange={(id, value) => setValues((current) => ({ ...current, [selected.uid]: { ...current[selected.uid], [id]: value } }))} />;
    footer = run
      ? <FlowResultBar run={run} category={selected.category} onDone={closeFlows} onUndo={() => void undo(selected)} onTryAgain={() => clearRun(selected.uid)} onBack={() => setUid(null)} />
      : (
        <div className="flex flex-col gap-2">
          {notFor(selected) && <p data-testid="flow-not-for" className="text-center text-body text-mute">{notFor(selected)}</p>}
          <Button data-testid="flow-apply" variant="primary" className="w-full py-3" disabled={busy || notFor(selected) !== null} reason={notFor(selected) ?? "Applying…"} onClick={() => void apply(selected)}>{busy ? "Applying…" : "Apply to layout"}</Button>
        </div>
      );
  } else if (category || searching) {
    const listed = searching ? searchFlows(offered, search) : flowsIn(offered, category ?? "");
    body = (
      <div className="flex flex-col gap-1.5">
        {!searching && <div className="px-1"><SectionLabel>{category}</SectionLabel></div>}
        {listed.length === 0 && <p className="py-4 text-center text-body italic text-mute">No Flows match your search.</p>}
        {listed.map((flow) => <FlowRow key={flow.uid} flow={flow} showCategory={searching} notFor={notFor(flow)} onOpen={() => setUid(flow.uid)} />)}
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <div className="px-1"><SectionLabel>Browse by category</SectionLabel></div>
        {offered.length === 0 && <p className="py-4 text-center text-body italic text-mute">No Flow is made for this keyboard yet.</p>}
        <div className="grid grid-cols-2 gap-3">
          {categoryTiles(offered).map((tile) => (
            <button key={tile.category} type="button" onClick={() => setCategory(tile.category)} className="flex cursor-pointer flex-col items-start gap-2 rounded-2xl border border-line-strong bg-raised p-4 text-left transition-all hover:-translate-y-px hover:bg-hover">
              <span className="flex items-center gap-1.5">
                <span className="text-heading">{tile.icon}</span>
                <span className="text-ui opacity-60">{tile.preview.join(" ")}</span>
              </span>
              <span className="text-ui font-semibold leading-tight text-ink">{tile.category}</span>
              <span className="text-caption text-mute">{tile.count} {tile.count === 1 ? "automation" : "automations"}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const backLabel = selected ? `← Back to ${selected.category}` : category || searching ? "← All categories" : null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-well/80 backdrop-blur-md" onClick={closeFlows}>
      <div role="dialog" aria-label="Flows" onClick={(event) => event.stopPropagation()} className="mx-4 flex max-h-[85dvh] w-full max-w-lg flex-col rounded-2xl border border-line-strong bg-panel p-6 shadow-2xl max-sm:mx-0 max-sm:h-full max-sm:max-h-full max-sm:max-w-none max-sm:rounded-none max-sm:p-4">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          {backLabel ? (
            <button type="button" data-testid="flow-back" onClick={back} className="-ml-2 cursor-pointer truncate rounded-lg px-3 py-2 text-ui font-semibold text-ink transition-colors hover:bg-raised">{backLabel}</button>
          ) : (
            <h3 className="flex items-center gap-2 text-title font-bold text-ink"><FlowsIcon size={22} className="text-accent" /> Flows Automations</h3>
          )}
          <button type="button" data-testid="flow-close" aria-label="Close" onClick={closeFlows} className="shrink-0 cursor-pointer px-2 text-mute hover:text-ink"><CloseIcon size={18} /></button>
        </div>
        {!selected && (
          <div className="relative mb-3 shrink-0">
            <SearchIcon size={13} className="absolute top-1/2 left-3 -translate-y-1/2 text-mute" />
            <TextInput type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Flows Automations..." aria-label="Search Flows" className="pl-8" />
          </div>
        )}
        {problems.map((problem) => <ErrorBanner key={problem} message={problem} className="mb-2" />)}
        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">{body}</div>
        {footer && <div className="mt-3 shrink-0 border-t border-line pt-4">{footer}</div>}
      </div>
    </div>
  );
}
