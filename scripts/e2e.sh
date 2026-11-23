#!/usr/bin/env bash
# The browser smoke test (tests/e2e, playwright.config.ts): installs
# Playwright's Chromium (only here, never in setup-session.sh; in CI with its
# system libraries), builds with the simulated boards and runs the test.
#   scripts/e2e.sh                       npm run e2e
#   E2E_CHROMIUM=/path/to/chrome …      use a browser already installed
#   … -- <playwright test args>          e.g. --headed, --debug
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${E2E_CHROMIUM:-}" ]; then
  if [ -n "${CI:-}" ]; then npx playwright install --with-deps chromium; else npx playwright install chromium; fi
fi
VITE_ENABLE_MOCKS=1 npx vite build
npx playwright test "$@"
