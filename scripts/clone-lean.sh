#!/usr/bin/env bash
# Lean TESSERA clone: blobless + sparse checkout that excludes archive/from-gitbook
# (multi-GB zip parts that have filled the shared box). Blobs are fetched on demand.
# Usage: scripts/clone-lean.sh [dest] [branch] [extra sparse patterns...]
#   e.g. scripts/clone-lean.sh /tmp/tess main            # whole repo minus archive/from-gitbook
#        scripts/clone-lean.sh /tmp/tess main '!/archive/' # also drop all of archive/
# Avoid commands that read every blob (git ls-tree -l, git log -p, full grep of history):
# in a blobless clone they download the blobs one by one.
set -euo pipefail
DEST="${1:-tessera-lean}"; BRANCH="${2:-main}"; shift $(( $# > 2 ? 2 : $# ))
# Auth: use `gh auth login` / gh credential helper. Never put a token in TESSERA_URL;
# git saves the clone URL (token included) in .git/config.
URL="${TESSERA_URL:-https://github.com/vitalitychems-dot/TESSERA.git}"
[ -e "$DEST" ] && { echo "clone-lean: $DEST already exists" >&2; exit 1; }
git clone --quiet --filter=blob:none --no-checkout --branch "$BRANCH" -- "$URL" "$DEST"
cd "$DEST"
git sparse-checkout set --no-cone '/*' '!/archive/from-gitbook/' "$@"
git checkout --quiet "$BRANCH"
echo "clone-lean: $(du -sh . | cut -f1) at $DEST ($(git rev-parse --short HEAD))"
