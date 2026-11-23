// @vitest-environment happy-dom
// The whole workbench, mounted in a page: unmounting it runs endWorkbench, so
// every store made with createWorkbenchStore is back at its start (ADR 0024).
// The static test beside this one (Workbench.test.tsx) can only call
// endWorkbench itself, as static rendering runs no effects.

import { describe, expect, it } from "vitest";
import { mockProvider } from "../session/mock/board";
import { glove80Board } from "../session/mock/glove80";
import { mount, mountWorkbench } from "../test/mount";
import { openBundle } from "../workbench/open";
import { hoveredBehavior } from "./behaviors/hoveredBehavior";
import { openFlows } from "./flows/store";
import { lightView } from "./keymap/lightView";
import { keyPick } from "./lighting/keyPick";
import { openProperties } from "./properties/store";
import { Workbench } from "./Workbench";
import { workbenchStores } from "./workbench-store";

/** Leaves every registered store somewhere other than its start. */
function leaveStoresBusy() {
  keyPick.start({ kind: "connection", layer: 0, connection: { type: "usb" } });
  openProperties("lighting");
  openFlows();
  lightView.setTryingOut(true);
  hoveredBehavior.enter({ id: "macros:0", places: [] });
  const stores = workbenchStores();
  for (const { store } of stores) store.set(Symbol("left over"));
  for (const { store, initial } of stores) expect(store.get()).not.toBe(initial);
  return stores;
}

describe("unmounting the workbench", () => {
  it("puts every workbench store back at its start", async () => {
    const session = await mockProvider(glove80Board).connect();
    try {
      const bundle = await openBundle(session);
      const page = mount(<Workbench bundle={bundle} onClose={() => {}} onUnexpectedDisconnect={() => {}} />);
      expect(page.page.textContent).toContain("Draft");
      const stores = leaveStoresBusy();
      expect(stores.length).toBeGreaterThanOrEqual(6);
      page.unmount();
      for (const { store, initial } of stores) expect(store.get()).toBe(initial);
    } finally {
      await session.close();
    }
  });

  it("does the same for a screen mounted in a test workbench", async () => {
    const page = await mountWorkbench(<span>a screen</span>, { board: glove80Board, mode: "draft" });
    const stores = leaveStoresBusy();
    await page.unmount();
    for (const { store, initial } of stores) expect(store.get()).toBe(initial);
  });
});
