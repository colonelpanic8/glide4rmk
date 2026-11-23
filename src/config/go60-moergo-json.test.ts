// The Go60's MoErgo JSON through the wasm client: MoErgo's factory default
// layout opens, saves back as a Go60 file, and imports onto a Glove80. The
// converter checks the key-by-key mapping itself (moergo-config
// `tests/moergo_go60.rs`).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { offlineGlove80Catalog } from "../session/offline/glove80";
import { withTestWorkbench } from "../test/harness";
import { parseDocument, renderDocument } from "./document";
import { readImport } from "./transfer";

const catalog = offlineGlove80Catalog();
const FACTORY = readFileSync("src/test/fixtures/go60-factory-default.json", "utf8");

describe("a Go60 MoErgo JSON file", () => {
  it("opens as a Go60 and saves back as one", () => {
    const { format, snapshot, notes } = parseDocument(FACTORY, catalog);
    expect(format).toBe("moergo-json");
    expect(snapshot.layers).toHaveLength(4);
    expect(snapshot.layers[0]).toHaveLength(5 * 14);
    expect(notes.filter((note) => !note.approximated)).toEqual([]);

    const saved = renderDocument(snapshot, catalog, "moergo-json", FACTORY);
    const document = JSON.parse(saved) as { keyboard: string; layers: unknown[][]; inputListeners: unknown };
    expect(document.keyboard).toBe("go60");
    expect(document.layers.every((layer) => layer.length === 60)).toBe(true);
    // The trackpads are the template's, kept as they were.
    expect(document.inputListeners).toEqual(JSON.parse(FACTORY).inputListeners);
    expect(parseDocument(saved, catalog).snapshot.layers).toEqual(snapshot.layers);
  });

  it("imports onto a Glove80 as a converted Go60 layout", async () => {
    // TailorKey's Glove80 has room for the factory layout's four layers.
    await withTestWorkbench({ fixture: "tailorkey" }, { mode: "draft" }, async ({ bundle, state }) => {
      const imported = readImport({ text: FACTORY, bundle, state: state(), catalog });
      expect(imported.sourceBoard).toBe("go60");
      expect(imported.targetBoard).toBe("glove80");
      expect(imported.converted).toBe(true);
    });
  });
});
