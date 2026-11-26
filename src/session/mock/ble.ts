// The Bluetooth profiles of a simulated board, changed as the firmware changes
// them when a host selects a profile or forgets its pairing.

import type { BleStatus, ConnectionStatus } from "../../vendor/rynk-wasm/rynk_wasm";

export type BleProfiles = Pick<ConnectionStatus, "ble" | "selected">;

/** A board's profiles at start: the first one selected and as given, the rest unpaired and offline. */
export function startingProfiles(count: number, first?: BleStatus): BleProfiles {
  return {
    ble: Array.from({ length: count }, (_, slot) => (slot === 0 && first ? { ...first } : { state: "Inactive", bonded: false })),
    selected: 0,
  };
}

export function copyBleProfiles(profiles: BleProfiles): BleProfiles {
  return { ble: profiles.ble.map((profile) => ({ ...profile })), selected: profiles.selected };
}

/** Selecting a slot drops any live link and advertises on it. */
export function selectProfile(profiles: BleProfiles, slot: number): BleProfiles {
  return {
    selected: slot,
    ble: profiles.ble.map((profile, index) => ({ ...profile, state: index === slot ? "Advertising" : "Inactive" })),
  };
}

/** A forgotten slot loses its bond; the selected one advertises for a new host,
 *  any other stays offline until selected. */
export function forgetProfile(profiles: BleProfiles, slot: number): BleProfiles {
  return {
    selected: profiles.selected,
    ble: profiles.ble.map((profile, index) =>
      index === slot ? { bonded: false, state: index === profiles.selected ? "Advertising" : "Inactive" } : { ...profile },
    ),
  };
}

export function forgetEveryProfile(profiles: BleProfiles): BleProfiles {
  return profiles.ble.reduce((next, _, slot) => forgetProfile(next, slot), profiles);
}
