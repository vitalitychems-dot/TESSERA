// Evolution subsystems historically named the same module two ways ("dual-brain"
// vs "dual-brain.ts") and referred to files that never existed ("sacred-geometry").
// Every tracker keys on the canonical name returned here so counters, cooldowns
// and source lookups agree.
const MODULE_ALIASES: Readonly<Record<string, string>> = {
  "sacred-geometry": "sovereign-sacred-geometry",
};

export function normalizeEvolutionModule(raw: string): string {
  if (/[/\\]/.test(raw) || raw.includes("..")) return raw;
  const base = raw.endsWith(".ts") ? raw.slice(0, -3) : raw;
  return `${MODULE_ALIASES[base] ?? base}.ts`;
}

export type EvolutionUnavailableReason = "llm-unavailable" | "source-unavailable";

// The environment cannot run the apply stage (no code generator, no source tree).
// This is not a defect in the target module and must not count against its health.
export class EvolutionUnavailableError extends Error {
  readonly reason: EvolutionUnavailableReason;
  constructor(reason: EvolutionUnavailableReason, message: string) {
    super(message);
    this.name = "EvolutionUnavailableError";
    this.reason = reason;
  }
}
