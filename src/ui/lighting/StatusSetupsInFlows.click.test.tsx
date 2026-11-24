// @vitest-environment happy-dom
// RGB Lighting → Advanced points to the status setups that are Flows (ADR
// 0035): its button opens the Flows window at "Looks & lighting", where the
// board's setups are listed.

import { describe, expect, it } from "vitest";
import { glove80Board } from "../../session/mock/glove80";
import { ortho60Board } from "../../session/mock/ortho60";
import { mountWorkbench } from "../../test/mount";
import { FlowsWindow } from "../flows/FlowsWindow";
import { useFlowsOpen } from "../flows/store";
import { LayoutProperties } from "../properties/LayoutProperties";
import { openProperties } from "../properties/store";

function FlowsWhenOpen() {
  return useFlowsOpen() ? <FlowsWindow /> : null;
}

describe("status setups in Flows", () => {
  it("open Flows at Looks & lighting, with the Glove80's setups", async () => {
    const page = await mountWorkbench(
      <>
        <LayoutProperties />
        <FlowsWhenOpen />
      </>,
      { board: glove80Board, mode: "draft" },
    );
    await page.run(() => openProperties("lighting"));
    await page.click(page.button("Advanced"));
    await page.click(page.button(/status setups in Flows/));
    await page.until(() => page.page.textContent?.includes("Glove80 status cluster") ?? false, "the Glove80 status cluster in the list");
    expect(page.page.textContent).toContain("Looks & lighting");
    expect(page.page.textContent).toContain("MoErgo Magic layer");
    expect(page.page.textContent).not.toContain("Mirror halves");
  });

  it("are a Go60's too, and a board without MoErgo's setups has no pointer", async () => {
    const go60 = await mountWorkbench(<LayoutProperties />, { fixture: "go60", mode: "draft" });
    await go60.run(() => openProperties("lighting"));
    await go60.click(go60.button("Advanced"));
    expect(go60.button(/Go60 status setups in Flows/)).toBeTruthy();

    const other = await mountWorkbench(<LayoutProperties />, { board: ortho60Board, mode: "draft" });
    await other.run(() => openProperties("lighting"));
    await other.click(other.button("Advanced"));
    expect(other.page.textContent).not.toContain("status setups in Flows");
  });
});
