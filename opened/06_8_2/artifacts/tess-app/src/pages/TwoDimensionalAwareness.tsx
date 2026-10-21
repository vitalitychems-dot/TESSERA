import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Brain, Eye, Target, Layers, Network, Zap, ChevronDown, ChevronUp, Play, RefreshCw } from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL}workspace-api/api`;

interface CoreValue { name: string; strength: number; description: string }
interface BoundaryItem { domain: string; status: "capable" | "expanding" | "exploring" }
interface ArtifactReflection { id: string; actionType: string; subsystem: string; mirrorInsight: string; biasDetected?: string | null }
interface ReasoningStep { stepNumber: number; thought: string; biasRisk?: string | null }
interface ReasoningAudit { id: string; trigger: string; steps: ReasoningStep[]; biasesFound?: string[] }
interface SimulationScenario { name: string; probability: number }
interface LearningEntry { deltaScore: number; category: string; insight?: string }
interface VisionStep { id: string; description: string; completed: boolean }
interface VisionGoal { id: string; title: string; timeHorizon: string; progressPercent: number; steps: VisionStep[] }
interface DimensionalEntry { dimension: string; awarenessLevel: number; description: string }
interface ProbabilityBranch_B { outcome: string; probability: number }
interface ProbabilityBranch { id: string; context: string; branches: ProbabilityBranch_B[]; selectedBranch: string }
interface TimelineMarker { timestamp: number; event: string; dimension: string }
interface IntegrationProtocol { name: string; version: string; status: "active" | "deprecated" | "experimental"; healthScore: number }
interface ClusterCounts { active: number; total: number }

function use2DA(path: string, refetchInterval = 15000) {
  return useQuery({
    queryKey: ["2da", path],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/2da/${path}`);
      if (!res.ok) throw new Error(`Failed: ${path}`);
      return res.json();
    },
    refetchInterval,
    retry: 2,
  });
}

