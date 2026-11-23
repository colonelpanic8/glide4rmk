// What the keyboard reports about itself while it is open: power, links, the
// layers it has on and the modifiers and LEDs the computer sees. Read at
// connect, then kept current by its topic reports; never drafted, never sent,
// outside the history (docs/adr/0032-workbench-state-groups.md). Pure.

import type {
  BatteryStatus,
  ConnectionStatus,
  LedIndicator,
  MaintenanceMode,
  ModifierCombination,
  SplitTransportState,
} from "../vendor/rynk-wasm/rynk_wasm";

// The report types screens use, named here so that screens never import the
// generated wire package (src/architecture/boundaries.ts).
export type {
  BatteryStatus,
  /** The BLE profile in use, its state and whether it is bonded. */
  BleStatus,
  /** A split half: whether it is linked, and its battery. */
  PeripheralStatus,
} from "../vendor/rynk-wasm/rynk_wasm";

export interface DeviceReports {
  battery: BatteryStatus;
  peripheralBattery: BatteryStatus;
  connection: ConnectionStatus | null;
  maintenanceMode: MaintenanceMode | null;
  splitTransport: SplitTransportState | null;
  /** Highest-precedence active layer, derived from `activeLayers`. */
  currentLayer: number;
  activeLayers: number[];
  /** Whether the layer report covered every layer (older firmware reports fewer). */
  layerStateComplete: boolean;
  ledIndicator: LedIndicator | null;
  /** Authoritative resolved HID modifiers; null enables the legacy matrix fallback. */
  modifierState: ModifierCombination | null;
}

/** The keyboard's live reports, as screens and io read them. */
export function deviceOf(state: { readonly device: DeviceReports }): DeviceReports {
  return state.device;
}

/** The reports with `parts` as the keyboard now gives them. */
export function withDevice<S extends { readonly device: DeviceReports }>(state: S, parts: Partial<DeviceReports>): S {
  return { ...state, device: { ...state.device, ...parts } };
}
