# 0025. Flows: jq over a description, operations out

**Status:** Accepted. Todo item 6 (the doors), the first part; builds on ADR 0019 (operations) and ADR 0017 (`io`). WebMCP comes later through the same parts.

## Context

GLIDE's Flows (`docs/specs/flows.md` in glide-src) are `.flows` files: TOML with a title, choices and a jq script that takes the MoErgo layout JSON and gives back a whole changed layout, which GLIDE re-checks like an opened file. GLIDE4RMK cannot work that way. Its MoErgo JSON codec does not carry behaviors either way: a custom hold-tap is not read ("has no Rynk equivalent yet"), a macro is read but cannot be written back, combos come back only from a template. Running GLIDE's script on an export and importing the result would lose or refuse what most Flows add (home-row mods, Autoshift, macros), and the JSON cannot see what only RMK has (tap timing profiles, forks, lighting rules).

## Decision

**jq stays the language; what it reads and returns changes.** jq is sandboxed (no page, network or files), can be stopped, and is what Flows4JSON and the JQ Flows Generator write.

- **In: a description, not a file.** The script gets `describe(image, board)` (`operations/describe.ts`): the keyboard (`glove80`, `go60` or null), `rows`, `cols`, `default_layer`, and each used layer's `index`, `name` and `keys` as rows of the keyboard's own actions (`{"TapHold": [{"Key": {"Hid": "A"}}, {"Modifier": {…}}, 3]}`). It grows with the first Flow that needs more (behaviors, lights, capacities), as capabilities do (ADR 0002).
- **Out: operation calls.** The script returns `{ "operations": [{ "name": "set_keys", "input": {…} }], "report": {…} }`. Each call goes through `runOperation` (input checked against the catalog), one after the other on the same image (`operations/flows/fold.ts`); the first that fails stops the run and nothing changes. `set_keys` checks each action's shape (`model/key-action-shape.ts`), so no caller without TypeScript can store a malformed key.
- **Applied as one operation.** `workbench/flows.ts` describes what you want, runs jq, folds the calls, and commits the result with `commitImage` (ADR 0019): Guard judges it once, it is one Undo step, in Draft it waits for Send, in Live only the difference is sent, all or nothing. If what you want changed while the script ran, nothing is applied.
- **The file.** GLIDE's TOML, read by `operations/flows/file.ts`: `uid`, `title`, `subtitle`, `description`, `category`, `script`, `[[param]]` with GLIDE's choice check, messages and binding (`<value> as $id |`), and `[manifest]` (`author`, `icon`, `keywords`, `advanced`, `keyboards`). New: `runs_on = "glide4rmk"`, required, so a GLIDE layout Flow is never run on a description; `[manifest] requires`, capability ids (`behaviors.morse`, `lighting.scenes`, …) the Flow needs. A Flow is offered when its `keyboards` (if any) include this keyboard and every `requires` is present; an operation still refuses what does not fit.
- **jq.** `jq-web`, in a Web Worker with a 10 second limit (`ui/flows/`); tests run the same jq in Node. Errors as GLIDE words them: a Flow's own `error("…")` sentence as it is, jq's compile errors with the line in the script, a run that stops after the limit. Every run keeps a short log (names, counts, times; never keys).
- **Where they live.** `flows/shared/`, `flows/glove80/`, `flows/go60/`; read with Vite's raw import, so there is no index to rebuild. Flows is GLIDE's Flows window, an app store opened by its button at the end of the top bar, for every keyboard (`ui/flows/`): the categories as tiles, a category's Flows, search, one Flow with its choices and Apply, and what the run did (Done, Undo this, Try again, the run log). Browsing is pure (`operations/flows/browse.ts`), in GLIDE's category order. jq loads only when a Flow first runs.

## Not copied from GLIDE

The whole layout out and the re-check of it; the 60-position `.layout.keys` stand-in; `keepLayerRefs` (layer moves are operations that already move every reference); a module-wide `window.jq` and run log; `successMessage` and `order` beside `report.message`; launcher entries.

## Consequences

- *Amended 2026-11-19:* first behind a feature flag; Flows is a strategic part of GLIDE4RMK, so it is in the top bar from the start, as GLIDE's window rather than a screen. The Transforms screen's alpha layout switch (and `apply_transform`'s `alpha-layout`) is removed: the Different typing layout Flow replaces it. Bulk changes that are one-time setups move to Flows the same way.

- WebMCP reads `describe`, lists `catalog()` and calls `io.apply`, which is what a Flow does without jq.
- GLIDE's own `.flows` files do not run here; a Flow is ported by rewriting its script against the description. Once the MoErgo JSON codec carries behaviors, keys-only GLIDE Flows could run through export, jq and import; not planned.
- jq-web (ISC) and smol-toml (BSD-3) are new dependencies; jq's 0.8 MB wasm loads only when a Flow runs.
