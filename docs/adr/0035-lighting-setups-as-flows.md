# 0035. MoErgo lighting setups become Flows; the rest is done on the key

**Status:** Accepted, #46. Builds on ADR 0025 and 0027 (Flows), ADR 0019 (operations) and ADR 0024 (lighting tools on the keymap); settles todo items 11 and 12 with item 6's lighting part.

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

- **Two Flows**, category "Looks & lighting", both assuming four Bluetooth profiles, so neither needs the board's LEDs or profile count in the description:
  - *Glove80 status cluster* (`flows/glove80/`, `keyboards = ["glove80"]`): choices `layer` (default 2) and `bars` (`outer-columns`, `stock`); `requires = ["lighting.rules", "lighting.rules.connection"]`. It holds its positions, and calls `set_battery_bar` twice and `set_connection_key` four times; no new operation.
  - *MoErgo Magic layer* (`flows/shared/`, `keyboards = ["glove80", "go60"]`): choice `layer`, default "the board's Magic layer" (2 on the Glove80, 3 on the Go60); `requires = ["lighting.rules", "lighting.rules.connection", "lighting.rules.indicators", "lighting.rules.device", "lighting.output"]`. One new operation, `set_magic_layer`: the keys, the dark scene on the left half when the board has scenes, the rules, the layer added to the wake mask. It runs in Draft too.
- **Each board's Magic layer is data in `model/boards/`** (`magic-layer.ts`), on its profile as `magicLayer`, as its key groups are (ADR 0027): the layer's keys and where its lights are. It replaces the profile's `presets` flags and `defaultStatusLayer`. `set_magic_layer` takes the table by the board's id and refuses with a sentence on a board without one (`OperationFacts` gains the id), so the shared catalog stays safe for WebMCP. The pure functions in `model/lighting/stock-magic-layer.ts` build the rules from a table instead of the Glove80's constants. The Bluetooth and USB lights go on the keys the layer binds to profiles 0–3 and to USB output, so they follow the bindings. MoErgo's indicator layout, the Go60's one row up from the Glove80's:

  | Lights | Glove80 | Go60 |
  |---|---|---|
  | Layers 0–5 | R2, C6 → C1 | R1, C6 → C1 |
  | Left battery, 0–100% | R3, C6 → C1 | R2, C6 → C1 |
  | Right battery, 0–100% | R4, C6 → C1 | R3, C6 → C1 |
  | Bluetooth 0–3, USB | the thumbs bound to them | R4 C4 → C1 (X C V B), R5 C4 |
  | Caps, num, scroll lock | R1 C4, C3, C2 (F3–F5) | LH-T1, T2, T3 |
  | Maintenance lock (key and light) | Z, LH-C5R5 | Z, LH-C5R4 |

  The maintenance lock moves from R to Z on both boards: on R its light hid the left battery's 80% segment, since one of its two rules always matches and comes last. Z is free on both Magic layers and lights nothing else. R takes Output brightness + (`BacklightUp`), beside Output brightness − below it. MoErgo's Go60 also shows output fallback (R5 C2); the rules cannot test fallback, so that key stays dark.
- **Everything else is done on the key.** The light menu gains three status lights: *RGB effects* (on or off; with `lighting.extension` and `lighting.rules.connection`), *Lighting policy* (always on, always off, USB-powered only; with `lighting.output`), and *Battery bar* for three to eight selected keys (filling up a column or along a row; `set_key_light` with `{ kind: "bar" }`). Bluetooth and USB lights also need `lighting.rules.connection`. With the action set in the key editor, that covers the connection key, the battery bar and both key presets. The Status setup block in Advanced, the picked-key cards and the key presets panel go.
- **The settings stay**: the rule editor (its Apply becomes a `set_rules` commit), firmware rules, background, layer policy, wake layers.
- **What Flows gain first:** capabilities `lighting.rules.connection`, `lighting.rules.indicators` and `lighting.rules.device` (the maintenance lock and the split link, which only the tagged rule table carries), resolved from the feature bits as `hasConnectionEffectsConditions`, `hasLayerIndicatorConditions` and `RULES` do (firmware with the newer rule table alone counts); the bits move into `capabilities/`, and the screens ask the capabilities.
- **Advanced keeps a pointer** on a board with a Magic layer table (the Glove80 and the Go60): "<board> status setups in Flows" opens Flows at "Looks & lighting".

## Consequences

- Every lighting setup is one commit: judged once by Guard, one Undo step, waiting for Send in Draft (todo 11), all at once in Live (todo 12). Guard now sees the whole Magic layer and may stop or ask where the per-key writes did not. Before the first Flow, a test on the simulated board checks that a commit whose rule write fails leaves no key changed (the planner writes keys before rules).
- A connection key is two steps on the key (action, then light), where the picked setup was one.
- Lost: the layer list's names and its "wakes the lights" mark (a Flow's choice lists slots); the "installed" badge (running a Flow again replaces what it made). A full rule table is reported by the failing step, not before the run.
- Removed: `StockMagicLayerPanel.tsx`, `StatusPresetsPanel.tsx`, `StatusKeyPicks.tsx`, `LightingKeyPresetPanel.tsx`; the key pick (`key-pick.ts`, `ui/lighting/keyPick.ts`, `PickBanner.tsx`) once the light menu's battery bar lands; `writeGlove80StatusSetup`, `writeStockMagicLayer`, `writeLightingKeyPreset` and their writer interfaces; `glove80BatteryBars`, `glove80ConnectionKeys`; the `magic.*` terms; `io.applyScenes` and, with the rule editor, `io.applyConditionalScenes`; their baseline entries. Their tests become tests of the two Flows on the offline Glove80 and of the new lights. `docs/sync.md`, `docs/ARCHITECTURE.md`, `docs/glossary.md` and `docs/ux-brief.md` follow.
- The tests: the Flow on the plain Glove80 gives MoErgo's default Glove80 layout with its RGB, as a golden file (the maintenance lock on Z); on the offline Go60, the table above.
- Plain RMK boards get the status lights on the key, as today; a Magic layer for another board is a table in its profile.
- Not verified: whether the Flows run on a Glove80 layout file with no keyboard connected (whether an offline file reports the rule capabilities), and anything on a connected Glove80 in Live.
