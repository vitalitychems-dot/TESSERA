# Retrieval split changelog

`split.json` is frozen. The gate and its test load the committed file and only check
`sha256(split.json) == split.sha256`. Use `build.mjs --drift` to see how the current tree differs
(writes nothing, exits 0). `build.mjs --write --version vN --note "..."` is the only way to
regenerate; it requires a version bump and appends here. New versions need Einstein's review.

## v1 (2026-10-20)
- sha256 47e1adba4377f1593de5a83f0e9be9e867689222ff4c6ad17b757b7e73222f9c
- Content identical to the original unversioned split (sha256 40964dad8540db8347536b04e29e58c0156c78bdcb7d46b49c34ccb8108e8c10,
  built at 0dd5ec52/981ee36b); the only change is the added `"version": "v1"` field, which is why the hash changed once.
- docs 38, dev 122, heldout 157.
- Not absorbed: the 2 query titles added on main by PR #507 (visible via `--drift`).
