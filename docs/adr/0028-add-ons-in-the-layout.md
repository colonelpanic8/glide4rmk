# 0028. A keyboard's add-ons are kept in the layout

**Status:** Accepted. Takes GLIDE's model of add-ons (`docs/specs/keyboards.md` in glide-src: places, built in or a module a layout turns on); builds on ADR 0020 (what a layout keeps beside the keys) and ADR 0027 (Flows know the board).

## Context

The Glove80 takes a touchpad module on either side; the Go60 has its touchpads built in. Whether a Glove80 layout has them is not something a firmware can always say, and a file opened without a keyboard has no firmware to ask. GLIDE4RMK took "has pointing" from the pointing capability alone, which every Glove80 file workspace has, so a Flow could not tell a Glove80 with touchpads from one without.

## Decision

- **Places in the registry** (`model/boards/add-ons.ts`, on the `BoardProfile`): each with its kind (`pointing`), side and noun, and either `builtIn` or the `module` a layout turns on, named as MoErgo names it (`lh-cirque`, `rh-cirque`; a family name, `cirque`, turns on every module of it). The Glove80 has two module places, the Go60 two built-in ones.
- **The layout keeps the modules it turns on.** MoErgo JSON has the field, as GLIDE and MoErgo's editor write it: `layout_parameters.hardware_modules = "lh-cirque,rh-cirque"`. TOML rejects unknown fields, so a TOML file keeps them as a comment line before its first table, `# hardware_modules = "lh-cirque,rh-cirque"`, as behavior descriptions are kept (`config/add-ons.ts`). A file brings its modules when it opens or is imported (not when converted to the other board); a connected keyboard's are kept in this browser by serial, as its labels are.
- **They are layout notes, beside the behavior labels.** `state.modules` next to `state.labels`; a history step records both as `notes` (before and after), so switching a module is one Undo step that changes no key and writes nothing to the keyboard (`io.setModules`).
- **Layout properties → Details → Add-ons** switches each module place on or off; a built-in one shows as built in; a board without places shows nothing.
- **A Flow's `board.extras`** are the kinds fitted (`pointing` with a touchpad module on, or built in); only a board the registry does not know falls back to its capabilities.

## Consequences

- The Glove80's touchpads are not drawn on the canvas yet: GLIDE draws them from a board variant with their positions, which GLIDE4RMK's Glove80 geometry does not have. The pointing inspector still follows the pointing capability.
- A layout for a board GLIDE4RMK does not know can say nothing about add-ons; its extras come from what its firmware reports.
