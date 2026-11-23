import { describe, expect, it } from "vitest";
import { renderInWorkbench } from "../../test/workbench";
import { GLOVE80_ADD_ONS, GO60_ADD_ONS } from "../../model/boards/add-ons";
import type { BoardProfile } from "../../model/boards/profiles";
import { AddOnsSection } from "./AddOnsSection";

const profile = (addOns: BoardProfile["addOns"]) => ({ boardProfile: { addOns } as BoardProfile });

describe("Layout properties: add-ons", () => {
  it("switches the Glove80's touchpad modules for this layout", () => {
    const html = renderInWorkbench(<AddOnsSection label="" />, { bundle: profile(GLOVE80_ADD_ONS), state: { modules: ["rh-cirque"] } });
    expect(html).toContain("Left touchpad");
    expect(html).toMatch(/role="switch" aria-checked="false"[\s\S]*Left touchpad[\s\S]*Not fitted/);
    expect(html).toMatch(/role="switch" aria-checked="true"[\s\S]*Right touchpad[\s\S]*Fitted: the touchpad module, saved with this layout/);
  });

  it("shows the Go60's touchpads as built in, with nothing to switch", () => {
    const html = renderInWorkbench(<AddOnsSection label="" />, { bundle: profile(GO60_ADD_ONS) });
    expect(html).toContain("Built in");
    expect(html).not.toContain('role="switch"');
  });

  it("shows nothing for a board without add-on places", () => {
    expect(renderInWorkbench(<AddOnsSection label="" />, {})).toBe("");
  });
});
