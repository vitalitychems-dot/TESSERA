export type WorkRisk = "low" | "medium" | "high";

export interface PlannedWorkItem {
  id: string;
  dependsOn?: string[];
  conflictsWith?: string[];
  priority?: number;
  risk?: WorkRisk;
}

export type DependencyPlan =
  | { ok: true; waves: string[][] }
  | { ok: false; error: string };

const RISK_RANK: Record<WorkRisk, number> = { low: 0, medium: 1, high: 2 };

function isWorkRisk(value: unknown): value is WorkRisk {
  return value === "low" || value === "medium" || value === "high";
}

export function planDependencyWaves(
  items: PlannedWorkItem[],
  options: { maxParallel?: number; maxRisk?: WorkRisk; completedIds?: string[] } = {},
): DependencyPlan {
  const maxParallel = options.maxParallel ?? 4;
  if (!Number.isInteger(maxParallel) || maxParallel < 1) {
    return { ok: false, error: "maxParallel must be a positive integer." };
  }

  const byId = new Map<string, PlannedWorkItem>();
  for (const item of items) {
    if (!item.id.trim()) return { ok: false, error: "Every task must have a non-empty id." };
    if (byId.has(item.id)) return { ok: false, error: `Duplicate task id: ${item.id}.` };
    byId.set(item.id, item);
  }

  const completed = new Set(options.completedIds ?? []);
  if (options.maxRisk !== undefined && !isWorkRisk(options.maxRisk)) {
    return { ok: false, error: "maxRisk must be low, medium, or high." };
  }
  const maxRiskRank = RISK_RANK[options.maxRisk ?? "high"];
  for (const item of items) {
    if (item.risk !== undefined && !isWorkRisk(item.risk)) {
      return { ok: false, error: `Task ${item.id} has an invalid risk value.` };
    }
    for (const dependency of item.dependsOn ?? []) {
      if (dependency === item.id) return { ok: false, error: `Task ${item.id} depends on itself.` };
      if (!byId.has(dependency) && !completed.has(dependency)) {
        return { ok: false, error: `Task ${item.id} has unknown dependency ${dependency}.` };
      }
    }
    for (const conflict of item.conflictsWith ?? []) {
      if (conflict === item.id || !byId.has(conflict)) {
        return { ok: false, error: `Task ${item.id} has invalid conflict ${conflict}.` };
      }
    }
    if (item.risk && RISK_RANK[item.risk] > maxRiskRank) {
      return { ok: false, error: `Task ${item.id} exceeds the configured risk limit.` };
    }
  }

  const remaining = new Set(byId.keys());
  const waves: string[][] = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .map(id => byId.get(id)!)
      .filter(item => (item.dependsOn ?? []).every(dependency => completed.has(dependency)))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id));

    if (ready.length === 0) {
      return { ok: false, error: `Dependency cycle detected among: ${[...remaining].sort().join(", ")}.` };
    }

    const wave: string[] = [];
    for (const candidate of ready) {
      if (wave.length >= maxParallel) break;
      const conflictsWithWave = wave.some(id =>
        (candidate.conflictsWith ?? []).includes(id) ||
        (byId.get(id)?.conflictsWith ?? []).includes(candidate.id),
      );
      if (!conflictsWithWave) wave.push(candidate.id);
    }

    if (wave.length === 0) {
      return { ok: false, error: "No ready task could be placed in the next wave." };
    }
    waves.push(wave);
    for (const id of wave) {
      remaining.delete(id);
      completed.add(id);
    }
  }

  return { ok: true, waves };
}
