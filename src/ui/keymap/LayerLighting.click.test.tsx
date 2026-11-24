// @vitest-environment happy-dom
// The key's RGB Lighting tab, clicked: status lights that show the keyboard's
// own state (ADR 0035): several keys made a battery bar, filling up the column
// whatever order they were chosen in, and RGB effects and the lighting policy
// on the boards that have them.

import { describe, expect, it } from "vitest";
import { glove80Board } from "../../session/mock/glove80";
import { mountWorkbench } from "../../test/mount";
import { batteryBarRules } from "../../model/lighting/status-presets";
import { statusLightOf } from "../../model/lighting/status-light";
import { wantOf } from "../../workbench/draft/want";
import { KeymapCenter } from "./KeymapCenter";
import { LayerLighting } from "./LayerLighting";

/** The keymap and the tab for the last key chosen, on the base layer of the simulated Glove80. */
async function open(lead: number) {
  const page = await mountWorkbench(
    <>
      <KeymapCenter />
      <LayerLighting ledId={lead} />
    </>,
    { board: { ...glove80Board, seedScenes: [] }, mode: "draft" },
  );
  await page.dispatch({ type: "uiLayer", layer: 0 });
  return page;
}

describe("status lights in the RGB Lighting tab", () => {
  it("make several keys a battery bar, filling up the column, as one change", async () => {
    // The left outer column, rows 2 to 4 (LEDs 35, 36, 37), chosen top down.
    const page = await open(37);
    await page.click(page.canvasKey(1, 0));
    await page.click(page.canvasKey(2, 0), { ctrl: true });
    await page.click(page.canvasKey(3, 0), { ctrl: true });
    await page.click(page.button(/Status light/));
    await page.click(page.button("Battery bar"));
    const rules = wantOf(page.state()).runtimeConditionalScenes;
    expect(rules).toEqual(expect.arrayContaining(batteryBarRules({ layer: 0, node: 0, leds: [37, 36, 35], style: "bands" })));
    expect(page.state().history.past.length).toBeGreaterThan(0);
  });

  it("offer a battery bar only for several keys, and the lights' own state where the keyboard has it", async () => {
    const page = await open(35);
    await page.click(page.canvasKey(1, 0));
    await page.click(page.button(/Status light/));
    const text = page.page.textContent ?? "";
    expect(text).not.toContain("Battery bar");
    expect(text).toContain("RGB effects");
    expect(text).toContain("Lighting policy");
    await page.click(page.button("Lighting policy"));
    expect(statusLightOf(wantOf(page.state()).runtimeConditionalScenes, 0, 35)).toEqual({ kind: "policy" });
  });
});
