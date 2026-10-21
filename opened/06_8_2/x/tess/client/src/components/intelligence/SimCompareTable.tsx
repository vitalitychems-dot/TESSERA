import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Shield } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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
  context: string;
  baseline: { description: string; predictedOutcome: string; confidence: number };
  scenarios: CounterfactualScenario[];
  recommendation: string;
  recommendedScenarioId: string | null;
  simulatedAt: number;
  status: string;
}

interface Props {
  sims: CounterfactualSimulation[];
}

const RISK_BG: Record<string, string> = {
  low: "bg-emerald-950/40 text-emerald-400",
  medium: "bg-amber-950/40 text-amber-400",
  high: "bg-orange-950/40 text-orange-400",
  critical: "bg-red-950/40 text-red-400",
};

const RISK_DOT: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

export function SimCompareTable({ sims }: Props) {
  if (sims.length === 0) return null;

  const allScenarios = sims.flatMap(sim =>
    sim.scenarios.map(s => ({ ...s, simId: sim.id, decision: sim.decision, recommendedScenarioId: sim.recommendedScenarioId }))
  );

  if (allScenarios.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Scenario Comparison Table
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80">
              <th className="text-left px-3 py-2.5 text-muted-foreground font-medium whitespace-nowrap">Scenario</th>
              <th className="text-left px-3 py-2.5 text-muted-foreground font-medium whitespace-nowrap">Assumption</th>
              <th className="text-center px-3 py-2.5 text-muted-foreground font-medium whitespace-nowrap">Risk</th>
              <th className="text-center px-3 py-2.5 text-muted-foreground font-medium whitespace-nowrap">Probability</th>
              <th className="text-left px-3 py-2.5 text-muted-foreground font-medium whitespace-nowrap">Predicted Outcome</th>
              <th className="text-left px-3 py-2.5 text-muted-foreground font-medium whitespace-nowrap">Key Mitigation</th>
            </tr>
          </thead>
          <tbody>
            {allScenarios.map((scenario, i) => {
              const isRecommended = scenario.recommendedScenarioId === scenario.id;
              return (
                <tr
                  key={`${scenario.simId}-${scenario.id}`}
                  className={cn(
                    "border-b border-gray-800/60 transition-colors hover:bg-gray-800/20",
                    isRecommended && "bg-emerald-950/10",
                    i % 2 === 0 ? "bg-gray-900/20" : ""
                  )}
                >
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("inline-block w-2 h-2 rounded-full", RISK_DOT[scenario.riskLevel])}
                      />
                      {scenario.name}
                      {isRecommended && (
                        <Badge className="text-xs bg-emerald-700 shrink-0">★</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[180px]">
                    <span className="line-clamp-2">{scenario.assumption}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", RISK_BG[scenario.riskLevel])}>
                      {scenario.riskLevel}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <Progress value={scenario.probability * 100} className="h-1.5 flex-1" />
                      <span className="font-mono text-muted-foreground shrink-0">
                        {(scenario.probability * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[200px]">
                    <span className="line-clamp-2">{scenario.predictedOutcome}</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[180px]">
                    {scenario.mitigations[0] ? (
                      <span className="flex items-start gap-1.5 line-clamp-2">
                        <Shield className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                        {scenario.mitigations[0]}
                      </span>
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="text-emerald-400">★</span> = recommended scenario
        · {allScenarios.length} scenarios across {sims.length} simulation{sims.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
