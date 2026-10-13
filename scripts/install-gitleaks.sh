#!/bin/sh
# Download a pinned gitleaks release and verify sha256 before the binary is used.
# No repository secrets are read. A checksum mismatch stops the script.
set -eu

VERSION=8.30.1
SHA256=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
ASSET="gitleaks_${VERSION}_linux_x64.tar.gz"
URL="https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/${ASSET}"
DEST="${PREFIX:-/usr/local/bin}"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

curl -fsSL -o "$tmpdir/gitleaks.tar.gz" "$URL"
echo "${SHA256}  $tmpdir/gitleaks.tar.gz" | sha256sum -c -
tar -xzf "$tmpdir/gitleaks.tar.gz" -C "$tmpdir" gitleaks
mkdir -p "$DEST"
install -m 0755 "$tmpdir/gitleaks" "$DEST/gitleaks"
"$DEST/gitleaks" version
