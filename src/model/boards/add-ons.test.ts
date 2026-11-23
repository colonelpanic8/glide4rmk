import { describe, expect, it } from "vitest";
import { GLOVE80_ADD_ONS, GO60_ADD_ONS, addOnKinds, fittedAddOns, readModules, withPlace, writeModules } from "./add-ons";

const [left, right] = GLOVE80_ADD_ONS;

describe("add-ons", () => {
  it("are fitted when built in, or when the layout turns their module on", () => {
    expect(fittedAddOns(GO60_ADD_ONS, []).map(({ id }) => id)).toEqual(["left-touchpad", "right-touchpad"]);
    expect(fittedAddOns(GLOVE80_ADD_ONS, [])).toEqual([]);
    expect(fittedAddOns(GLOVE80_ADD_ONS, ["rh-cirque"])).toEqual([right]);
    expect(fittedAddOns(GLOVE80_ADD_ONS, ["cirque"])).toEqual([left, right]);
    expect(addOnKinds(GLOVE80_ADD_ONS, ["lh-cirque"])).toEqual(["pointing"]);
    expect(addOnKinds(GLOVE80_ADD_ONS, [])).toEqual([]);
  });

  it("turn one side on or off, keeping the other and any module the board does not know", () => {
    expect(withPlace(GLOVE80_ADD_ONS, ["other"], right, true)).toEqual(["rh-cirque", "other"]);
    expect(withPlace(GLOVE80_ADD_ONS, ["rh-cirque", "lh-cirque"], right, false)).toEqual(["lh-cirque"]);
    expect(withPlace(GLOVE80_ADD_ONS, ["cirque"], left, false)).toEqual(["rh-cirque"]);
    expect(withPlace(GO60_ADD_ONS, [], GO60_ADD_ONS[0], false)).toEqual([]);
  });

  it("read and write MoErgo's hardware_modules", () => {
    expect(readModules(" lh-cirque, rh-cirque ,")).toEqual(["lh-cirque", "rh-cirque"]);
    expect(readModules(undefined)).toEqual([]);
    expect(writeModules(["lh-cirque", "rh-cirque"])).toBe("lh-cirque,rh-cirque");
  });
});
