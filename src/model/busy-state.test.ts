import { describe, expect, it } from "vitest";
import { busyOf, withBusy, type BusyFlags } from "./busy-state";

const idle: BusyFlags = {
  batchBusy: false,
  batchError: null,
  layerBusy: false,
  layerError: null,
  lightingBusy: false,
  lightingError: null,
  pointingBusy: false,
  pointingError: null,
};

describe("busy flags", () => {
  it("set the flags given and keep the rest", () => {
    const state = { busy: { ...idle, batchError: "1 change waits" }, other: 1 };
    const next = withBusy(state, { lightingBusy: true });
    expect(busyOf(next)).toEqual({ ...idle, batchError: "1 change waits", lightingBusy: true });
    expect(next.other).toBe(1);
    expect(busyOf(state).lightingBusy).toBe(false);
  });
});
