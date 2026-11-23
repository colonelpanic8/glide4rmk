// @vitest-environment happy-dom
// What DraftKeeper does on its own, mounted (todo 26): Live's own send of what
// waits in the draft once edits pause, and the kept draft (saved a moment
// after a change, at once when the workbench goes away, offered back on the
// next visit). Its gate alone (liveSendDue) is tested in workbench/draft.

import { afterEach, describe, expect, it } from "vitest";
import type { LightingEffect } from "../../model/lighting-types";
import { glove80Board } from "../../session/mock/glove80";
import { mountWorkbench, type Mounted } from "../../test/mount";
import { draftGroups, draftSize } from "../../workbench/draft/changes";
import { readSetting, SETTING_KEYS, writeSetting } from "../settings";
import { ConnectionChip } from "./ConnectionChip";
import { DraftKeeper } from "./DraftKeeper";

const LED = 34; // the Glove80's key at row 0, column 0
const red: LightingEffect = { Solid: { color: { r: 200, g: 0, b: 0 } } };
const changes = (page: Mounted) => draftSize(draftGroups(page.state()));
const kept = (page: Mounted) => readSetting(SETTING_KEYS.draft(page.bench.bundle.info.serial_number));
const paint = (page: Mounted) => page.dispatch({ type: "paint", cells: [{ led_id: LED, effect: red, ttl_ms: undefined }], layer: 0 });
async function litOnBoard(page: Mounted): Promise<boolean> {
  const scenes = await page.bench.session.lighting.scenes.readScenes();
  return scenes.some((cell) => cell.layer === 0 && cell.led_id === LED);
}

afterEach(() => localStorage.clear());

describe("Live's own send", () => {
  it("writes what waits in the draft once edits pause, through Send's path", async () => {
    const page = await mountWorkbench(<DraftKeeper />, { board: glove80Board, mode: "live" });
    await paint(page);
    expect(changes(page)).toBe(1);
    expect(await litOnBoard(page)).toBe(false);
    await page.until(() => changes(page) === 0, "Live's own send", 3000);
    expect(await litOnBoard(page)).toBe(true);
  });

  it("waits while edits go on: each one starts the pause again", async () => {
    const page = await mountWorkbench(<DraftKeeper />, { board: glove80Board, mode: "live" });
    await paint(page);
    await page.wait(400);
    await page.dispatch({ type: "paint", cells: [{ led_id: LED, effect: { Solid: { color: { r: 0, g: 200, b: 0 } } }, ttl_ms: undefined }], layer: 0 });
    await page.wait(400);
    expect(await litOnBoard(page)).toBe(false);
    await page.until(() => changes(page) === 0, "Live's own send", 3000);
    expect(await litOnBoard(page)).toBe(true);
  });

  it("sends nothing in Draft: the change waits for Send", async () => {
    const page = await mountWorkbench(<DraftKeeper />, { board: glove80Board, mode: "draft" });
    await paint(page);
    await page.wait(900);
    expect(changes(page)).toBe(1);
    expect(await litOnBoard(page)).toBe(false);
  });
});

describe("the kept draft", () => {
  it("is saved for the keyboard a moment after a change", async () => {
    const page = await mountWorkbench(<DraftKeeper />, { board: glove80Board, mode: "draft" });
    await paint(page);
    expect(kept(page) ?? "").toBe("");
    await page.until(() => (kept(page) ?? "") !== "", "the kept draft", 2000);
    expect(JSON.parse(kept(page) ?? "")).toBeTruthy();
  });

  it("goes at once when the workbench goes away (a reconnect remounts it)", async () => {
    const page = await mountWorkbench(<DraftKeeper />, { board: glove80Board, mode: "draft" });
    await paint(page);
    const key = SETTING_KEYS.draft(page.bench.bundle.info.serial_number);
    expect(readSetting(key) ?? "").toBe("");
    await page.unmount();
    expect(readSetting(key) ?? "").not.toBe("");
  });

  it("goes at once when the page is hidden for good (pagehide)", async () => {
    const page = await mountWorkbench(<DraftKeeper />, { board: glove80Board, mode: "draft" });
    await paint(page);
    await page.run(() => window.dispatchEvent(new Event("pagehide")));
    expect(kept(page) ?? "").not.toBe("");
  });

  it("is offered back on the next visit, and Restore puts it in the draft", async () => {
    const first = await mountWorkbench(<DraftKeeper />, { board: glove80Board, mode: "draft" });
    await paint(first);
    const key = SETTING_KEYS.draft(first.bench.bundle.info.serial_number);
    await first.unmount();
    const saved = readSetting(key) ?? "";
    expect(saved).not.toBe("");

    writeSetting(key, saved);
    const page = await mountWorkbench(
      <>
        <DraftKeeper />
        <ConnectionChip />
      </>,
      { board: glove80Board, mode: "draft" },
    );
    expect(page.shows("1 change from before, not on the keyboard")).toBe(true);
    expect(changes(page)).toBe(0);
    await page.click(page.button("Restore"));
    await page.until(() => changes(page) === 1, "the restored draft");
    expect(page.shows("from before")).toBe(false);
  });
});
