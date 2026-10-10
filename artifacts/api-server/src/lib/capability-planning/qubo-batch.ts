import type { WorkRisk } from "./dependency-planner";

export interface BatchCandidate {
  id: string;
  utility: number;
  cost: number;
  dependsOn?: string[];
  conflictsWith?: string[];
  risk?: WorkRisk;
}

export interface BatchSynergy {
  leftId: string;
  rightId: string;
  bonus: number;
}

export interface BatchSearchOptions {
  maxTasks: number;
  maxCost: number;
  maxRisk?: WorkRisk;
  completedIds?: string[];
  synergies?: BatchSynergy[];
  iterations?: number;
  seed?: number;
}

export interface BatchSearchResult {
  selectedIds: string[];
  score: number;
  elapsedMs: number;
  method: "greedy" | "qubo-inspired";
}

const RISK_RANK: Record<WorkRisk, number> = { low: 0, medium: 1, high: 2 };

function isWorkRisk(value: unknown): value is WorkRisk {
  return value === "low" || value === "medium" || value === "high";
}

function validateCandidates(candidates: BatchCandidate[], options: BatchSearchOptions): void {
  if (!Number.isInteger(options.maxTasks) || options.maxTasks < 0) {
    throw new Error("maxTasks must be a non-negative integer.");
  }
  if (!Number.isFinite(options.maxCost) || options.maxCost < 0) {
    throw new Error("maxCost must be a non-negative number.");
  }
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.id.trim() || ids.has(candidate.id)) throw new Error(`Invalid or duplicate task id: ${candidate.id}.`);
    if (!Number.isFinite(candidate.utility) || !Number.isFinite(candidate.cost) || candidate.cost < 0) {
      throw new Error(`Invalid utility or cost for ${candidate.id}.`);
    }
    if (candidate.risk !== undefined && !isWorkRisk(candidate.risk)) {
      throw new Error(`Invalid risk for ${candidate.id}.`);
    }
    ids.add(candidate.id);
  }
  const completed = new Set(options.completedIds ?? []);
  for (const candidate of candidates) {
    for (const dependency of candidate.dependsOn ?? []) {
      if (!ids.has(dependency) && !completed.has(dependency)) {
        throw new Error(`Unknown dependency ${dependency} for ${candidate.id}.`);
      }
    }
    for (const conflict of candidate.conflictsWith ?? []) {
      if (conflict === candidate.id || !ids.has(conflict)) {
        throw new Error(`Invalid conflict ${conflict} for ${candidate.id}.`);
      }
    }
  }
  for (const synergy of options.synergies ?? []) {
    if (!ids.has(synergy.leftId) || !ids.has(synergy.rightId) || !Number.isFinite(synergy.bonus)) {
      throw new Error("Synergy entries must reference known tasks and have a finite bonus.");
    }
  }
  if (options.maxRisk !== undefined && !isWorkRisk(options.maxRisk)) {
    throw new Error("maxRisk must be low, medium, or high.");
  }
}

function compatible(
  selected: Set<string>,
  byId: Map<string, BatchCandidate>,
  options: BatchSearchOptions,
): boolean {
  if (selected.size > options.maxTasks) return false;
  const completed = new Set(options.completedIds ?? []);
  const maxRisk = RISK_RANK[options.maxRisk ?? "high"];
  let totalCost = 0;
  for (const id of selected) {
    const candidate = byId.get(id)!;
    totalCost += candidate.cost;
    if (candidate.risk && RISK_RANK[candidate.risk] > maxRisk) return false;
    if ((candidate.dependsOn ?? []).some(dependency => !selected.has(dependency) && !completed.has(dependency))) {
      return false;
    }
    for (const conflict of candidate.conflictsWith ?? []) {
      if (selected.has(conflict)) return false;
    }
    for (const otherId of selected) {
      if ((byId.get(otherId)?.conflictsWith ?? []).includes(id)) return false;
    }
  }
  return totalCost <= options.maxCost;
}

function scoreSelection(selected: Set<string>, byId: Map<string, BatchCandidate>, synergies: BatchSynergy[]): number {
  let score = 0;
  for (const id of selected) score += byId.get(id)!.utility;
  for (const synergy of synergies) {
    if (selected.has(synergy.leftId) && selected.has(synergy.rightId)) score += synergy.bonus;
  }
  return score;
}

function dependencyClosure(id: string, byId: Map<string, BatchCandidate>, completed: Set<string>): Set<string> | null {
  const closure = new Set<string>();
  const visiting = new Set<string>();
  const visit = (currentId: string): boolean => {
    if (completed.has(currentId)) return true;
    if (visiting.has(currentId)) return false;
    if (closure.has(currentId)) return true;
    const current = byId.get(currentId);
    if (!current) return false;
    visiting.add(currentId);
    closure.add(currentId);
    const valid = (current.dependsOn ?? []).every(dependency => visit(dependency));
    visiting.delete(currentId);
    return valid;
  };
  return visit(id) ? closure : null;
}

export function greedyBatch(candidates: BatchCandidate[], options: BatchSearchOptions): BatchSearchResult {
  validateCandidates(candidates, options);
  const started = performance.now();
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const completed = new Set(options.completedIds ?? []);
  const selected = new Set<string>();
  const ordered = [...candidates].sort((a, b) =>
    b.utility / Math.max(b.cost, 0.001) - a.utility / Math.max(a.cost, 0.001) ||
    b.utility - a.utility ||
    a.id.localeCompare(b.id),
  );

  for (const candidate of ordered) {
    const closure = dependencyClosure(candidate.id, byId, completed);
    if (!closure) continue;
    const proposed = new Set([...selected, ...closure]);
    if (compatible(proposed, byId, options)) {
      proposed.forEach(id => selected.add(id));
    }
  }

  return {
    selectedIds: [...selected].sort(),
    score: scoreSelection(selected, byId, options.synergies ?? []),
    elapsedMs: Number((performance.now() - started).toFixed(3)),
    method: "greedy",
  };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

export function quboInspiredBatch(
  candidates: BatchCandidate[],
  options: BatchSearchOptions,
): BatchSearchResult {
  // Classical seeded simulated annealing over binary task choices; no quantum backend is used.
  validateCandidates(candidates, options);
  const started = performance.now();
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const synergies = options.synergies ?? [];
  const iterations = options.iterations ?? 2_000;
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error("iterations must be a positive integer.");
  const random = seededRandom(options.seed ?? 1);

  const initial = new Set(greedyBatch(candidates, options).selectedIds);
  let current = new Set(initial);
  let currentScore = scoreSelection(current, byId, synergies);
  let best = new Set(current);
  let bestScore = currentScore;

  for (let step = 0; step < iterations; step++) {
    if (candidates.length === 0) break;
    const index = Math.floor(random() * candidates.length);
    const id = candidates[index].id;
    const proposal = new Set(current);
    if (proposal.has(id)) proposal.delete(id);
    else proposal.add(id);
    if (!compatible(proposal, byId, options)) continue;

    const proposalScore = scoreSelection(proposal, byId, synergies);
    const progress = step / Math.max(1, iterations - 1);
    const temperature = 5 * (1 - progress) + 0.01;
    const delta = proposalScore - currentScore;
    if (delta >= 0 || random() < Math.exp(delta / temperature)) {
      current = proposal;
      currentScore = proposalScore;
      if (currentScore > bestScore) {
        best = new Set(current);
        bestScore = currentScore;
      }
    }
  }

  return {
    selectedIds: [...best].sort(),
    score: bestScore,
    elapsedMs: Number((performance.now() - started).toFixed(3)),
    method: "qubo-inspired",
  };
}
