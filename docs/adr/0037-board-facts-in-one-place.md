# 0037. Board facts in one place

**Status:** Accepted. Builds on ADR 0002 (capabilities), ADR 0027 (Flows know the board) and ADR 0035.

## Context

The MoErgo Magic layer Flow assumed four Bluetooth profiles on every board; the Go60's RMK firmware has three, and refused what was sent (#49). The assumption could be made because board facts were written down in several places: the Bluetooth profile count was read from the firmware reply in seven places, each with its own "profiles if Bluetooth, else 0"; `config/document-board.ts` kept its own tables of board names, MoErgo JSON layer lengths and matrix shapes; `config/migration.ts` hardcoded which board migrates to which and which drops trackpad settings; the Magic layer Flow kept `{glove80: 2, go60: 3}`, and the Glove80 status cluster Flow its own copy of Glove80 key positions and LEDs.

## Decision

- **Two sources, each one place.** What a board is (its id, matrix, keys, LEDs, labels, key groups, add-ons, user actions, document tools, Magic layer, and what GLIDE4RMK's RMK build for it keeps) is its profile in the registry, `src/model/boards/`. What a connected keyboard can do is what its firmware reports, read once into capabilities (`src/capabilities/`).
- **Bluetooth is a capability**, `bluetooth`, its slots the host profiles; `bleProfilesOf(capabilities)` is the one way to ask how many. The profile's `build.bleProfiles` (Glove80 4, Go60 3, from `moergo-rmk`'s keyboard.toml files) is what the simulated and offline boards report.
- **Files and migration ask the registry:** a file's board from the profiles' ids, matrices and MoErgo JSON layer lengths (`documents.moergoLayerLengths`); a migration's target from `documents.migrationTarget`, and whether trackpad settings travel from the target's add-ons.
- **Flows read the board from their description.** `describe()` gives `board.magic_layer`. The status cluster becomes the Magic layer Flow's "Only the status lights" choice (`set_magic_layer` with `keys: false`), in MoErgo's positions, for both boards; its Glove80 tables go.
- **A guard keeps it so:** `src/architecture/board-facts.ts`. Outside the registry, the simulated and offline boards, tests and the guards, code may not name a board as a value or a key, use a board's own table (`GLOVE80_…`, `GO60_…`) or import a board's own file; a shared Flow's script may not name a board. Prose may. There is no baseline: the tree holds none today.

## Consequences

- Adding a board is adding its profile; screens, files, migration, operations and Flows follow without an edit, and the guard fails where one would have been needed.
- A firmware fact a feature needs and capabilities do not carry becomes a capability first, as Bluetooth did, not a read of the firmware reply in a screen.
- The status cluster's outer-column battery bars are gone; a battery bar on any keys is a status light on the key (ADR 0035).
- The guard reads text: a board fact written as numbers alone (an LED table without a board's name) is not caught; reviews still matter for those.
