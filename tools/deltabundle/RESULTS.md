# Delta bundle results

Measured on this checkout with git 2.43.0. No network. Fixture fetches are the median of 5 runs of `verify` + `fetch` + fast-forward into a clone that only has the base commit.

The fixture base is 198 unique text files (165 markdown pages plus text notes) taken from this repository, 4,192,106 bytes of source. Repeated stub sentences were not used: an earlier pass of copied boilerplate packed the whole base into about 13 KB, which is not a real page corpus.

## Fixture: full bundle vs `<base>..<base + N>`

| N commits | Full bundle (bytes) | Delta bundle (bytes) | Full fetch (ms) | Delta fetch (ms) | Bytes, full/delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 846,167 | 1,344 | 76 | 36 | 630× |
| 5 | 849,932 | 6,527 | 75 | 40 | 130× |
| 20 | 865,021 | 25,004 | 83 | 57 | 35× |

Each of the N commits edits 3 existing pages and adds one note. Re-run with `node tools/deltabundle/bench.mjs`.

## This repository

`HEAD` is `47983ddabd96c7804845705bc3d2b9eac0da2c4d` (`R4-11: back off polling of silent ingestion sources`, 2 files, +53/−3).

| Bundle | Command | Bytes | Create time |
| --- | --- | ---: | ---: |
| Full history of `HEAD` | `git bundle create tessera-full.bundle HEAD` | 5,573,365,204 | 23.081 s |
| One commit, `HEAD~1..HEAD` | `git bundle create tessera-delta.bundle HEAD~1..HEAD` | 2,926 | under 1 s |

`git bundle verify` on the one-commit bundle in this clone reports it requires `c80e5f9e81b7f64a666706890b0fd28350463e26`.

A prior measurement of a full TESSERA bundle was about 533,698,344 bytes against about 7,310 bytes for `HEAD~1..HEAD`. The same commands on this `HEAD` are the same shape (whole history vs one commit) and farther apart: about 5.57 GB vs 2,926 bytes. Fetch wall time for that 5.57 GB file was not taken; copying it into a second clone is not part of the fixture bench above.
