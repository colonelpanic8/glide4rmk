// TailorKey for RMK saved as MoErgo JSON and read back (docs/todo.md 30). The
// converter's own tests check the editor's layouts round-trip exactly
// (moergo-config `tests/moergo_export.rs`); this checks the same through the
// wasm client GLIDE4RMK ships, on the layout it ships.

import { describe, expect, it } from "vitest";
import type { ComboDefinition, KeyAction } from "../model/action-types";
import { offlineGlove80Catalog } from "../session/offline/glove80";
import { withTailorKey } from "../test/tailorkey";
import { parseDocument, renderDocument, snapshotFromState, type RuntimeSnapshot } from "./document";
import { exportDocument } from "./transfer";

const catalog = offlineGlove80Catalog();

/** TailorKey's keys and chords that ZMK has no equivalent for. */
const NO_ZMK_EQUIVALENT = /Backlight(Up|Down|Toggle)|MouseAccel[0-2]|MaintenanceModeToggle/;
const portable = (action: KeyAction) => !NO_ZMK_EQUIVALENT.test(JSON.stringify(action));

/** TailorKey with what MoErgo cannot hold taken out. */
function withoutUnportable(snapshot: RuntimeSnapshot): RuntimeSnapshot {
  const behaviors = snapshot.behaviors;
  if (!behaviors) throw new Error("TailorKey carries its behavior tables");
  const combos = behaviors.combos?.filter((combo: ComboDefinition) =>
    "Positions" in combo ? portable(combo.Positions.output) : true,
  );
  return {
    ...snapshot,
    layers: snapshot.layers.map((layer) => layer.map((action) => (portable(action) ? action : "No"))),
    behaviors: { ...behaviors, combos },
  };
}

/** The combos a layout programs: TailorKey's are positional, and an empty slot
 *  is an empty action combo. */
const programmed = (combos: ComboDefinition[] | undefined) => combos?.filter((combo) => "Positions" in combo);

/** A key whose runtime spelling the trip may change: a profiled tap-hold comes
 *  back as a tap pattern, and macros are numbered by first use. What they do is
 *  checked in moergo-config. */
const isRenumbered = (action: KeyAction) =>
  typeof action === "object" && ("Morse" in action || "TapHold" in action || JSON.stringify(action).includes("TriggerMacro"));

describe("TailorKey as MoErgo JSON", () => {
  it("names the bindings MoErgo cannot hold, and nothing the converter can write", async () => {
    await withTailorKey(async (_io, state) => {
      let message = "";
      try {
        exportDocument(state(), catalog, "moergo-json");
      } catch (error) {
        message = String(error);
      }
      expect(message).toContain("13 bindings cannot be written as MoErgo JSON");
      expect(message).toContain("layer 8 (Magic), editor key 27 (r2,c5): BL_TOGG");
      expect(message).toContain("combo 'combo 14': MAINT_LOCK_TOG");
      // Tap patterns, macros and user keys are written now.
      expect(message).not.toMatch(/TD\(|MACRO\(|USER\(/);
    });
  });

  it("reads back as the same layout, and saving it again changes nothing", async () => {
    await withTailorKey(async (_io, state) => {
      const before = withoutUnportable(snapshotFromState(state()));
      const json = renderDocument(before, catalog, "moergo-json");
      const after = parseDocument(json, catalog).snapshot;

      expect(after.layers.length).toBe(before.layers.length);
      after.layers.forEach((layer, index) =>
        layer.forEach((action, offset) => {
          const was = before.layers[index][offset];
          if (isRenumbered(was)) expect(isRenumbered(action), `layer ${index} offset ${offset}`).toBe(true);
          else expect(action, `layer ${index} offset ${offset}`).toEqual(was);
        }),
      );
      // The workbench holds the keyboard's whole combo table, empty slots
      // included; a file carries the programmed ones.
      expect(programmed(after.behaviors?.combos)).toEqual(programmed(before.behaviors?.combos));
      expect(after.behaviors?.macros?.length).toBe(before.behaviors?.macros?.length);
      expect(after.behaviors?.forks?.length).toBe(1);

      expect(renderDocument(after, catalog, "moergo-json", json)).toBe(json);
    });
  });
});
