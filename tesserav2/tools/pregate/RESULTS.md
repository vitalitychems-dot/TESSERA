# Pregate replay of TESSERA #315

Before this command existed, a builder asked for a gate on each intermediate head with nothing checking identity or argv pass-through. **0 of the 5 findings below were caught before the gate.**

After, `node tools/pregate/run.mjs --replay <sha> --base 33ed9383cb9d63c96ba3fb7d49ff393a174ab84d` was run on the four heads the gate actually reviewed. **5 of 5 findings fail the command on the head where the gate recorded them.**

Base for every replay is `33ed9383cb9d63c96ba3fb7d49ff393a174ab84d` (`main` at the time of #315). `gitleaks` is not on this machine, so the secrets line is `pass (gitleaks not on PATH)` on every head. The gate's own comments say gitleaks was clean; this replay did not re-run it.

## The five findings

| # | What the gate recorded | Where | What the replay does |
| --- | --- | --- | --- |
| 1 | Author and committer display name is `Tessera`. The email is already `332565808+vitalitychems-dot@users.noreply.github.com`. | `f9b80dbd`, `6510b7b0` | `identity: fail` on both commits |
| 2 | With the flag on, `runCli` serves `-f`, `-F`, `--jq`, `-H`, `-i`, and `--input` as a cached GET. The PASS on `6510b7b0` missed the same gap. | `f9b80dbd`, `6510b7b0`, `587d8107` | `argv: fail` lists `-f`, `-F`, `--field`, `--raw-field`, `--input`, `-H`, `--header`, `--jq`, `-q`, `-i`, `--include` |
| 3 | `--paginate` and a non-GET `-X` were swallowed too. `587d8107` was the commit that started passing those two through. | `f9b80dbd`, `6510b7b0` (gone at `587d8107`) | `argv: fail` lists `--paginate` and `-X POST` on the first two heads only |
| 4 | A bare `graphql` and a `{owner}` / `{repo}` placeholder still take the cache path. Noted on the `ae51fff8` PASS, fixed later in `791ef5da`. | all four heads, including `ae51fff8` | `argv: fail` lists `graphql` and `{owner}/{repo}` on every head |
| 5 | The tip author is `vitalitychems-dot` from `587d8107` on, but `f9b80dbd` and `6510b7b0` are still in the branch, so Security required a squash as that noreply identity. | `587d8107`, `ae51fff8` | `identity: fail` still names `f9b80dbd` and `6510b7b0`. The tip commit is not in the identity list. |

Caught before gating: **0 / 5**. Caught by this command on the head where the gate recorded the finding: **5 / 5**.

The `f9b80dbd` FAIL about the cache key (`sha256("GET "+url)` with no token fingerprint, Accept, or API version) is a product bug. This command does not look at cache-key contents. `flags: pass` on that head because `TESSERA_ENABLE_ETAG_CACHE` is off unless it equals `1`.

## Per head

### `f9b80dbd05f7d3767057915e4a54c42dbda145b1`

Findings 1, 2, 3, and 4.

```text
identity: fail
  - f9b80dbd05f7 author Tessera <332565808+vitalitychems-dot@users.noreply.github.com>
  - f9b80dbd05f7 committer Tessera <332565808+vitalitychems-dot@users.noreply.github.com>
locked: pass
flags: pass
tests: pass
secrets: pass (gitleaks not on PATH)
argv: fail
  - tools/etagcache/etagcache.mjs: -f, -F, --input, -H, --jq, -i, --paginate, -X POST,
    unknown flags, graphql, {owner}/{repo}, and the other adversarial argv
```

No `ready for gate` line. Exit 1.

### `6510b7b0a51d32a72cf650c71db5e9cd51865bed`

Findings 1, 2, 3, and 4. Identity lists both `f9b80dbd` and `6510b7b0`.

The first full replay reported `tests: fail` in `@workspace/gitai` (`login needs the matching handle and key` expected `null` and got an agent). That test is unchanged from `f9b80dbd`, where the same suite passed, and it is not one of the five findings. A second run of the same command reported `tests: pass`. Identity, locked, flags, secrets, and argv matched the first run. The numbers above use the rerun for the test line.

No `ready for gate` line. Exit 1.

### `587d81077cc0d10c195d5e9e6cbaa3f8d73323df`

Findings 2, 4, and 5. Finding 3 is fixed on this head: the argv list does not contain `--paginate` or `-X POST`.

```text
identity: fail
  - f9b80dbd05f7 author Tessera <...>
  - f9b80dbd05f7 committer Tessera <...>
  - 6510b7b0a51d author Tessera <...>
  - 6510b7b0a51d committer Tessera <...>
locked: pass
flags: pass
tests: pass
secrets: pass (gitleaks not on PATH)
argv: fail
  - still includes -f, -F, --input, -H, --jq, -i, -X get, -XGET, --method, -iX,
    double-dash, graphql, {owner}/{repo}
  - does not include --paginate or -X POST
```

The tip commit's author and committer are `vitalitychems-dot`. The identity failure is the earlier commits (finding 5) plus the argv FAIL the gate wrote on this sha (finding 2).

No `ready for gate` line. Exit 1.

### `ae51fff8bde40521be31782b764d2bcc6ef53688`

Findings 4 and 5. Findings 2 and 3 are fixed: the only argv failures are `graphql` and `{owner}/{repo}`.

```text
identity: fail
  - f9b80dbd05f7 author Tessera <332565808+vitalitychems-dot@users.noreply.github.com>
  - f9b80dbd05f7 committer Tessera <332565808+vitalitychems-dot@users.noreply.github.com>
  - 6510b7b0a51d author Tessera <332565808+vitalitychems-dot@users.noreply.github.com>
  - 6510b7b0a51d committer Tessera <332565808+vitalitychems-dot@users.noreply.github.com>
locked: pass
flags: pass
tests: pass
secrets: pass (gitleaks not on PATH)
argv: fail
  - tools/etagcache/etagcache.mjs: graphql: arguments were not passed through
  - tools/etagcache/etagcache.mjs: {owner}/{repo}: arguments were not passed through
```

No `ready for gate` line. Exit 1.

## Count

| | Caught |
| --- | --- |
| Before this command | 0 / 5 |
| Replay on the head where the gate recorded the finding | 5 / 5 |
