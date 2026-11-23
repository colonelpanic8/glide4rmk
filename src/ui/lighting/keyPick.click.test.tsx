// @vitest-environment happy-dom
// Picking keys for a status setup, clicked from start to end: Layout
// properties → RGB Lighting → Advanced → "Choose … on the board", the window
// steps aside, keys are chosen on the keymap, Done installs the setup as one
// change in the draft and Layout properties comes back.

import { describe, expect, it } from "vitest";
import { selectedKeys } from "../../model/key-selection";
import { glove80Board } from "../../session/mock/glove80";
import { isDisabled, mountWorkbench, type Mounted } from "../../test/mount";
import { draftGroups, draftSize } from "../../workbench/draft/changes";
import { KeymapCenter } from "../keymap/KeymapCenter";
import { MessageHost } from "../messages/MessageHost";
import { LayoutProperties } from "../properties/LayoutProperties";
import { openProperties } from "../properties/store";
import { keyPick } from "./keyPick";

const windowShown = (page: Mounted) => {
  const dialog = page.page.querySelector('[role="dialog"]');
  return dialog !== null && !dialog.closest(".hidden");
};

async function openAdvanced(): Promise<Mounted> {
  const page = await mountWorkbench(
    <>
      <LayoutProperties />
      <KeymapCenter />
      <MessageHost />
    </>,
    { board: glove80Board, mode: "draft" },
  );
  await page.run(() => openProperties("lighting"));
  expect(windowShown(page)).toBe(true);
  await page.click(page.button("Advanced"));
  return page;
}

describe("picking keys for a status setup", () => {
  it("a connection key: chosen on the board, installed by Done as one change, and the window is back", async () => {
    const page = await openAdvanced();
    await page.click(page.button("Choose its key on the board"));
    expect(keyPick.get()?.kind).toBe("connection");
    expect(windowShown(page)).toBe(false);
    expect(isDisabled(page.button("Done"))).toBe(true);

    await page.click(page.canvasKey(0, 0));
    expect(selectedKeys(page.state().selection)).toEqual([{ row: 0, col: 0 }]);
    expect(page.shows("1 chosen")).toBe(true);

    await page.click(page.button("Done"));
    await page.until(() => keyPick.get() === null, "the pick to end");
    expect(draftSize(draftGroups(page.state()))).toBeGreaterThan(0);
    expect(page.shows("is on")).toBe(true);
    expect(page.state().selection).toBeNull();
    expect(windowShown(page)).toBe(true);
    // One Undo step.
    expect(page.bench.dispatched.filter((action) => action.type === "commit")).toHaveLength(1);
  });

  it("a battery bar: plain clicks add keys while picking many", async () => {
    const page = await openAdvanced();
    await page.click(page.button("Choose its keys on the board"));
    expect(keyPick.get()?.kind).toBe("battery");
    for (const col of [0, 1, 2]) await page.click(page.canvasKey(0, col));
    expect(selectedKeys(page.state().selection)).toHaveLength(3);
    expect(page.shows("3 chosen")).toBe(true);
    // A key clicked again leaves the pick.
    await page.click(page.canvasKey(0, 2));
    expect(selectedKeys(page.state().selection)).toHaveLength(2);
  });

  it("Escape cancels: nothing installed, the window back", async () => {
    const page = await openAdvanced();
    await page.click(page.button("Choose its key on the board"));
    await page.click(page.canvasKey(0, 0));
    await page.key("Escape", {}, document.body);
    expect(keyPick.get()).toBeNull();
    expect(page.state().selection).toBeNull();
    expect(draftSize(draftGroups(page.state()))).toBe(0);
    expect(windowShown(page)).toBe(true);
  });
});
