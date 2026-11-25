import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { testWorkbench } from "../../test/workbench";
import type { Fork, KeyAction, Morse } from "../../vendor/rynk-wasm/rynk_wasm";
import { DOUBLE_TAP_PATTERN, HOLD_PATTERN, TAP_PATTERN } from "../../model/key-slots";
import { emptyFork, emptyMorse, noModifiers } from "../../model/slots";
import { noLabels, withLabel } from "../../model/behavior-labels";
import { PREFERENCES, type OsChoice } from "../preferences";
import { WorkbenchContext } from "../state";
import { KeyEditor } from "./KeyEditor";

const A = { Single: { Key: { Hid: "A" } } } as unknown as KeyAction;
const TAP_HOLD = { TapHold: [{ Key: { Hid: "A" } }, { Modifier: { left_shift: true } }, 255] } as unknown as KeyAction;

const B = { Key: { Hid: "B" } };
const DOUBLE_TAP: Morse = { ...emptyMorse(), actions: [[TAP_PATTERN, { Key: { Hid: "A" } }], [DOUBLE_TAP_PATTERN, B]] } as Morse;

const SHIFTDANCE: Morse = {
  ...emptyMorse(),
  actions: [[TAP_PATTERN, { OneShotModifier: { ...noModifiers(), left_shift: true } }], [HOLD_PATTERN, { Key: { Hid: "LShift" } }]],
  profile: { ...emptyMorse().profile, hold_timeout_ms: 250, mode: "HoldOnOtherPress" },
} as Morse;
const CAPS_FORK: Fork = {
  ...emptyFork(),
  trigger: { Morse: 0 },
  positive_output: { Single: { Key: { Hid: "CapsLock" } } },
  match_any: { ...emptyFork().match_any, modifiers: { ...noModifiers(), left_shift: true, right_shift: true } },
} as Fork;
const LABELS = withLabel(withLabel(noLabels(), "morse", 0, { name: "shiftdance_v1_TK", description: "" }), "forks", 0, {
  name: "shiftdance_helper_v1_TK",
  description: "",
});

/** A slot row showing `value` (its name, then what it does). */
const slotShows = (slot: string, value: string) =>
  new RegExp(`${slot}:</span>(?:<span[^>]*>via [^<]*</span>)?(?:</span>)?<span[^>]*>${value}</span>`);

afterEach(() => PREFERENCES.os.set("auto"));

function editor(binding: KeyAction | null, { morse = [] as Morse[], forks = [] as Fork[], morseSlots = 0, os = "auto" as OsChoice } = {}) {
  PREFERENCES.os.set(os);
  const workbench = testWorkbench({
    bundle: {
      caps: { num_cols: 2, num_layers: 2, max_morses: morseSlots, max_patterns_per_key: 8 },
      model: { keys: [{ row: 0, col: 0, address: "LH-C1R1" }] },
      session: { kind: "offline" },
      lightingState: null,
      sceneStatus: null,
      compiledSceneStatus: null,
      lightingExtension: null,
      pointingConfig: null,
      runtimeConditionalStatus: null,
      lightingOutputMode: null,
    },
    state: {
      selection: binding ? { type: "key", row: 0, col: 0 } : null,
      uiLayer: 0,
      layers: [[binding ?? "No", "No"]],
      pending: {},
      layerMetadata: [{ occupied: true, name: "Base" }, { occupied: true, name: "Lower" }],
      morseProfiles: [],
      morse,
      forks,
      labels: LABELS,
    },
    dispatch: () => {},
    io: {},
  });
  return renderToStaticMarkup(
    <WorkbenchContext value={workbench}>
      <KeyEditor />
    </WorkbenchContext>,
  );
}

describe("key editor", () => {
  it("keeps its shape when no key is selected, its picker greyed out", () => {
    const html = editor(null);
    expect(html).toContain("No key selected");
    expect(html).toContain("Click a key on the keyboard to change what it does");
    expect(html).toContain("Pick Key");
    expect(html).toMatch(/inert=""[^>]*opacity-40/);
  });

  it("shows a plain key's On Tap and offers an On Hold", () => {
    const html = editor(A);
    expect(html).toContain("Left hand · row 1, column 1");
    expect(html).toContain("On Tap:");
    expect(html).toMatch(slotShows("On Tap", "A"));
    expect(html).toContain("On Hold");
    expect(html).not.toContain('aria-label="Behavior"');
    expect(html).not.toContain('aria-label="Timing"');
  });

  it("names a tap-hold's behavior and timing, with a gear on its hold for the timing editor", () => {
    const html = editor(TAP_HOLD);
    expect(html).toContain("Clear On Hold");
    expect(html).toContain("Tap-hold");
    expect(html).toContain("Keyboard default timing");
    expect(html).toMatch(/aria-label="Timing"[^>]*>[\s\S]*?aria-label="Clear On Hold"/);
    expect(html).not.toContain("Hold timing");
  });

  it("shows TailorKey's shiftdance as tap, hold and the fork's double tap", () => {
    const html = editor({ Morse: 0 } as KeyAction, { morse: [SHIFTDANCE], forks: [CAPS_FORK], morseSlots: 4, os: "win" });
    expect(html).toMatch(slotShows("On Tap", "Sticky Shift"));
    expect(html).toMatch(slotShows("On Hold", "Shift"));
    expect(html).toMatch(slotShows("On Double Tap", "Caps"));
    expect(html).toContain("via shiftdance_helper_v1_TK");
    expect(html).toContain("shiftdance_v1_TK");
    expect(html).toContain("250 ms hold");
    expect(html).not.toMatch(/[⌃⌥⇧⌘]/);
  });

  it("writes modifiers the Mac way only when the computer is a Mac", () => {
    const html = editor({ Morse: 0 } as KeyAction, { morse: [SHIFTDANCE], forks: [CAPS_FORK], morseSlots: 4, os: "mac" });
    expect(html).toMatch(slotShows("On Tap", "Sticky ⇧"));
  });

  it("offers On Double Tap only on a keyboard that can do one", () => {
    expect(editor(A)).not.toContain("On Double Tap");
    expect(editor(A, { morseSlots: 4 })).toContain("On Double Tap");
  });

  it("shows a key bound to a morse entry of tap and tap-tap as its slots", () => {
    const html = editor({ Morse: 0 } as KeyAction, { morse: [DOUBLE_TAP], morseSlots: 4 });
    expect(html).toContain("Clear On Double Tap");
    expect(html).toMatch(slotShows("On Double Tap", "B"));
    expect(html).not.toContain("Behaviors → Morse");
  });

  it("opens on Pick Key with GLIDE's quick links", () => {
    const html = editor(A);
    expect(html).toContain("Pick Key");
    expect(html).toContain("Search keys, symbols, layers");
    for (const chip of ["Letters", "Numbers", "Symbols", "Navigation", "Media", "Device"]) expect(html).toContain(chip);
  });
});
