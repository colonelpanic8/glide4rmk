# 0032. The workbench state in groups: the keyboard's reports first

**Status:** Accepted. Does the first step of P2 in `docs/architecture-review.md`; the later steps amend this record.

## Context

`WorkbenchState` holds 63 fields side by side: keyboard items, drafts, the keyboard's live reports, busy and error flags, and the screen's own state. A screen reads `state.battery` beside `state.layers`, so nothing says which fields are drafted and sent and which are only reported, and every new field widens the one flat record. P2 proposes `{ base, want, basedOn, history, notes, device, busy, ui }`, one group at a time, each step mechanical and green.

## Decision

- **`state.device`** (`model/device-state.ts`, `DeviceReports`) holds what the keyboard reports about itself while it is open: `battery`, `peripheralBattery`, `connection`, `maintenanceMode`, `splitTransport`, the layer report (`currentLayer`, `activeLayers`, `layerStateComplete`), `ledIndicator` and `modifierState`. Read at connect (`initialWorkbenchState`), then kept current by the topic actions (`topicLayers`, `topicBattery`, `topicConnection`, `topicLedIndicator`, `topicModifier`) through `withDevice`. Never drafted, never sent, outside the history.
- **Read through a selector, never the path:** core code reads `deviceOf(state)`, a screen `useDevice()` (`ui/state.tsx`). The report types screens need (`BatteryStatus`, `BleStatus`, `PeripheralStatus`) are named in `model/device-state.ts`, like `model/action-types.ts`.
- **What stays outside:** `defaultLayer` arrives with the layer report but is a keyboard item you can want and send (`wantOf`), so it stays a field. `lightingState` and `lightingOutputMode` are reported and wanted at once (`lightingState`, `wakeLayers` in the image) and stay until `want` is stored (P2's last step).
- **The connect bundle stays flat:** `ConnectedBundle` is what the connect flow read, not the state; only the state is grouped.
- **Tests:** a test workbench's `state.device` override merges its fields (`src/test/workbench.tsx`), as `caps` and `model` do, so a test names only the reports it needs.

## Consequences

- A screen that shows a report asks `useDevice()`; a new report the keyboard pushes is a field of `DeviceReports` and a topic case that calls `withDevice`, nothing in the flat record.
- `WorkbenchState` goes from 63 fields to 54.
