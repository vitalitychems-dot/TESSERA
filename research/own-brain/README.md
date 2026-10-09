# TESSERA own-brain Phase 1

This directory contains an original, local-only, deterministic sparse leaky integrate-and-fire simulator. It is an engineering research instrument, not a biological brain, CL1 replica, consciousness test, or sentience claim.

## Run

```bash
cd research/own-brain
python3 -m unittest -v test_lif.py
python3 scale_ladder.py
```

The scale runner tests 10,000, 100,000, and 1,000,000 synapses when they fit the local safety cap, and reports 10,000,000 and 100,000,000 as `BLOCKED` when their conservative estimate exceeds the cap. Override the cap only for a controlled local experiment with `OWN_BRAIN_MEMORY_CAP_BYTES`; never treat a blocked rung as a completed target.

## Phase 1 guarantees

- Seeded XorShift32 generator; no network/API calls.
- Sparse synapse lists with explicit weights.
- LIF leak, threshold, reset, and refractory handling.
- Exact replay test for identical configuration and input.
- Invalid configuration and input shape rejection.
- No STDP, self-modification, external dependency, or product-memory write.

The next promotion candidate is BC-013 scale reporting. Learning rules and memory adapters remain separate gates.
