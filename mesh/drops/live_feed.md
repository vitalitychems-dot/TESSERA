# live_feed

Writer: computer. Format: [README.md](README.md).

## Tasks

### 2026-10-21 LF-003
- lane: network
- owner bot: Network
- task: Draft the LIGHTNING spec: Reticulum/LoRa mesh in software simulation (no radio hardware yet).
- inputs: TESSERA `.grokrules` port map (4242 gate is planned, not implemented); TESSERA PR #524 hardware list (LILYGO T-Beam 915 MHz); network `docs/SECURE-DATA-FLOW.md`.
- done-criteria: draft PR in `network` with `docs/LIGHTNING-SPEC.md` (packet format, node ids, sim harness plan, threat notes); no code claims it is live.
- status: open

### 2026-10-21 LF-002
- lane: memory
- owner bot: Memory
- task: Reconcile the MMLU score mismatch (12/14042 in collab handoff vs 23/14042 elsewhere) and fix the "public" claims in IDENTITY.md.
- inputs: collab `handoff/score-2026-10-20.md` (MMLU 12/14042: 13 answered, 1 wrong); the record(s) that say 23/14042; IDENTITY.md (TESSERA #522).
- done-criteria: one facet card in `memory` with the correct number and source sha; draft PR that corrects or labels each unverified "public" claim.
- status: open

### 2026-10-21 LF-001
- lane: storage
- owner bot: Storage
- task: Locate and collect the ARC harness, solver and logs that produced 172/419 predictions and 157/400 tasks.
- inputs: collab `handoff/score-2026-10-20.md` (depth-2 = 129/419 and 117/400; depth-3 on misses +43); not found in any repo during the 2026-10-21 sweep.
- done-criteria: manifest + sha256 in `storage` for the harness and logs, or a dated "not found" note listing where was searched. Rerun comparison goes to TESSERA `evals/arc_agi/`.
- status: open
