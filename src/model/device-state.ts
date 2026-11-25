// What the keyboard reports about itself while it is open: power, links, the
// layers it has on and the modifiers and LEDs the computer sees. Read at
// connect, then kept current by its topic reports; never drafted, never sent,
// outside the history (docs/adr/0032-workbench-state-groups.md). Pure.

import type {
  BatteryStatus,
  BleStatus,
  ConnectionStatus,
  LedIndicator,
  ModifierCombination,
} from "../vendor/rynk-wasm/rynk_wasm";

// The report types screens use, named here so that screens never import the
// generated wire package (src/architecture/boundaries.ts).
export type {
  BatteryStatus,
  /** A BLE profile's state and whether it is bonded. */
  BleStatus,
  /** USB state, every BLE profile, the selected one and the preferred transport. */
  ConnectionStatus,
  /** A split half: whether it is linked, and its battery. */
  PeripheralStatus,
} from "../vendor/rynk-wasm/rynk_wasm";

export interface DeviceReports {
  battery: BatteryStatus;
  /** The first split half's battery as read at connect. The firmware has no
   *  topic for it, so it is not kept current while the keyboard is open. */
  peripheralBattery: BatteryStatus;
  connection: ConnectionStatus | null;
  /** Highest-precedence active layer, derived from `activeLayers`. */
  currentLayer: number;
  activeLayers: number[];
  /** Whether the layer report covered every layer (older firmware reports fewer). */
  layerStateComplete: boolean;
  ledIndicator: LedIndicator | null;
  /** Authoritative resolved HID modifiers; null enables the legacy matrix fallback. */
  modifierState: ModifierCombination | null;
}

/** The selected BLE profile: its slot, its state and whether it is bonded. */
export interface SelectedBle extends BleStatus {
  profile: number;
}

/** The profile the keyboard has selected, from its connection report. */
export function selectedBle(connection: ConnectionStatus): SelectedBle {
  const own = connection.ble[connection.selected] ?? { state: "Inactive", bonded: false };
  return { ...own, profile: connection.selected };
}

/** The keyboard's live reports, as screens and io read them. */
export function deviceOf(state: { readonly device: DeviceReports }): DeviceReports {
  return state.device;
}

/** The reports with `parts` as the keyboard now gives them. */
export function withDevice<S extends { readonly device: DeviceReports }>(state: S, parts: Partial<DeviceReports>): S {
  return { ...state, device: { ...state.device, ...parts } };
}
