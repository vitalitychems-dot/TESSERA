# Delta bundle sync

Offline sync for a git clone. The sender ships `<peer_ref>..<head>` as one git bundle (every commit and file in that range, not a single patch). The receiver runs `git bundle verify` against the clone it already has and refuses the fetch when the prerequisite commits are missing. A full history bundle is created or applied only when `--full` is passed.

The tool is off unless `TESSERA_ENABLE_DELTA_BUNDLE=1`. Unset, `0`, and `true` all leave it off.

## Ledger

`--ledger` is a JSON file of the last synced commit per peer:

```json
{
  "version": 1,
  "peers": {
    "lan-peer": { "ref": "<sha>", "syncedAt": "<iso>" }
  }
}
```

`record` writes a peer's ref. `create` reads it when `--peer-ref` is omitted. `fetch` updates it only after verify and a fast-forward succeed.

## Commands

```sh
export TESSERA_ENABLE_DELTA_BUNDLE=1

node tools/deltabundle/deltabundle.mjs record --ledger peers.json --peer lan-peer --ref <sha> --repo <sender>
node tools/deltabundle/deltabundle.mjs create --repo <sender> --out delta.bundle --peer lan-peer --ledger peers.json
node tools/deltabundle/deltabundle.mjs verify --repo <receiver> --bundle delta.bundle
node tools/deltabundle/deltabundle.mjs fetch --repo <receiver> --bundle delta.bundle --peer lan-peer --ledger peers.json

node tools/deltabundle/deltabundle.mjs create --repo <sender> --out full.bundle --full
node tools/deltabundle/deltabundle.mjs fetch --repo <receiver> --bundle full.bundle --peer lan-peer --ledger peers.json --full
```

`--head` must be a ref name (`HEAD` by default). Git will not put a raw commit sha on the right-hand side of a bundle.

Exit codes: `2` usage or flag off, `3` missing peer ref or nothing to send, `4` verify failed or a full bundle was refused, `5` the update is not a fast-forward.

Tests (no network): `node --test tools/deltabundle/deltabundle.test.mjs`

Benchmark: `node tools/deltabundle/bench.mjs` writes a JSON table. Numbers from the last run are in `RESULTS.md`.
