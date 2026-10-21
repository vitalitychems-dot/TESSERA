# Keyless live-data layer (shepherd)

- `sources.mjs`: 34 declarative adapters (api-anything style: endpoint spec -> request + normalizer). Official keyless endpoints only, `rps` set below each published limit, `ttlS` minimum re-pull interval. No proxies, no IP rotation, no scraping.
- `shepherd.mjs`: gateway pull loop = token bucket -> Retry-After backoff -> conditional GET (ETag/Last-Modified) -> normalize -> Ed25519-signed, content-addressed snapshot in `<cache>/snapshots/`, plus signed `manifest.json`. `syncTo()` delta-copies to an offline node (USB/LAN/GitMesh); `verifySnapshot()` checks hash, signature and staleness against the pinned `shepherd.pub.pem`. Private keys stay in the node keystore, never in git.
- Disabled: `osm-tiles` (tile policy bans offline bulk prefetch), `data-gov` (CKAN v3 returned 404 on 2026-10-12).
- Tests: `test/v2-030-live-data.test.mjs` uses recorded fixtures in `test/fixtures/live/` (overpass and semantic-scholar fixtures are synthetic: unreachable / 429 at record time).
- Live smoke (optional): `node src/live/smoke.mjs [ids...]`.
