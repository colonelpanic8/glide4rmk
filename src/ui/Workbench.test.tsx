// The whole workbench renders, on a connected keyboard and on a file: the
// hooks it calls itself run above its own context, and a mistake there only
// shows when the whole screen is drawn.

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { mockProvider } from "../session/mock/board";
import { glove80Board } from "../session/mock/glove80";
import type { RynkSession } from "../session/types";
import { openBundle } from "../workbench/open";
import { hoveredBehavior } from "./behaviors/hoveredBehavior";
import { earlierDraft } from "./draft/earlier";
import { flowsStartCategory, openFlows } from "./flows/store";
import { lightView } from "./keymap/lightView";
import { openProperties } from "./properties/store";
import { Workbench } from "./Workbench";
import { endWorkbench, workbenchStores } from "./workbench-store";

let session: RynkSession | null = null;
afterEach(async () => {
  await session?.close();
  session = null;
});

describe("the workbench", () => {
  it("draws a connected keyboard, starting in Draft", async () => {
    session = await mockProvider(glove80Board).connect();
    const bundle = await openBundle(session);
    const html = renderToStaticMarkup(<Workbench bundle={bundle} onClose={() => {}} onUnexpectedDisconnect={() => {}} />);
    expect(html).toContain("Draft");
    expect(html).toContain("Up to date");
  });

  it("opens a second workbench with every store it registers back at its start", async () => {
    session = await mockProvider(glove80Board).connect();
    const bundle = await openBundle(session);
    const draw = () => renderToStaticMarkup(<Workbench bundle={bundle} onClose={() => {}} onUnexpectedDisconnect={() => {}} />);
    draw();

    // What the first workbench was doing when it went away.
    openProperties("lighting");
    openFlows("Looks & lighting");
    lightView.setTryingOut(true);
    hoveredBehavior.enter({ id: "macros:0", places: [] });
    const stores = workbenchStores();
    expect(stores.length).toBeGreaterThanOrEqual(6);
    for (const { store } of stores) store.set(Symbol("left over"));

    // The workbench's unmount runs endWorkbench (static rendering runs no effects).
    endWorkbench();
    draw();
    for (const { store, initial } of stores) expect(store.get()).toBe(initial);
    expect(flowsStartCategory()).toBeNull();
    expect(lightView.get().tryingOut).toBe(false);
    expect(hoveredBehavior.get()).toBeNull();
    expect(earlierDraft.get()).toBeNull();
  });
});
