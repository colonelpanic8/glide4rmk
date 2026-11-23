# 0029. Opening a keyboard is the workbench's; one harness for core tests

**Status:** Accepted. Moves the connect snapshot that ADR 0017 left in `ui/`; does items 6 and 7 of `docs/architecture-review.md`.

## Context

`openBundle` reads a session into a `ConnectedBundle` and shows nothing, but it lived in `ui/bundle.ts`, so every core test that needed a real board imported `ui/`. Eleven test files and `test/tailorkey.ts` wired `openBundle`, `initialWorkbenchState`, `makeWorkbenchReducer` and `makeIo` by hand, each slightly differently. TailorKey was the only realistic layout, so tests about one key carried its combos, forks and Magic layer, and its Flow environment answered yes to every capability.

## Decision

- **`workbench/open.ts`** holds `openBundle` (moved with its history). The boundaries guard's `core-never-imports-ui` rule now holds for the core layers' tests too.
- **`src/test/harness.ts`**: `openTestWorkbench(board, { mode, io?, connected? })` and `withTestWorkbench(…, check)` open a simulated board (`BoardSpec`), a fixture (`{ fixture: "plain" | "tailorkey", board?: { pointing, lighting } }`) or a session the test made, the way the app does, with the real reducer and `io`. They give `{ session, bundle, io, state, dispatch, dispatched, capabilities, flows }`; `flows` is a Flow environment that asks the board's real capability set.
- **Fixtures:** `glove80-plain.toml` (three layers, no home-row mods, no combos, no Magic layer) for tests that need a realistic board and nothing else; TailorKey stays the golden for round-trips and Flows. The offline Glove80 takes `{ pointing, lighting }` (both on by default) to stand for a Glove80 built without them.
- **`src/test/image.ts`**: a `KeyboardImage` builder (`layout().layer("Base", row("MO(1) A")).vacant().build()`) for unit and operation tests.

## Consequences

- A new workbench test is a call to `withTestWorkbench`, not twenty lines of wiring; screen tests that click (review P3) build on the same harness.
- A test that hand-wires on purpose (a screen's delayed state, `apply.test.ts`'s `keepingCurrent` case) still may, with `openBundle` from `workbench/open.ts`.
