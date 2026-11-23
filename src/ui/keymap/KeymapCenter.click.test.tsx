// @vitest-environment happy-dom
// The keymap's canvas, clicked: selecting keys (one, Ctrl or ⌘ with a click,
// Shift with a click, a selecting drag) and moving one onto another by
// dragging, in Draft and in Live, on the simulated Glove80.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { KeyAction } from "../../model/action-types";
import { selectedKeys } from "../../model/key-selection";
import { glove80Board } from "../../session/mock/glove80";
import { mountWorkbench, type Held, type Mounted } from "../../test/mount";
import { draftGroups, draftSize } from "../../workbench/draft/changes";
import { KeymapCenter } from "./KeymapCenter";

const COLS = 14; // the Glove80's matrix
const hid = (key: string): KeyAction => ({ Single: { Key: { Hid: key } } }) as KeyAction;
const place = (row: number, col: number) => ({ row, col });
const chosen = (page: Mounted) => selectedKeys(page.state().selection);
const onLayer0 = (page: Mounted, row: number, col: number) => page.state().layers[0][row * COLS + col];
async function onBoard(page: Mounted, row: number, col: number): Promise<KeyAction> {
  const layers = await page.bench.session.keymap.readAll();
  return layers[0].actions[row * COLS + col];
}

/** The keymap on the simulated Glove80, showing its base layer (it opens on the active one). */
async function open(mode: "draft" | "live"): Promise<Mounted> {
  const page = await mountWorkbench(<KeymapCenter />, { board: glove80Board, mode });
  await page.dispatch({ type: "uiLayer", layer: 0 });
  return page;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("selecting keys on the canvas", () => {
  it("a click selects that key alone", async () => {
    const page = await open("draft");
    await page.click(page.canvasKey(0, 0));
    expect(chosen(page)).toEqual([place(0, 0)]);
    await page.click(page.canvasKey(0, 3));
    expect(chosen(page)).toEqual([place(0, 3)]);
  });

  for (const [computer, platform, add] of [
    ["Windows and Linux", "Win32", { ctrl: true }],
    ["an Apple computer", "MacIntel", { meta: true }],
  ] as const) {
    it(`on ${computer}, ${"ctrl" in add ? "Ctrl" : "Command"} with a click adds a key, and again removes it`, async () => {
      vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
      const page = await open("draft");
      await page.click(page.canvasKey(0, 0));
      await page.click(page.canvasKey(0, 2), add);
      await page.click(page.canvasKey(0, 4), add);
      expect(chosen(page)).toEqual([place(0, 0), place(0, 2), place(0, 4)]);
      await page.click(page.canvasKey(0, 2), add);
      expect(chosen(page)).toEqual([place(0, 0), place(0, 4)]);
      // A plain click starts over.
      await page.click(page.canvasKey(0, 1));
      expect(chosen(page)).toEqual([place(0, 1)]);
    });
  }

  it("on an Apple computer, Ctrl with a click is the secondary click: it never selects", async () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    const page = await open("draft");
    await page.click(page.canvasKey(0, 0));
    await page.click(page.canvasKey(0, 2), { ctrl: true });
    expect(chosen(page)).toEqual([place(0, 0)]);
  });

  it("Shift with a click extends the selection to that key", async () => {
    const page = await open("draft");
    await page.click(page.canvasKey(0, 0));
    await page.click(page.canvasKey(0, 3), { shift: true });
    const keys = chosen(page);
    expect(keys[0]).toEqual(place(0, 0));
    expect(keys.at(-1)).toEqual(place(0, 3));
    expect(keys).toEqual(expect.arrayContaining([place(0, 1), place(0, 2)]));
  });

  it("Ctrl held through a drag selects every key it crosses, and moves none", async () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
    const page = await open("draft");
    const held: Held = { ctrl: true };
    await page.drag(page.canvasKey(0, 0), page.canvasKey(0, 3), { ...held, crossing: [page.canvasKey(0, 1), page.canvasKey(0, 2)] });
    expect(chosen(page)).toEqual([place(0, 0), place(0, 1), place(0, 2), place(0, 3)]);
    expect(onLayer0(page, 0, 0)).toEqual(hid("F1"));
    expect(onLayer0(page, 0, 3)).toEqual(hid("F4"));
  });

  it("Enter selects the focused key; Ctrl with Enter adds one", async () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
    const page = await open("draft");
    await page.key("Enter", {}, page.canvasKey(0, 1));
    await page.key("Enter", { ctrl: true }, page.canvasKey(0, 2));
    expect(chosen(page)).toEqual([place(0, 1), place(0, 2)]);
  });
});

describe("dragging a key onto another", () => {
  it("in Draft swaps them in the draft; the keyboard keeps its keys until Send", async () => {
    const page = await open("draft");
    await page.drag(page.canvasKey(0, 0), page.canvasKey(0, 1));
    await page.until(() => JSON.stringify(onLayer0(page, 0, 0)) === JSON.stringify(hid("F2")), "the swap");
    expect(onLayer0(page, 0, 0)).toEqual(hid("F2"));
    expect(onLayer0(page, 0, 1)).toEqual(hid("F1"));
    expect(draftSize(draftGroups(page.state()))).toBe(2);
    expect(await onBoard(page, 0, 0)).toEqual(hid("F1"));
  });

  it("in Live swaps them on the keyboard", async () => {
    const page = await open("live");
    await page.drag(page.canvasKey(0, 0), page.canvasKey(0, 1));
    await page.until(() => JSON.stringify(onLayer0(page, 0, 0)) === JSON.stringify(hid("F2")), "the swap");
    await page.until(() => draftSize(draftGroups(page.state())) === 0, "the write");
    expect(await onBoard(page, 0, 0)).toEqual(hid("F2"));
    expect(await onBoard(page, 0, 1)).toEqual(hid("F1"));
    expect(draftSize(draftGroups(page.state()))).toBe(0);
  });

  it("dropped back where it started, or off the keys, changes nothing", async () => {
    const page = await open("draft");
    await page.drag(page.canvasKey(0, 0), page.canvasKey(0, 0));
    expect(onLayer0(page, 0, 0)).toEqual(hid("F1"));
    expect(draftSize(draftGroups(page.state()))).toBe(0);
  });
});
