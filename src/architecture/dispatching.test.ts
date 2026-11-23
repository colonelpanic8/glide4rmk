import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareWithBaseline, key } from "./boundaries";
import { committedTypes, DISPATCH_WHY, EDIT_ACTIONS, findEditDispatches, isDispatchChecked } from "./dispatching";
import { readSource, readSourcesUnder } from "./sources";

const BASELINE = new URL("dispatching.baseline.json", import.meta.url);

describe("the dispatching rule itself", () => {
  it("applies to production UI code only", () => {
    expect(isDispatchChecked("src/ui/lighting/BackgroundPanel.tsx")).toBe(true);
    expect(isDispatchChecked("src/ui/lighting/BackgroundPanel.test.tsx")).toBe(false);
    expect(isDispatchChecked("src/workbench/io-keys.ts")).toBe(false);
  });

  it("finds edits and opaque dispatches, and leaves screen state and status alone", () => {
    const found = findEditDispatches({
      "src/ui/a.tsx": [
        'dispatch({ type: "select", selection: { type: "key", row: 0, col: 1 } });',
        'dispatch({ type: "mode", mode: "keymap" });',
        'dispatch({ type: "hoverLeds", leds: null });',
        'dispatch({ type: "keyErrDismiss", layer: 0, row: 0, col: 0 });',
        'dispatch({ type: "paint", cells, layer });',
        "const reset = { type: 'conditionalDraftReset' } as const;",
        "for (const action of actions) dispatch(action);",
        "useThing(dispatch);",
      ].join("\n"),
    });
    expect(found.map((f) => f.to)).toEqual(["paint#1", "conditionalDraftReset#1", "dispatch(action)#1"].sort());
  });

  it("numbers repeats, so another edit of the same kind is a new entry", () => {
    const found = findEditDispatches({ "src/ui/a.tsx": 'dispatch({ type: "erase" }); dispatch({ type: "erase" });' });
    expect(found.map((f) => f.to)).toEqual(["erase#1", "erase#2"]);
  });

  it("counts as an edit everything the reducer makes a step of the history", () => {
    const committed = committedTypes(readSource("src/workbench/reducer.ts"));
    expect(committed.length).toBeGreaterThan(0);
    expect(committed.filter((type) => !(EDIT_ACTIONS as readonly string[]).includes(type))).toEqual([]);
  });
});

describe("edits dispatched by screens (ratchet)", () => {
  it("has no edit dispatch beyond the baseline, and the baseline holds nothing fixed", () => {
    const found = findEditDispatches(readSourcesUnder("src/ui"));
    const keys = [...new Set(found.map(key))].sort();

    if (process.env.UPDATE_ARCH_BASELINE) {
      writeFileSync(BASELINE, `${JSON.stringify(keys, null, 2)}\n`);
      return;
    }

    const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as string[];
    const { added, fixed } = compareWithBaseline(found, baseline);
    expect(
      added.map((k) => `${k}\n    ${DISPATCH_WHY}`),
      "A screen dispatches a new edit. Go through io instead; do not add it to the baseline.",
    ).toEqual([]);
    expect(
      fixed,
      "These edit dispatches are gone. Remove them from the baseline: UPDATE_ARCH_BASELINE=1 npx vitest run src/architecture",
    ).toEqual([]);
  });
});
