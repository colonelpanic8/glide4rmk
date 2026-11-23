import { describe, expect, it } from "vitest";
import { offlineGlove80Catalog } from "../session/offline/glove80";
import { withTestWorkbench } from "../test/harness";
import { decorationNotes } from "./decorations";
import { renderDocument, snapshotFromState } from "./document";
import { readImport } from "./transfer";

const catalog = offlineGlove80Catalog();

const kp = (key: string, decoration?: object) => ({ value: "&kp", params: [{ value: key, params: [] }], ...(decoration && { decoration }) });

describe("decorationNotes", () => {
  it("says how many keys lose their GLIDE colour or label", () => {
    const text = JSON.stringify({ layers: [[kp("A", { background: "#f8e6d7" }), kp("B")], [kp("C", { label: "+ @" })]] });
    expect(decorationNotes(text)).toEqual([
      { approximated: true, location: undefined, message: "2 keys lose the colour or label GLIDE gave them: GLIDE4RMK does not keep them." },
    ]);
    expect(decorationNotes(JSON.stringify({ layers: [[kp("A", { label: "x" })]] }))[0].message).toBe(
      "1 key loses the colour or label GLIDE gave it: GLIDE4RMK does not keep them.",
    );
  });

  it("says nothing for a layout without decorations, or for TOML", () => {
    expect(decorationNotes(JSON.stringify({ layers: [[kp("A")]] }))).toEqual([]);
    expect(decorationNotes('[[layer]]\nkeys = ["A"]')).toEqual([]);
  });
});

describe("importing a GLIDE layout with decorations", () => {
  it("keeps the keys and notes what is lost", async () => {
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ bundle, state }) => {
      const layout = JSON.parse(renderDocument(snapshotFromState(state()), catalog, "moergo-json")) as { layers: object[][] };
      layout.layers[0][0] = { ...layout.layers[0][0], decoration: { background: "#f8e6d7" } };
      const file = readImport({ text: JSON.stringify(layout), bundle, state: state(), catalog });
      expect(file.notes.map(({ message }) => message)).toContain("1 key loses the colour or label GLIDE gave it: GLIDE4RMK does not keep them.");
    });
  });
});
