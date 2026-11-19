import { describe, expect, it } from "vitest";
import { flagOn, flagsFromAddress, parseFlags } from "./flags";

describe("flags", () => {
  it("are read from a list, unknown names left out", () => {
    expect(parseFlags("webmcp, flows,nope")).toEqual(["flows", "webmcp"]);
    expect(parseFlags(null)).toEqual([]);
  });

  it("are off until the address turns them on, and off again with an empty list", () => {
    expect(flagOn("flows")).toBe(false);
    flagsFromAddress("?x=1");
    expect(flagOn("flows")).toBe(false);
    flagsFromAddress("?flags=flows");
    expect(flagOn("flows")).toBe(true);
    flagsFromAddress("?flags=");
    expect(flagOn("flows")).toBe(false);
  });
});
