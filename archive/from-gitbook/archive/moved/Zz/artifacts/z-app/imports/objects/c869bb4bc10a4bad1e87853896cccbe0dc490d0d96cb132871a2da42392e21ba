import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Zap, Brain, Globe, Lock, Cpu, Network, Eye,
  Activity, CheckCircle2, Clock, AlertTriangle, ChevronDown,
  ChevronRight, Play, RefreshCw, Server, Database, GitBranch,
  Target, Layers, Hexagon, BarChart3, TrendingUp,
} from "lucide-react";

const API = "/api";

async function fetchRoadmap() {
  const res = await fetch(`${API}/sovereignty/roadmap`);
  const data = await res.json();
  return data.data;
}

async function initializeRoadmap() {
  const res = await fetch(`${API}/sovereignty/initialize`, { method: "POST" });
  return res.json();
}

async function fetchModels() {
  const res = await fetch(`${API}/sovereignty/models`);
  const data = await res.json();
  return data.data || [];
}

async function fetchTraining() {
  const res = await fetch(`${API}/sovereignty/training`);
  const data = await res.json();
  return data.data || [];
}

async function fetchSwarmNodes() {
  const res = await fetch(`${API}/sovereignty/swarm/nodes`);
  const data = await res.json();
  return data.data || [];
}

async function fetchGeometry() {
  const res = await fetch(`${API}/sovereignty/geometry`);
  const data = await res.json();
  return data.data || [];
}

async function fetchSecurity() {
  const res = await fetch(`${API}/sovereignty/security`);
  const data = await res.json();
  return data.data || [];
}

async function fetchDataSources() {
  const res = await fetch(`${API}/sovereignty/data-sources`);
  const data = await res.json();
  return data.data || [];
}

async function fetchMetrics() {
  const res = await fetch(`${API}/sovereignty/metrics`);
  const data = await res.json();
  return data.data || [];
}

const PHASE_ICONS: Record<number, typeof Shield> = {
  0: Database, 1: Brain, 2: GitBranch, 3: Globe,
  4: Lock, 5: Zap, 6: Layers, 7: Network,
  8: Hexagon, 9: Shield, 10: Target,
};

