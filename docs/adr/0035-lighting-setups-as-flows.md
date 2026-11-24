# 0035. The Glove80 lighting setups become Flows; the rest is done on the key

**Status:** Proposed. Builds on ADR 0025 and 0027 (Flows), ADR 0019 (operations) and ADR 0024 (lighting tools on the keymap); settles todo items 11 and 12 with item 6's lighting part.

## Context

RGB Lighting → Advanced (`ui/properties/LightingSection.tsx`) mixes settings you come back to with setups you run once. The setups write keys and lights together, and three of them do not use the write path:

| What | Writes | Boards | Kind | How it reaches the keyboard |
|---|---|---|---|---|
| Glove80 Magic status cluster (`StatusPresetsPanel`) | 4 keys (Bluetooth 1–3, USB) and their rules, two battery bars' rules | Glove80 | setup | keys one by one through `io.setKey`; the rules dispatched into the draft from the screen |
| Stock Magic layer (`StockMagicLayerPanel`) | the whole layer's keys, the scene table (left half dark), the rule table, wake layers | Glove80 | setup, Live only | `io.setKey` per key, then `io.applyScenes` and `io.applyConditionalScenes` (whole tables), then `io.setWakeLayers` |
| Connection key, battery bar on picked keys (`StatusKeyPicks`, `key-pick.ts`) | one key and its rules; a bar's rules | any board with lit keys | setup | `set_connection_key`, `set_battery_bar` through `io.apply` |
| Lighting key presets (`LightingKeyPresetPanel`, in the key editor) | the key's action and its rules | any board with rules | setup, Live only | `io.setKey`, then `io.applyConditionalScenes` |
| Condition rules (`ConditionalRulesPanel`) | the rule table | `lighting.rules` | setting (an editor) | Apply: `io.applyConditionalScenes` |
| Firmware rules, background, layer policy, wake layers | nothing; lighting state; policy; wake mask | per capability | read-only; settings | —; `io.setLightingState`, `io.setScenePolicy`, `io.setWakeLayers` (draft, or Realtime) |

A key's light menu (`KeyLightFields.tsx`, `set_key_light`) already gives selected keys a Bluetooth, USB, lock or battery status light; the key's action is set in the key editor. The write path already carries scenes, rules and wake layers (`sync/plan.ts`), and a Flow is one commit (ADR 0025). Every Glove80 has Bluetooth, USB, lit keys and 80 keys, and its firmware has four Bluetooth profiles; what still differs between Glove80 firmware is whether rules can test connections, locks and layers (feature bits in `session/lighting-features.ts`, not capabilities), and whether it has wake layers.

## Decision

- **The two Glove80 setups become Flows** in `flows/glove80/` (`keyboards = ["glove80"]`), category "Looks & lighting". Each holds its own positions and LEDs and assumes four profiles; neither needs the board's LEDs or profile count in the description.
  - *Glove80 status cluster*: choices `layer` (default 2) and `bars` (`outer-columns`, `stock`); `requires = ["lighting.rules", "lighting.rules.connection"]`. Two `set_battery_bar` and four `set_connection_key` calls; no new operation.
  - *Stock Magic layer*: choice `layer` (default 2); `requires = ["lighting.rules", "lighting.rules.indicators", "lighting.output"]`. One new operation, `set_magic_layer`, from the pure functions in `model/lighting/stock-magic-layer.ts`: the keys (the Glove80's holes from `model/boards/glove80`), the dark scene when the board has scenes, the rules, the layer added to the wake mask. It refuses on any other board with a sentence (`OperationFacts` gains the board's id), so the shared catalog stays safe for WebMCP. It runs in Draft too.
- **Everything else is done on the key.** The light menu gains three status lights: *RGB effects* (on or off), *Lighting policy* (always on, always off, USB-powered only), and *Battery bar* for the selected keys (filling in the order they lie, `set_battery_bar` underneath). With the action set in the key editor, that covers the connection key, the battery bar and both key presets. The Status setup block in Advanced, the picked-key cards and the key presets panel go.
- **The settings stay**: the rule editor (its Apply becomes a `set_rules` commit), firmware rules, background, layer policy, wake layers.
- **What Flows gain first:** capabilities `lighting.rules.connection` and `lighting.rules.indicators`, resolved from the feature bits as `hasConnectionEffectsConditions` and `hasLayerIndicatorConditions` do (firmware with the newer rule table alone counts), and the screens asking those instead.
- **Advanced keeps a pointer** on a Glove80: "Status setups are in Flows" opens Flows at "Looks & lighting".

## Consequences

- Every lighting setup is one commit: judged once by Guard, one Undo step, waiting for Send in Draft (todo 11), all at once in Live (todo 12). Guard now sees the whole Magic layer and may stop or ask where the per-key writes did not. Before the first Flow, a test on the simulated board checks that a commit whose rule write fails leaves no key changed (the planner writes keys before rules).
- A connection key is two steps on the key (action, then light), where the picked setup was one.
- Lost: the layer list's names and its "wakes the lights" mark (a Flow's choice lists slots); the "installed" badge (running a Flow again replaces what it made). A full rule table is reported by the failing step, not before the run.
- Removed: `StockMagicLayerPanel.tsx`, `StatusPresetsPanel.tsx`, `StatusKeyPicks.tsx`, `LightingKeyPresetPanel.tsx`; the key pick (`key-pick.ts`, `ui/lighting/keyPick.ts`, `PickBanner.tsx`) once the light menu's battery bar lands; `writeGlove80StatusSetup`, `writeStockMagicLayer`, `writeLightingKeyPreset` and their writer interfaces; `glove80BatteryBars`, `glove80ConnectionKeys`; the `magic.*` terms; `io.applyScenes` and, with the rule editor, `io.applyConditionalScenes`; their baseline entries. Their tests become tests of the two Flows on the offline Glove80 and of the new lights. `docs/sync.md`, `docs/ARCHITECTURE.md`, `docs/glossary.md` and `docs/ux-brief.md` follow.
- Go60 and plain RMK boards get the status lights on the key, as today. A Go60 cluster is a file in `flows/go60/` when someone wants one.
- Not verified: whether the Flows run on a Glove80 layout file with no keyboard connected (whether an offline file reports the rule capabilities), and anything on a connected Glove80 in Live.
