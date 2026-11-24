# 0035. Lighting setups that run once become Flows; the editors stay

**Status:** Proposed. Builds on ADR 0025 and 0027 (Flows) and ADR 0019 (operations); settles todo items 11 and 12 with item 6's lighting part.

## Context

RGB Lighting → Advanced (`ui/properties/LightingSection.tsx`) mixes settings you come back to with setups you run once. The setups write keys and lights together, and three of them do not use the write path:

| What | Writes | Boards | Kind | How it reaches the keyboard |
|---|---|---|---|---|
| Glove80 Magic status cluster (`StatusPresetsPanel`) | 4 keys (Bluetooth 1–3, USB) and their rules, two battery bars' rules | Glove80 (`glove80-status` preset, the stock LED map, 3+ profiles, a split) | setup | keys one by one through `io.setKey`; the rules dispatched into the draft from the screen |
| Stock Magic layer (`StockMagicLayerPanel`) | the whole layer's keys, the scene table (left half dark), the rule table, wake layers | Glove80 (`glove80-stock-magic`, the stock LED map) | setup, Live only | `io.setKey` per key, then `io.applyScenes` and `io.applyConditionalScenes` (whole tables), then `io.setWakeLayers` |
| Connection key, battery bar on picked keys (`StatusKeyPicks`, `key-pick.ts`) | one key and its rules; a bar's rules | any board with lit keys (connection: Bluetooth and rule predicates) | setup | `set_connection_key`, `set_battery_bar` through `io.apply` |
| Lighting key presets (`LightingKeyPresetPanel`, in the key editor, not Advanced) | the inspected key's action and its rules | any board with rules (`lighting.output`; `lighting.extension` and indicator predicates) | setup, Live only | `io.setKey`, then `io.applyConditionalScenes` |
| Condition rules (`ConditionalRulesPanel`) | the rule table | `lighting.rules` | setting (an editor) | Apply: `io.applyConditionalScenes` |
| Firmware rules (`FirmwareRulesPanel`) | nothing | `lighting.compiled` | read-only | — |
| Background (`BackgroundPanel`); layer policy, wake layers (`LayerLightingSettings`) | lighting state; policy; wake mask | `lighting.state`, `lighting.scenes`, `lighting.output` | settings | `io.setLightingState`, `io.setScenePolicy`, `io.setWakeLayers` (draft, or Realtime) |

The write path already carries scenes, rules and wake layers (`sync/plan.ts`), and a Flow is one commit (ADR 0025). What a Flow lacks: its description has no lights, profiles or LEDs; `requires` cannot say "rules that can test Bluetooth" (feature bits in `session/lighting-features.ts`, not capabilities); no operation sets wake layers or a Magic layer's rules.

## Decision

- **The two Glove80 setups move to Flows** in `flows/glove80/`, category "Looks & lighting", `keyboards = ["glove80"]`:
  - *Glove80 status cluster*: choices `layer` (default the Magic layer, 2) and `bars` (`outer-columns`, `stock`); `requires = ["lighting.rules", "lighting.rules.connection"]`. The script holds the positions and calls `set_battery_bar` twice and `set_connection_key` four times; it stops with a sentence when `board.ble_profiles < 3`. No new operation.
  - *Stock Magic layer*: choice `layer` (default 2); `requires = ["lighting.rules", "lighting.rules.indicators"]`. One new operation, `set_magic_layer` (`operations/lighting.ts`), built from the pure functions already in `model/lighting/stock-magic-layer.ts`: the keys, the dark scene (when the board has scenes), the rules, the layer added to the wake mask (when it has one); the profile count comes from `OperationFacts`. It runs in Draft too.
- **The picked-key setups stay** in Properties: picking keys on the board is not something a jq script can ask for, and they are operations already.
- **The lighting key presets stay in the key editor and become one operation**, `set_lighting_key` (the key's action and its rules), applied with `io.apply`, so they run in Draft, are one Undo step and go through Guard.
- **The rule editor, firmware rules, background, layer policy and wake layers stay**: they are settings. The rule editor's Apply becomes a commit (`set_rules`, the whole table as you want it), sent with everything else.
- **What Flows gain first:** capabilities `lighting.rules.connection` and `lighting.rules.indicators`, resolved from the feature bits (screens then ask those instead of `session/lighting-features`); `describe()`'s board gains `ble_profiles`. Lights, rules and LEDs join the description only when a Flow needs them (ADR 0025).
- **Advanced keeps a pointer**: "Status setups for the Glove80 are in Flows" opens Flows at "Looks & lighting", on the Glove80 only.

## Consequences

- Every lighting setup is one commit: atomic in Live (todo 12), judged once by Guard, undoable, waiting for Send in Draft (todo 11). The stock Magic layer stops being Live only.
- Removed: `StockMagicLayerPanel.tsx`, the cluster half of `StatusPresetsPanel.tsx`, `writeGlove80StatusSetup`, `writeStockMagicLayer`, `writeLightingKeyPreset` and their writer interfaces, `glove80BatteryBars`/`glove80ConnectionKeys` (the script holds them), the `magic.*` terms, `io.applyScenes` (no caller left) and, with the rule editor, `io.applyConditionalScenes`; their baseline entries go with them.
- Lost: the layer list names the layers and marks the one that wakes the lights; a Flow's `select` lists slots. A setup is found in Flows, not beside the rules it makes.
- Go60 and plain RMK boards keep the picked-key setups. A Go60 cluster is a file in `flows/go60/` when someone wants one; a Flow for a board the registry does not know needs LEDs in the description first.
- Not verified on a keyboard: that a Flow's commit in Live writes keys and rules all or nothing.
