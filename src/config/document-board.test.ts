import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { documentBoard } from "./document-board";

const json = (layout: object) => JSON.stringify(layout);
const layers = (length: number) => [Array.from({ length }, () => ({ value: "&none" }))];

describe("documentBoard", () => {
  it("reads a MoErgo JSON's keyboard field", () => {
    expect(documentBoard(json({ keyboard: "go60", layers: layers(60) }))).toBe("go60");
    expect(documentBoard(json({ keyboard: "glove80", layers: layers(80) }))).toBe("glove80");
    expect(documentBoard(json({ keyboard: " Go60 " }))).toBe("go60");
    expect(documentBoard(readFileSync("src/test/fixtures/go60-factory-default.json", "utf8"))).toBe("go60");
  });

  it("reads it inside a keymap wrapper", () => {
    expect(documentBoard(json({ keymap: { keyboard: "go60", layers: layers(60) } }))).toBe("go60");
  });

  it("tells a file that names no keyboard by its layers", () => {
    expect(documentBoard(json({ layers: layers(60) }))).toBe("go60");
    expect(documentBoard(json({ layers: layers(80) }))).toBe("glove80");
    expect(documentBoard(json({}))).toBe("glove80");
  });

  it("refuses a file for another board, naming it", () => {
    expect(() => documentBoard(json({ keyboard: "corne" }))).toThrow(/for the keyboard "corne"/);
    expect(() => documentBoard("rows = 4\ncols = 12\n")).toThrow(/for a 4x12 keyboard/);
  });

  it("reads a TOML's matrix", () => {
    expect(documentBoard("rows = 5\ndefault_layer = 0\n")).toBe("go60");
    expect(documentBoard("default_layer = 0\n")).toBe("glove80");
    expect(documentBoard("rows = 6\ncols = 14\n")).toBe("glove80");
    expect(documentBoard(readFileSync("src/test/fixtures/glove80-plain.toml", "utf8"))).toBe("glove80");
  });

  it("leaves a broken file to the parser", () => {
    expect(documentBoard("{ not json")).toBe("glove80");
    expect(documentBoard("rows = = 5")).toBe("glove80");
  });
});
