import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareWithBaseline, key } from "./boundaries";
import { CAPS_FIELDS, findProbes, isProbeChecked, PROBE_WHY } from "./probing";
import { readSourcesUnder } from "./sources";

const BASELINE = new URL("probing.baseline.json", import.meta.url);

describe("the probing rule itself", () => {
  it("applies to production UI code only", () => {
    expect(isProbeChecked("src/ui/lighting/BackgroundPanel.tsx")).toBe(true);
    expect(isProbeChecked("src/ui/lighting/BackgroundPanel.test.tsx")).toBe(false);
    expect(isProbeChecked("src/ui/state.tsx")).toBe(false);
    expect(isProbeChecked("src/workbench/open.ts")).toBe(false);
    expect(isProbeChecked("src/session/link-session.ts")).toBe(false);
  });

  it("finds bundle reads and null tests, and leaves value reads alone", () => {
    const probes = findProbes({
      "src/ui/a.tsx": [
        "const s = bundle.sceneStatus;",
        "if (state.lightingExtension !== null) {}",
        "if (state.pointingConfig === null) {}",
        "const w = state.lightingOutputMode?.wake_layers;",
        "const ok = capabilities.has('lighting.scenes');",
      ].join("\n"),
    });
    expect(probes.map((p) => p.to)).toEqual([
      "bundle.sceneStatus#1",
      "state.lightingExtension !== null#1",
      "state.pointingConfig === null#1",
    ]);
  });

  it("counts a null test on the bundle once, not as a read and a test", () => {
    const probes = findProbes({ "src/ui/a.tsx": "if (bundle.sceneStatus !== null) {}" });
    expect(probes.map((p) => p.to)).toEqual(["bundle.sceneStatus !== null#1"]);
  });

  it("finds firmware feature fields however caps was reached, and leaves geometry alone", () => {
    const probes = findProbes({
      "src/ui/a.tsx": [
        "if (bundle.caps.is_split) {}",
        "const caps = bundle.caps;",
        "const n = caps.max_combos;",
        "const { ble_enabled, num_cols } = bundle.caps;",
        "const w = caps.num_cols + bundle.caps.num_layers;",
        "const rows = caps.num_rows;",
      ].join("\n"),
    });
    expect(probes.map((p) => p.to)).toEqual(["caps.ble_enabled#1", "caps.is_split#1", "caps.max_combos#1"]);
  });

  it("sorts the firmware's whole capability record, geometry apart", () => {
    const geometry = Object.entries(CAPS_FIELDS).filter(([, kind]) => kind === "geometry").map(([field]) => field);
    expect(geometry.sort()).toEqual(["num_cols", "num_encoders", "num_layers", "num_rows"]);
  });

  it("numbers repeats, so a second identical probe is a new entry", () => {
    const probes = findProbes({ "src/ui/a.tsx": "bundle.sceneStatus; bundle.sceneStatus;" });
    expect(probes.map((p) => p.to)).toEqual(["bundle.sceneStatus#1", "bundle.sceneStatus#2"]);
  });
});

describe("capability probing (ratchet)", () => {
  it("has no probe beyond the baseline, and the baseline holds nothing fixed", () => {
    const probes = findProbes(readSourcesUnder("src/ui"));
    const keys = [...new Set(probes.map(key))].sort();

    if (process.env.UPDATE_ARCH_BASELINE) {
      writeFileSync(BASELINE, `${JSON.stringify(keys, null, 2)}\n`);
      return;
    }

    const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as string[];
    const { added, fixed } = compareWithBaseline(probes, baseline);
    expect(
      added.map((k) => `${k}\n    ${PROBE_WHY}`),
      "New capability probing in a screen. Use useCapability / useCapabilities instead; do not add it to the baseline.",
    ).toEqual([]);
    expect(
      fixed,
      "These probes are gone. Remove them from the baseline: UPDATE_ARCH_BASELINE=1 npx vitest run src/architecture",
    ).toEqual([]);
  });
});
