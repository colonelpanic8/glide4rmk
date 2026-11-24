# 0038. The Magic layer is found by its name

**Status:** Accepted. Amends ADR 0035 and ADR 0037.

## Context

The "MoErgo Magic layer" Flow put the layer where MoErgo's default layout keeps it: the third layer on a Glove80, the fourth on a Go60. A layout of your own keeps it elsewhere (TailorKey: the ninth), so the Flow overwrote another layer. Each run also cleared only what it made on the layer it chose, so runs on different layers added a dark half each until the scene table was full ("This layout needs 164 scene cells; the keyboard holds 160").

## Decision

- **No layer number is assumed.** Left to itself, `set_magic_layer` takes the layer named Magic (any case, spaces trimmed). Without one, it takes the layer the default layer's lower-left key holds down: MoErgo's Magic key, `reach` in the board's table (`model/boards/magic-layer.ts`), which replaces the table's `layer`. Without that, it adds a layer named Magic after the last one and gives it that key when the key is free. If the key holds something else, the report says to give a key "hold Magic". `findMagicLayer` (`model/lighting/stock-magic-layer.ts`) is pure and tested. A layer can still be picked by number.
- **The whole layer starts clean.** With its keys, the Magic layer's own scene cells and every rule watching it go first. Only the status lights, as before, keeps the layer's other rules.
- **Looks give way to room.** When the scene table has no room for the dark half, the half stays lit, and the Flow says so instead of stopping. An operation can now return `notes` with a success, and a Flow's report shows them as lines to look at.
- **A refusal is the layout's, not the Flow's.** When an operation stops with a sentence for the person, the Flow shows that sentence and "Nothing was changed." without "the automation may need fixing by its author".
- **Send says which part did not reach the keyboard** ("The lighting rules (60) did not reach the keyboard: …").
- `describe()` gives `board.magic_layer` as true or false: whether the board has MoErgo's Magic layer, not where.

## Consequences

- The Flow works on any Glove80 or Go60 layout: one with a Magic layer anywhere, one reaching it only by the Magic key, or one without it.
- Running it again changes only the Magic layer. Lights an earlier version left on another layer stay until that layer's lights are cleared.
- On a layout file whose every layer slot is in use, with no Magic layer, the Flow cannot add one and says so. A keyboard has free slots.
