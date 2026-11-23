# 0034. A layout file opens on the board it is for

**Status:** Accepted.

## Context

Opening a layout file from the start screen always made an offline Glove80, whatever the file was for. Since ADR 0033 the converter reads a Go60's MoErgo JSON and TOML as a 5x14 layout, so a Go60 file opened as a Glove80 went through the board transfer: keys moved, Go60-only keys were lost, and a key-addressed light was lowered against the Glove80's LEDs. Importing a file into a keyboard that is open is a different act: there the keyboard decides, and the file converts to it (`readImport`, `model/boards/transfer.ts`).

## Decision

- **The file names its board, read before it is parsed** (`config/document-board.ts`, `documentBoard`): a MoErgo JSON's `keyboard` field (also inside a `{"keymap": …}` wrapper; without one, its layer length, as the converter reads it), a TOML's `rows` and `cols` (5x14 a Go60; none, or 6x14, a Glove80). A file for any other board opens nothing, and the message names the board.
- **The offline board takes the board as a parameter** (`session/offline/board.ts`: `offlineBoard`, `offlineCatalog`, `offlineTopology`, `openOfflineBoard`): one surface laid over a template per board. The Glove80's template is the simulated Glove80; the Go60's (`session/offline/go60.ts`) is built from what the codebase knows of it: `GO60_KEYS`, GLIDE's Go60 geometry (`model/boards/go60-geometry.ts`, generated), the LED chain and trackpads as `go60-rmk` declares them. `session/offline/glove80.ts` keeps the Glove80 names as thin wrappers.
- **The file is parsed with that board's catalog and LED topology** (`session/offline/document.ts`, `openOfflineDocument`), and the offline board takes the file's trackpad settings when it has them.
- **A new file is still a Glove80**; the start screen has no board choice yet (`docs/todo.md`).

## Consequences

- A Go60 file opens with its 60 keys, its lights on the Go60's LEDs, and both trackpads, and saves back as a Go60 file; the test harness opens each fixture on its own board, with the Go60 factory layout as one.
- Another MoErgo board is a template and a `documentBoard` entry.
- The firmware's 40% LED ceiling on the Go60 is not modelled: it applies after everything the host sets.
