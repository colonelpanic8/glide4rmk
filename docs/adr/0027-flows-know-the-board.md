# 0027. Flows know the board: key groups, a jq library, needs_keys

**Status:** Accepted. Builds on ADR 0025 (Flows) and ADR 0019 (operations).

## Context

A Flow's script got the layers and the board's id, nothing more. So every Flow kept its own table of where the letter keys and the home row are on each board (`boards: { glove80: { rows: [2, 3, 4] … } }`), refused every other board, and spelled out operation shapes and modifier objects by hand. The four home-row and Autoshift drafts repeated the same tables and helpers, and asked for operations that did not exist (a layer added after another, a timing profile by name).

## Decision

- **A board's key groups are data in the registry** (`model/boards/key-groups.ts`, on its `BoardProfile`): `letters` (three rows of six a hand, reading order), `home_row` (the keys that take home-row mods, pinky to pinky, each with its hand and finger), `thumbs`, `numbers`, `function`, `bottom` (the keys below the letters, outside the thumbs; added with the Mirror halves Flow, so that the groups name every key once). The Glove80 and Go60 have them; a board GLIDE4RMK does not know has none. Adding a board is adding its groups.
- **`describe()` gives the board** (`operations/describe.ts`): its id, name, key count, groups, capabilities and extras (`pointing` when a trackpad, trackball or touchpad is fitted), with the timing profiles by name, the layer capacity (`max_layers`) and the number of combos.
- **A jq library goes in front of every script** (`operations/flows/library.ts`): `$view` (the whole description), `group`, `key_at`, `base_layer`, `layer_named`, `profile_named`, `mods`, `key`, `tap_hold`, `tapped_hid`, `holds_modifier`, `is_letter`, `set_keys`, `set_timing_profile`, `add_layer` … A script's own `def` wins, and error lines still count from the script's first line.
- **New operations for what Flows do:** `add_layer` (an empty layer right after another; every reference to the layers above follows) and `set_timing_profile` (a profile by name, changed or added; its fields checked). `set_keys` takes a tap-hold's profile by name, so a Flow adds a profile and uses it in one run.
- **The manifest says what a Flow needs of the board:** `needs_keys` (groups) and `min_keys`, beside `requires` (capabilities). A Flow for another keyboard is not listed; one this keyboard cannot run is listed greyed, with the reason, and cannot be applied. `flows/shared/` is for every board that has what a Flow needs; `flows/<board id>/` is for that board only, and the folders come from the registry.

## Consequences

- The home-row mods, their removal, their timing presets and Autoshift ship in `flows/shared/` and work on any board with a home row; the typing-layout Flow works on any board with a letter block. None keeps a board table.
- Extras come from capabilities only. Declaring an add-on the firmware cannot report (a touchpad on a board that does not say so) in the layout file is not built: the TOML format rejects unknown fields, so it needs a decision on where to keep it.
- A plain RMK board gets Flows that need no groups (timing presets, Autoshift); giving it groups is a profile in the registry.
