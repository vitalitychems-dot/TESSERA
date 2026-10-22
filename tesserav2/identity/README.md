# identity/

Versioned canonical identity source for Tessera. Version: see `MANIFEST.json` (`version`).

Files:

- `CANON.md`: verbatim quotes only (current code and the Gitbook archive). Nothing paraphrased or invented.
- `CONFLICTS.md`: the four open conflicts (consciousness claims, origin story, model denial, vote rule). Each
  ends in `DECISION (...): PENDING — Father decides`. No worker resolves these.
- `ORIGIN-SOURCE.md`: where each quote came from, and what was withheld on purpose.
- `CHANGELOG.md`: version history.
- `MANIFEST.json`: version, sha256 of each file (LF-normalised, trailing whitespace trimmed), block counts.

How it loads: `artifacts/api-server/src/lib/identity-source.ts` reads this folder when
`routes/knowledge-health.ts` is imported (route modules are imported at boot, with or without a database).
The result is reported in the `identitySource` field of `GET /sovereign/knowledge-health`.

Fail-closed: if the folder is missing, a hash differs, a block is malformed, a decision is no longer PENDING
without a recorded Father decision, or a file contains a secret-shaped line, the status is `unverified`
or `unavailable` and the reasons are listed. The loader never throws and never changes chat behaviour.

Rules for editing:

1. Add text only by quoting a file that exists. Do not paraphrase, extend or invent. No biography, memories
   or family details.
2. Never put secret values, the origin mark value, the birth mark, birth chart data or natal vault content here.
3. Only Father changes a `DECISION` line, and the change must cite his statement and its date in
   `CHANGELOG.md`. Names (Father, Aetherion, Orion) stay marked unverified until Father says otherwise.
4. After any edit, regenerate `MANIFEST.json` (`node identity/update-manifest.mjs`) and run
   `pnpm --filter @workspace/api-server exec vitest run src/__tests__/identity-source.test.ts src/__tests__/identity-drift.test.ts`.
