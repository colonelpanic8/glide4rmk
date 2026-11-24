import { describe, expect, it } from "vitest";
import { ALL_SECTIONS } from "./areas";
import { DEFAULT_WORDING, TERMS, normalizeWording, termFor, type TermId } from "./terms";

describe("terms", () => {
  it("has both voices for every term, and none empty", () => {
    for (const [id, term] of Object.entries(TERMS)) {
      expect(term.technical.length, `${id} technical`).toBeGreaterThan(0);
      expect(term.friendly.length, `${id} friendly`).toBeGreaterThan(0);
    }
  });

  it("keeps the RMK and Rynk words as the technical voice and the default", () => {
    expect(DEFAULT_WORDING).toBe("technical");
    const technical: Record<string, string> = {
      "section.keymap": "Keymap",
      "section.combos": "Combos",
      "section.morse": "Morse",
      "section.macros": "Macros",
      "section.forks": "Forks",
      "section.profiles": "Profiles",
      "section.transforms": "Transforms",
      "section.usage": "All your behaviors",
      "section.live": "Live",
    };
    for (const [id, label] of Object.entries(technical)) expect(termFor(id as TermId, "technical")).toBe(label);
  });

  it("names every section of src/ui/areas.ts", () => {
    for (const section of ALL_SECTIONS) expect(TERMS).toHaveProperty(`section.${section}`);
  });

  it("keeps area names short enough for the narrow rail", () => {
    for (const [id, term] of Object.entries(TERMS)) {
      if (id.startsWith("area.")) {
        expect(term.technical.length, id).toBeLessThanOrEqual(10);
        expect(term.friendly.length, id).toBeLessThanOrEqual(10);
      }
    }
  });

  it("fills a term's placeholders, and leaves one it is not given", () => {
    expect(termFor("lighting.setupsInFlows", "technical", { board: "Go60" })).toBe("Go60 status setups in Flows");
    expect(termFor("lighting.setupsInFlows", "friendly", { board: "Glove80" })).toBe("Status lights for your Glove80, in Flows");
    expect(termFor("lighting.setupsInFlows", "friendly")).toBe("Status lights for your {board}, in Flows");
  });

  it("uses no word for what the app no longer has", () => {
    for (const [id, term] of Object.entries(TERMS)) {
      for (const text of [term.technical, term.friendly]) expect(text, id).not.toMatch(/batch|start(s)? (the history )?over/i);
    }
  });

  it("falls back to the default for anything that is not a voice", () => {
    expect(normalizeWording("friendly")).toBe("friendly");
    expect(normalizeWording("technical")).toBe("technical");
    expect(normalizeWording("pirate")).toBe("technical");
    expect(normalizeWording(undefined)).toBe("technical");
  });
});
