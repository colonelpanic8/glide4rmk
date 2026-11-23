# Writing a Flow for GLIDE4RMK

A Flow is a `.flows` file: GLIDE's TOML with a jq script. The script reads the layout and the board as JSON and gives back operations; GLIDE4RMK runs them as one change (Guard checks it once, one Undo step, Draft until Send). Decisions: ADR 0025 and ADR 0027.

## Where it goes

- `shared/`: for every board that has what the Flow needs (`needs_keys`, `min_keys`, `requires`).
- `glove80/`, `go60/`: for that board only. The folders are the board ids in the registry (`src/model/boards/`).

## The file

```toml
uid = "hrm_create"            # lowercase, digits and _
runs_on = "glide4rmk"         # required
title = "Home-row mods"
subtitle = "Per-finger, bilateral"
description = '''First sentence is the line in the list. Markdown.'''
category = "Modifier keys"    # Modifier keys, Symbols, QWERTY alternatives, Shortcuts & macros, Mouse, Gaming, Looks & lighting, Other
script = ''' … jq … '''

[manifest]
author = "moosyresearch"
icon = "🏠"
keywords = ["hrm"]
needs_keys = ["home_row"]           # key groups the board must have
min_keys = 30                       # the fewest keys the board may have
requires = ["behaviors.profiles"]   # capabilities
# keyboards = ["glove80"]           # only for these boards (a board's folder sets this)

[[param]]                            # a choice, bound as $mod_preset
id = "mod_preset"
label = "Modifier order"
type = "select"                      # select, boolean, number, text
options = ["GACS", "CAGS"]
labels = ["Windows / Linux", "macOS"]
default = "GACS"
```

## What the script reads

`.` (and `$view`, anywhere in the script) is:

```
{ board: { id, name, keys, groups, capabilities, extras },
  default_layer, rows, cols, max_layers, combo_count,
  layers: [{ index, name, keys: [[action, …], …] }],      # row by row
  profiles: [{ index, name, timing }] }
```

`board.groups` has `letters` (36 keys, reading order), `home_row` (pinky to pinky), `thumbs`, `numbers` and `function`. Each key is `{ row, col, hand, finger }`. A board GLIDE4RMK does not know has no groups. `extras` has `"pointing"` when a touchpad is fitted: built in (Go60), or its module switched on in the layout (Glove80, Layout properties → Add-ons; ADR 0028).

Actions are the keyboard's own: `{"Single": {"Key": {"Hid": "A"}}}`, `{"TapHold": [tap, hold, profile]}`, `"Transparent"`. A timing's fields are `hold_timeout_ms`, `gap_timeout_ms`, `quick_tap_timeout_ms`, `prior_idle_time_ms`, `unilateral_tap`, `opposite_hand_hold`, `enable_flow_tap`, `retro_tap`, `hold_trigger_on_release` and `mode` (`PermissiveHold`, `HoldOnOtherPress`, `Normal`, `TapUnlessInterrupted`).

## The library (in front of every script)

| | |
|---|---|
| `group("home_row")`, `has_group(name)` | a key group of the board |
| `base_layer`, `layer(i)`, `layer_named(name)` | a layer, or null |
| `key_at($layer; $spot)` | the action at a group's key |
| `profile_named(name)`, `has_profile(name)` | a timing profile |
| `mods(["left_shift"])`, `key("A")`, `tap("A")`, `shifted("A")`, `tap_hold(tap; hold; profile)` | actions; a profile may be its name |
| `tapped_hid`, `is_tap_hold`, `holds_modifier`, `is_letter`, `is_digit`, `is_punctuation` | reading an action |
| `set_keys(keys)`, `set_timing_profile(name; timing)`, `add_layer(name; after)` | operations |

A script's own `def` with the same name wins.

## What the script gives back

```
{ operations: [ set_keys([{layer, row, col, action}]), … ],
  report: { message: "Shown after the run.", lines: [{ok: true, text: "…"}], log: ["counts, never keys"] } }
```

With nothing to do: `{operations: [], report: {changed: false, message: "Nothing was changed: …"}}`. To stop with a sentence for the person: `error("… so nothing was changed.")`. Every operation in the catalog can be called (`src/operations/catalog.ts`); the first that fails stops the run and nothing changes.
