# CL1-inspired software research source manifest

**Status:** Research sources PROPOSED for evaluation (no approver on record); no upstream repository is copied into Gitbook.

## Purpose

These projects provide complementary software models of spiking neural networks (SNNs). They do **not** reproduce Cortical Labs' CL1, which uses living biological cells and laboratory hardware. They are proposed as references for a safe, software-only Tessera research lane.

See also [Cortical Labs readiness](../intake/CORTICAL-LABS-READINESS.md) (HYB-019, BLOCKED on section (d)).

| Source | Official repository | License shown by upstream | Best use in Tessera research | Incorporation rule |
|---|---|---|---|---|
| BindsNET | [BindsNET/bindsnet](https://github.com/BindsNET/bindsnet) | AGPL-3.0 | PyTorch-based SNN simulation, learning rules, reinforcement-learning experiments | Use as an external research dependency or isolated experiment. Do not copy code into TESSERA without an AGPL compatibility review. |
| BrainCog | [BrainCog-X/Brain-Cog](https://github.com/BrainCog-X/Brain-Cog) | Apache-2.0 | Brain-inspired cognitive modules, perception, decision-making, memory, and multi-scale simulation references | Prototype compatible ideas in TESSERA with provenance. Preserve Apache notices if code is ever reused. |
| Brian2 | [brian-team/brian2](https://github.com/brian-team/brian2) | CeCILL 2.1 | Explicit neuron, synapse, membrane, and differential-equation simulations | Keep as a comparison/reference backend until license compatibility is reviewed. |
| snnTorch | [jeshraghian/snntorch](https://github.com/jeshraghian/snntorch) | MIT | PyTorch-native trainable spiking-neuron layers and GPU experiments | Preferred first reference for a small TESSERA-owned prototype, subject to normal dependency review. |

## Installation policy

1. Gitbook stores the research record, source URLs, license notes, experiment specifications, and agent check-ins.
2. TESSERA stores executable adapters and original implementation code.
3. Agents must pin versions or commits before running experiments and must record the exact version in the check-in ledger.
4. Never run `pip install` from an unreviewed fork, pull request, archive, or pasted command.
5. Do not vendor whole upstream repositories into Gitbook or TESSERA. Build small, tested, original adapters instead.
6. Any code copied or adapted must include provenance, license text/notice requirements, and the full review path before merge: Moderator, then Tessera, then Security, then CI/Build, then Father's final yes in a bulk digest. The Moderator reviews only; it does not merge.

## Proposed hybrid boundary

The first software-only CL1-inspired hybrid should contain:

- a spike encoder and decoder;
- leaky integrate-and-fire neuron dynamics;
- synaptic plasticity experiments, including STDP where scientifically justified;
- a deterministic event log for spikes, rewards, inputs, and state transitions;
- a memory/replay interface;
- a safe task environment such as Pong-like or classification benchmarks;
- metrics for learning, stability, reproducibility, energy proxy, and failure cases.

It must **not** claim biological equivalence, consciousness, sentience, or a biological-cell interface. Those remain research hypotheses and product-language proposals, not verified capabilities.

## Verification evidence

The official repository pages were inspected on 2026-10-05. Upstream descriptions and installation guidance were recorded from the repository pages. Re-check versions, licenses, and security advisories before each dependency update.
