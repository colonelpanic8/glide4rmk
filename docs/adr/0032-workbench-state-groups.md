# 0032. The workbench state in groups: the keyboard's reports and the busy flags

**Status:** Accepted. Does the first two steps of P2 in `docs/architecture-review.md` (`device`, then `busy`); the later steps amend this record.

## Context

`WorkbenchState` holds 63 fields side by side: keyboard items, drafts, the keyboard's live reports, busy and error flags, and the screen's own state. A screen reads `state.battery` beside `state.layers`, so nothing says which fields are drafted and sent and which are only reported, and every new field widens the one flat record. P2 proposes `{ base, want, basedOn, history, notes, device, busy, ui }`, one group at a time, each step mechanical and green.

## Decision

- **`state.device`** (`model/device-state.ts`, `DeviceReports`) holds what the keyboard reports about itself while it is open: `battery`, `peripheralBattery`, `connection`, the layer report (`currentLayer`, `activeLayers`, `layerStateComplete`), `ledIndicator` and `modifierState`. Read at connect (`initialWorkbenchState`), then kept current by the topic actions (`topicLayers`, `topicBattery`, `topicConnection`, `topicLedIndicator`, `topicModifier`) through `withDevice`. Never drafted, never sent, outside the history. `peripheralBattery` is read at connect only: the firmware has no topic for it, so it can be stale while the keyboard is open, which is accepted.
- **Reports nothing reads are not kept:** maintenance mode and the split link were read at connect and never again, and no screen showed them, so the state holds neither (todo 29 for bringing them back).
- **`state.busy`** (`model/busy-state.ts`, `BusyFlags`) holds what is being written and why the last write of each kind failed: `batchBusy`, `batchError`, `layerBusy`, `layerError`, `lightingBusy`, `lightingError`, `pointingBusy`, `pointingError` (the connect-time pointing read's error included). The reducers set them through `withBusy`; the names stay as they were, so a search for one still finds every use.
- **Read through a selector, never the path:** core code reads `deviceOf(state)` and `busyOf(state)`, a screen `useDevice()` and `useBusy()` (`ui/state.tsx`); a screen that owns the state or is at its size cap uses the selector. The report types screens need (`BatteryStatus`, `BleStatus`, `PeripheralStatus`) are named in `model/device-state.ts`, like `model/action-types.ts`.
- **What stays outside:** `pending` (per key, slot and field write status, with the action to retry) is keyed by item and belongs with the items, not with these flags. `defaultLayer` arrives with the layer report but is a keyboard item you can want and send (`wantOf`), so it stays a field. `lightingState` and `lightingOutputMode` are reported and wanted at once (`lightingState`, `wakeLayers` in the image) and stay until `want` is stored (P2's last step).
- **The connect bundle stays flat:** `ConnectedBundle` is what the connect flow read, not the state; only the state is grouped.
- **Tests:** a test workbench's `state.device` and `state.busy` overrides merge their fields (`src/test/workbench.tsx`), as `caps` and `model` do, so a test names only the fields it needs.

## Consequences

- A screen that shows a report asks `useDevice()`, one that greys out while something is written asks `useBusy()`; a new report or a new kind of write is a field of its group, nothing in the flat record.
- `WorkbenchState` goes from 63 fields to 54 with `device`, and to 47 with `busy`.
