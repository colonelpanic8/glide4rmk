import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderInWorkbench, testWorkbench } from "../../test/workbench";
import { WorkbenchContext } from "../state";
import { StatusPresetsPanel } from "./StatusPresetsPanel";

describe("status setups", () => {
  it("offer nothing on a board without a preset or a lit key", () => {
    const value = testWorkbench({
      bundle: {
        caps: { num_cols: 1, num_layers: 3, num_split_peripherals: 1, num_ble_profiles: 3 },
        model: { name: "test", keys: [], zones: [] },
        runtimeConditionalStatus: { capacity: 32 },
        lightingCaps: null,
      },
      state: { layers: [[], [], []], device: { currentLayer: 0 }, lightingOutputMode: null, lightingControls: { wake_layers: 0 }, layerMetadata: null },
    });
    expect(renderToStaticMarkup(<WorkbenchContext value={value}><StatusPresetsPanel /></WorkbenchContext>)).toBe("");
  });
});

describe("setups on keys picked on the board", () => {
  const draw = (caps: { ble_enabled: boolean; is_split?: boolean }, features: number | null = 1 << 17) =>
    renderInWorkbench(<StatusPresetsPanel />, {
      bundle: {
        caps: { num_cols: 2, num_layers: 3, num_ble_profiles: 3, ...caps },
        model: { name: "test", keys: [{ row: 0, col: 0, ledId: 0 }, { row: 0, col: 1 }], zones: [] },
        runtimeConditionalStatus: { capacity: 32 },
        lightingCaps: features === null ? null : { features },
      },
      state: { layers: [[], [], []], layerMetadata: null },
    });
  const pickKey = (html: string) => /<button[^>]*>(?:(?!<\/button>).)*Choose its key on the board…<\/button>/.exec(html)?.[0];

  it("are offered on any keyboard with a lit key: a battery bar, and wireless, a connection key", () => {
    const wireless = draw({ ble_enabled: true, is_split: true });
    expect(wireless).not.toContain("Glove80 Magic status cluster");
    expect(wireless).toContain("Battery bar");
    expect(wireless).toContain("Choose its keys on the board…");
    expect(wireless).toContain("Right half");
    expect(pickKey(wireless)).not.toContain('aria-disabled="true"');

    const wired = draw({ ble_enabled: false });
    expect(wired).toContain("Battery bar");
    expect(wired).not.toContain("Connection key");
    expect(wired).not.toContain("Right half");
  });

  it("say why a connection key cannot be picked on firmware whose rules cannot ask about the connection", () => {
    const html = draw({ ble_enabled: true }, null);
    expect(pickKey(html)).toContain('aria-disabled="true"');
    expect(pickKey(html)).toContain("update it first");
    expect(html).toContain("Choose its keys on the board…");
  });
});
