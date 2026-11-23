# 0030. Screen tests that click: happy-dom, per test file, on the core harness

**Status:** Accepted. Builds on ADR 0029's harness; does part (a) of P3 in `docs/architecture-review.md`.

## Context

Every screen test rendered static markup (`renderInWorkbench`, `renderToStaticMarkup`): no effects run, nothing can be clicked. Send, drag-swap, the selection gestures, the pick flow and `DraftKeeper`'s effect were checked only by hand-written browser scripts (todo 25, 26). GLIDE runs its screen tests in jsdom on one harness.

## Decision

- **happy-dom**, not jsdom, as the page for screen tests. It has what the canvas needs and jsdom lacks or only stubs: `PointerEvent`, `setPointerCapture`/`hasPointerCapture` on SVG elements, `navigator.clipboard`; it is smaller and starts faster. GLIDE's tests use jsdom; nothing in them depends on the difference, so a test ported from GLIDE should only need its environment line changed.
- **Per test file.** A file that clicks starts with `// @vitest-environment happy-dom` and is named `*.click.test.tsx`. Every other test keeps running in Node, as fast as before; there is no second Vitest project.
- **`mountWorkbench(<Screen />, { board | fixture, mode })`** in `src/test/mount.tsx` opens the board with `openTestWorkbench` (ADR 0029) and mounts the screen with `react-dom/client` inside `act`, in a host (`src/test/mount-host.tsx`) wired as the app's `Workbench`: the harness's state as React state, the real reducer, the real `io` behind Guard (`guardIo`, `guardJudge`), the one history (`useHistory`) and the document transfer. It returns helpers that deliver events as a browser does — `click` (pointer down and up, then click, with Ctrl, ⌘, Shift or Alt held), `key`, `drag` (with the keys it crosses; it answers `document.elementFromPoint`, as there is no layout), `button(name)`, `canvasKey(row, col)`, `until(check)`, `wait(ms)`, `run(step)` — and `unmount`, which runs the effects' cleanup and closes the board. Anything still mounted is unmounted after each test. `mount(node)` mounts a tree that brings its own workbench (the app's `Workbench`).
- **Canvas keys carry `data-key="row,col"`**, a stable handle for tests.
- `src/test/jq.ts` hides the page from jq-web while it loads, as Emscripten otherwise takes a happy-dom file for a browser and waits for a fetch that never comes.

## Consequences

- A gesture, a window that opens or closes, an effect's timing and what reaches the board are tested with `npm run t`; static checks of what a screen shows stay on `renderInWorkbench`, and old tests are not converted for the sake of it.
- Mounted tests wait on real time where the screen does (Live's pause before its own send is 600 ms), so they cost more than static ones: use them where something must be clicked or must run.
- The browser smoke test (P3 b) checks what happy-dom cannot: layout, real hit-testing and the production build.
