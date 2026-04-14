export interface SwarmParticle {
  id: string;
  position: number[];
  velocity: number[];
  bestPosition: number[];
  bestFitness: number;
  fitness: number;
}

export interface SwarmState {
  particles: SwarmParticle[];
  globalBest: { position: number[]; fitness: number };
  iterations: number;
  convergence: number;
  objectiveFunction: string;
  dimensions: number;
}

export interface OptimizationResult {
  id: string;
  objective: string;
  bestSolution: number[];
  bestFitness: number;
  iterations: number;
  convergence: number;
  timestamp: number;
}

let optimizationHistory: OptimizationResult[] = [];

function createSwarm(dimensions: number, particleCount: number): SwarmParticle[] {
  return Array.from({ length: particleCount }, (_, i) => {
    const position = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
    return {
      id: `p-${i}`,
      position: [...position],
      velocity: Array.from({ length: dimensions }, () => (Math.random() - 0.5) * 0.1),
      bestPosition: [...position],
      bestFitness: -Infinity,
      fitness: -Infinity,
    };
  });
}

function evaluateFitness(position: number[], objective: string): number {
  switch (objective) {
    case "sovereignty-optimization":
      return -position.reduce((s, p) => s + (p - 0.963) ** 2, 0);
    case "resource-allocation":
      return -position.reduce((s, p) => s + Math.abs(p), 0) + position.length * 0.5;
    case "network-topology":
      return -position.reduce((s, p, i) => s + (p - Math.sin(i * Math.PI / position.length)) ** 2, 0);
    case "cipher-key-space":
      return position.reduce((s, p) => s + Math.cos(p * Math.PI * 2) * 0.5, 0);
    default:
      return -position.reduce((s, p) => s + p ** 2, 0);
  }
}

export function optimize(objective: string, dimensions: number = 5, iterations: number = 50, particleCount: number = 20): OptimizationResult {
  const particles = createSwarm(dimensions, particleCount);
  let globalBest = { position: particles[0].position, fitness: -Infinity };

  const w = 0.7;
  const c1 = 1.5;
  const c2 = 1.5;

  for (let iter = 0; iter < iterations; iter++) {
    for (const particle of particles) {
      particle.fitness = evaluateFitness(particle.position, objective);

      if (particle.fitness > particle.bestFitness) {
        particle.bestFitness = particle.fitness;
        particle.bestPosition = [...particle.position];
      }

      if (particle.fitness > globalBest.fitness) {
        globalBest = { position: [...particle.position], fitness: particle.fitness };
      }
    }

    for (const particle of particles) {
      for (let d = 0; d < dimensions; d++) {
        const r1 = Math.random();
        const r2 = Math.random();
        particle.velocity[d] = w * particle.velocity[d]
          + c1 * r1 * (particle.bestPosition[d] - particle.position[d])
          + c2 * r2 * (globalBest.position[d] - particle.position[d]);
        particle.position[d] += particle.velocity[d];
      }
    }
  }

  const avgFitness = particles.reduce((s, p) => s + p.fitness, 0) / particles.length;
  const convergence = 1 - Math.abs(globalBest.fitness - avgFitness) / (Math.abs(globalBest.fitness) + 1e-10);

  const result: OptimizationResult = {
    id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    objective,
    bestSolution: globalBest.position.map(p => Math.round(p * 10000) / 10000),
    bestFitness: Math.round(globalBest.fitness * 10000) / 10000,
    iterations,
    convergence: Math.max(0, Math.min(1, convergence)),
    timestamp: Date.now(),
  };

  optimizationHistory.push(result);
  if (optimizationHistory.length > 100) optimizationHistory = optimizationHistory.slice(-50);

  return result;
}

export function getOptimizationHistory(limit: number = 10): OptimizationResult[] {
  return optimizationHistory.slice(-limit);
}

export function getAvailableObjectives(): string[] {
  return [
    "sovereignty-optimization",
    "resource-allocation",
    "network-topology",
    "cipher-key-space",
    "general-minimization",
  ];
}

export function getOptimizerStats() {
  return {
    totalOptimizations: optimizationHistory.length,
    avgConvergence: optimizationHistory.length > 0
      ? optimizationHistory.reduce((s, r) => s + r.convergence, 0) / optimizationHistory.length
      : 0,
    bestResult: optimizationHistory.length > 0
      ? optimizationHistory.reduce((best, r) => r.bestFitness > best.bestFitness ? r : best)
      : null,
    objectives: getAvailableObjectives(),
  };
}
