@AGENTS.md

## Sessions

`AGENTS.md` holds the rules; this adds how a session runs.

- Start with `scripts/setup-session.sh`. It copies the WASM clients CI built into `src/vendor/` and runs `npm ci` when the lock file changed; run again, it does nothing it need not. If it warns that the clients were built from another flake, say so in your report: tests then run against clients that may not match.
- Tests: `npm run t -- <paths>` (failures and totals only), or `npx vitest run`. `npm test`, `npm run build` and `npm run dev` first check the WASM clients; without Nix that only works when `src/vendor/` has them, so run the setup first.
- Before you push: `npx tsc -b`, `npx oxlint`, and the tests for what you changed; the whole suite before a large change.
- Big files (`session/link-session.ts`, `session/mock/board.ts`, `ui/lighting/ConditionalRulesPanel.tsx`): find the line first (`rg -n`), then read only that range.
- One change per branch, named by kind (`feat/…`, `fix/…`, `docs/…`, `ci/…`), from `master`, with a pull request against `master`. Merge only when asked.
- Docs on every PR: a decision gets an ADR with a `**Status:**` line, then `npm run docs` (never edit the ADR table; on a conflict in it, take either side and run `npm run docs`). Strike a `docs/todo.md` item in the PR that does it, with the PR's number. No "done" log and no line counts in the docs.
