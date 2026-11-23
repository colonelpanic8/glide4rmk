import { describe, expect, it } from "vitest";
import type { KeyAction, MorseProfileEntry } from "../../vendor/rynk-wasm/rynk_wasm";
import { emptyMorseProfile } from "../../model/slots";
import { renderInWorkbench } from "../../test/workbench";
import { TimingPanel } from "./TimingPanel";

const HRM: MorseProfileEntry = { index: 0, name: "HRM_index_v1_TK", profile: { ...emptyMorseProfile(), hold_timeout_ms: 200 } };
const homeRowMod = { TapHold: [{ Key: { Hid: "F" } }, { Key: { Hid: "LShift" } }, 0] } as KeyAction;

function panel(layers: KeyAction[][], action: KeyAction) {
  return renderInWorkbench(<TimingPanel layer={0} row={0} col={0} action={action} keyName="LH-C2R3" onClose={() => {}} />, {
    bundle: { caps: { num_cols: 2 } },
    state: { layers, morseProfiles: [HRM] },
  });
}

describe("the key editor's timing panel", () => {
  it("copies a shared profile for this key by default, under a name that ties it to the original", () => {
    const html = panel([[homeRowMod, homeRowMod]], homeRowMod);
    expect(html).toContain("HRM_index_v1_TK");
    expect(html).toMatch(/checked=""\/><span>Only this key/);
    expect(html).toContain("HRM_index_v1_TK_LH_C2R3");
    expect(html).toContain("All 2 keys that use HRM_index_v1_TK");
    expect(html).toContain('value="200"');
  });

  it("changes a profile only this key uses in place, without asking", () => {
    const html = panel([[homeRowMod, "No"]], homeRowMod);
    expect(html).not.toContain("Only this key");
  });

  it("saves the keyboard's default timing, once changed, as the key's own profile", () => {
    const own = { TapHold: [{ Key: { Hid: "F" } }, { Key: { Hid: "LShift" } }, 255] } as KeyAction;
    const html = panel([[own, own]], own);
    expect(html).toContain("Keyboard default");
    expect(html).toContain("Saved as a new profile");
    expect(html).toContain("Timing_LH_C2R3");
  });
});
