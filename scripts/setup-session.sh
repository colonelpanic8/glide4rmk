#!/usr/bin/env bash
# Makes a checkout ready to typecheck, lint, test and build, without Nix:
#   - the WASM clients CI built, from the ci/vendor-wasm-out branch, into src/vendor/
#     (skipped when src/vendor/WASM_KEY already matches this flake);
#   - `npm ci` when node_modules is missing or older than package-lock.json.
# Safe to run again. Warns when the clients were built from another flake than
# this checkout's (the branch is refreshed by the deploy on master; a branch that
# changes flake.nix, flake.lock or nix/ needs Nix: `npm run wasm`).
#   scripts/setup-session.sh                 WASM_BRANCH=… to read another branch
set -euo pipefail
cd "$(dirname "$0")/.."

ms() { node -e 'process.stdout.write(String(Date.now()))'; }
started=$(ms)
branch="${WASM_BRANCH:-ci/vendor-wasm-out}"
clients="rynk-wasm moergo-config-wasm"

key=$(node scripts/wasm-key.mjs)
stamp=$(cat src/vendor/WASM_KEY 2>/dev/null || true)
present=yes
for c in $clients; do [ -e "src/vendor/$c" ] || present=no; done

if [ "$present" = yes ] && [ "$stamp" = "$key" ]; then
  echo "WASM clients: match this flake (${key:0:12})"
elif ! git fetch -q --depth 1 origin "+refs/heads/$branch:refs/remotes/origin/$branch"; then
  if [ "$present" = yes ]; then
    echo "Warning: could not fetch $branch; keeping the WASM clients in src/vendor/." >&2
  else
    echo "Could not fetch $branch, and src/vendor/ has no WASM clients." >&2
    exit 1
  fi
else
  ref="origin/$branch"
  built=$(git show "$ref:WASM_KEY" 2>/dev/null | tr -d '[:space:]' || true)
  mkdir -p src/vendor
  for c in $clients; do rm -rf "src/vendor/$c"; done
  # shellcheck disable=SC2086
  git archive "$ref" $clients | tar -x -C src/vendor
  if [ -z "$built" ]; then
    rm -f src/vendor/WASM_KEY
    echo "Warning: $branch has no WASM_KEY, so whether its clients match this flake is unknown." >&2
  else
    echo "$built" > src/vendor/WASM_KEY
    if [ "$built" = "$key" ]; then
      echo "WASM clients: from $branch, match this flake (${key:0:12})"
    else
      echo "Warning: the WASM clients on $branch were built from another flake (${built:0:12}; this checkout is ${key:0:12})." >&2
      echo "  Tests run against them may not match. Master's deploy refreshes the branch; with Nix, npm run wasm builds this flake's." >&2
    fi
  fi
fi

if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  echo "node_modules: up to date"
fi

echo "Ready in $(( ($(ms) - started) )) ms. Tests: npm run t -- <paths> (or npx vitest run)."
