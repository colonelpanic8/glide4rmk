import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import "../../test/wasm";
import { parseDocument } from "../../config/document";
import { offlineGlove80Catalog, openOfflineGlove80 } from "../../session/offline/glove80";
import { renderInWorkbench } from "../../test/workbench";
import { openBundle } from "../bundle";
import { ComboList } from "./ComboList";

describe("the side panel's combos", () => {
  it("shows a combo stored once per layer once, with a chip for each layer (TailorKey for RMK)", async () => {
    // TailorKey stores each of its 10 combos twice: on Base and Autoshift, or (the Gaming toggle) on Base and Gaming.
    const text = readFileSync("src/test/fixtures/glove80-tailorkey-qwerty.toml", "utf8");
    const session = openOfflineGlove80(parseDocument(text, offlineGlove80Catalog()).snapshot);
    try {
      const html = renderInWorkbench(<ComboList />, { bundle: await openBundle(session) });
      expect(html.match(/data-testid="combo-row"/g)).toHaveLength(10);
      expect(html.match(/>Base<\/span><span[^>]*>Autoshift</g)).toHaveLength(9);
      expect(html.match(/>Base<\/span><span[^>]*>Gaming</g)).toHaveLength(1);
      expect(html).toContain("20 of");
    } finally {
      await session.close();
    }
  });
});
