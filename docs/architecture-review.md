# Architecture review

Two passes. The second (23 November 2026) asks what makes a change slow and what a critical engineering manager would still flag, now that the first plan has mostly shipped. Measured on `master` at `f4f5f7d` (after #13), PR #14 at `09a8459`, against `moosylog/glide-src` at `f329879`. Every number below was measured in this pass (2 cores, Node 22) unless it says otherwise.

**Verdict.** The first plan worked: the workbench core exists, `ui/state.tsx` went from 1,594 lines to 34, the draft is a wanted image, operations and Flows run through one Guard and one Undo. What slows a change now is not the layering but four things around it: (1) the workbench state is 62 flat fields, so anything new the layout keeps is threaded by hand through commit, history, reducer and import; (2) the tests wait on a simulated board that sleeps 5–15 ms on every call, and no screen test can click; (3) CI rebuilds the WASM clients with Nix on every run, twice per push; (4) shared docs (the ADR table, `todo.md`'s "Done recently", line counts in `ARCHITECTURE.md`) are edited by every branch and conflict. Items 1–5 of "Do now" below take about two days together and remove most of the waiting.

## The plan, validated: where it stands

The first review's plan (its full text is in this file's history, at `f4f5f7d`; ADR 0017–0019 name its steps), checked against the code:

| First plan, step | Status | Evidence |
|---|---|---|
| 0. Safety net | Done | `ui/every-screen.test.tsx` (`227ae02`); a board without RGB or Bluetooth: `session/mock/plain36.ts` |
| 1. A core for the workbench | Done | `1d035e0`, ADR 0017; `workbench/` 26 files, 3,144 lines; `ui/state.tsx` 34 lines, off the size list |
| 2. The draft holds the whole keyboard | Done, with one rest | ADR 0018. But what you want is still assembled from state fields (`wantOf`/`withWant`, 280 lines), not stored: plan item P2 |
| 3. Operations | Done, two panels left | ADR 0019, 0023; 24 operations in the catalog. Left: the rule panels and lighting presets (todo 11, 12) |
| 4. Capabilities and `offer()` | Open | 12 capability ids (was 8); screens still decide from raw firmware fields (plan item P4) |
| 5. The doors | Mostly done | `describe` (`operations/describe.ts`), Flows (ADR 0025, 0027). WebMCP open |

From the first review's other findings:

- **`ui/state.tsx` does three jobs:** done.
- **Domain logic in `ui/`:** mostly done. Pure files in `ui/` are now 4,376 lines, mostly presentation; four are not: `ui/bundle.ts` (357, opening a keyboard: `openBundle`), `ui/keymap/keyManipulation.ts` (237, the clipboard plan), `ui/behaviors/library.ts` (195, usage rows), `ui/live/compositor.ts` (136). `openBundle` matters most: 11 core test files and `test/tailorkey.ts` import it from `ui/` (item 7).
- **Module-level state:** contained but not solved. `ui/workbench-end.ts` ends 5 stores by hand; `ui/` has 11 stores written the same way by hand (item 9).
- **Bulk changes bypass the write path:** transforms done (operations); the rule panels, presets and direct Live writes remain (P5).
- **Screens without render tests:** every screen renders on every simulated board. None is clicked (P3).
- **`describe(image)`:** done.

Everything else in the first review's answers still holds and is not repeated here.

## The numbers

| | Now | First review |
|---|---|---|
| Non-test lines | `ui/` 24,041 (187 files); `session/` 6,493; `model/` 5,706; `workbench/` 3,144; `operations/` 1,832; `config/` 790; `sync/` 783; `domain/` 567; `layers/` 411 | `ui/` 26,000; core 5,000 |
| Test files / tests | 172 / 1,852 (71 of them in `ui/`) | 118 |
| Full test run | 104 s wall; 61 s in tests, of which **42 s is the simulated board's latency** (19 s with it at 0) | "about a minute" |
| `tsc -b` / lint / build | 16 s / 1 s / 1 s | |
| Session setup without Nix | WASM branch 1 s, `npm ci` 3 s | |
| CI Checks run | 9 min, of which **6.5 min Nix WASM build**; 64 runs in the last week (push and pull_request both), 308 runner minutes | |
| Deploy | 1 min (WASM cached), no tests | |
| Over 500 lines | `session/link-session.ts` 1,513, `session/mock/board.ts` 1,499, `ui/lighting/ConditionalRulesPanel.tsx` 1,059, `session/mock/glove80.ts` 625, `ui/keymap/ActionEditor.tsx` 562 (all on the list) | |
| Boundary baseline | 20 `ui/` files import the wire package; probing baseline empty (but it only watches 7 lighting fields) | |
| Most imported | `ui/kit.tsx` 84, `ui/state.tsx` 81 (`useWorkbench` in 94 places), `ui/icons.tsx` 45, `model/action-types.ts` 38, `session/types.ts` 34 | |
| Most imports | `ui/keymap/KeymapCenter.tsx` 34, `ui/Workbench.tsx` 33, `ui/keymap/KeyEditor.tsx` 28 | |
| Main bundle | 930 kB (277 kB gzip), one chunk | |

## 1. Where a change spends its effort

The last 30 commits (no merges) touch a median of 4.5 files, p75 12, max 60 (the rename). Of 250 file touches: `ui/` 83, core 70, tests 52, docs 41. Docs are one touch in six.

What rippled, and why:

- **Modifiers per computer** (`b2cec9b`, PR #11): 28 files. `ui/labels.ts`'s functions took no context, so giving them the chosen computer changed every caller (16 files import it) and every label test. The seam now exists (`TextContext`, `useKeyText`) and a guard keeps it (`modifier-text.test.ts`). The same shape is still in `ui/behaviors/library.ts` (`wording` passed by hand). Lesson for the next one: a function that formats takes one context object, never loose parameters.
- **Add-ons in the layout** (`0b00d74`, PR #14): 20 files, 8 of them the core pipeline (`model/history.ts`, `model/workbench-state.ts`, `workbench/apply.ts`, `reducer.ts`, `io.ts`, `io-import.ts`, `initial-state.ts`, `config/transfer.ts`) for one list of strings. Behavior labels were threaded the same way before: `labels` is a separate field of the `commit` action, of `CommitOptions`, of `importLayout`, of the history step and of the reducer's undo. #14 already names the idea (`LayoutNotes`) but threads `labels` and `modules` side by side. The seam is "what the layout keeps that the keyboard does not", as one value (item 1).
- **A new keyboard item** costs more than it should: it joins `KeyboardImage`, gets a state field, `initialWorkbenchState`, a line in `wantOf` and `withWant`, reducer cases, a planner and a writer. Three of those are the essential ones (image, planner, writer); the rest exist because what you want is not stored as an image (P2).
- **A test needs a realistic board:** `fc25eb9` added a 2,161-line TailorKey file to test one shape check, because there is no small realistic fixture (item 6).
- **Hotspots:** `ui/TopBar.tsx` (6 of 30 commits), `ui/Workbench.tsx` (5), `ui/terms.ts` (4), `ui/every-screen.test.tsx` (4). These are registries, which is fine; keep them as data (`areas.ts` is the model).
- **Flows (#13) were well contained:** 36 files, but each in its place (board facts in `model/boards/`, operations, `describe`, `flows/`, one screen). That is the architecture doing its job.

Seams missing or misplaced: layout notes as one value (item 1); `want` stored, not assembled (P2); opening a keyboard in `ui/` (item 7); screens that `dispatch` edits directly, beside `io` (P5); one module-store helper (item 9).

## Do now (under a day each, cheapest high impact first)

1. **Layout notes as one value, in #14 before it merges.** *Problem:* above; the next note (a layout's description, its author, a touchpad's settings) would touch the same 8 files again. *Proposal:* `state.notes: LayoutNotes`; `commit`, `CommitOptions`, `importLayout` take `notes?: Partial<LayoutNotes>`; the history step already records `NotesChange`; `config/` reads and writes notes through one codec per field. *Cost:* S. *Saves:* a new note becomes a field and its codec: 2–3 files, not 8.
2. **The simulated board without latency in tests.** *Problem:* `session/mock/board.ts` `latency()` waits 5–15 ms (random) on every call, in tests too: 42 of the 61 s of test time (measured by setting it to 0: 104 s → 60 s wall, 1,852 tests still green). *Proposal:* a `latency` option on the board (default as now for `just dev-mocks`), 0 in `src/test/wasm.ts`'s setup. Random latency also makes timing flakes possible; a test that needs a slow board asks for one. *Cost:* S. *Saves:* 45 s per full run, locally and in CI.
3. **CI: one WASM cache, one run per change, tests on master.** *Problems:* `checks.yml` builds both WASM clients with Nix every run (391 of 540 s), though `deploy.yml` already caches them by the hash of `flake.nix`, `flake.lock` and `nix/`; Checks runs on `push` and on `pull_request`, so every PR push runs twice (64 runs, 308 runner minutes last week); deploy runs no tests, so the merge result of two PRs merged seconds apart (#11 and #12, 4 s) was never tested before it went live; `pages.yml` and `import-upstream-prs.yml` are disabled but still in the repo. *Proposal:* a composite action `.github/actions/wasm` (restore the cache, build with Nix only on a miss, put the files in `src/vendor/`) used by both workflows; Checks on `pull_request` and `workflow_dispatch` only; deploy runs `tsc -b` and the tests before Cloudflare (1–2 min with item 2); delete the two dead workflows. The cancelled deploy when merging several PRs is `cancel-in-progress: true` doing its job (the last merge deploys); say so in the workflow's comment rather than change it. *Cost:* S. *Saves:* about 7 of 9 minutes per run, half the runs, and no untested deploy.
4. **`scripts/setup-session.sh` and the WASM branch kept fresh by CI.** *Problems:* every session repeats the setup by hand; `ci/vendor-wasm-out` is pushed by a "scratch" workflow (`vendor-wasm.yml`), with nothing that says which flake it was built from, so a session can test against stale clients without knowing; `npm test` runs `pretest` → `nix build`, which fails without Nix (agents must know to use `npx vitest run` or `npm run t`). *Proposal:* the composite action of item 3, on a cache miss in deploy, pushes `wasm-out/` to `ci/vendor-wasm-out` with a `WASM_KEY` file (the same hash). The script: fetch that branch shallow, compare `WASM_KEY` with the local hash and warn if it differs, copy into `src/vendor/`, `npm ci` if `node_modules` is older than `package-lock.json`; idempotent; prints its timing. `pretest`/`prebuild` skip `nix build` when `src/vendor/*` is present and `WASM_KEY` matches. Playwright is installed only by the e2e script (P3), not here. *Cost:* S. *Saves:* the setup is one command and under 10 s, and never silently stale.
5. **Docs that do not conflict.** *Problems:* #11 and #13 conflicted on `docs/adr/README.md` and `docs/todo.md`; #14 edits both again. Three causes: the ADR table is edited by every ADR; `todo.md`'s rule "strike it with its commit" needs a hash that only exists after merge, and "Done recently" is a log every branch prepends to; `ARCHITECTURE.md`'s line counts drift with every PR (it says `ui/` 22,300 and `operations/` 1,000; measured 24,041 and 1,832). *Proposal:* `scripts/adr-index.mjs` builds the table from each ADR's `# title` and `Status:` line (`npm run docs`), a test fails when the table is stale or two ADRs share a number, and the rule is "never edit the table; on a conflict, take either side and run `npm run docs`"; `todo.md` loses "Done recently" (the PR body and `git log` are the record) and items are struck with the PR number, which exists before merge; `ARCHITECTURE.md` drops the line counts or gets them from the same script. *Cost:* S. *Saves:* the conflicts seen in #11/#13, and a docs touch on every PR.
6. **Small fixtures beside TailorKey.** *Problems:* TailorKey (2,161 lines of TOML) is the only realistic layout; its layers are referenced by combos, forks and the Magic layer, so a test about one key carries all of that, and a change to one rule moves many golden results. The offline Glove80 is built from the simulated Glove80's spec (`session/offline/glove80.ts` → `mock/glove80.ts`), so it always reports pointing; 125 test uses go through `glove80Board`, and `test/tailorkey.ts` answers `has: () => true` for every capability. *Proposal:* (a) a builder over `KeyboardImage` in `src/test/` (`layout().layer("Base", row("QWERTY…")).combo(…)`) for unit and operation tests; (b) `glove80-plain.toml`: three layers, no home-row mods, no combos, no Magic layer; (c) options on the offline Glove80 (`{ pointing: false, lighting: false }`) and the harness asks the real capability set; (d) TailorKey stays the one golden for round-trips and Flows. *Cost:* S for (a)–(c). *Saves:* fixture edits in unrelated tests; tests that say what they need.
7. **One core test harness, and `openBundle` out of `ui/`.** *Problem:* 11 test files wire `makeIo` and `makeWorkbenchReducer` by hand (`test/tailorkey.ts` is one more); 11 core test files and `test/tailorkey.ts` import `ui/bundle.ts`, because opening a keyboard into a `ConnectedBundle` lives in `ui/`. *Proposal:* `git mv ui/bundle.ts workbench/open.ts` (it reads the session, it shows nothing); `src/test/harness.ts`: `openTestWorkbench(board | fixture, { mode })` returning `{ io, state, session }`, used by those 11 files and by P3. *Cost:* S. *Saves:* about 20 lines per new workbench test; core tests stop depending on `ui/`.
8. **Guards where the reviewer will look.** *Problem:* the probing guard watches 7 lighting fields, so the ~40 feature decisions from raw firmware fields in screens (`caps.is_split` 10, `max_combos` 9, `num_ble_profiles` 9, `ble_enabled` 7, `max_morse` 6 …; worst: `ui/device/DeviceMode.tsx` 18 reads, `ui/properties/DetailsSection.tsx` 12) are invisible to it. *Proposal:* extend the rule to those fields (geometry such as `num_cols` stays allowed) with a baseline, so P4 can only shrink it; the same for screens dispatching edit actions (P5). *Cost:* S. *Saves:* the count stops growing before P4 starts.
9. **One helper for module stores.** *Problem:* 11 stores in `ui/` each write `let x` + `listeners = new Set` + subscribe by hand; `ui/workbench-end.ts` must name each one that ends with the workbench, and forgetting one leaks state into the next keyboard and the next test. *Proposal:* `createWorkbenchStore(initial)` (subscribe, get, set, and registration for the end); `endWorkbench()` ends them all; a test resets them all. *Cost:* S. *Saves:* a class of leak, and boilerplate per new store.
10. **A GLIDE parity ledger.** See question 5. *Cost:* S.
11. **Operation names as GLIDE's.** GLIDE's catalog: `set_keys`, `add_behavior`, `update_behavior`, `add_layer`, `rename_layer`. GLIDE4RMK: `create_behavior`, `set_behavior`, `rename_behavior`, and no `rename_layer` (a rename is a direct Live write, `keymap.setLayerMetadata`). *Proposal:* the names GLIDE has, for the same meaning (aliases first, so Flows keep working), and `rename_layer` as an operation, which also removes one direct write. *Cost:* S. *Saves:* a Flow or a WebMCP tool reads the same in both apps.
12. **A `CLAUDE.md` for agents.** One line, `@AGENTS.md`, plus a short session section: run `scripts/setup-session.sh`; use `npm run t` (never `npm test` without Nix); read ranges in the big files; branch and PR conventions; docs rules from item 5. One source of rules, found by every agent. *Cost:* S.

## Plan (bigger)

(Numbered from P2: the first plan's layout-notes seam is item 1 above.)

- **P2. Store what you want; group the rest.** *Problem:* `WorkbenchState` has 62 fields and `WorkbenchAction` 65 kinds. Keyboard items (`layers`, `combos`, `morse`, `forks`, `macroOps`, `scenes` …), drafts (`layerDrafts`, `pointingDraft`, `runtimeConditionalDraft`), the keyboard's live reports (`battery`, `connection`, `modifierState`, `ledIndicator` …), busy and error flags (`batchBusy`, `layerBusy`, `lightingBusy`, `pointingBusy` and their errors) and the screen's own state (`mode`, `uiLayer`, `selection`, `hoverLeds`, `tryOut`) sit side by side. *Proposal:* `{ base, want, basedOn, history, notes, device, busy, ui }`, with selectors for what screens read today. Step by step, each green: `device` and `busy` first (S each, mechanical), then `want` as a stored `KeyboardImage` (M–L: `wantOf` and `withWant` disappear, the drafts become parts of it). *Cost:* L in all. *Saves:* a new keyboard item touches the image, its planner and its writer, nothing else; the state reads like ADR 0018 says it is.
- **P3. Screen tests that click, and one browser smoke.** *Problem:* every screen test is `renderToStaticMarkup` (`src/test/workbench.tsx`); Send, drag-swap, the selection gestures, the pick flow and `DraftKeeper` are untested at screen level (todo 25, 26), so a UI change is checked with hand-written Playwright scripts. GLIDE has 109 jsdom screen tests on one harness and one Playwright smoke. *Proposal:* (a) `jsdom` (or `happy-dom`) with `react-dom/client` and `act`; `mountWorkbench(<Screen />, { board, mode })` on the harness of item 7, with the real reducer and `io` on a simulated board, and helpers for click, keys and drag; first tests: todo 25's list, then `DraftKeeper`. (b) `tests/e2e/smoke.spec.ts` (Playwright, Chromium only): the dev-mocks build, each simulated board opens, a key is clicked and changed, Send, no console error; on pull requests, with the browser cached. Stable `data-key` attributes on canvas keys (41 test ids today). *Cost:* M for (a), S for (b) after it. *Saves:* a UI change is checked by `npm run t`, not by a script per change.
- **P4. Capabilities and `offer()` for everything a screen offers** (first plan, step 4, unchanged). With item 8's baseline as the measure of done; board presets (`presets.includes("glove80-status")`, 3 places) become offers with their conditions. *Cost:* M.
- **P5. The rest of the write path.** Unchanged from `ARCHITECTURE.md` "Not yet" and todo 11–13: direct Live writes (`session.*` calls: `io-lighting.ts` 14, `io-settings.ts` 6, `io-layers.ts` 4, `io-keys.ts` 3), whole rule and scene tables, and the Device screen calling the session itself (65 `session.*` call sites in 18 `ui/` files). New in this pass: 28 `ui/` files call `dispatch`, mostly for screen state (`select` 19, `mode` 9) but some for edits (`conditionalDraft` 4, `pointingDraftSet`, `paint`), which skip `io` and so skip what `io` decides. *Proposal:* screens get `io` and selectors, not `dispatch`; the screen's own state moves to its own store (P2's `ui`); item 8's guard holds the line meanwhile. Split `ConditionalRulesPanel.tsx` (1,059 lines) by job while moving its Apply onto an operation (todo 11). *Cost:* M–L, one item per session.
- **P6. GLIDE Flows without rewriting them.** See question 5. *Cost:* S spike, then M.
- **P7. Smaller big files and the bundle.** `link-session.ts` and `mock/board.ts` (about 1,500 lines each) split by topic (keys, behaviors, lighting, device); the 930 kB chunk split at the Flows window and jq (`jq-web`), the lighting gallery and the device screen. Neither slows a change today. *Cost:* M each; last.

## 2. Code quality, in short

- **Layering:** sound and enforced; the open edges are the 20 wire-type imports on the baseline (shrink when touched), `openBundle` in `ui/` (item 7) and screens dispatching edits (P5).
- **Files over budget:** five, all listed; `ConditionalRulesPanel.tsx` is the only screen that matters (P5).
- **Duplicated logic:** less than before. Left: key-clipboard planning in `ui/keymap/keyManipulation.ts` beside `operations/keys.ts`; library rows in `ui/behaviors/library.ts` beside `workbench/usage.ts`. Move each when next touched.
- **State shape:** the main debt (P2).
- **Write path:** as `ARCHITECTURE.md` lists, plus screen `dispatch` (P5).
- **Naming with GLIDE:** close (Guard, `askConfirm`, `showToast`, Flows, the type scale). Different without reason: operation names (item 11); `io.apply` vs GLIDE's `runOperation` + `pushHistory` is a real difference (GLIDE4RMK writes to a keyboard) and fine.

## 3. Tests

Fast feedback: items 2 (latency) and 7 (harness). Interaction: P3. Fixtures: item 6. Today's strengths stay: pure tests next to their code, every screen on every simulated board, golden usage results.

## 4. Session and tooling cost

Setup: item 4 (one script, under 10 s, never stale). CI: item 3. Docs per change: item 5 (generated ADR index, no log in `todo.md`, no hand-kept counts). Agents: item 12. The per-change docs rule that remains: a decision gets its ADR, a todo item is struck with its PR number; nothing else is edited by hand on every PR.

## 5. GLIDE parity

Today each port re-reads both codebases: GLIDE's Flows, key editor and add-ons are found by search, and each Flow is rewritten against `describe` and the operations (GLIDE's `autoshift.flows` is 100 lines; GLIDE4RMK's rewrite is 123).

- **A ledger (item 10, S).** `docs/glide-parity.md`: one row per feature (Flows store, key editor tabs, behavior library, add-ons, macro builder …) with GLIDE's files, GLIDE4RMK's files, and the GLIDE commit last ported. `scripts/glide-since.sh <feature>` prints GLIDE's commits and `DEVLOG.md` lines on those files since that commit. A port then reads one diff, not two codebases; the ledger is also the list of what is left.
- **GLIDE Flows as they are (P6).** `moergo-config-wasm` already writes and reads MoErgo JSON, and a file import is already a commit judged whole by Guard (ADR 0023). A compat runner could export what you want as MoErgo JSON, run a GLIDE layout Flow on it unchanged, read the result with `readImport` and commit it as an import. *Spike first (S):* run GLIDE's `dev/flows/shared/` Flows through it in a test and record which survive the round trip; behaviors RMK has no equivalent for, and anything the conversion loses, are the risk. If most survive, porting a Flow becomes copying it, and ADR 0025's `runs_on` rule is amended by a new ADR. If not, keep rewriting, with the ledger.

## Order

Items 1–5 first (about two days; item 1 inside #14), then 6–9 and 12 (about two days), then P3 (it makes P2 and P5 safe), P2, P5 and P4 one per session; P6's spike any time; P7 last.
