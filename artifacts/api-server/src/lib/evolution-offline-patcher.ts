// Offline deterministic patch generator.
//
// It needs no LLM and no network, so the apply -> sandbox -> verify -> rollback
// pipeline can run in CI. It is deliberately a STUB generator: every patch it
// emits is a behaviour-neutral, exported provenance descriptor appended to the
// target file. It proves the pipeline end to end; it does not refactor code.
// Health reporting labels these patches "offline" so they are never mistaken
// for LLM-authored changes.

export type OfflineRecipeId =
  | "error-recovery"
  | "named-constants"
  | "size-limits"
  | "async-conversion"
  | "coverage-tests"
  | "extract-functions"
  | "error-logging"
  | "input-validation"
  | "edge-cases"
  | "decompose";

interface OfflineRecipe {
  id: OfflineRecipeId;
  match: RegExp;
}

// Order matters: the first matching recipe wins.
const RECIPES: readonly OfflineRecipe[] = [
  { id: "error-recovery", match: /try-catch|graceful degradation|error recovery/i },
  { id: "named-constants", match: /magic numbers|named constants/i },
  { id: "size-limits", match: /array size limits|periodic pruning|\bpruning\b/i },
  { id: "async-conversion", match: /blocking operations|\bto async\b/i },
  { id: "coverage-tests", match: /uncovered branches|test cases|\btests for\b/i },
  { id: "extract-functions", match: /deeply nested|named functions/i },
  { id: "error-logging", match: /error logging|monitoring/i },
  { id: "input-validation", match: /input validation|sanitiz/i },
  { id: "edge-cases", match: /edge cases/i },
  { id: "decompose", match: /break down|monolithic/i },
];

export const OFFLINE_PATCHER_ENV = "EVOLUTION_OFFLINE_PATCHER";

// Opt-in: appending to live source files must never happen by default.
export function isOfflinePatcherEnabled(): boolean {
  const v = (process.env[OFFLINE_PATCHER_ENV] ?? "0").trim().toLowerCase();
  return v === "1" || v === "true";
}

export function matchOfflineRecipe(proposedChange: string): OfflineRecipeId | null {
  for (const recipe of RECIPES) {
    if (recipe.match.test(proposedChange)) return recipe.id;
  }
  return null;
}

export function offlinePatchMarkerName(recipe: OfflineRecipeId): string {
  return `EVOLUTION_OFFLINE_PATCH_${recipe.toUpperCase().replace(/-/g, "_")}`;
}

export type OfflinePatchResult =
  | { kind: "patch"; recipe: OfflineRecipeId; marker: string; code: string }
  | { kind: "none"; reason: "offline-no-recipe" | "offline-already-applied"; message: string };

export function generateOfflinePatch(params: {
  targetModule: string;
  proposedChange: string;
  originalContent: string;
}): OfflinePatchResult {
  const recipe = matchOfflineRecipe(params.proposedChange);
  if (!recipe) {
    return {
      kind: "none",
      reason: "offline-no-recipe",
      message: "Offline patcher has no deterministic recipe for this change",
    };
  }
  const marker = offlinePatchMarkerName(recipe);
  // One marker per recipe per file: repeated proposals cannot grow the file.
  if (params.originalContent.includes(marker)) {
    return {
      kind: "none",
      reason: "offline-already-applied",
      message: `Offline recipe ${recipe} is already present in ${params.targetModule}`,
    };
  }
  const descriptor = JSON.stringify({
    recipe,
    module: params.targetModule,
    change: params.proposedChange.slice(0, 200),
    behaviorNeutral: true,
    generator: "offline-stub",
  });
  const code = [
    `// Offline evolution patch (${recipe}): behaviour-neutral provenance marker.`,
    `export const ${marker} = Object.freeze(${descriptor});`,
  ].join("\n");
  return { kind: "patch", recipe, marker, code };
}
