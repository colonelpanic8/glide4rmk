// A capability is one keyboard function the firmware may or may not have. The
// UI asks for it by id and gets the capability or `undefined`; it never learns
// about absence from a failed request.
//
// Only what a consumer reads today is described here. Further contract fields
// (durability, atomic replace, order that carries meaning, destructive) join a
// capability with the first code that needs them, not ahead of it
// (docs/adr/0002-capability-contract.md).

export type CapabilityId =
  | "lighting.state"
  | "lighting.scenes"
  | "lighting.rules"
  /** Rules that can test Bluetooth, USB and whether RGB effects are on. */
  | "lighting.rules.connection"
  /** Rules that can test which layers are on and the host's lock lights. */
  | "lighting.rules.indicators"
  /** Rules that can test the keyboard's own state: the maintenance lock, the split link. */
  | "lighting.rules.device"
  | "lighting.compiled"
  | "lighting.extension"
  | "lighting.output"
  /** Lights put on the keyboard at once and never stored (the overlay). */
  | "lighting.overlay"
  | "pointing"
  /** On Double Tap in the key editor; its slots are the morse table's. */
  | "keys.doubleTap"
  /** The Behavior Library's kinds (ADR 0020), each a table of numbered slots. */
  | "behaviors.macros"
  | "behaviors.morse"
  | "behaviors.forks"
  | "behaviors.profiles"
  /** Bluetooth, its slots the host profiles the firmware keeps (the Glove80's RMK build four, the Go60's three). */
  | "bluetooth";

/** The capabilities that are tables with a fixed number of slots. */
export type TableCapabilityId =
  | "lighting.scenes"
  | "lighting.rules"
  | "keys.doubleTap"
  | "behaviors.macros"
  | "behaviors.morse"
  | "behaviors.forks"
  | "behaviors.profiles"
  | "bluetooth";

export interface Capability {
  id: CapabilityId;
  /** Slots the firmware reserves for this surface, when it has a table. */
  slots?: number;
  /** Bytes the slots share, when they share a buffer (macros). */
  bytes?: number;
  /** How far a change goes: live over the link, or only by rebuilding the firmware. */
  reach: "device" | "build";
  /** Whether the surface cannot be written at all. */
  readOnly: boolean;
}

/** A capability whose surface is a table: its slot count is always known. */
export type TableCapability = Capability & { slots: number };

/** What one connected keyboard offers. Absent means the firmware lacks it. */
export interface CapabilitySet {
  get(id: TableCapabilityId): TableCapability | undefined;
  get(id: CapabilityId): Capability | undefined;
  has(id: CapabilityId): boolean;
  list(): Capability[];
}
