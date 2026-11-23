import { describe, expect, it } from "vitest";
import type { Flow } from "./file";
import { categoryTiles, flowsIn, searchFlows, splitDescription } from "./browse";

const flow = (title: string, category: string, extra: Partial<Flow> = {}): Flow => ({
  uid: title.toLowerCase().replace(/\W/g, "_"), title, subtitle: "", description: "", category, script: ".", choices: [],
  author: "", icon: title[0], keywords: [], advanced: false, keyboards: null, requires: [], needsKeys: [], minKeys: 0, file: `shared/${title}.flows`, ...extra,
});

const flows = [
  flow("Zebra", "Symbols"),
  flow("Alpha", "Symbols", { advanced: true }),
  flow("Beta", "Symbols"),
  flow("Colemak", "QWERTY alternatives", { keywords: ["home-row"] }),
  flow("Mine", "Things I made"),
  flow("Keys", "Modifier keys"),
];

describe("browsing Flows", () => {
  it("shows a tile per category in GLIDE's order, with a preview and a count", () => {
    expect(categoryTiles(flows)).toEqual([
      { category: "Modifier keys", icon: "⌨️", preview: ["K"], count: 1 },
      { category: "Symbols", icon: "🔣", preview: ["B", "Z", "A"], count: 3 },
      { category: "QWERTY alternatives", icon: "🔠", preview: ["C"], count: 1 },
      { category: "Things I made", icon: "⚙️", preview: ["M"], count: 1 },
    ]);
  });

  it("lists a category's Flows by title, advanced ones last", () => {
    expect(flowsIn(flows, "Symbols").map(({ title }) => title)).toEqual(["Beta", "Zebra", "Alpha"]);
  });

  it("finds Flows in a person's words, ignoring case, dashes and underscores", () => {
    expect(searchFlows(flows, "HOME row").map(({ title }) => title)).toEqual(["Colemak"]);
    expect(searchFlows(flows, "symbols").map(({ title }) => title)).toEqual(["Beta", "Zebra", "Alpha"]);
    expect(searchFlows(flows, "  ")).toEqual([]);
  });

  it("takes a description's first sentence as its tagline", () => {
    expect(splitDescription("Swaps keys, e.g. A and B. Thumb keys stay.\n\n- More")).toEqual({ tagline: "Swaps keys, e.g. A and B.", more: "Thumb keys stay.\n\n- More" });
    expect(splitDescription("No full stop")).toEqual({ tagline: "No full stop", more: "" });
  });
});
