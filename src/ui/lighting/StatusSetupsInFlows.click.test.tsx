// @vitest-environment happy-dom
// RGB Lighting → Advanced points to the status setups that are Flows (ADR
// 0035): its button opens the Flows window at "Looks & lighting", where the
// board's setups are listed.

import { describe, expect, it } from "vitest";
import { glove80Board } from "../../session/mock/glove80";
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
    expect(page.page.textContent).not.toContain("Mirror halves");
  });
});
