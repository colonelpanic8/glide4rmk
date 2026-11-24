import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { offlineGlove80Catalog } from "../session/offline/glove80";
import { parseDocument, renderDocument } from "./document";
import { checkSaved } from "./saved-check";

const catalog = offlineGlove80Catalog();
const meant = parseDocument(readFileSync("src/test/fixtures/glove80-plain.toml", "utf8"), catalog).snapshot;
const text = renderDocument(meant, catalog, "toml");

describe("checkSaved", () => {
  it("passes a file that opens again as what was saved", () => {
    expect(checkSaved(text, meant, catalog, "toml")).toEqual({ ok: true });
  });

  it("stops a file the reader refuses, in the reader's words", () => {
    const broken = text.replace(/KC_Q\b/, "KC_NOPE");
    const check = checkSaved(broken, meant, catalog, "toml");
    expect(check).toMatchObject({ ok: false, opens: false, reason: expect.stringContaining("KC_NOPE") });
  });

  it("names the key that would open as another, and the part that differs", () => {
    const other = text.replace(/KC_Q\b/, "KC_W").replace(/name = "Lower"/, "name = \"Raise\"");
    const check = checkSaved(other, meant, catalog, "toml");
    expect(check).toMatchObject({ ok: false, opens: true });
    const differences = check.ok || !check.opens ? [] : check.differences;
    expect(differences[0]).toMatch(/^Base, key r\d+,c\d+ reads back as another key$/);
    expect(differences).toContain("The layer names read back differently");
  });

  it("sets aside what a file does not keep: unused slots, the trackpads' revision, the scenes' order", () => {
    const noisy = {
      ...meant,
      pointing: meant.pointing && { ...meant.pointing, revision: 9 },
      behaviors: meant.behaviors && { ...meant.behaviors, morses: [...(meant.behaviors.morses ?? []), { profile: {}, actions: [] }] },
    } as typeof meant;
    expect(checkSaved(text, noisy, catalog, "toml")).toEqual({ ok: true });
  });
});
