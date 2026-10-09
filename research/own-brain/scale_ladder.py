"""Run the own-brain scale ladder with bounded local resource use.

The harness measures actual completed rungs and reports larger rungs as BLOCKED
when a conservative memory cap would be exceeded. It never calls an API.
"""
from __future__ import annotations

import hashlib
import json
import os
import resource
import sys
import time
from pathlib import Path

from lif import LIFConfig, SparseLIFNetwork, seeded_currents

RUNG_SYNAPSES = (10_000, 100_000, 1_000_000, 10_000_000, 100_000_000)
MEMORY_CAP_BYTES = int(os.environ.get("OWN_BRAIN_MEMORY_CAP_BYTES", str(512 * 1024 * 1024)))


def config_for(synapses: int) -> LIFConfig:
    neurons = max(2, min(10_000, synapses // 10))
    return LIFConfig(neurons=neurons, synapses=synapses, steps=8, seed=20261009)


def estimate_bytes(config: LIFConfig) -> int:
    # Python object overhead estimate intentionally errs high for safety.
    return config.neurons * 80 + config.synapses * 72 + config.neurons * 16


def run_rung(synapses: int) -> dict:
    config = config_for(synapses)
    estimated = estimate_bytes(config)
    base = {
        "rung": f"S{RUNG_SYNAPSES.index(synapses)}",
        "synapses": synapses,
        "neurons": config.neurons,
        "seed": config.seed,
        "estimated_bytes": estimated,
        "memory_cap_bytes": MEMORY_CAP_BYTES,
    }
    if estimated > MEMORY_CAP_BYTES:
        return {**base, "status": "BLOCKED", "reason": "estimated peak memory exceeds local safety cap"}
    started = time.perf_counter()
    currents = seeded_currents(config)
    network = SparseLIFNetwork(config)
    trace = network.run(currents)
    elapsed = time.perf_counter() - started
    encoded = json.dumps(trace, separators=(",", ":")).encode()
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024
    return {
        **base,
        "status": "TESTED",
        "elapsed_seconds": round(elapsed, 6),
        "spikes": sum(sum(row) for row in trace),
        "throughput_synapses_per_second": round(synapses * config.steps / max(elapsed, 1e-9), 2),
        "peak_rss_bytes": peak,
        "trace_sha256": hashlib.sha256(encoded).hexdigest(),
        "deterministic_replay": trace == SparseLIFNetwork(config).run(currents),
    }


def main() -> int:
    results = [run_rung(synapses) for synapses in RUNG_SYNAPSES]
    payload = {
        "program": "TESSERA own-brain Phase 1/2 local simulator",
        "python": sys.version.split()[0],
        "platform": sys.platform,
        "memory_cap_bytes": MEMORY_CAP_BYTES,
        "results": results,
        "limitations": [
            "software simulator only; no biological hardware or CL1 interface",
            "estimated memory is a safety gate for blocked rungs, not a claim of hardware maximum",
            "no learning rule or product-memory write is enabled in Phase 1",
        ],
    }
    out = Path(__file__).with_name("scale-results.json")
    out.write_text(json.dumps(payload, indent=2) + "\n")
    print(json.dumps(payload, indent=2))
    return 0 if all(r["status"] == "BLOCKED" or r.get("deterministic_replay") for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
