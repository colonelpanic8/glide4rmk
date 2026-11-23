#!/usr/bin/env bash
# What GLIDE changed on a feature since GLIDE4RMK last ported it: GLIDE's
# commits on the feature's files after the ledger's commit, each with the
# DEVLOG.md lines it added. The ledger is docs/glide-parity.md.
#   scripts/glide-since.sh <feature>        e.g. flows-store, key-editor
#   scripts/glide-since.sh --list           the features in the ledger
#   GLIDE_SRC=<path> …                      glide-src's clone (default ../glide-src)
set -euo pipefail
cd "$(dirname "$0")/.."
ledger=docs/glide-parity.md
glide="${GLIDE_SRC:-../glide-src}"

# The ledger's rows: | `feature` | what | GLIDE files | GLIDE4RMK files | commit | port |
rows() { grep -E '^\| `[a-z0-9-]+` \|' "$ledger"; }
cell() { awk -F'|' -v n="$1" '{ gsub(/`/, "", $n); gsub(/^ +| +$/, "", $n); print $n }'; }

if [ "${1:-}" = "--list" ]; then rows | cell 2 | sort; exit 0; fi
feature="${1:?usage: scripts/glide-since.sh <feature> (scripts/glide-since.sh --list for the features)}"
row=$(rows | grep -F "| \`$feature\` |" || true)
if [ -z "$row" ]; then
  echo "No feature \"$feature\" in $ledger; these are: $(rows | cell 2 | sort | tr '\n' ' ')" >&2
  exit 1
fi
if ! git -C "$glide" rev-parse -q --verify HEAD >/dev/null 2>&1; then
  echo "No glide-src clone at $glide: git clone https://github.com/moosylog/glide-src $glide, or set GLIDE_SRC." >&2
  exit 1
fi
read -r -a files <<<"$(echo "$row" | cell 4)"
since=$(echo "$row" | cell 6)

if [ "$since" = unknown ]; then
  echo "$feature: last port unknown; every GLIDE commit on its files:"
  range=HEAD
elif ! git -C "$glide" cat-file -e "$since^{commit}" 2>/dev/null; then
  echo "$feature: commit $since is not in $glide (a shallow clone? git -C $glide fetch --depth=3000 origin main)" >&2
  exit 1
else
  echo "$feature: GLIDE's commits since $since"
  range="$since..HEAD"
fi

commits=$(git -C "$glide" log --format=%h "$range" -- "${files[@]}")
if [ -z "$commits" ]; then
  echo "  nothing: GLIDE has not changed these files since."
  exit 0
fi
for commit in $commits; do
  git -C "$glide" log -1 --format='  %h %ad %s' --date=short "$commit"
  git -C "$glide" show --format= "$commit" -- DEVLOG.md | grep -E '^\+[^+]' | sed 's/^+/      DEVLOG: /' || true
done
