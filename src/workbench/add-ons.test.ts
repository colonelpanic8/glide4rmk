// A layout's add-on modules (ADR 0028) through the workbench: one Undo step,
// kept in the file the layout is saved to, read back when it opens, and what a
// Flow sees as the board's extras.

import { describe, expect, it } from "vitest";
import { exportDocument } from "../config/transfer";
import { modulesFromFile } from "../config/add-ons";
import { offlineGlove80Catalog } from "../session/offline/glove80";
import { withTestWorkbench, type TestWorkbench } from "../test/harness";
import { describe as describeImage } from "../operations/describe";
import { wantOf } from "./draft/want";
import { flowBoard } from "./flows";

/** A plain Glove80 layout in Draft: add-ons need the board, not a rich layout. */
const onGlove80 = (check: (bench: TestWorkbench) => Promise<void>) => withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, check);

describe("the Glove80's touchpad modules", () => {
  it("are one Undo step each, and change no key", async () => {
    await onGlove80(async ({ io, state }) => {
      const keys = state().layers;
      io.setModules(["lh-cirque", "rh-cirque"]);
      expect(state().modules).toEqual(["lh-cirque", "rh-cirque"]);
      expect(state().history.past).toHaveLength(1);
      expect(state().layers).toBe(keys);
      await io.travel("undo");
      expect(state().modules).toEqual([]);
      await io.travel("redo");
      expect(state().modules).toEqual(["lh-cirque", "rh-cirque"]);
    });
  });

  it("are saved with the layout and read back (MoErgo JSON: config/add-ons.test.ts)", async () => {
    await onGlove80(async ({ io, state }) => {
      io.setModules(["rh-cirque"]);
      const toml = exportDocument(state(), offlineGlove80Catalog(), "toml");
      expect(toml.split("\n")[0]).toBe('# hardware_modules = "rh-cirque"');
      expect(modulesFromFile(toml, "toml")).toEqual(["rh-cirque"]);
    });
  });

  it("make the board's extras what a Flow reads: pointing only when a touchpad is fitted", async () => {
    await onGlove80(async ({ state, bundle }) => {
      const extras = (modules: string[]) => describeImage(wantOf(state()), flowBoard(bundle, ["pointing"], modules)).board.extras;
      expect(extras([])).toEqual([]);
      expect(extras(["lh-cirque"])).toEqual(["pointing"]);
    });
  });
});
