// The shipped "Mirror halves" Flow: which keys change places, checked against
// GLIDE's own tables on the Glove80, and run for real on the plain Glove80.

import { beforeAll, describe, expect, it } from "vitest";
import type { KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import { flowProgram, readFlowOutput, type ChoiceValue, type Flow } from "../operations/flows";
import { nodeJq } from "../test/jq";
import { withTestWorkbench } from "../test/harness";
import { GLOVE80_KEY_GROUPS, GO60_KEY_GROUPS, type KeyGroups } from "../model/boards/key-groups";
import { GLOVE80_GRID } from "../model/boards/glove80";
import { shippedFlows } from "./flow-catalog";

let flow: Flow;
beforeAll(async () => {
  const { flows, problems } = await shippedFlows();
  expect(problems).toEqual([]);
  flow = flows.find(({ uid }) => uid === "mirror_halves")!;
});

/** Each key of one layer named after its place, so a swap shows where every key went. */
const named = (rows: number, cols: number) => Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => ({ at: [row, col] })));

/** The places the Flow swaps on a board, as `row,col` pairs. */
async function swaps(groups: KeyGroups, rows: number, choices: Record<string, ChoiceValue>): Promise<Map<string, string>> {
  const board = { id: "test", name: "Test", keys: rows * 14, groups, capabilities: [], extras: [] };
  const view = { board, rows, cols: 14, default_layer: 0, max_layers: 8, profiles: [], combo_count: 0, layers: [{ index: 0, name: "Base", keys: named(rows, 14) }] };
  const { program, lineOffset } = flowProgram(flow.choices, { layer: "0", ...choices }, flow.script);
  const ran = await nodeJq.run(view, program, { lineOffset, timeoutMs: 0 });
  if (!ran.ok) throw new Error(ran.message);
  const output = readFlowOutput(ran.output);
  if (!output.ok) throw new Error(output.message);
  const keys = (output.calls[0].input as { keys: { row: number; col: number; action: { at: [number, number] } }[] }).keys;
  return new Map(keys.map(({ row, col, action }) => [`${row},${col}`, action.at.join(",")]));
}

/** GLIDE's Glove80 table (flows/shared/mirror-halves.flows): MoErgo positions, left and right. */
const GLIDE_LEFT = [0, 1, 2, 3, 4, 10, 11, 12, 13, 14, 15, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 46, 47, 48, 49, 50, 51, 52, 53, 54, 64, 65, 66, 67, 68, 69, 70, 71];
const GLIDE_RIGHT = {
  symmetric: [9, 8, 7, 6, 5, 21, 20, 19, 18, 17, 16, 33, 32, 31, 30, 29, 28, 45, 44, 43, 42, 41, 40, 63, 62, 61, 60, 59, 58, 57, 56, 55, 79, 78, 77, 76, 75, 74, 73, 72],
  block: [5, 6, 7, 8, 9, 16, 17, 18, 19, 20, 21, 28, 29, 30, 31, 32, 33, 40, 41, 42, 43, 44, 45, 58, 59, 60, 61, 62, 63, 55, 56, 57, 75, 76, 77, 78, 79, 72, 73, 74],
};
const placeOf = (moergo: number) => {
  const grid = GLOVE80_GRID.indexOf(moergo);
  return `${Math.floor(grid / 14)},${grid % 14}`;
};

describe("Mirror halves: which keys change places", () => {
  it.each(["symmetric", "block"] as const)("on a Glove80, as GLIDE's %s table has them", async (style) => {
    const expected = new Map(GLIDE_LEFT.flatMap((left, i) => {
      const [a, b] = [placeOf(left), placeOf(GLIDE_RIGHT[style][i])];
      return [[a, b], [b, a]];
    }));
    expect(await swaps(GLOVE80_KEY_GROUPS, 6, { style })).toEqual(expected);
  });

  it("on a Go60, pinky to pinky: every key with its mirror image, the thumbs by row", async () => {
    const moved = await swaps(GO60_KEY_GROUPS, 5, { style: "symmetric" });
    expect(moved.size).toBe(60);
    for (const [from, to] of moved) {
      const [row, col] = from.split(",").map(Number);
      expect(to).toBe(`${row},${13 - col}`);
    }
  });

  it("on a Go60, left side to right side: the order kept, the thumb fan too", async () => {
    const moved = await swaps(GO60_KEY_GROUPS, 5, { style: "block" });
    expect(moved.get("1,0")).toBe("1,8");
    expect(moved.get("4,2")).toBe("4,9");
    expect(moved.get("0,6")).toBe("2,7");
    expect(moved.get("1,6")).toBe("1,7");
  });

  it("leaves the thumb keys alone when asked", async () => {
    const moved = await swaps(GLOVE80_KEY_GROUPS, 6, { style: "symmetric", keep_thumbs: true });
    expect([...moved.keys()].filter((place) => place.endsWith(",6") || place.endsWith(",7"))).toEqual([]);
    expect(moved.size).toBe(80 - 12);
  });
});

describe("Mirror halves on the plain Glove80", () => {
  const at = (layers: KeyAction[][], row: number, col: number) => layers[0][row * 14 + col];

  it("swaps the base layer as one step, and a second run puts it back", async () => {
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ io, state, flows }) => {
      const before = state().layers;
      const run = await io.runFlow(flow, { layer: "0" }, flows);
      expect(run).toMatchObject({ ok: true });
      expect(run.report?.lines[1].text).toBe("Thumb keys changed places too");
      const after = state().layers;
      expect(at(after, 3, 1)).toEqual(at(before, 3, 12));
      expect(at(after, 3, 12)).toEqual(at(before, 3, 1));
      expect(after.slice(1)).toEqual(before.slice(1));
      expect(state().history.past).toHaveLength(1);
      expect(await io.runFlow(flow, { layer: "0" }, flows)).toMatchObject({ ok: true });
      expect(state().layers).toEqual(before);
    });
  });

  it("names a layer the layout does not have, and changes nothing", async () => {
    await withTestWorkbench({ fixture: "plain" }, { mode: "draft" }, async ({ io, state, flows }) => {
      const before = state().layers;
      expect(await io.runFlow(flow, { layer: "31" }, flows)).toMatchObject({
        ok: false,
        message: expect.stringMatching(/^Layer 32 is not in this layout, which has \d+ layers\. Pick one of them, so nothing was changed\.$/),
      });
      expect(state().layers).toBe(before);
    });
  });
});
