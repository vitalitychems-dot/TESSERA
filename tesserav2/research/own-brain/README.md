# TESSERA own-brain Phase 1

This directory contains an original, local-only, deterministic sparse leaky integrate-and-fire simulator. It is an engineering research instrument, not a biological brain, CL1 replica, consciousness test, or sentience claim.

## Run

```bash
cd research/own-brain
python3 -m unittest -v test_lif.py
python3 scale_ladder.py
```

The scale runner uses a packed CSR-like representation for large graphs. The default 512 MiB safety cap fails closed before allocation when the conservative peak estimate exceeds the budget. A larger run requires an explicit local override, for example:

```bash
OWN_BRAIN_MEMORY_CAP_BYTES=1073741824 python3 scale_ladder.py
```

An override is a measured resource decision, not a bypass: actual peak RSS is recorded and results must remain deterministic. Never treat a blocked rung as a completed target.

## Phase 1 guarantees

- Seeded XorShift32 generator; no network/API calls.
- Sparse synapse lists for the reference path and packed CSR-like arrays for scale runs.
- LIF leak, threshold, reset, and refractory handling.
- Exact replay test for identical configuration and input.
- Packed path must match the reference trace on a seeded fixture.
- Invalid configuration and input shape rejection.
- No STDP, self-modification, external dependency, or product-memory write.

## Latest measured result

With the default 512 MiB cap, S0–S2 complete and S3/S4 block before allocation. With an explicit 1 GiB cap, S3 (10 million synapses) completed at 576,499,712 bytes peak RSS and S4 remained blocked. These are measurements of this sandbox run, not universal hardware limits.
