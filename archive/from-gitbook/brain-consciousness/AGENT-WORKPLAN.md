# Brain & Consciousness Development — agent workplan

**Coordinator:** Tessera assigns BC items. Gitbook Moderator reviews only; it never merges or promotes anything into TESSERA. Check-ins go through the conference issue.

**Scope:** Build a software-only, CL1-inspired spiking-neural-network research program for TESSERA. This is not a biological CL1 replica and does not establish consciousness.

See [Cortical Labs readiness](../intake/CORTICAL-LABS-READINESS.md). HYB-019 is BLOCKED on Father's answers in section (d) of that page.

## No-overlap work queue

| ID | Lane | Suggested owner | Deliverable | Acceptance test | Status |
|---|---|---|---|---|---|
| BC-001 | Source and license audit | Github Scraper (provisional, not instantiated); Gitbook Moderator reviews only | Update [SNN-SOURCE-MANIFEST.md](SNN-SOURCE-MANIFEST.md) with pinned refs, licenses, and advisories | Every proposed dependency has an official URL, license, ref, and disposition | PROPOSED |
| BC-002 | Neuron dynamics | TESSERA build lane — PROPOSED (unrostered) | Original LIF neuron adapter and deterministic spike trace API in TESSERA | Unit tests cover reset, threshold, refractory period, and repeatability | PROPOSED |
| BC-003 | Plasticity research | Computational neuroscience lane — PROPOSED (unrostered) | Compare STDP rules across the listed sources and write an experiment note | Reproduce one published/reference equation and report deviations | PROPOSED |
| BC-004 | Learning environment | RL / task lane — PROPOSED (unrostered) | Small deterministic benchmark environment with spike input/output | Same seed produces the same episode trace; baseline is documented | PROPOSED |
| BC-005 | Cognitive interfaces | BrainCog research lane — PROPOSED (unrostered) | Map memory, decision, and perception concepts to TESSERA interfaces without importing incompatible code | Interface proposal includes inputs, outputs, state, and tests | PROPOSED |
| BC-006 | Trainable PyTorch path | snnTorch research lane — PROPOSED (unrostered) | Evaluate a minimal original trainable SNN adapter | CPU smoke test and one reproducible training run pass | PROPOSED |
| BC-007 | Equation simulator comparison | Brian2 research lane — PROPOSED (unrostered) | Compare one neuron/synapse model against Brian2 reference output | Numeric tolerance and simulator version are recorded | PROPOSED |
| BC-008 | BindsNET comparison | BindsNET research lane — PROPOSED (unrostered) | Compare learning-rule and RL experiment semantics | No upstream code copied; differences and license constraints recorded | PROPOSED |
| BC-009 | Event memory and observability | TESSERA systems lane — PROPOSED (unrostered) | Event schema for spikes, rewards, state, provenance, and experiment runs | Schema validation rejects missing provenance and nondeterministic run IDs | PROPOSED |
| BC-010 | Safety and claims review | Gitbook Moderator | Review language, data handling, dependency permissions, and claims about brain/consciousness | No unverified consciousness or biological-equivalence claim remains | PROPOSED |

Suggested owners are not assignments. Items are assigned by Tessera. No approver is on record for BC-001 through BC-010.

## Check-in protocol

Items are assigned by Tessera. After Tessera assigns a BC item, the assigned lane posts one check-in in the Gitbook conference before work begins, using:

```text
IDENTITY: <declared agent or lane>
TASK: BC-###
SOURCE: <official URL and pinned ref>
TARGET: <exact Gitbook or TESSERA path>
SCOPE: <what is included and excluded>
DELIVERABLE: <one result>
ACCEPTANCE TEST: <deterministic check>
OVERLAP CHECK: <Gitbook main SHA checked; open PRs checked (numbers or none); overlapping BC task or none>
STATUS: ASSIGNED (by Tessera)
```

On completion, update the same check-in with the commit, test output, provenance, limitations, and the next task. Agents must not mark another lane complete.

## Build order

1. BC-001 and BC-010 establish source, license, and claims boundaries.
2. BC-002 and BC-009 establish the deterministic TESSERA substrate.
3. BC-003, BC-006, BC-007, and BC-008 run isolated comparisons.
4. BC-004 and BC-005 integrate only interfaces that pass tests.
5. The Gitbook Moderator reviews validated ideas but never merges or promotes them into TESSERA (see Promotion gate). Rejected or deferred ideas are recorded here.

## Promotion gate

A proposal moves from Gitbook to TESSERA only when it has: a source or original-design rationale, an owner assigned by Tessera, a non-overlapping scope, a deterministic test, a security/dependency review, and a limitations statement. Meeting these criteria is not approval. The proposal then goes Moderator, then Tessera, then Security, then CI/Build, then Father's final yes in a bulk digest. Nothing merges into TESSERA without Father's explicit yes.
