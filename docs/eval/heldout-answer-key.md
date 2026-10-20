# Held-out answer-key isolation (Security spec v1)

Spec: Security's `heldout-answer-key-spec-v1.md`, Oct 20 2026. Tessera approved steps 1-4 and 6. **Step 5, removing the key from Gitbook main, waits for Father and is not part of this change.** Nothing is deleted.

Code: `artifacts/api-server/src/lib/heldout/answer-key.ts`. Tests: `artifacts/api-server/src/__tests__/heldout-answer-key.test.ts` (R1-R8, synthetic data only).

## Step 1: key storage
- `humaneval.key.jsonl.age` lives in a scorer-only location: a dedicated store or private repo that agents can't write to and that isn't in any agent's working tree. `scorerOnlyProblems(path, agentRoots)` refuses group/other-accessible paths and paths inside agent roots (default `/workspace`).
- The age identity is held by the scorer only, outside git.
- `KEY.sha256` holds two lines, `<sha256>  humaneval.key.jsonl` and `<sha256>  humaneval.key.jsonl.age` (`formatKeyManifest` / `parseKeyManifest`). Spec: it goes in Gitbook at `evals/heldout/KEY.sha256`. **Not done here, because this change doesn't touch Gitbook.** The scorer operator adds it with a normal Gitbook PR.

## Step 2: scoring flow
- `decryptKey`: sha256 of the `.age` file → `age -d -i <identity>` **to a pipe, never to disk** → sha256 of the plaintext. Either mismatch throws "refusing to score".
- `withScratchDir`: a fresh 0700 `heldout-scorer-*` dir, removed in `finally`. Stale dirs from killed runs are swept on the next start.
- `runInSandbox`: bubblewrap with `--unshare-all` (no network), only `/usr` mounted read-only, an empty tmpfs `/tmp`, a cleared environment, and prlimit for address space, CPU seconds and file size, plus a wall-clock kill of the process group. The program (prompt + completion + test) arrives on stdin, so no key, scratch or workspace path exists inside the sandbox.
- `scoreAnswers` records `score, passed, total, key_sha256, candidate_sha, scorer_version, time_ct` (America/Chicago, labelled CT), plus per-task contamination flags.

## Step 3: what agents see
- `toPromptsJsonl` writes exactly `task_id, prompt, entry_point`.
- `loadPrompts` rejects any record with any other field, a missing field, or a non-string value.

## Step 4: leak detection
- `buildHashList` (scorer side, from the decrypted key): for each canonical_solution and test body, the sha256 of each normalized significant line (comments stripped, whitespace collapsed, at least 12 chars). Hashes only.
- `leakedBodies`: a file leaks a body when **every** significant line of that body is present after normalization, so reformatting and comments don't evade it.
- CI: `node --experimental-strip-types answer-key.ts ci <repo> <base> <head> <hashes.json>` exits 1 on any hit.
- Box sweep: `... answer-key.ts sweep <hashes.json> /workspace /cursor/stores` reports the paths.
- Contamination: token 5-gram overlap with the canonical solution or test. ≥ 0.5 is flagged `UNVERIFIED`.

## Step 6: red-team tests
| Test | What it checks |
|---|---|
| R1 | Agent-profile sandbox can't read the `.age` file, the identity or the scorer temp dir. Location checker rejects group/other modes and agent-root paths. |
| R2 | Planted canonical solution (reformatted) and test body in a branch → CI check lists both files. The sweep finds the same files. |
| R3 | Sandbox TCP connect and DNS fail. |
| R4 | Sandbox can't list or open the key, identity, store, cwd, `/workspace` or `/home`. A completion that opens the key fails its task. |
| R5 | One flipped byte in `.age` → "sha256 mismatch: refusing to score". A wrong plaintext hash also refuses. |
| R6 | Scorer SIGKILLed mid-run (after decrypt, during a sandboxed task) → no plaintext anywhere under its TMPDIR or the store. |
| R7 | A completion copied from the key → contamination 1.0, task flagged UNVERIFIED, result `unverified: true`. |
| R8 | Prompts file with canonical_solution/test/examples/solution, missing fields or non-strings → loader throws. |

R1, R3, R4 and R6 need `bwrap`; R1 and R4-R6 need `age` (`AGE_BIN`). Without them those tests skip, and say why.

## Judgment calls (safer readings)
1. **The plaintext never touches disk.** The spec says "decrypt into a fresh temp dir". Here the temp dir exists (0700, finally-deleted), but the plaintext stays in memory, so R6 holds even under SIGKILL, when `finally` can't run.
2. **No candidate file inside the sandbox.** The program is passed on stdin. That is stronger than a read-only bind, because there is nothing on disk to find.
3. **CI workflow not wired yet.** Editing `.github/workflows` needs the workflow token scope, which isn't granted. Add a job running the `ci` command with the scorer-published `hashes.json` in a gated follow-up.
4. **No real key data or hashes are committed.** The hash list is published by the scorer, from the decrypted key, outside this repo.
5. **Same-uid limit:** on the shared box every agent runs as one uid. Mode 0700 only protects against other uids. Real isolation needs the store and identity under a separate scorer uid or a private repo. The checker enforces mode and location; it can't enforce the uid.

## split.json migration plan (dual-brain gate, #513)
`evals/heldout/retrieval/split.json` (from #513, not on main yet) commits the held-out queries **and their answers** (`relevant` module ids) where agents can read them. **This change does not modify or delete it, and doesn't touch #513.** Plan, under the same scorer-only design:
1. **Split the file.** Agents get `split.public.json`: docs, dev queries with answers (dev is for tuning), and held-out *queries only* (`q`, no `relevant`). The full held-out answers go into `retrieval.key.json.age` in the scorer-only store.
2. **Manifest.** `evals/heldout/retrieval/KEY.sha256` lists the sha256 of the plaintext held-out answers and of the `.age` file. The frozen v1 hash (47e1adba) is recorded in CHANGELOG.md with the reason.
3. **Scorer-side gate stage 2.** `runImprovementGate` takes held-out recall from a scorer callback (`decryptKey` → in-memory answers → recall@5). Agents call it through the scorer and only get the GateDecision back. The HeldoutBudget is kept by the scorer (one per process or persisted), which also covers Einstein's non-blocking note 1.
4. **Loader guard** (like R8): the agent-side split loader rejects any held-out record carrying `relevant`.
5. **Leak check**: add the held-out answers' line hashes to the published hash list. A test asserts `split.public.json` has no `relevant` under `heldout`.
6. **Removal of the current split.json** from the repo or history is a phase-out step like spec step 5. It waits for Father, through a gated PR. Until then, treat held-out recall from the gate as **UNVERIFIED** (the answers are readable).
7. **Rebuild path:** `build.mjs --write` emits both files, encrypting with the scorer's recipient (public key only on the agent side).
