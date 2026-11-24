// Every layout GLIDE4RMK knows, saved as each file its board writes and read
// back (ADR 0036): the file must open again as what was saved. A change to the
// converters that breaks a round trip fails here, not when someone opens a file.

import { describe, expect, it } from "vitest";
import { exportChecked } from "../config/transfer";
import { loadCatalog } from "../config/document";
import { glove80Board } from "../session/mock/glove80";
import { FIXTURES, withTestWorkbench, type TestBoard } from "../test/harness";

const BOARDS: Array<[string, TestBoard]> = [
  ["the simulated Glove80", glove80Board],
  ...Object.keys(FIXTURES).map((fixture): [string, TestBoard] => [`the ${fixture} fixture`, { fixture: fixture as keyof typeof FIXTURES }]),
];

describe("a saved file opens again as what was saved", () => {
  it.each(BOARDS)("%s", async (_, board) => {
    await withTestWorkbench(board, { mode: "draft" }, async ({ state, bundle, session }) => {
      const catalog = await loadCatalog(session, state(), bundle.extensionEffectNames, bundle.extensionPaletteNames);
      for (const format of bundle.boardProfile?.documents?.formats ?? []) {
        let saved: ReturnType<typeof exportChecked>;
        try {
          saved = exportChecked(state(), catalog, format, bundle.workspace?.sourceText ?? undefined, [], bundle.topology);
        } catch (error) {
          // MoErgo JSON cannot express some keys; it says which, and writes nothing.
          expect(format).toBe("moergo-json");
          expect(String(error)).toMatch(/cannot be written as MoErgo JSON/);
          continue;
        }
        expect({ format, check: saved.check }).toEqual({ format, check: { ok: true } });
      }
    });
  });
});
