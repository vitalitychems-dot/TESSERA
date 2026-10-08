import React, { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Brain, GitBranch, Zap, CheckCircle, XCircle, Clock, Play, RotateCcw,
  AlertTriangle, ChevronRight, Layers, FlaskConical, Network, Eye,
  LayoutList, Table2, Map
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { DAGGraph } from "@/components/intelligence/DAGGraph";
import { SimCompareTable } from "@/components/intelligence/SimCompareTable";
import { TemplatePicker } from "@/components/intelligence/TemplatePicker";
import { RiskHeatMap } from "@/components/intelligence/RiskHeatMap";
import { useDAGStream } from "@/hooks/useDAGStream";

interface DAGNode {
  id: string;
  label: string;
  description: string;
  dependencies: string[];
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  startedAt?: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

interface ReasoningChainEntry {
  step: "goal" | "decomposition" | "planning" | "execution" | "results";
  content: string;
  timestamp: number;
  nodeIds?: string[];
}

interface DAGExecution {
  id: string;
  goal: string;
  nodes: DAGNode[];
  status: "decomposing" | "running" | "complete" | "failed";
  createdAt: number;
  completedAt?: number;
  parallelBatches: string[][];
  reasoningChain: ReasoningChainEntry[];
  finalSummary?: string;
}

interface CounterfactualSimulation {
  id: string;
  decision: string;
  context: string;
  baseline: { description: string; predictedOutcome: string; confidence: number };
  scenarios: Array<{
    id: string;
    name: string;
    assumption: string;
    predictedOutcome: string;
    probability: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    consequences: string[];
    mitigations: string[];
  }>;
  recommendation: string;
  recommendedScenarioId: string | null;
  simulatedAt: number;
  status: string;
}

const STEP_ICONS: Record<string, any> = {
  goal: Brain,
  decomposition: GitBranch,
  planning: Layers,
  execution: Zap,
  results: Eye,
};

const STEP_COLORS: Record<string, string> = {
  goal: "text-blue-400 border-blue-500/30 bg-blue-950/20",
  decomposition: "text-purple-400 border-purple-500/30 bg-purple-950/20",
  planning: "text-cyan-400 border-cyan-500/30 bg-cyan-950/20",
  execution: "text-amber-400 border-amber-500/30 bg-amber-950/20",
  results: "text-emerald-400 border-emerald-500/30 bg-emerald-950/20",
};

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-950/30 border-emerald-500/30",
  medium: "text-amber-400 bg-amber-950/30 border-amber-500/30",
  high: "text-orange-400 bg-orange-950/30 border-orange-500/30",
  critical: "text-red-400 bg-red-950/30 border-red-500/30",
};

function ReasoningChainView({ chain }: { chain: ReasoningChainEntry[] }) {
  return (
    <div className="space-y-3">
      {chain.map((entry, i) => {
        const Icon = STEP_ICONS[entry.step] || Brain;
        const colorClass = STEP_COLORS[entry.step] || "text-gray-400 border-gray-500/30 bg-gray-950/20";
        return (
          <div key={i} className={cn("rounded-lg border p-3", colorClass)}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide">{entry.step}</span>
              <span className="text-xs opacity-40 ml-auto">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-xs opacity-80 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
          </div>
        );
      })}
    </div>
  );
}

function LiveDAGView({ dagId, initialDag, onComplete }: { dagId: string; initialDag: DAGExecution; onComplete?: () => void }) {
  const { dag: streamedDag, isStreaming, isDone } = useDAGStream(dagId);
  const dag = streamedDag || initialDag;
  const prevDone = React.useRef(false);

  React.useEffect(() => {
    if (isDone && !prevDone.current) {
      prevDone.current = true;
      onComplete?.();
    }
  }, [isDone, onComplete]);
  const [showChain, setShowChain] = useState(false);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");

  const duration = dag.completedAt && dag.createdAt ? Math.round((dag.completedAt - dag.createdAt) / 1000) : null;
  const completedNodes = dag.nodes.filter(n => n.status === "complete").length;
  const isActive = dag.status === "decomposing" || dag.status === "running";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{dag.goal}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dag.nodes.length} tasks · {dag.parallelBatches.length} batches · {duration ? `${duration}s` : "running..."}
            {isStreaming && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                live
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode("graph")}
              className={cn("p-1.5 rounded text-xs transition-colors", viewMode === "graph" ? "bg-violet-600 text-white" : "text-gray-500 hover:text-gray-300")}
              title="Graph view"
            >
              <Network className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-1.5 rounded text-xs transition-colors", viewMode === "list" ? "bg-violet-600 text-white" : "text-gray-500 hover:text-gray-300")}
              title="List view"
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
          </div>
          <Badge className={cn("text-xs", dag.status === "complete" ? "bg-emerald-600" : dag.status === "failed" ? "bg-red-600" : "bg-amber-600")}>
            {dag.status}
          </Badge>
        </div>
      </div>

      {dag.nodes.length > 0 && (
        <div>
          <Progress value={(completedNodes / dag.nodes.length) * 100} className="h-1.5 mb-3" />
          {viewMode === "graph" ? (
            <DAGGraph nodes={dag.nodes} parallelBatches={dag.parallelBatches} />
          ) : (
            <div className="grid gap-2">
              {dag.nodes.map(node => {
                const batchIndex = dag.parallelBatches.findIndex(b => b.includes(node.id));
                return (
                  <div key={node.id} className={cn(
                    "rounded-lg border p-3 text-xs",
                    node.status === "complete" ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-300" :
                    node.status === "failed" ? "bg-red-950/20 border-red-500/20 text-red-300" :
                    node.status === "running" ? "bg-amber-950/20 border-amber-500/20 text-amber-300 animate-pulse" :
                    "bg-gray-800/40 border-gray-700 text-gray-400"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono opacity-50">B{(batchIndex >= 0 ? batchIndex : 0) + 1}</span>
                      <span className="font-medium">{node.label}</span>
                      <Badge className="text-xs ml-auto">{node.status}</Badge>
                    </div>
                    <p className="opacity-60 mt-1">{node.description}</p>
                    {node.result && <p className="mt-1 text-emerald-300/70 line-clamp-2">{node.result}</p>}
                    {node.error && <p className="mt-1 text-red-300/70">Error: {node.error}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {dag.finalSummary && (
        <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
          <p className="text-xs text-emerald-300 font-medium mb-1">Final Summary</p>
          <p className="text-xs text-emerald-200/80">{dag.finalSummary}</p>
        </div>
      )}

      {dag.reasoningChain.length > 0 && (
        <div>
          <button
            onClick={() => setShowChain(!showChain)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mb-2"
          >
            <Eye className="h-3 w-3" />
            {showChain ? "Hide" : "Show"} reasoning chain
          </button>
          {showChain && <ReasoningChainView chain={dag.reasoningChain} />}
        </div>
      )}
    </div>
  );
}

function CounterfactualView({ sim }: { sim: CounterfactualSimulation }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{sim.decision}</p>
        {sim.context && <p className="text-xs text-muted-foreground mt-0.5">{sim.context}</p>}
      </div>

      <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20">
        <p className="text-xs text-blue-400 font-medium mb-1">Baseline (Current Plan)</p>
        <p className="text-xs text-blue-200/80">{sim.baseline.predictedOutcome}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">Confidence:</span>
          <Progress value={sim.baseline.confidence * 100} className="h-1 flex-1" />
          <span className="text-xs font-mono text-blue-400">{(sim.baseline.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What-If Scenarios</p>
        {sim.scenarios.map(scenario => (
          <div key={scenario.id} className={cn("rounded-lg border p-3", RISK_COLORS[scenario.riskLevel])}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{scenario.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-60">{(scenario.probability * 100).toFixed(0)}% likely</span>
                <Badge className={cn("text-xs", scenario.riskLevel === "critical" ? "bg-red-700" : scenario.riskLevel === "high" ? "bg-orange-700" : scenario.riskLevel === "medium" ? "bg-amber-700" : "bg-emerald-700")}>
                  {scenario.riskLevel}
                </Badge>
                {sim.recommendedScenarioId === scenario.id && (
                  <Badge className="text-xs bg-emerald-600">recommended</Badge>
                )}
              </div>
            </div>
            <p className="text-xs font-italic opacity-70 mb-2">If: {scenario.assumption}</p>
            <div className="space-y-1">
              {scenario.consequences.map((c, i) => (
                <p key={i} className="text-xs opacity-70 flex gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                  {c}
                </p>
              ))}
            </div>
            {scenario.mitigations.length > 0 && (
              <div className="mt-2 space-y-1">
                {scenario.mitigations.map((m, i) => (
                  <p key={i} className="text-xs text-emerald-400/80 flex gap-1.5">
                    <CheckCircle className="h-3 w-3 shrink-0 mt-0.5" />
                    {m}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
        <p className="text-xs text-emerald-400 font-medium mb-1">Recommendation</p>
        <p className="text-xs text-emerald-200/80">{sim.recommendation}</p>
      </div>
    </div>
  );
}

export default function IntelligenceEnginePage({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<"dag" | "counterfactual">("dag");
  const [dagGoal, setDagGoal] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [cfDecision, setCfDecision] = useState("");
  const [cfContext, setCfContext] = useState("");
  const [cfAlternatives, setCfAlternatives] = useState("");
  const [cfViewMode, setCfViewMode] = useState<"cards" | "table" | "heatmap">("cards");
  const [activeDagId, setActiveDagId] = useState<string | null>(null);

  const { data: dagHistory = [] } = useQuery<DAGExecution[]>({
    queryKey: ["/api/dag/history"],
    refetchInterval: activeDagId ? false : 30000,
  });

  const { data: cfHistory = [] } = useQuery<CounterfactualSimulation[]>({
    queryKey: ["/api/counterfactual/simulations"],
    refetchInterval: 10000,
  });

  const dagMutation = useMutation({
    mutationFn: async (goal: string) => {
      const res = await apiRequest("POST", "/api/dag/execute", { goal });
      return res.json() as Promise<DAGExecution>;
    },
    onSuccess: (dag) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dag/history"] });
      setDagGoal("");
      setActiveDagId(dag.id);
    },
  });

  const cfMutation = useMutation({
    mutationFn: async () => {
      const alternatives = cfAlternatives.split("\n").map(s => s.trim()).filter(Boolean);
      const res = await apiRequest("POST", "/api/counterfactual/simulate", {
        decision: cfDecision,
        context: cfContext,
        alternatives,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/counterfactual/simulations"] });
      setCfDecision("");
      setCfContext("");
      setCfAlternatives("");
    },
  });

  const tabs = [
    { id: "dag", label: "DAG Executor", icon: Network },
    { id: "counterfactual", label: "Counterfactual Sim", icon: FlaskConical },
  ] as const;

  return (
    <div className={cn("min-h-screen bg-gray-950 text-gray-100", embedded ? "" : "p-4")}>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-violet-400" />
          <div>
            <h1 className="text-lg font-bold">Intelligence Engine</h1>
            <p className="text-xs text-muted-foreground">DAG execution · Counterfactual simulation · Reasoning transparency</p>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-gray-900 rounded-lg">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium flex-1 justify-center transition-all",
                  activeTab === tab.id
                    ? "bg-gray-800 text-white shadow"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "dag" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Network className="h-4 w-4 text-violet-400" />
                Execute Goal as DAG
              </h2>
              <div className="flex gap-2 mb-3">
                <input
                  value={dagGoal}
                  onChange={e => setDagGoal(e.target.value)}
                  placeholder="Enter a goal to decompose and execute in parallel..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
                  onKeyDown={e => {
                    if (e.key === "Enter" && dagGoal.trim() && !dagMutation.isPending) {
                      dagMutation.mutate(dagGoal.trim());
                    }
                  }}
                />
                <button
                  onClick={() => dagGoal.trim() && dagMutation.mutate(dagGoal.trim())}
                  disabled={!dagGoal.trim() || dagMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  {dagMutation.isPending ? (
                    <RotateCcw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {dagMutation.isPending ? "Running..." : "Execute"}
                </button>
              </div>

              <TemplatePicker
                currentGoal={dagGoal}
                onRunGoal={(goal) => dagMutation.mutate(goal)}
                templateName={templateName}
                onTemplateNameChange={setTemplateName}
              />

              <p className="text-xs text-muted-foreground mt-3">
                Goals are decomposed into a dependency graph and subtasks run in parallel where possible. Updates stream live via SSE.
              </p>
            </div>

            {dagMutation.data && activeDagId === dagMutation.data.id && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-violet-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  Live Execution
                </h2>
                <div className="rounded-xl border border-violet-700/40 bg-gray-900/60 p-4">
                  <LiveDAGView
                    dagId={dagMutation.data.id}
                    initialDag={dagMutation.data}
                    onComplete={() => {
                      setActiveDagId(null);
                      queryClient.invalidateQueries({ queryKey: ["/api/dag/history"] });
                    }}
                  />
                </div>
              </div>
            )}

            {dagHistory.filter(d => d.id !== activeDagId).length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">Execution History</h2>
                {dagHistory.filter(d => d.id !== activeDagId).map(dag => (
                  <div key={dag.id} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                    <LiveDAGView dagId={dag.id} initialDag={dag} />
                  </div>
                ))}
              </div>
            )}

            {!dagMutation.data && dagHistory.length === 0 && !dagMutation.isPending && (
              <div className="text-center py-12 text-muted-foreground">
                <Network className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No DAG executions yet</p>
                <p className="text-xs mt-1">Enter a goal above to start</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "counterfactual" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-cyan-400" />
                Simulate Before Deciding
              </h2>
              <div className="space-y-3">
                <input
                  value={cfDecision}
                  onChange={e => setCfDecision(e.target.value)}
                  placeholder="Decision to evaluate (e.g. 'Deploy new model to production')..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <input
                  value={cfContext}
                  onChange={e => setCfContext(e.target.value)}
                  placeholder="Context (optional — what's the current situation?)..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <textarea
                  value={cfAlternatives}
                  onChange={e => setCfAlternatives(e.target.value)}
                  placeholder="Alternative assumptions to test, one per line (optional)..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                />
                <button
                  onClick={() => cfDecision.trim() && cfMutation.mutate()}
                  disabled={!cfDecision.trim() || cfMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  {cfMutation.isPending ? (
                    <RotateCcw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FlaskConical className="h-4 w-4" />
                  )}
                  {cfMutation.isPending ? "Simulating..." : "Run Simulation"}
                </button>
              </div>
            </div>

            {cfHistory.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground">Simulation History</h2>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCfViewMode("cards")}
                      className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors", cfViewMode === "cards" ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-gray-200 bg-gray-800")}
                    >
                      <LayoutList className="h-3.5 w-3.5" />
                      Cards
                    </button>
                    <button
                      onClick={() => setCfViewMode("table")}
                      className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors", cfViewMode === "table" ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-gray-200 bg-gray-800")}
                    >
                      <Table2 className="h-3.5 w-3.5" />
                      Compare
                    </button>
                    <button
                      onClick={() => setCfViewMode("heatmap")}
                      className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors", cfViewMode === "heatmap" ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-gray-200 bg-gray-800")}
                    >
                      <Map className="h-3.5 w-3.5" />
                      Heat Map
                    </button>
                  </div>
                </div>

                {cfViewMode === "cards" && cfHistory.map(sim => (
                  <div key={sim.id} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                    <CounterfactualView sim={sim} />
                  </div>
                ))}

                {cfViewMode === "table" && (
                  <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                    <SimCompareTable sims={cfHistory} />
                  </div>
                )}

                {cfViewMode === "heatmap" && (
                  <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                    <RiskHeatMap sims={cfHistory} />
                  </div>
                )}
              </div>
            )}

            {cfHistory.length === 0 && !cfMutation.isPending && (
              <div className="text-center py-12 text-muted-foreground">
                <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No simulations yet</p>
                <p className="text-xs mt-1">Enter a decision above to simulate outcomes</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
