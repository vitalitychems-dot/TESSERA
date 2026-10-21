"""Original deterministic sparse LIF simulator for TESSERA's own-brain lane.

This is a local simulator only. It makes no biological or consciousness claim.
"""
from __future__ import annotations

from array import array
from dataclasses import dataclass
from typing import Iterable


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class LIFConfig:
    neurons: int
    synapses: int
    steps: int = 20
    leak: float = 0.9
    threshold: float = 1.0
    reset: float = 0.0
    refractory_steps: int = 2
    weight_scale: float = 0.08
    seed: int = 1

    def validate(self) -> None:
        if self.neurons <= 0 or self.synapses < 0 or self.steps <= 0:
            raise ConfigError("neurons, synapses, and steps must be positive/non-negative")
        if not 0.0 < self.leak < 1.0:
            raise ConfigError("leak must be between 0 and 1")
        if self.threshold <= 0.0 or self.weight_scale < 0.0:
            raise ConfigError("threshold must be positive and weight_scale non-negative")
        if self.refractory_steps < 0:
            raise ConfigError("refractory_steps cannot be negative")
        if self.synapses and self.neurons < 2:
            raise ConfigError("at least two neurons are required for synapses")


class XorShift32:
    """Small deterministic PRNG; no platform RNG or API dependency."""

    def __init__(self, seed: int) -> None:
        self.state = (seed & 0xFFFFFFFF) or 0x6D2B79F5

    def next_u32(self) -> int:
        x = self.state
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        self.state = x & 0xFFFFFFFF
        return self.state

    def unit(self) -> float:
        return self.next_u32() / 4294967296.0


@dataclass(frozen=True)
class Synapse:
    source: int
    weight: float


class SparseLIFNetwork:
    def __init__(self, config: LIFConfig) -> None:
        config.validate()
        self.config = config
        rng = XorShift32(config.seed)
        self.adjacency: list[list[Synapse]] = [[] for _ in range(config.neurons)]
        for _ in range(config.synapses):
            source = rng.next_u32() % config.neurons
            target = rng.next_u32() % config.neurons
            if target == source:
                target = (target + 1) % config.neurons
            weight = (rng.unit() * 2.0 - 1.0) * config.weight_scale
            self.adjacency[target].append(Synapse(source, weight))
        self.membrane = [0.0] * config.neurons
        self.refractory = [0] * config.neurons

    def reset(self) -> None:
        self.membrane[:] = [0.0] * self.config.neurons
        self.refractory[:] = [0] * self.config.neurons

    def step(self, external_current: Iterable[float]) -> tuple[int, ...]:
        current = tuple(float(x) for x in external_current)
        if len(current) != self.config.neurons:
            raise ConfigError("external_current length must equal neuron count")
        previous = tuple(self.last_spikes) if hasattr(self, "last_spikes") else (0,) * self.config.neurons
        spikes: list[int] = []
        for target, incoming in enumerate(self.adjacency):
            if self.refractory[target] > 0:
                self.refractory[target] -= 1
                self.membrane[target] = self.config.reset
                spikes.append(0)
                continue
            synaptic = sum(s.weight for s in incoming if previous[s.source])
            self.membrane[target] = self.membrane[target] * self.config.leak + current[target] + synaptic
            if self.membrane[target] >= self.config.threshold:
                spikes.append(1)
                self.membrane[target] = self.config.reset
                self.refractory[target] = self.config.refractory_steps
            else:
                spikes.append(0)
        self.last_spikes = tuple(spikes)
        return self.last_spikes

    def run(self, currents: Iterable[Iterable[float]]) -> tuple[tuple[int, ...], ...]:
        self.reset()
        self.last_spikes = (0,) * self.config.neurons
        return tuple(self.step(row) for row in currents)


class PackedSparseLIFNetwork:
    """Memory-efficient CSR-like equivalent used only by the scale harness.

    Sources are packed uint32 values and weights are packed float32 values;
    offsets index each target's incoming range. This reduces storage overhead,
    but does not relax the harness memory/time gates or change the model rules.
    """

    def __init__(self, config: LIFConfig) -> None:
        config.validate()
        self.config = config
        rng = XorShift32(config.seed)
        counts = [0] * config.neurons
        sources = array("I")
        weights = array("f")
        targets: list[int] = []
        for _ in range(config.synapses):
            source = rng.next_u32() % config.neurons
            target = rng.next_u32() % config.neurons
            if target == source:
                target = (target + 1) % config.neurons
            targets.append(target)
            sources.append(source)
            weights.append((rng.unit() * 2.0 - 1.0) * config.weight_scale)
            counts[target] += 1
        offsets = [0] * (config.neurons + 1)
        for target, count in enumerate(counts):
            offsets[target + 1] = offsets[target] + count
        positions = offsets[:-1].copy()
        packed_sources = array("I", [0]) * config.synapses
        packed_weights = array("f", [0.0]) * config.synapses
        for source, weight, target in zip(sources, weights, targets):
            position = positions[target]
            packed_sources[position] = source
            packed_weights[position] = weight
            positions[target] += 1
        self.offsets = offsets
        self.sources = packed_sources
        self.weights = packed_weights
        self.membrane = [0.0] * config.neurons
        self.refractory = [0] * config.neurons

    def reset(self) -> None:
        self.membrane[:] = [0.0] * self.config.neurons
        self.refractory[:] = [0] * self.config.neurons

    def step(self, external_current: Iterable[float]) -> tuple[int, ...]:
        current = tuple(float(x) for x in external_current)
        if len(current) != self.config.neurons:
            raise ConfigError("external_current length must equal neuron count")
        previous = tuple(self.last_spikes) if hasattr(self, "last_spikes") else (0,) * self.config.neurons
        spikes: list[int] = []
        for target in range(self.config.neurons):
            if self.refractory[target] > 0:
                self.refractory[target] -= 1
                self.membrane[target] = self.config.reset
                spikes.append(0)
                continue
            synaptic = 0.0
            for position in range(self.offsets[target], self.offsets[target + 1]):
                if previous[self.sources[position]]:
                    synaptic += self.weights[position]
            self.membrane[target] = self.membrane[target] * self.config.leak + current[target] + synaptic
            if self.membrane[target] >= self.config.threshold:
                spikes.append(1)
                self.membrane[target] = self.config.reset
                self.refractory[target] = self.config.refractory_steps
            else:
                spikes.append(0)
        self.last_spikes = tuple(spikes)
        return self.last_spikes

    def run(self, currents: Iterable[Iterable[float]]) -> tuple[tuple[int, ...], ...]:
        self.reset()
        self.last_spikes = (0,) * self.config.neurons
        return tuple(self.step(row) for row in currents)


def seeded_currents(config: LIFConfig) -> tuple[tuple[float, ...], ...]:
    rng = XorShift32(config.seed ^ 0xA5A5A5A5)
    return tuple(
        tuple((rng.unit() * 0.35) for _ in range(config.neurons))
        for _ in range(config.steps)
    )
