import { cn } from "@/lib/utils";

interface CounterfactualScenario {
  id: string;
  name: string;
  assumption: string;
  predictedOutcome: string;
  probability: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  consequences: string[];
  mitigations: string[];
}

interface CounterfactualSimulation {
  id: string;
  decision: string;
  scenarios: CounterfactualScenario[];
  recommendedScenarioId: string | null;
}

interface Props {
  sims: CounterfactualSimulation[];
}

const LIKELIHOOD_LABELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const IMPACT_LABELS = ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"];

type RiskLevel = "low" | "medium" | "high" | "critical";

function getRiskLevelForCell(likelihood: number, impact: number): RiskLevel {
  const score = likelihood * impact;
  if (score >= 16) return "critical";
  if (score >= 9) return "high";
  if (score >= 4) return "medium";
  return "low";
}

const CELL_BG: Record<RiskLevel, string> = {
  low: "bg-emerald-950/60 border-emerald-900/40 hover:bg-emerald-950/80",
  medium: "bg-amber-950/60 border-amber-900/40 hover:bg-amber-950/80",
  high: "bg-orange-950/60 border-orange-900/40 hover:bg-orange-950/80",
  critical: "bg-red-950/70 border-red-900/40 hover:bg-red-950/90",
};

const CELL_TEXT: Record<RiskLevel, string> = {
  low: "text-emerald-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

function scenarioProbabilityToLikelihood(probability: number): number {
  if (probability >= 0.8) return 5;
  if (probability >= 0.6) return 4;
  if (probability >= 0.4) return 3;
  if (probability >= 0.2) return 2;
  return 1;
}

function riskLevelToImpact(riskLevel: RiskLevel): number {
  return { low: 1, medium: 2, high: 3, critical: 5 }[riskLevel] ?? 1;
}

interface PlottedScenario {
  name: string;
  likelihood: number;
  impact: number;
  riskLevel: RiskLevel;
  isRecommended: boolean;
}

function computeAggregateRiskScore(scenarios: PlottedScenario[]): number {
  if (scenarios.length === 0) return 0;
  const total = scenarios.reduce((sum, s) => sum + s.likelihood * s.impact, 0);
  return Math.round(total / scenarios.length);
}

function aggregateToLabel(score: number): string {
  if (score >= 16) return "Critical";
  if (score >= 9) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

function aggregateToClass(score: number): string {
  if (score >= 16) return "text-red-400 bg-red-950/30 border-red-500/30";
  if (score >= 9) return "text-orange-400 bg-orange-950/30 border-orange-500/30";
  if (score >= 4) return "text-amber-400 bg-amber-950/30 border-amber-500/30";
  return "text-emerald-400 bg-emerald-950/30 border-emerald-500/30";
}

export function RiskHeatMap({ sims }: Props) {
  if (sims.length === 0) return null;

  const allScenarios: PlottedScenario[] = sims.flatMap(sim =>
    sim.scenarios.map(s => ({
      name: s.name,
      likelihood: scenarioProbabilityToLikelihood(s.probability),
      impact: riskLevelToImpact(s.riskLevel),
      riskLevel: s.riskLevel,
      isRecommended: sim.recommendedScenarioId === s.id,
    }))
  );

  const aggregateScore = computeAggregateRiskScore(allScenarios);
  const aggregateLabel = aggregateToLabel(aggregateScore);
  const aggregateClass = aggregateToClass(aggregateScore);

  const cellScenarios = (likelihood: number, impact: number) =>
    allScenarios.filter(s => s.likelihood === likelihood && s.impact === impact);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Risk Heat Map
        </p>
        <div className={cn("flex items-center gap-2 px-2.5 py-1 rounded border text-xs font-medium", aggregateClass)}>
          Aggregate Risk: {aggregateLabel}
          <span className="font-mono opacity-70">{aggregateScore}/25</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex">
            <div className="w-20 shrink-0" />
            <div className="flex-1 flex">
              {IMPACT_LABELS.map((label, i) => (
                <div key={i} className="flex-1 text-center text-xs text-muted-foreground pb-1.5 px-0.5 leading-tight min-w-[72px]">
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center mb-1">
            <div className="w-20 shrink-0" />
            <div className="flex-1 text-center text-xs text-muted-foreground font-medium">
              Impact →
            </div>
          </div>

          <div className="flex gap-0">
            <div className="flex flex-col justify-around w-20 shrink-0 pr-1 py-0.5">
              {[...LIKELIHOOD_LABELS].reverse().map((label, i) => (
                <div key={i} className="text-right text-xs text-muted-foreground leading-tight py-1.5">
                  {label}
                </div>
              ))}
              <div className="text-xs text-muted-foreground font-medium text-right mt-1">
                ↑ Likelihood
              </div>
            </div>

            <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(5, minmax(72px, 1fr))`, gridTemplateRows: `repeat(5, 1fr)` }}>
              {[5, 4, 3, 2, 1].flatMap(likelihood =>
                [1, 2, 3, 4, 5].map(impact => {
                  const cellRisk = getRiskLevelForCell(likelihood, impact);
                  const scenarios = cellScenarios(likelihood, impact);

                  return (
                    <div
                      key={`${likelihood}-${impact}`}
                      className={cn(
                        "relative border rounded min-h-[52px] p-1.5 transition-all",
                        CELL_BG[cellRisk]
                      )}
                    >
                      <span className={cn("text-xs font-mono opacity-30", CELL_TEXT[cellRisk])}>
                        {likelihood}×{impact}
                      </span>

                      {scenarios.map((s, si) => (
                        <div
                          key={si}
                          className={cn(
                            "mt-0.5 px-1 py-0.5 rounded text-xs font-medium leading-tight",
                            CELL_TEXT[s.riskLevel],
                            s.isRecommended && "ring-1 ring-emerald-500/50"
                          )}
                          title={s.name}
                        >
                          {s.isRecommended && <span className="mr-0.5">★</span>}
                          {s.name.length > 10 ? s.name.slice(0, 9) + "…" : s.name}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(["low", "medium", "high", "critical"] as RiskLevel[]).map(risk => (
          <span key={risk} className={cn("flex items-center gap-1.5", CELL_TEXT[risk])}>
            <span className={cn("inline-block w-2.5 h-2.5 rounded-sm", {
              "bg-emerald-950 border border-emerald-800": risk === "low",
              "bg-amber-950 border border-amber-800": risk === "medium",
              "bg-orange-950 border border-orange-800": risk === "high",
              "bg-red-950 border border-red-800": risk === "critical",
            })} />
            {risk.charAt(0).toUpperCase() + risk.slice(1)}
          </span>
        ))}
        <span className="ml-auto opacity-60">★ = recommended</span>
      </div>
    </div>
  );
}
