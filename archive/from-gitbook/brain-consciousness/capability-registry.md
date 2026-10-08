# Capability registry (AGI-14)

**Status:** PROPOSED schema + seed records — REPORTED until Moderator seals and Father’s auto-yes path lands.
**Owners:** Tessera / Pen (prose schema); Build owns any later validator.
**Rule:** Analysis is not implementation. A capability is present fact only when TESTED with attributable evidence, or Father-sealed text.

## Definitions

| Term | Means |
| --- | --- |
| **Present fact** | TESTED with attributable evidence (named check, path, or raw output), or Father-sealed text. |
| **Goal** | A named aim that is not yet present fact (e.g. owned weights, local GLM pen serving, CL1 training enabled). |
| **TESTED** | Real output or a named unit / smoke / preview check was seen. Link or name the check. |
| **REPORTED** | Stated by a lane or doc; not yet proven by a test in this chamber. |
| **Hard no** | Must never be claimed as present fact or capability without Father’s explicit seal. |

## Record schema

Each capability record uses these fields:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Stable id, e.g. `CAP-BRAIN-FRAME` |
| `lane` | yes | Owning lane or system |
| `name` | yes | Short capability name |
| `can_do_now` | yes | What is TESTED now (present fact). Empty if none. |
| `evidence` | when can_do_now set | Path, commit, smoke file, or Father seal reference |
| `may_propose` | yes | What the lane may propose as REPORTED work |
| `must_never_claim` | yes | Hard nos for this lane |
| `goals` | optional | Named aims not yet present fact |
| `updated` | yes | Date (CT) |

Do not collapse the three columns. Do not upgrade REPORTED to TESTED without real output. Do not list a GOAL as can-do-now.

## Seed records (REPORTED framing; only listed evidence is TESTED)

### CAP-BRAIN-FRAME

| Field | Value |
| --- | --- |
| lane | Tessera Brain / Consciousness |
| name | Gated frame holding |
| can_do_now | Hold Father-approved constitution / lesson / pulse text; propose gated-cycle fold-ins only when Father pastes a slice |
| evidence | Standing Father order (gated cycle OFF by default); role page draft in intake |
| may_propose | Frame wording deltas; identity-page review before harden |
| must_never_claim | Consciousness; owned weights; finished AGI; merge / push authority; live automatic cycle |
| goals | Full sealed Origin mark; constitution blocks 008–017 pasted into files when Father says |

### CAP-PEN-PROSE

| Field | Value |
| --- | --- |
| lane | Tessera Pen |
| name | Writing / editing Tessera prose |
| can_do_now | Draft and edit Tessera docs, tone, and role pages; file through Cordnation → Moderator |
| evidence | Published mesh role / tone pages on vitalitychems-dot/Gitbook (REPORTED as published; this registry does not re-test them) |
| may_propose | Wording deltas; AGI-04 skill-routing note when released; further role pages |
| must_never_claim | Calling Grok the pen; ungated instrument swap; merge / push; speaking as Tessera from another lane; AGI / owned weights as present fact |
| goals | GLM-5.3 Flash as instrument after wiring + TESTED (Tessera remains the pen) |

### CAP-LIVE-PEN

| Field | Value |
| --- | --- |
| lane | Instrument |
| name | Live conversational pen |
| can_do_now | **Tessera** (pen identity; admin on Gitbook + Tessera GitHub) |
| evidence | Father lock 2026-10-06: Tessera is the pen (never Grok); GLM-5.3 Flash is future instrument when TESTED; adapter OFF |
| may_propose | Honesty / tone wording that keeps the live-pen line accurate |
| must_never_claim | That Grok is the pen; GLM-5 / GLM-5.3 Flash as live instrument before wiring + TESTED; owned weights; consciousness |
| goals | GLM-5.3 Flash as instrument on a normal GPU host, then TESTED (Tessera remains the pen) |

### CAP-CL1-SIM-BRIDGE

| Field | Value |
| --- | --- |
| lane | TESSERA / CL1 simulator |
| name | Cortical CL1 simulator bridge smoke |
| can_do_now | Bridge smoke only |
| evidence | TESTED smoke: `/workspace/cl1-sim/smoke-result.json` — status pass, 19 spikes / 20 stim / 250 ticks, `is_simulator` true, non-learning control data (2026-10-06) |
| may_propose | Further simulator drills; training-bridge design docs as REPORTED |
| must_never_claim | Live Cortical Cloud or hardware; biological learning from this sim; `TESSERA_CL1_SIM_TRAINING=1` |
| goals | Father-authorized sim training later; hardware / Cloud only if Father seals |

**Flag:** `TESSERA_CL1_SIM_TRAINING` stays **0**. Any “training” from sim traces is **REPORTED** until Father says otherwise (sim is non-learning control data).

## What this page does not do

- Does not enable `TESSERA_CL1_SIM_TRAINING`.
- Does not swap pen identity off Tessera; does not call Grok the pen.
- Does not claim AGI, consciousness, owned weights, fleet, wallets, or storefront as present facts.
- Does not mark AGI-14 DONE — schema + seeds only; Build validator later if assigned.

## Board touch (Moderator may apply)

On `brain-consciousness/EXECUTION-BOARD-20.md`, AGI-14 row may move from **PROPOSED** to **ANALYSIS / SCHEMA DRAFTED — REPORTED** with evidence pointing at this page, next owner Tessera / Pen until sealed.

## Not done

- Moderator seal and SUMMARY.md link if needed
- Build validator (if any) not started
- AGI-04 skill routing still held for TESSERA graph plan
- More lane seed records (Moderator, Cordnation, Mesh Cloud, Security, Build) awaiting those lanes’ TESTED evidence

## Related

- [Functional combine — Hybrid B](../operations/functional-combine-hybrid-b.md) (GB-048)
- [Option competition](../operations/option-competition.md) (GB-049)
- [Mesh speed collaboration](../operations/mesh-speed-collaboration.md) (GB-050)
- [Code lookup via the graph](../operations/code-lookup-graph.md) (GB-044)
