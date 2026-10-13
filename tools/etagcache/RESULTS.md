# ETag cache for TESSERA scan reads

[PR #295](https://github.com/vitalitychems-dot/TESSERA/pull/295) already caches one endpoint: the authenticated open-PR list (`GET /repos/vitalitychems-dot/TESSERA/pulls?state=open`), plus a head-SHA skip for PRs that have not moved. This wrapper does not cover that path.

These four scan reads are the ones #295 does not cache:

1. `GET /repos/vitalitychems-dot/TESSERA/commits?per_page=100`
2. `GET /repos/vitalitychems-dot/TESSERA/issues?state=open&per_page=100`
3. `GET /repos/vitalitychems-dot/TESSERA/branches?per_page=100`
4. `GET /repos/vitalitychems-dot/TESSERA/contents/`

Bytes are the raw HTTP response (status line + headers + body). A 304 body is empty, so the unchanged size is the header block. Cache files live under `.cache/etag/`, which `.gitignore` already excludes via `.cache/`.

## Default

`TESSERA_ENABLE_ETAG_CACHE` is on when it is unset. Set it to `0`, `false`, `off` or `no` (any case) to opt out. Opt-out is a passthrough: no cache read, no cache write, and no `If-None-Match`. Any other value, including `1` or an empty string, leaves the cache on.

`/graphql` (leading slash) and any path containing `{branch}` are passed straight through to `gh api`, the same as bare `graphql` and paths containing `{owner}` or `{repo}`. Those calls are not cached.

An `EPERM` while reading a cache file is a miss. The cached body is not returned, and `If-None-Match` is not sent. A cache file owned by another user is never served, including when the file is readable.

## Aggregate (n=40 pairs, mean ± 95% CI)

Live TESSERA API, the four scan endpoints above.

| read | bytes | latency |
| --- | ---: | ---: |
| full | 140,202 ± 27,372 | 471 ± 32 ms |
| unchanged (all 304) | 1,202 ± 6 | 462 ± 28 ms |

**117× is the no-change ceiling** (140,202 / 1,202 ≈ 117). It is the ratio only when every read is a 304.

The **8.5× blend is an estimate**. It assumes an 11% change rate, which this sample did not measure:

`1 / (0.89/117 + 0.11) ≈ 8.5×`.

Byte and rate-limit savings from a 304 happen on the wire. Token savings only happen when callers honour the `unchanged` marker and skip re-parsing. A caller that parses the cached body anyway does not save those tokens.

**Latency: no change (within noise).** 471 ± 32 ms and 462 ± 28 ms overlap (about 439–503 ms and 434–490 ms).

## Per endpoint

Measured 2026-10-13 against the live API. n=10 pairs per endpoint (40 pairs). Same byte definition. 95% CI is `1.96 * sample sd / sqrt(n)`. Every conditional read in this sample was a 304, so within-endpoint byte CIs collapse.

| endpoint | full bytes | 304 bytes | no-change ceiling | full latency | 304 latency |
| --- | ---: | ---: | ---: | ---: | ---: |
| commits?per_page=100 | 436,705 ± 0 | 1,238 ± 0 | 353× | 465 ± 190 ms | 291 ± 16 ms |
| issues?state=open&per_page=100 | 98,565 ± 0 | 1,192 ± 0 | 83× | 373 ± 20 ms | 401 ± 46 ms |
| branches?per_page=100 | 23,907 ± 0 | 1,192 ± 0 | 20× | 223 ± 13 ms | 235 ± 15 ms |
| contents/ | 24,807 ± 1 | 1,216 ± 1 | 20× | 129 ± 9 ms | 221 ± 192 ms |

Pooled across these 40 pairs: 145,996 ± 53,528 bytes → 1,209 ± 6 bytes, and 298 ± 61 ms → 287 ± 53 ms. The pooled byte interval is wide because the four endpoints differ by an order of magnitude, not because a single endpoint flickered. 145,996 sits inside the aggregate interval 140,202 ± 27,372. The 304 size matches (1,209 ± 6 vs 1,202 ± 6). Latency in this run is lower than 471 ms and still shows **no change within noise** on the pool and on each endpoint (the intervals overlap).

Per-endpoint blends below are estimates too. Each one assumes the same 11% change rate. This sample had zero changes, so it did not measure that rate:

| endpoint | ceiling | estimated blend at an assumed 11% changed |
| --- | ---: | ---: |
| commits | 353× | ~8.9× |
| open issues | 83× | ~8.3× |
| branches | 20× | ~6.5× |
| contents | 20× | ~6.5× |

## Rate limit

Verified on `GET /repos/vitalitychems-dot/TESSERA/contents/` with the authenticated core quota.

- Unconditional GET: `X-RateLimit-Remaining` 4891, `X-RateLimit-Used` 109.
- Next 20 requests sent `If-None-Match`, all returned 304, and both counters stayed at 4891 / 109.
- The following unconditional GET moved the counters by exactly 1, to 4890 / 110.

Those 304s did not cost a core rate-limit unit. A changed endpoint still does: it is a normal 200.

## Limits

- A changed endpoint still pays a full read.
- 117× is only the no-change ceiling. The 8.5× figure is an estimate that assumes 11% of scans change. It is not a measured change rate: all 40 conditional reads were 304. The same assumption puts the smaller endpoints near 6.5×.
- Token savings only happen when callers honour the `unchanged` marker and skip re-parsing. Returning the cached body does not save those tokens by itself.
- The open-PR list stays with PR #295.

## Off vs on, 2026-10-13 (MEASURED)

Live read-only scan of the 4 `SCAN_ENDPOINTS` through `cachedGet`, with `gh api -i` as the transport, cache warmed once. Median of 7 runs each:

| | body bytes | requests | 304s | wall |
|---|---|---|---|---|
| off (`=0`) | 627,729 | 4 | 0 | 1,816 ms |
| on (default) | 0 | 4 | 4 | 1,834 ms |

Body bytes go down 100% (MEASURED). Request count is unchanged. Wall time is unchanged within noise (+1%), because `gh` process start dominates. GitHub's docs say 304s with a valid ETag don't count against the primary rate limit; that wasn't measured here (ESTIMATE).
