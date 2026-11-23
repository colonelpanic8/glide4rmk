import { describe, expect, it } from "vitest";
import type { WorkbenchState } from "../model/workbench-state";
import { notesChange, notesOf, withNotes } from "./notes";

const labels = { macros: {}, morse: { 0: { name: "Shiftdance", description: "" } }, forks: {}, profiles: {} } as unknown as WorkbenchState["labels"];
const state = { labels, modules: ["lh-cirque"] } as unknown as WorkbenchState;

describe("layout notes", () => {
  it("reads the notes off the state", () => {
    expect(notesOf(state)).toEqual({ labels, modules: ["lh-cirque"] });
  });

  it("sets the notes given and keeps the rest", () => {
    const next = withNotes(state, { modules: ["cirque"] });
    expect(next.modules).toEqual(["cirque"]);
    expect(next.labels).toBe(labels);
    expect(withNotes(state, {})).toEqual(state);
  });

  it("says whether any note given differs", () => {
    expect(notesChange(state, undefined)).toBe(false);
    expect(notesChange(state, { modules: ["lh-cirque"] })).toBe(false);
    expect(notesChange(state, { modules: [] })).toBe(true);
    expect(notesChange(state, { labels: { ...labels, macros: { 1: { name: "Hi", description: "" } } } as typeof labels })).toBe(true);
  });
});
