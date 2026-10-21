# config/secrets

Files here are encrypted with git-crypt. Unlock: `git-crypt unlock <keyfile>`.

## Rules
- Never commit raw tokens. Only `*.example.json` files (placeholder zeros) are plain text.
- `MESH_LANE_TOKENS` is a JSON map `{ "<slug>": "<sha256 hex of that lane's token>" }`.
  Slugs are mesh lanes from `config/mesh-lanes.json` or council nodes (`council-*`).
- Generate a token: `openssl rand -hex 32`; hash it: `printf %s "$TOKEN" | sha256sum`.
  Give the raw token only to the lane (sent as the `x-mesh-lane-token` header, which the
  logger redacts); put only the hash in the env / encrypted file.
- Rotate by replacing the hash and redeploying; revoke by deleting the slug's entry.
- Before committing, check `git-crypt status config/secrets` shows real secret files as encrypted.
- Keys starting with `_` (e.g. the example's `_doc`) are ignored by the loader, so copying
  the example is safe. Any other non-slug key or non-sha256 value makes MESH_LANE_TOKENS
  invalid, and then every comms POST fails closed with 403.
