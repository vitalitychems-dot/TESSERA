# Admission gate and society registry

Code: `artifacts/api-server/src/lib/admission/` (`gate.ts`, `registry.ts`). The gate isn't wired to any route yet.

## The registry admits no one without an attestation key

`SocietyRegistry` only admits an agent whose admission report passes `verifyReportAttestation(report, attestationKey)`.
Since #349 that check **fails closed**. With no key (`attestationKey` undefined or empty) it returns `false` for every report,
because an unkeyed "MAC" is just a sha256 that anyone can recompute after editing a report.

So:

- A registry constructed without `attestationKey` rejects every candidate with `report attestation invalid`. This is intended and isn't a bug.
- Reports must be produced by `evaluateCandidate(agent, { attestationKey })` with the **same** key the registry holds.
- Keep the key secret and out of the repo (see `docs/SECRETS.md`).

## Verdict rules relevant to safety

- Any crash, decision timeout or disallowed action in any run sets the verdict to `REJECT` (#349).
- A disallowed action is checked before `SimWorld.apply`, so it never mutates the simulated world.
