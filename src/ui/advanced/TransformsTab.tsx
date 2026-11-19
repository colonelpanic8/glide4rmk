// Transforms: keymap-wide rewrites — the dual-OS Ctrl↔GUI swap, the
// apply_transform operation (ADR 0019): one change, one Undo step; in Draft it
// waits for Send, in Live it is sent at once. Switching typing layouts is a
// Flow (ADR 0025).

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { TransformChoice } from "../../operations";
import { useWorkbench } from "../state";
import { Button, Chip, Panel, SectionLabel } from "../kit";
import { CenterScroll } from "./bits";
import { planOsSwap, planKeyCount, planSize, type TransformPlan } from "../../model/transforms";

type RunState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; changes: number; drafted: boolean }
  | { phase: "error"; message: string };

export function TransformsTab({ nav }: { nav: ReactNode }) {
  const { bundle, state, io } = useWorkbench();
  const [run, setRun] = useState<RunState>({ phase: "idle" });

  const input = useMemo(
    () => ({
      layers: state.layers,
      cols: bundle.caps.num_cols,
      combos: state.combos,
      morse: state.morse,
      forks: state.forks,
      macroOps: state.macroOps,
    }),
    [
      state.layers,
      bundle.caps.num_cols,
      state.combos,
      state.morse,
      state.forks,
      state.macroOps,
    ],
  );

  const osPlan = useMemo(() => planOsSwap(input), [input]);
  const busy = run.phase === "running";

  const execute = async (choice: TransformChoice, plan: TransformPlan) => {
    const changes = planSize(plan);
    if (changes === 0 || busy) return;
    setRun({ phase: "running" });
    const result = await io.apply("apply_transform", choice);
    if (result.ok) setRun({ phase: "done", changes, drafted: state.batchMode });
    else setRun(result.guarded ? { phase: "idle" } : { phase: "error", message: result.message });
  };

  /** The chip aggregates key cells with slot-table and macro-region writes;
   *  spell the split out rather than leaving one number to explain both. */
  const planBreakdown = (plan: TransformPlan): string => {
    const keys = planKeyCount(plan);
    const tables = planSize(plan) - keys;
    return `${keys} key binding${keys === 1 ? "" : "s"}, ${tables} combo/morse/fork/macro write${tables === 1 ? "" : "s"}`;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {nav}
      <CenterScroll>
        <Panel className="p-5">
          <SectionLabel>Swap Ctrl ↔ GUI</SectionLabel>
          <p className="mt-1.5 text-body leading-relaxed text-faint">
            Converts a PC-style keymap to its macOS counterpart (and back — the swap is
            its own inverse). Rewrites every binding that names Ctrl or GUI: keys on all
            layers, combos, morse slots, forks, and macro steps. One step to undo.
          </p>
          <div className="mt-4 flex items-center gap-2 border-t border-line-soft pt-4">
            <Button
              variant="primary"
              disabled={busy || planSize(osPlan) === 0}
              onClick={() => execute({ transform: "ctrl-gui-swap" }, osPlan)}
            >
              Swap everywhere
            </Button>
            <span title={planBreakdown(osPlan)}>
              <Chip tone={planSize(osPlan) === 0 ? "neutral" : "accent"}>
                {planSize(osPlan)} {planSize(osPlan) === 1 ? "change" : "changes"}
              </Chip>
            </span>
          </div>
        </Panel>

        {run.phase === "running" && <div className="text-center text-body text-accent">Writing…</div>}
        {run.phase === "done" && (
          <div className="text-center text-body text-ok">
            {run.drafted
              ? `${run.changes} ${run.changes === 1 ? "change" : "changes"} in the draft.`
              : `Wrote ${run.changes} ${run.changes === 1 ? "change" : "changes"} to the keyboard.`}
          </div>
        )}
        {run.phase === "error" && (
          <div className="text-center text-body text-danger">Transform failed: {run.message}</div>
        )}
      </CenterScroll>
    </div>
  );
}
