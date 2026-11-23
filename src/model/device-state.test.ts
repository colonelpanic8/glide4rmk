import { describe, expect, it } from "vitest";
import { deviceOf, withDevice, type DeviceReports } from "./device-state";

const reports: DeviceReports = {
  battery: "Unavailable",
  peripheralBattery: "Unavailable",
  connection: null,
  maintenanceMode: null,
  splitTransport: null,
  currentLayer: 0,
  activeLayers: [0],
  layerStateComplete: true,
  ledIndicator: null,
  modifierState: null,
};

describe("device reports", () => {
  it("take the parts a report gives and keep the rest", () => {
    const state = { device: reports, other: 1 };
    const next = withDevice(state, { activeLayers: [0, 2], currentLayer: 2 });
    expect(deviceOf(next)).toEqual({ ...reports, activeLayers: [0, 2], currentLayer: 2 });
    expect(next.other).toBe(1);
    expect(deviceOf(state)).toBe(reports);
  });
});