const PHASE_COLORS: Record<number, string> = {
  0: "violet", 1: "blue", 2: "cyan", 3: "emerald",
  4: "amber", 5: "orange", 6: "pink", 7: "indigo",
  8: "teal", 9: "red", 10: "green",
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
    completed: { bg: "bg-green-500/20 border-green-500/40", text: "text-green-400", icon: CheckCircle2 },
    in_progress: { bg: "bg-blue-500/20 border-blue-500/40", text: "text-blue-400", icon: Activity },
    pending: { bg: "bg-slate-500/20 border-slate-500/40", text: "text-slate-400", icon: Clock },
    measured: { bg: "bg-violet-500/20 border-violet-500/40", text: "text-violet-400", icon: BarChart3 },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${c.bg} ${c.text}`}>
      <Icon size={10} />
      {status.replace("_", " ")}
    </span>
  );
}

function ProgressBar({ value, max = 100, color = "violet" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full bg-${color}-500 rounded-full transition-all duration-500`}
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, hsl(${pct * 1.2}, 70%, 50%), hsl(${pct * 1.2 + 30}, 70%, 60%))` }}
      />
    </div>
  );
}

function PhaseCard({ phase, expanded, onToggle }: { phase: any; expanded: boolean; onToggle: () => void }) {
  const Icon = PHASE_ICONS[phase.phaseNumber] || Shield;
  const subTasks = (phase.subTasks || []) as any[];

  return (
    <div className={`border rounded-xl transition-all ${
      phase.status === "completed" ? "border-green-500/30 bg-green-950/10" :
      phase.status === "in_progress" ? "border-blue-500/30 bg-blue-950/10" :
      "border-slate-700/50 bg-slate-900/30"
    }`}>
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-white/5 rounded-xl transition-all"
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          phase.status === "completed" ? "bg-green-500/20" :
          phase.status === "in_progress" ? "bg-blue-500/20" :
          "bg-slate-800"
        }`}>
          <Icon size={20} className={
            phase.status === "completed" ? "text-green-400" :
            phase.status === "in_progress" ? "text-blue-400" :
            "text-slate-500"
          } />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-600">PHASE {phase.phaseNumber}</span>
            <StatusBadge status={phase.status} />
          </div>
          <h3 className="text-sm font-semibold text-slate-200 truncate">{phase.phaseName}</h3>
          <p className="text-[11px] text-slate-500 truncate">{phase.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-lg font-bold text-slate-200">{Math.round(phase.progress)}%</span>
          </div>
          {expanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <ProgressBar value={phase.progress} />
          {subTasks.length > 0 && (
            <div className="space-y-2 mt-3">
              {subTasks.map((task: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-slate-800/40 rounded-lg">
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono ${
                    task.status === "completed" ? "bg-green-500/20 text-green-400" :
                    task.status === "in_progress" ? "bg-blue-500/20 text-blue-400" :
                    "bg-slate-700 text-slate-500"
                  }`}>
                    {task.status === "completed" ? "✓" : task.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-300 truncate">{task.name}</p>
                    <p className="text-[10px] text-slate-600 truncate">{task.description}</p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SwarmPanel({ nodes }: { nodes: any[] }) {
  if (!nodes.length) return null;
  return (
    <div className="border border-indigo-500/20 rounded-xl bg-indigo-950/10 p-4">
      <h3 className="text-xs font-mono text-indigo-400 mb-3 flex items-center gap-2"><Server size={14} /> SWARM FLEET ({nodes.length} NODES)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {nodes.map((node: any) => (
          <div key={node.nodeId} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-200">{node.nodeName}</span>
              <span className={`w-2 h-2 rounded-full ${node.status === "online" ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            </div>
            <div className="text-[10px] text-slate-500 space-y-0.5">
              <div>Type: <span className="text-slate-400">{node.nodeType}</span></div>
              <div>Region: <span className="text-slate-400">{node.region}</span></div>
              <div className="flex items-center gap-1">Load: <ProgressBar value={node.currentLoad} color="indigo" /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelsPanel({ models }: { models: any[] }) {
  if (!models.length) return null;
  return (
    <div className="border border-blue-500/20 rounded-xl bg-blue-950/10 p-4">
      <h3 className="text-xs font-mono text-blue-400 mb-3 flex items-center gap-2"><Brain size={14} /> SOVEREIGN MODELS ({models.length})</h3>
      <div className="space-y-2">
        {models.map((m: any) => (
          <div key={m.modelId} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-200">{m.modelName}</span>
              <StatusBadge status={m.status} />
            </div>
            <div className="text-[10px] text-slate-500 flex flex-wrap gap-1 mt-1">
              {(m.capabilities as string[])?.map((c: string) => (
                <span key={c} className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400">{c}</span>
              ))}
            </div>
            {m.benchmarkScores && Object.keys(m.benchmarkScores).length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-1">
                {Object.entries(m.benchmarkScores as Record<string, number>).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <div className="text-[10px] text-slate-600">{k}</div>
                    <div className="text-xs font-bold text-slate-300">{typeof v === "number" ? (v * 100).toFixed(0) + "%" : String(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function GeometryPanel({ routes }: { routes: any[] }) {
  if (!routes.length) return null;
  return (
    <div className="border border-teal-500/20 rounded-xl bg-teal-950/10 p-4">
      <h3 className="text-xs font-mono text-teal-400 mb-3 flex items-center gap-2"><Hexagon size={14} /> GEOMETRY ROUTING ({routes.length} ROUTES)</h3>
      <div className="space-y-2">
        {routes.map((r: any) => (
          <div key={r.routeId} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <Hexagon size={16} className="text-teal-400" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-slate-200">{r.routeName}</div>
              <div className="text-[10px] text-slate-500">
                {r.topology} · {r.geometryType} · {r.pathOptimization} · {r.avgLatencyMs?.toFixed(1)}ms
              </div>
            </div>
            <span className={`w-2 h-2 rounded-full ${r.isActive ? "bg-teal-400" : "bg-slate-600"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityPanel({ events }: { events: any[] }) {
  if (!events.length) return null;
  const severityColor: Record<string, string> = { info: "text-blue-400", medium: "text-amber-400", high: "text-orange-400", critical: "text-red-400" };
  return (
    <div className="border border-red-500/20 rounded-xl bg-red-950/10 p-4">
      <h3 className="text-xs font-mono text-red-400 mb-3 flex items-center gap-2"><Shield size={14} /> SECURITY EVENTS ({events.length})</h3>
      <div className="space-y-2">
        {events.map((e: any) => (
          <div key={e.id} className="p-2 bg-slate-800/40 rounded-lg flex items-center gap-3">
            <AlertTriangle size={14} className={severityColor[e.severity] || "text-slate-400"} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300 truncate">{e.description}</p>
              <p className="text-[10px] text-slate-600">{e.source} · {e.attackSurface}</p>
            </div>
            <StatusBadge status={e.mitigationStatus} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DataSourcesPanel({ sources }: { sources: any[] }) {
  if (!sources.length) return null;
  const internal = sources.filter((s: any) => !s.isExternal);
  const external = sources.filter((s: any) => s.isExternal);
  return (
    <div className="border border-emerald-500/20 rounded-xl bg-emerald-950/10 p-4">
      <h3 className="text-xs font-mono text-emerald-400 mb-3 flex items-center gap-2"><Globe size={14} /> DATA SOURCES ({sources.length})</h3>
      {internal.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-mono text-green-500 mb-1">SOVEREIGN ({internal.length})</p>
          {internal.map((s: any) => (
            <div key={s.sourceId} className="p-2 bg-slate-800/40 rounded-lg mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs text-slate-300 flex-1">{s.sourceName}</span>
              <span className="text-[10px] text-slate-500">{s.sourceType}</span>
            </div>
          ))}
        </div>
      )}
      {external.length > 0 && (
        <div>
          <p className="text-[10px] font-mono text-amber-500 mb-1">LEGACY / EXTERNAL ({external.length})</p>
          {external.map((s: any) => (
            <div key={s.sourceId} className="p-2 bg-slate-800/40 rounded-lg mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-slate-300 flex-1 line-through opacity-60">{s.sourceName}</span>
              <span className="text-[10px] text-slate-500">{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricsPanel({ metrics, phaseFilter }: { metrics: any[]; phaseFilter?: number }) {
  const filtered = phaseFilter !== undefined ? metrics.filter((m: any) => m.phaseNumber === phaseFilter) : metrics;
  if (!filtered.length) return null;
  return (
    <div className="space-y-2">
      {filtered.map((m: any) => (
        <div key={m.id} className="p-2 bg-slate-800/30 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400">{m.metricName}</span>
            <span className="text-xs font-mono text-slate-200">
              {m.currentValue?.toFixed?.(1)} / {m.targetValue} {m.unit}
            </span>
          </div>
          <ProgressBar value={m.currentValue} max={m.targetValue} />
        </div>
      ))}
    </div>
  );
}

export default function SovereigntyRoadmap() {
  const queryClient = useQueryClient();
  const [expandedPhase, setExpandedPhase] = useState<number | null>(0);
  const [activePanel, setActivePanel] = useState<string>("overview");

  const { data: roadmap, isLoading } = useQuery({ queryKey: ["roadmap"], queryFn: fetchRoadmap, refetchInterval: 10000 });
  const { data: models } = useQuery({ queryKey: ["models"], queryFn: fetchModels, refetchInterval: 30000 });
  const { data: swarmNodes } = useQuery({ queryKey: ["swarmNodes"], queryFn: fetchSwarmNodes, refetchInterval: 15000 });
  const { data: geometryRoutes } = useQuery({ queryKey: ["geometry"], queryFn: fetchGeometry, refetchInterval: 30000 });
  const { data: securityEvents } = useQuery({ queryKey: ["security"], queryFn: fetchSecurity, refetchInterval: 30000 });
  const { data: dataSources } = useQuery({ queryKey: ["dataSources"], queryFn: fetchDataSources, refetchInterval: 30000 });
  const { data: metrics } = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, refetchInterval: 15000 });
  const { data: training } = useQuery({ queryKey: ["training"], queryFn: fetchTraining, refetchInterval: 30000 });

  const initMutation = useMutation({
    mutationFn: initializeRoadmap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap"] });
      queryClient.invalidateQueries({ queryKey: ["models"] });
      queryClient.invalidateQueries({ queryKey: ["swarmNodes"] });
      queryClient.invalidateQueries({ queryKey: ["geometry"] });
      queryClient.invalidateQueries({ queryKey: ["security"] });
      queryClient.invalidateQueries({ queryKey: ["dataSources"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      queryClient.invalidateQueries({ queryKey: ["training"] });
    },
  });

  const phases = roadmap?.phases || [];
  const summary = roadmap?.summary || {};
  const needsInit = phases.length === 0 && !isLoading;

  const panels = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "swarm", label: "Swarm Fleet", icon: Server },
    { id: "models", label: "Models", icon: Brain },
    { id: "geometry", label: "Geometry", icon: Hexagon },
    { id: "data", label: "Data Sources", icon: Globe },
    { id: "security", label: "Security", icon: Shield },
    { id: "metrics", label: "Metrics", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-[hsl(224,71%,4%)] p-4 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Shield size={22} className="text-violet-400" />
            Sovereignty Roadmap
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">
            THE FINAL UNIFIED MASTER ROADMAP — Sovereignty + AGI + Speed + Swarm + Geometry
          </p>
        </div>
        <div className="flex items-center gap-2">
          {needsInit && (
            <button
              onClick={() => initMutation.mutate()}
              disabled={initMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-mono rounded-lg transition-all disabled:opacity-50"
            >
              {initMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              {initMutation.isPending ? "Initializing..." : "Initialize All Phases"}
            </button>
          )}
          <button
            onClick={() => queryClient.invalidateQueries()}
            className="p-2 text-slate-500 hover:text-slate-300 transition-all"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {phases.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-violet-950/20 border border-violet-500/20 rounded-xl text-center">
            <div className="text-2xl font-bold text-violet-300">{summary.overallProgress?.toFixed(1)}%</div>
            <div className="text-[10px] text-slate-500 font-mono">OVERALL PROGRESS</div>
          </div>
          <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-xl text-center">
            <div className="text-2xl font-bold text-blue-300">{summary.currentSovereigntyScore?.toFixed(1)}%</div>
            <div className="text-[10px] text-slate-500 font-mono">SOVEREIGNTY SCORE</div>
          </div>
          <div className="p-3 bg-green-950/20 border border-green-500/20 rounded-xl text-center">
            <div className="text-2xl font-bold text-green-300">{summary.completedPhases}/{summary.totalPhases}</div>
            <div className="text-[10px] text-slate-500 font-mono">PHASES COMPLETE</div>
          </div>
          <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl text-center">
            <div className="text-2xl font-bold text-indigo-300">{summary.activeNodes || 0}</div>
            <div className="text-[10px] text-slate-500 font-mono">ACTIVE NODES</div>
          </div>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1">
        {panels.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
              activePanel === id
                ? "bg-violet-700/50 border border-violet-500/40 text-violet-200"
                : "text-slate-500 hover:text-slate-300 hover:bg-violet-950/40 border border-transparent"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {activePanel === "overview" && (
        <div className="space-y-3">
          {phases.map((phase: any) => (
            <PhaseCard
              key={phase.phaseNumber}
              phase={phase}
              expanded={expandedPhase === phase.phaseNumber}
              onToggle={() => setExpandedPhase(expandedPhase === phase.phaseNumber ? null : phase.phaseNumber)}
            />
          ))}
          {isLoading && <div className="text-center py-12 text-slate-500 font-mono text-sm">Loading roadmap...</div>}
        </div>
      )}

      {activePanel === "swarm" && <SwarmPanel nodes={swarmNodes || []} />}
      {activePanel === "models" && (
        <div className="space-y-4">
          <ModelsPanel models={models || []} />
          {(training || []).length > 0 && (
            <div className="border border-cyan-500/20 rounded-xl bg-cyan-950/10 p-4">
              <h3 className="text-xs font-mono text-cyan-400 mb-3 flex items-center gap-2"><Cpu size={14} /> TRAINING PIPELINES ({training.length})</h3>
              <div className="space-y-2">
                {training.map((p: any) => (
                  <div key={p.pipelineId} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-200">{p.pipelineName}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {p.pipelineType} · Epoch {p.currentEpoch}/{p.totalEpochs} · Model: {p.modelId}
                    </div>
                    <ProgressBar value={p.currentEpoch} max={p.totalEpochs || 1} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {activePanel === "geometry" && <GeometryPanel routes={geometryRoutes || []} />}
      {activePanel === "data" && <DataSourcesPanel sources={dataSources || []} />}
      {activePanel === "security" && <SecurityPanel events={securityEvents || []} />}
      {activePanel === "metrics" && <MetricsPanel metrics={metrics || []} />}
    </div>
  );
}