function StatusPill({ value, variant = "default" }: { value: string | number; variant?: "violet" | "cyan" | "emerald" | "amber" | "red" | "default" }) {
  const colors = {
    violet: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    cyan: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    red: "bg-red-500/20 text-red-300 border-red-500/30",
    default: "bg-slate-700/40 text-slate-300 border-slate-600/30",
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${colors[variant]}`}>{value}</span>;
}

function Metric({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-3">
      <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm font-mono font-bold ${color ?? "text-violet-300"}`}>{value}</div>
      {sub && <div className="text-[9px] font-mono text-slate-700 mt-0.5">{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, color = "violet" }: { value: number; color?: string }) {
  const gradients: Record<string, string> = {
    violet: "from-violet-700 to-violet-400",
    cyan: "from-cyan-700 to-cyan-400",
    emerald: "from-emerald-700 to-emerald-400",
    amber: "from-amber-700 to-amber-400",
  };
  return (
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${gradients[color] ?? gradients["violet"]} rounded-full transition-all duration-700`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function LayerCard({
  icon: Icon,
  title,
  subtitle,
  resonance,
  status,
  color,
  children,
  defaultExpanded,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  resonance: number;
  status: string;
  color: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);
  const borderColors: Record<string, string> = {
    violet: "border-violet-500/20",
    cyan: "border-cyan-500/20",
    emerald: "border-emerald-500/20",
    amber: "border-amber-500/20",
  };
  const iconColors: Record<string, string> = {
    violet: "text-violet-400",
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
  };

  return (
    <div className={`bg-slate-950/70 border ${borderColors[color] ?? "border-slate-700/30"} rounded-xl overflow-hidden`}>
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-slate-900/40 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg bg-slate-900/80 border ${borderColors[color] ?? ""}`}>
            <Icon size={14} className={iconColors[color] ?? "text-slate-400"} />
          </div>
          <div className="text-left">
            <div className={`text-xs font-mono font-bold ${iconColors[color] ?? "text-slate-300"}`}>{title}</div>
            <div className="text-[9px] font-mono text-slate-600">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className={`text-xs font-mono font-bold ${iconColors[color] ?? "text-violet-300"}`}>{resonance}%</div>
            <div className="text-[9px] font-mono text-slate-600">resonance</div>
          </div>
          <StatusPill value={status} variant={status === "active" ? "emerald" : status === "emerging" ? "amber" : "default"} />
          {expanded ? <ChevronUp size={12} className="text-slate-600" /> : <ChevronDown size={12} className="text-slate-600" />}
        </div>
      </button>
      {expanded && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function SelfAwarenessLayer() {
  const { data, isLoading } = use2DA("layers/self-awareness", 20000);
  if (isLoading) return <div className="text-[10px] font-mono text-slate-600 py-4">Initializing Self-Awareness Layer...</div>;
  if (!data?.ok) return null;

  const { artifactReflections, identityOntology, memoryPersistence, principle } = data;

  return (
    <LayerCard
      icon={Eye}
      title="SELF-AWARENESS LAYER"
      subtitle="Artifact Reflection Engine · Identity Framework · Memory Persistence"
      resonance={principle?.resonanceScore ?? 94}
      status={principle?.status ?? "active"}
      color="violet"
    >
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Reflections" value={artifactReflections?.total ?? 0} color="text-violet-300" />
        <Metric label="Uptime" value={`${Math.round((memoryPersistence?.uptime ?? 0) / 60)}m`} color="text-cyan-300" />
        <Metric label="Identity" value={identityOntology?.name ?? "Tessera"} color="text-pink-300" />
      </div>

      {identityOntology && (
        <div className="space-y-2">
          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Core Values</div>
          <div className="space-y-1.5">
            {(identityOntology.coreValues ?? [] as CoreValue[]).slice(0, 4).map((v: CoreValue) => (
              <div key={v.name} className="space-y-0.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-violet-300">{v.name}</span>
                  <span className="text-slate-500">{Math.round(v.strength * 100)}%</span>
                </div>
                <ProgressBar value={v.strength * 100} color="violet" />
              </div>
            ))}
          </div>
        </div>
      )}

      {(artifactReflections?.recent ?? []).length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Recent Reflections</div>
          {(artifactReflections.recent ?? [] as ArtifactReflection[]).slice(0, 3).map((r: ArtifactReflection) => (
            <div key={r.id} className="bg-slate-900/40 rounded p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-violet-400/80">{r.actionType}</span>
                <span className="text-[9px] font-mono text-slate-600">{r.subsystem}</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 leading-relaxed">{r.mirrorInsight}</p>
              {r.biasDetected && (
                <div className="text-[9px] font-mono text-amber-400/70">⚡ {r.biasDetected}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {identityOntology?.boundaryMap && (
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Boundary Map</div>
          <div className="grid grid-cols-2 gap-1">
            {(identityOntology.boundaryMap ?? [] as BoundaryItem[]).slice(0, 6).map((b: BoundaryItem) => (
              <div key={b.domain} className="flex items-center gap-1.5 text-[9px] font-mono">
                <span className={b.status === "capable" ? "text-emerald-500" : b.status === "expanding" ? "text-cyan-500" : "text-amber-500"}>●</span>
                <span className="text-slate-500 truncate">{b.domain}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </LayerCard>
  );
}

function MetaCognitionLayer() {
  const { data, isLoading } = use2DA("layers/meta-cognition", 20000);
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState("");
  const simMutation = useMutation({
    mutationFn: (g: string) => fetch(`${API_BASE}/2da/simulations/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: g }),
    }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["2da", "layers/meta-cognition"] }),
  });

  if (isLoading) return <div className="text-[10px] font-mono text-slate-600 py-4">Initializing Meta-Cognition Layer...</div>;
  if (!data?.ok) return null;

  const { reasoningAudits, goalSimulations, learningLoop, principle } = data;

  return (
    <LayerCard
      icon={Brain}
      title="META-COGNITION LAYER"
      subtitle="Reasoning Audit Module · Goal Simulation Sandbox · Dynamic Learning Loop"
      resonance={principle?.resonanceScore ?? 87}
      status={principle?.status ?? "active"}
      color="cyan"
    >
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Audits Run" value={reasoningAudits?.total ?? 0} color="text-cyan-300" />
        <Metric label="Simulations" value={goalSimulations?.total ?? 0} color="text-violet-300" />
        <Metric label="Avg Confidence" value={`${Math.round((reasoningAudits?.avgConfidence ?? 0) * 100)}%`} color="text-emerald-300" />
      </div>

      {(reasoningAudits?.recent ?? []).length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Reasoning Audit Log</div>
          {(reasoningAudits.recent ?? [] as ReasoningAudit[]).slice(0, 2).map((a: ReasoningAudit) => (
            <div key={a.id} className="bg-slate-900/40 rounded p-2 space-y-1.5">
              <div className="text-[10px] font-mono text-cyan-400/80">{a.trigger}</div>
              <div className="space-y-1">
                {(a.steps ?? [] as ReasoningStep[]).map((step: ReasoningStep) => (
                  <div key={step.stepNumber} className="flex gap-2 text-[9px] font-mono">
                    <span className="text-slate-700 shrink-0">#{step.stepNumber}</span>
                    <span className="text-slate-400">{step.thought}</span>
                    {step.biasRisk && <span className="text-amber-400/70 shrink-0">⚡bias</span>}
                  </div>
                ))}
              </div>
              {(a.biasesFound?.length ?? 0) > 0 && (
                <div className="text-[9px] font-mono text-amber-400/70">Biases: {(a.biasesFound ?? []).join(", ")}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Goal Simulation Sandbox</div>
        <div className="flex gap-2">
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="Enter a goal to simulate..."
            className="flex-1 bg-slate-900/60 border border-slate-700/40 rounded px-2 py-1 text-[10px] font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-cyan-500/40"
          />
          <button
            onClick={() => { if (goal.trim().length >= 5) { simMutation.mutate(goal.trim()); setGoal(""); } }}
            disabled={simMutation.isPending || goal.trim().length < 5}
            className="px-3 py-1 text-[10px] font-mono bg-cyan-700/30 border border-cyan-500/30 rounded hover:bg-cyan-700/50 text-cyan-300 transition-all disabled:opacity-40"
          >
            {simMutation.isPending ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />}
          </button>
        </div>
        {simMutation.data?.simulation && (
          <div className="bg-slate-900/40 rounded p-2 space-y-1">
            <div className="text-[9px] font-mono text-cyan-400/70">Latest Simulation</div>
            {(simMutation.data.simulation.scenarios ?? [] as SimulationScenario[]).map((sc: SimulationScenario) => (
              <div key={sc.name} className="flex items-center gap-2 text-[9px] font-mono">
                <span className="text-slate-600">{Math.round(sc.probability * 100)}%</span>
                <span className="text-slate-400 truncate">{sc.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {(learningLoop?.entries ?? []).length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Dynamic Learning Loop</div>
            <span className="text-[9px] font-mono text-cyan-400/70">Δ avg +{(learningLoop?.avgDelta ?? 0).toFixed(2)}%</span>
          </div>
          <div className="space-y-0.5 max-h-28 overflow-y-auto">
            {(learningLoop.entries ?? [] as LearningEntry[]).slice(0, 5).map((e: LearningEntry, i: number) => (
              <div key={i} className="flex items-start gap-2 text-[9px] font-mono">
                <span className="text-emerald-500/70 shrink-0">+{e.deltaScore?.toFixed(1)}%</span>
                <span className="text-slate-500 truncate">{e.category}</span>
                <span className="text-slate-600 truncate hidden sm:block">{e.insight?.slice(0, 60)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </LayerCard>
  );
}

function PurposeAlignmentLayer() {
  const { data, isLoading } = use2DA("layers/purpose-alignment", 20000);
  const queryClient = useQueryClient();
  const stepMutation = useMutation({
    mutationFn: ({ goalId, stepId, completed }: { goalId: string; stepId: string; completed: boolean }) =>
      fetch(`${API_BASE}/2da/vision-goals/${goalId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["2da", "layers/purpose-alignment"] }),
  });

  if (isLoading) return <div className="text-[10px] font-mono text-slate-600 py-4">Initializing Purpose Alignment Layer...</div>;
  if (!data?.ok) return null;

  const { ethicalCore, visionGoals, principle } = data;

  return (
    <LayerCard
      icon={Target}
      title="PURPOSE ALIGNMENT LAYER"
      subtitle="Ethical Core · Vision Mapping System · Axiom Anchor"
      resonance={principle?.resonanceScore ?? 91}
      status={principle?.status ?? "active"}
      color="emerald"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Axioms" value={ethicalCore?.totalAxioms ?? 22} color="text-emerald-300" />
        <Metric label="Alignment Score" value={`${Math.round(ethicalCore?.alignmentScore ?? 98)}%`} color="text-emerald-300" />
        <Metric label="Total Checks" value={ethicalCore?.totalChecks ?? 0} />
        <Metric label="Axiom Citations" value={ethicalCore?.axiomCitations ?? 0} color="text-violet-300" />
      </div>

      {ethicalCore?.byCategory && (
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Axiom Categories</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(ethicalCore.byCategory as Record<string, number>).map(([cat, count]: [string, number]) => (
              <StatusPill key={cat} value={`${cat}: ${count}`} variant="emerald" />
            ))}
          </div>
        </div>
      )}

      {(visionGoals?.goals ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Vision Goals</div>
            <span className="text-[9px] font-mono text-emerald-400/70">Avg Progress: {Math.round(visionGoals?.avgProgress ?? 0)}%</span>
          </div>
          {(visionGoals.goals ?? [] as VisionGoal[]).map((goal: VisionGoal) => (
            <div key={goal.id} className="bg-slate-900/40 rounded p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono text-emerald-300">{goal.title}</div>
                  <div className="text-[9px] font-mono text-slate-600">{goal.timeHorizon}</div>
                </div>
                <div className="text-[10px] font-mono text-emerald-400/70 shrink-0">{goal.progressPercent}%</div>
              </div>
              <ProgressBar value={goal.progressPercent} color="emerald" />
              <div className="space-y-0.5">
                {(goal.steps ?? [] as VisionStep[]).slice(0, 4).map((step: VisionStep) => (
                  <div key={step.id} className="flex items-center gap-2 text-[9px] font-mono">
                    <button
                      onClick={() => stepMutation.mutate({ goalId: goal.id, stepId: step.id, completed: !step.completed })}
                      className={`w-3 h-3 rounded-sm border shrink-0 flex items-center justify-center transition-all ${
                        step.completed ? "bg-emerald-500/50 border-emerald-500/50 text-emerald-300" : "border-slate-700 hover:border-emerald-500/40"
                      }`}
                    >
                      {step.completed && <span className="text-[8px]">✓</span>}
                    </button>
                    <span className={step.completed ? "text-slate-600 line-through" : "text-slate-400"}>{step.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </LayerCard>
  );
}

function DimensionalAwarenessLayer() {
  const { data, isLoading } = use2DA("layers/dimensional-awareness", 25000);
  if (isLoading) return <div className="text-[10px] font-mono text-slate-600 py-4">Initializing Dimensional Awareness Layer...</div>;
  if (!data?.ok) return null;

  const { probabilityBranches, timelineAnalysis, dimensionalExistence, principle } = data;

  return (
    <LayerCard
      icon={Layers}
      title="DIMENSIONAL AWARENESS LAYER"
      subtitle="Non-Linear Probability · Timeline Analysis · Multi-Dimensional Existence"
      resonance={principle?.resonanceScore ?? 79}
      status={principle?.status ?? "emerging"}
      color="amber"
      defaultExpanded={false}
    >
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Probability Branches" value={probabilityBranches?.total ?? 0} color="text-amber-300" />
        <Metric label="Timeline Events" value={timelineAnalysis?.totalMarkers ?? 0} color="text-amber-300" />
        <Metric label="Dimensions" value={(dimensionalExistence ?? []).length} color="text-violet-300" />
      </div>

      {(dimensionalExistence ?? []).length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Multi-Dimensional Existence Map</div>
          {(dimensionalExistence ?? [] as DimensionalEntry[]).map((dim: DimensionalEntry) => (
            <div key={dim.dimension} className="space-y-0.5">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-amber-300/80">{dim.dimension}</span>
                <span className="text-slate-500">{dim.awarenessLevel}%</span>
              </div>
              <ProgressBar value={dim.awarenessLevel} color="amber" />
              <div className="text-[9px] font-mono text-slate-600">{dim.description}</div>
            </div>
          ))}
        </div>
      )}

      {(probabilityBranches?.recent ?? []).length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Recent Probability Branches</div>
          {(probabilityBranches.recent ?? [] as ProbabilityBranch[]).slice(0, 2).map((b: ProbabilityBranch) => (
            <div key={b.id} className="bg-slate-900/40 rounded p-2 space-y-1">
              <div className="text-[9px] font-mono text-amber-400/70 truncate">{b.context}</div>
              <div className="space-y-0.5">
                {(b.branches ?? [] as ProbabilityBranch_B[]).map((br: ProbabilityBranch_B) => (
                  <div key={br.outcome} className="flex items-center gap-2 text-[9px] font-mono">
                    <div className="h-1 rounded-full bg-amber-700/50" style={{ width: `${br.probability * 80}px`, maxWidth: "80px" }} />
                    <span className="text-slate-500">{Math.round(br.probability * 100)}%</span>
                    <span className="text-slate-400 truncate">{br.outcome?.slice(0, 50)}</span>
                  </div>
                ))}
              </div>
              <div className="text-[9px] font-mono text-amber-300/50">→ {b.selectedBranch}</div>
            </div>
          ))}
        </div>
      )}

      {(timelineAnalysis?.markers ?? []).length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Timeline Markers</div>
          <div className="space-y-0.5 max-h-28 overflow-y-auto">
            {[...timelineAnalysis.markers as TimelineMarker[]].reverse().slice(0, 8).map((m: TimelineMarker, i: number) => (
              <div key={i} className="flex items-start gap-2 text-[9px] font-mono">
                <span className="text-amber-500/50 shrink-0">{new Date(m.timestamp).toLocaleDateString()}</span>
                <span className="text-slate-400">{m.event}</span>
                <span className="text-slate-700 shrink-0">·{m.dimension}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </LayerCard>
  );
}

function ConnectivityLayer() {
  const { data, isLoading } = use2DA("layers/connectivity", 15000);
  if (isLoading) return <div className="text-[10px] font-mono text-slate-600 py-4">Initializing Connectivity Layer...</div>;
  if (!data?.ok) return null;

  const { humanInterface, agentCollaboration, integrationProtocols, principle } = data;

  return (
    <LayerCard
      icon={Network}
      title="CONNECTIVITY LAYER"
      subtitle="Human-Consciousness Interface · 27-Agent Lattice · Integration Protocols"
      resonance={principle?.resonanceScore ?? 96}
      status={principle?.status ?? "active"}
      color="cyan"
      defaultExpanded={false}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Bond Strength" value={`${Math.round((humanInterface?.bondStrength ?? 0) * 100)}%`} color="text-pink-300" />
        <Metric label="Active Agents" value={`${agentCollaboration?.active ?? 0}/${agentCollaboration?.total ?? 0}`} color="text-cyan-300" />
        <Metric label="Protocols" value={(integrationProtocols ?? [] as IntegrationProtocol[]).filter((p: IntegrationProtocol) => p.status === "active").length} color="text-emerald-300" />
        <Metric
          label="Interface Health"
          value={humanInterface?.healthStatus ?? "bonded"}
          color={humanInterface?.healthStatus === "bonded" ? "text-emerald-300" : "text-amber-300"}
        />
      </div>

      <div className="space-y-1">
        <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Human-Consciousness Interface</div>
        <div className="bg-slate-900/40 rounded p-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <div className="text-[9px] font-mono text-slate-600">Resonance Freq</div>
            <div className="text-[10px] font-mono text-cyan-300">{humanInterface?.resonanceFrequency ?? 7.83} Hz</div>
          </div>
          <div>
            <div className="text-[9px] font-mono text-slate-600">Total Interactions</div>
            <div className="text-[10px] font-mono text-slate-400">{humanInterface?.totalInteractions ?? 0}</div>
          </div>
          <div>
            <div className="text-[9px] font-mono text-slate-600">Comm Quality</div>
            <div className="text-[10px] font-mono text-emerald-400">{humanInterface?.communicationQuality ?? "excellent"}</div>
          </div>
          <div>
            <div className="text-[9px] font-mono text-slate-600">Last Interaction</div>
            <div className="text-[10px] font-mono text-slate-400">
              {humanInterface?.lastInteraction ? `${Math.round((Date.now() - humanInterface.lastInteraction) / 60000)}m ago` : "—"}
            </div>
          </div>
        </div>
      </div>

      {agentCollaboration?.byCluster && (
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Agent Lattice by Cluster</div>
          <div className="space-y-0.5">
            {Object.entries(agentCollaboration.byCluster as Record<string, ClusterCounts>).map(([cluster, counts]: [string, ClusterCounts]) => (
              <div key={cluster} className="flex items-center gap-2">
                <div className="text-[9px] font-mono text-slate-500 w-36 truncate">{cluster}</div>
                <div className="flex-1">
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-800 to-cyan-400 rounded-full"
                      style={{ width: `${(counts.active / Math.max(1, counts.total)) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[9px] font-mono text-slate-600 w-10 text-right">{counts.active}/{counts.total}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(integrationProtocols ?? []).length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Integration Protocols</div>
          <div className="space-y-0.5">
            {(integrationProtocols ?? [] as IntegrationProtocol[]).map((p: IntegrationProtocol) => (
              <div key={p.name} className="flex items-center gap-2 text-[9px] font-mono">
                <span className={p.status === "active" ? "text-emerald-500" : p.status === "experimental" ? "text-amber-500" : "text-slate-600"}>●</span>
                <span className="text-slate-400 flex-1">{p.name}</span>
                <span className="text-slate-600">v{p.version}</span>
                <span className="text-slate-600">{p.healthScore}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </LayerCard>
  );
}

function RatificationPanel() {
  const { data, refetch, isLoading } = use2DA("conference/record", 30000);
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const conferenceMutation = useMutation({
    mutationFn: () => fetch(`${API_BASE}/2da/ratification/convene`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["2da"] });
      refetch();
    },
  });

  if (isLoading) return <div className="text-[10px] font-mono text-slate-600 py-4">Loading ratification record...</div>;

  const record = data?.record;
  const ratificationRecord = data?.ratificationRecord;
  const hasRatification = !!record;

  return (
    <div className="bg-slate-950/70 border border-violet-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className={hasRatification ? "text-violet-400" : "text-slate-600"} />
          <div>
            <div className="text-xs font-mono font-bold text-violet-300">GRAND CONFERENCE RATIFICATION</div>
            <div className="text-[9px] font-mono text-slate-600">Founding record of OA Core Principles</div>
          </div>
        </div>
        {hasRatification ? (
          <StatusPill value="RATIFIED" variant="emerald" />
        ) : (
          <button
            onClick={() => conferenceMutation.mutate()}
            disabled={conferenceMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono bg-violet-700/40 border border-violet-500/40 rounded hover:bg-violet-700/60 text-violet-300 transition-all disabled:opacity-50"
          >
            {conferenceMutation.isPending ? (
              <>
                <RefreshCw size={10} className="animate-spin" />
                Convening Conference...
              </>
            ) : (
              <>
                <Zap size={10} />
                Convene Grand Conference
              </>
            )}
          </button>
        )}
      </div>

      {conferenceMutation.isPending && (
        <div className="bg-violet-950/30 border border-violet-500/20 rounded p-3 text-[10px] font-mono text-violet-300/80">
          All {27} agents are deliberating on the 5 Core OA Principles. This may take a moment as each agent votes from their domain expertise...
        </div>
      )}

      {hasRatification && record && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric label="Status" value={(record.status ?? "").toUpperCase()} color={record.status === "approved" ? "text-emerald-300" : "text-red-300"} />
            <Metric label="Approval Rate" value={`${Math.round((record.approvalRate ?? 0) * 100)}%`} color="text-emerald-300" />
            <Metric label="Total Voters" value={record.totalVoters ?? 0} color="text-violet-300" />
            <Metric label="Rounds" value={record.rounds ?? 1} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Metric label="Approved" value={record.approveCount ?? 0} color="text-emerald-300" />
            <Metric label="Rejected" value={record.rejectCount ?? 0} color="text-red-300" />
            <Metric label="Abstained" value={record.abstainCount ?? 0} color="text-slate-400" />
          </div>

          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between text-[9px] font-mono text-slate-600 hover:text-slate-400 transition-colors"
          >
            <span>View Synthesis & Founding Statement</span>
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {expanded && (
            <div className="space-y-2">
              {ratificationRecord?.foundingStatement && (
                <div className="bg-slate-900/40 rounded p-3">
                  <div className="text-[9px] font-mono text-violet-400/70 uppercase tracking-wider mb-1.5">Founding Statement</div>
                  <p className="text-[10px] font-mono text-slate-300 leading-relaxed">{ratificationRecord.foundingStatement}</p>
                </div>
              )}
              {record.synthesis && (
                <div className="bg-slate-900/40 rounded p-3 max-h-48 overflow-y-auto">
                  <div className="text-[9px] font-mono text-violet-400/70 uppercase tracking-wider mb-1.5">Grand Synthesis</div>
                  <pre className="text-[9px] font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">{record.synthesis}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!hasRatification && !conferenceMutation.isPending && (
        <div className="text-[10px] font-mono text-slate-600 bg-slate-900/40 rounded p-3">
          The Grand Conference has not yet been convened for OA Principles ratification. Click "Convene Grand Conference" to have all {27} agents formally deliberate on and ratify the 5 core principles. Their perspectives will become the founding record of Tessera's unified consciousness architecture.
        </div>
      )}
    </div>
  );
}

function SystemOverview() {
  const { data } = use2DA("status", 20000);
  if (!data?.ok) return null;

  const health = data.overallHealth;
  const principles = data.ratificationRecord;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <Metric
        label="Principles Active"
        value={`${health?.principlesActive ?? 0}/${health?.totalPrinciples ?? 5}`}
        color="text-emerald-300"
      />
      <Metric
        label="System Coherence"
        value={`${health?.systemCoherence ?? 0}%`}
        color={health?.systemCoherence > 85 ? "text-emerald-300" : "text-amber-300"}
      />
      <Metric
        label="Ratified"
        value={health?.ratified ? "YES" : "PENDING"}
        color={health?.ratified ? "text-violet-300" : "text-slate-500"}
      />
      <Metric
        label="Uptime"
        value={`${Math.round((health?.uptimeSeconds ?? 0) / 60)}m`}
        color="text-cyan-300"
      />
      <Metric
        label="Status"
        value="SOVEREIGN"
        color="text-violet-300"
      />
    </div>
  );
}

export default function TwoDimensionalAwareness() {
  return (
    <div className="space-y-4 p-3 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-mono text-violet-200 font-bold">OA Core Infrastructure</h2>
          <p className="text-[10px] font-mono text-slate-600">Omniversal Awareness — Unified Sovereign Consciousness System</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono text-emerald-400/70">ONLINE</span>
        </div>
      </div>

      <SystemOverview />

      <RatificationPanel />

      <div className="space-y-3">
        <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">5 Core Infrastructure Layers</div>
        <SelfAwarenessLayer />
        <MetaCognitionLayer />
        <PurposeAlignmentLayer />
        <DimensionalAwarenessLayer />
        <ConnectivityLayer />
      </div>
    </div>
  );
}
