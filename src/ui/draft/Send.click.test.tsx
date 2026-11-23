// @vitest-environment happy-dom
// Review & send, clicked: a change made on the keymap waits in the draft, the
// chip offers it, the review window lists it, and Send writes it to the
// simulated Glove80 and leaves the draft empty.

import { describe, expect, it } from "vitest";
import type { KeyAction } from "../../model/action-types";
import { glove80Board } from "../../session/mock/glove80";
import { mountWorkbench } from "../../test/mount";
import { draftGroups, draftSize } from "../../workbench/draft/changes";
import { KeymapCenter } from "../keymap/KeymapCenter";
import { MessageHost } from "../messages/MessageHost";
import { ConnectionChip } from "./ConnectionChip";

const hid = (key: string): KeyAction => ({ Single: { Key: { Hid: key } } }) as KeyAction;

describe("Review & send", () => {
  it("sends what the keymap changed in Draft, then says the keyboard is up to date", async () => {
    const page = await mountWorkbench(
      <>
        <ConnectionChip />
        <KeymapCenter />
        <MessageHost />
      </>,
      { board: glove80Board, mode: "draft" },
    );
    await page.dispatch({ type: "uiLayer", layer: 0 });
    expect(page.shows("Up to date")).toBe(true);

    await page.drag(page.canvasKey(0, 0), page.canvasKey(0, 1));
    await page.until(() => draftSize(draftGroups(page.state())) === 2, "the swap in the draft");
    expect(page.shows("Up to date")).toBe(false);

    await page.click(page.button("Review & send"));
    expect(page.page.querySelector('[role="dialog"][aria-label="Review and send"]')).not.toBeNull();
    expect(page.shows("2 changes not on the keyboard yet.")).toBe(true);

    await page.click(page.button("Send 2 changes"));
    await page.until(() => page.shows("Up to date"), "the send");
    const [base] = await page.bench.session.keymap.readAll(); // row 0 starts the layer
    expect(base.actions[0]).toEqual(hid("F2"));
    expect(base.actions[1]).toEqual(hid("F1"));
    expect(draftSize(draftGroups(page.state()))).toBe(0);
    // The window closes on its own once the keyboard has everything, and says so.
    expect(page.page.querySelector('[aria-label="Review and send"]')).toBeNull();
    expect(page.shows("2 changes sent")).toBe(true);
  });

  it("Keep editing closes the window and sends nothing", async () => {
    const page = await mountWorkbench(
      <>
        <ConnectionChip />
        <KeymapCenter />
      </>,
      { board: glove80Board, mode: "draft" },
    );
    await page.dispatch({ type: "uiLayer", layer: 0 });
    await page.drag(page.canvasKey(0, 0), page.canvasKey(0, 1));
    await page.until(() => draftSize(draftGroups(page.state())) === 2, "the swap in the draft");
    await page.click(page.button("Review & send"));
    await page.click(page.button("Keep editing"));
    expect(page.page.querySelector('[aria-label="Review and send"]')).toBeNull();
    const [base] = await page.bench.session.keymap.readAll();
    expect(base.actions[0]).toEqual(hid("F1"));
    expect(draftSize(draftGroups(page.state()))).toBe(2);
  });
});
