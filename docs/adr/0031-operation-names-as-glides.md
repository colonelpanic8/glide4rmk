# 0031. Operation names as GLIDE's; a layer's name is an operation

**Status:** Accepted. Does item 11 of `docs/architecture-review.md`; amends ADR 0020's operation names; removes one direct Live write that ADR 0013 lists.

## Context

GLIDE's layout operations (`moosylog/glide-src`, `dev/core/operations.js`) are `set_keys`, `add_behavior`, `update_behavior`, `add_layer` and `rename_layer`. GLIDE4RMK had `set_keys` and `add_layer` under the same names, but `create_behavior` and `set_behavior` for the other two, and no `rename_layer`: renaming a layer wrote `keymap.setLayerMetadata` at once in Live, outside Guard, the draft's three-way check and Undo. A Flow or a WebMCP tool written for one app read differently in the other.

## Decision

- **GLIDE's names, for the same meaning.** `add_behavior` (was `create_behavior`) adds a behavior in the first free slot of its kind; `update_behavior` (was `set_behavior`) sets what a slot holds, and its name and description when given. Only the names follow GLIDE: the inputs stay GLIDE4RMK's (slots and kinds of an RMK keyboard, not ZMK behavior names), as `set_keys` and `add_layer` already did. Operations GLIDE has not (`rename_behavior`, `move_layer`, the lighting ones …) keep their names.
- **The former names are aliases.** `FORMER_NAMES` (`operations/catalog.ts`) maps `create_behavior` and `set_behavior` to the new ones; `runOperation`, `io.apply` and Flows still accept them, as the same operation. `catalog()` lists only the new names, so WebMCP and `describe` never offer the old ones. The app's own callers use the new names.
- **`rename_layer { layer, name }`** is an operation (`operations/layers.ts`): a name unique on the keyboard, at most 32 UTF-8 bytes, on a layer in use; nothing that names the layer by its slot changes. `io.renameLayer` applies it, so a rename is judged by Guard, waits in Draft, goes through Send's path in Live (fresh read, only the difference, read back), and is one Undo step. The direct `keymap.setLayerMetadata` write in `workbench/io-layers.ts` is gone. Flows get `rename_layer($layer; $name)` in their jq library.

## When the former names go

When nothing in the repository (code, tests, `flows/`) uses them and one release has shipped with the new names: a PR deletes `FORMER_NAMES` and its two aliases, and a Flow still using an old name then gets "there is no operation called …". Until then a test checks that each former name runs the same operation as its new one.

## Consequences

- A Flow or a WebMCP call that adds or updates a behavior, or renames a layer, reads the same in GLIDE and GLIDE4RMK, though its input differs.
- Renaming a layer in Live costs a fresh read and a read-back, as every write on the one path does, instead of one write; it can now be undone.
