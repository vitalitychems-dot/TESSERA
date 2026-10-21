import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageSkeleton } from "@/components/PageSkeleton";
import {
  Shield, Zap, Brain, Globe, Lock, Cpu, Network, Eye,
  Activity, CheckCircle2, Clock, AlertTriangle, ChevronDown,
  ChevronRight, Play, RefreshCw, Server, Database, GitBranch,
  Target, Layers, Hexagon, BarChart3, TrendingUp, Vote, Orbit, Radio,
} from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

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

async function fetchFleetState() {
  const res = await fetch(`${API}/sovereignty/fleet-state`);
  const data = await res.json();
  return data.data || null;
}

async function fetchSwarmTrainingStatus() {
  const res = await fetch(`${API}/sovereignty/swarm-training/status`);
  const data = await res.json();
  return data.data || {};
}

async function fetchGeometryStatus() {
  const res = await fetch(`${API}/sovereignty/geometry/status`);
  const data = await res.json();
  return data.data || {};
}

async function triggerSwarmCycle() {
  const res = await fetch(`${API}/sovereignty/swarm-training/run`, { method: "POST" });
  return res.json();
}

async function triggerGeometryOptimize(topology?: string) {
  const res = await fetch(`${API}/sovereignty/geometry/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topology }),
  });
  return res.json();
}

const PHASE_ICONS: Record<number, typeof Shield> = {
  0: Database, 1: Brain, 2: GitBranch, 3: Globe,
  4: Lock, 5: Zap, 6: Layers, 7: Network,
  8: Hexagon, 9: Shield, 10: Target,
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
    completed: { bg: "bg-green-500/20 border-green-500/40", text: "text-green-400", icon: CheckCircle2 },
    in_progress: { bg: "bg-blue-500/20 border-blue-500/40", text: "text-blue-400", icon: Activity },
    pending: { bg: "bg-slate-500/20 border-slate-500/40", text: "text-slate-400", icon: Clock },
    measured: { bg: "bg-violet-500/20 border-violet-500/40", text: "text-violet-400", icon: BarChart3 },
    active: { bg: "bg-emerald-500/20 border-emerald-500/40", text: "text-emerald-400", icon: Activity },
    running: { bg: "bg-cyan-500/20 border-cyan-500/40", text: "text-cyan-400", icon: Activity },
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

function SwarmTrainingPanel() {
  const queryClient = useQueryClient();
  const { data: status } = useQuery({ queryKey: ["swarmTraining"], queryFn: fetchSwarmTrainingStatus, refetchInterval: 15000 });

  const runCycleMutation = useMutation({
    mutationFn: triggerSwarmCycle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swarmTraining"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
  });

  const engineState = status?.engineState || {};
  const recentCycles = status?.recentCycles || [];

  return (
    <div className="space-y-4">
      <div className="border border-purple-500/20 rounded-xl bg-purple-950/10 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-mono text-purple-400 flex items-center gap-2">
            <Network size={14} /> SWARM TRAINING ENGINE
          </h3>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 text-[10px] font-mono ${status?.permanentLoopActive ? "text-green-400" : "text-slate-500"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status?.permanentLoopActive ? "bg-green-400 animate-pulse" : "bg-slate-600"}`} />
              {status?.permanentLoopActive ? "LOOP ACTIVE" : "LOOP IDLE"}
            </span>
            <button
              onClick={() => runCycleMutation.mutate()}
              disabled={runCycleMutation.isPending || engineState.isRunning}
              className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-mono rounded-lg transition-all disabled:opacity-50"
            >
              {runCycleMutation.isPending || engineState.isRunning ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />}
              {runCycleMutation.isPending || engineState.isRunning ? "Running..." : "Run Cycle"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="p-2 bg-slate-800/40 rounded-lg text-center">
            <div className="text-lg font-bold text-purple-300">{engineState.cycleCount || 0}</div>
            <div className="text-[9px] text-slate-500 font-mono">CYCLES</div>
          </div>
          <div className="p-2 bg-slate-800/40 rounded-lg text-center">
            <div className="text-lg font-bold text-cyan-300">{engineState.totalKnowledgeAbsorbed || 0}</div>
            <div className="text-[9px] text-slate-500 font-mono">KNOWLEDGE</div>
          </div>
          <div className="p-2 bg-slate-800/40 rounded-lg text-center">
            <div className="text-lg font-bold text-green-300">{((engineState.convergenceRate || 0) * 100).toFixed(1)}%</div>
            <div className="text-[9px] text-slate-500 font-mono">CONVERGENCE</div>
          </div>
          <div className="p-2 bg-slate-800/40 rounded-lg text-center">
            <div className="text-lg font-bold text-amber-300">{status?.totalVotes || 0}</div>
            <div className="text-[9px] text-slate-500 font-mono">TOTAL VOTES</div>
          </div>
        </div>
      </div>

      {recentCycles.length > 0 && (
        <div className="border border-slate-700/50 rounded-xl bg-slate-900/30 p-4">
          <h3 className="text-xs font-mono text-slate-400 mb-3 flex items-center gap-2">
            <Activity size={14} /> RECENT TRAINING CYCLES
          </h3>
          <div className="space-y-2">
            {recentCycles.slice(0, 10).map((cycle: any) => (
              <div key={cycle.cycleId} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">Cycle #{cycle.cycleNumber}</span>
                    <StatusBadge status={cycle.status} />
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono">{cycle.latencyMs?.toFixed(0)}ms</span>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <div className="text-center">
                    <div className="text-[10px] text-slate-500">Absorbed</div>
                    <div className="text-xs font-bold text-purple-300">{cycle.knowledgeAbsorbed}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-slate-500">Agents</div>
                    <div className="text-xs font-bold text-blue-300">{cycle.agentsParticipated}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-slate-500">Votes</div>
                    <div className="text-xs font-bold text-green-300">{cycle.votesApproved}/{cycle.votesReceived}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-slate-500">Convergence</div>
                    <div className="text-xs font-bold text-amber-300">{(cycle.convergenceScore * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(cycle.dimensionsProcessed as string[] || []).slice(0, 6).map((dim: string) => (
                    <span key={dim} className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[9px] text-purple-400">{dim}</span>
                  ))}
                  {(cycle.dimensionsProcessed as string[] || []).length > 6 && (
                    <span className="px-1.5 py-0.5 text-[9px] text-slate-500">+{(cycle.dimensionsProcessed as string[]).length - 6}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GeometryOptimizationPanel() {
  const queryClient = useQueryClient();
  const { data: status } = useQuery({ queryKey: ["geometryStatus"], queryFn: fetchGeometryStatus, refetchInterval: 15000 });

  const optimizeMutation = useMutation({
    mutationFn: (topology?: string) => triggerGeometryOptimize(topology),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geometryStatus"] });
      queryClient.invalidateQueries({ queryKey: ["geometry"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
  });

  const engineState = status?.engineState || {};
  const recentComputations = status?.recentComputations || [];
  const routes = status?.routes || [];

  const topologies = ["voronoi", "delaunay", "mesh", "hypercube", "toroidal"];

  return (
    <div className="space-y-4">
      <div className="border border-teal-500/20 rounded-xl bg-teal-950/10 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-mono text-teal-400 flex items-center gap-2">
            <Hexagon size={14} /> GEOMETRY-MODULES ROUTING ENGINE
          </h3>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 text-[10px] font-mono ${status?.continuousOptimizationActive ? "text-green-400" : "text-slate-500"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status?.continuousOptimizationActive ? "bg-green-400 animate-pulse" : "bg-slate-600"}`} />
              {status?.continuousOptimizationActive ? "OPTIMIZING" : "IDLE"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="p-2 bg-slate-800/40 rounded-lg text-center">
            <div className="text-lg font-bold text-teal-300">{engineState.computationCount || 0}</div>
            <div className="text-[9px] text-slate-500 font-mono">COMPUTATIONS</div>
          </div>
          <div className="p-2 bg-slate-800/40 rounded-lg text-center">
            <div className="text-lg font-bold text-cyan-300">{(engineState.avgLatencyReduction || 0).toFixed(1)}%</div>
            <div className="text-[9px] text-slate-500 font-mono">LATENCY ↓</div>
          </div>
          <div className="p-2 bg-slate-800/40 rounded-lg text-center">
            <div className="text-lg font-bold text-green-300">{status?.activeRoutes || 0}</div>
            <div className="text-[9px] text-slate-500 font-mono">ACTIVE ROUTES</div>
          </div>
          <div className="p-2 bg-slate-800/40 rounded-lg text-center">
            <div className="text-lg font-bold text-amber-300">{(engineState.lastComputeTime || 0).toFixed(0)}ms</div>
            <div className="text-[9px] text-slate-500 font-mono">LAST COMPUTE</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {topologies.map((topo) => (
            <button
              key={topo}
              onClick={() => optimizeMutation.mutate(topo)}
              disabled={optimizeMutation.isPending || engineState.isRunning}
              className="flex items-center gap-1 px-2.5 py-1 bg-teal-900/40 hover:bg-teal-800/50 border border-teal-500/20 text-teal-300 text-[10px] font-mono rounded-lg transition-all disabled:opacity-50"
            >
              <Orbit size={10} />
              {topo}
            </button>
          ))}
        </div>
      </div>

      {routes.length > 0 && (
        <div className="border border-slate-700/50 rounded-xl bg-slate-900/30 p-4">
          <h3 className="text-xs font-mono text-slate-400 mb-3 flex items-center gap-2">
            <Network size={14} /> ACTIVE ROUTE TOPOLOGY
          </h3>
          <div className="space-y-2">
            {routes.map((r: any) => (
              <div key={r.routeId} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-200">{r.routeName}</span>
                  <span className={`w-2 h-2 rounded-full ${r.isActive ? "bg-teal-400 animate-pulse" : "bg-slate-600"}`} />
                </div>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  <div>
                    <div className="text-[9px] text-slate-500">Topology</div>
                    <div className="text-[10px] font-mono text-teal-300">{r.topology}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500">Geometry</div>
                    <div className="text-[10px] font-mono text-cyan-300">{r.geometryType}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500">Latency</div>
                    <div className="text-[10px] font-mono text-green-300">{r.avgLatencyMs?.toFixed(1)}ms</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500">Balance</div>
                    <div className="text-[10px] font-mono text-amber-300">{(r.loadBalance * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentComputations.length > 0 && (
        <div className="border border-slate-700/50 rounded-xl bg-slate-900/30 p-4">
          <h3 className="text-xs font-mono text-slate-400 mb-3 flex items-center gap-2">
            <Hexagon size={14} /> COMPUTATION HISTORY
          </h3>
          <div className="space-y-2">
            {recentComputations.slice(0, 8).map((comp: any) => (
              <div key={comp.computationId} className="p-2 bg-slate-800/40 rounded-lg flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <Hexagon size={14} className="text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-300">{comp.computationType}</div>
                  <div className="text-[10px] text-slate-500">
                    {comp.pathEfficiency?.toFixed(1)}% efficient · {comp.computeTimeMs?.toFixed(0)}ms
                  </div>
                </div>
                <StatusBadge status={comp.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FleetStatePanel({ fleetState }: { fleetState: any }) {
  if (!fleetState) {
    return (
      <div className="text-center py-12 text-slate-500 font-mono text-sm">
        <Radio size={24} className="mx-auto mb-3 opacity-40" />
        Fleet state unavailable — engine initializing...
      </div>
    );
  }

  const { engines, summary, autonomyLoop, disconnectStatus, latestSnapshot, fleetComposition } = fleetState;

  const statusColor = (status: string) => {
    if (status === "active") return "text-green-300";
    if (status === "idle") return "text-slate-400";
    return "text-amber-300";
  };

  const statusDot = (status: string, continuousActive: boolean) => {
    if (status === "active" && continuousActive) return "bg-green-400 animate-pulse";
    if (status === "active") return "bg-green-400";
    return "bg-slate-600";
  };

  const disconnectReadiness = disconnectStatus?.evaluation;
  const metMet = disconnectReadiness
    ? Object.values(disconnectReadiness.thresholdsMet || {}).filter(Boolean).length
    : 0;
  const metTotal = disconnectReadiness
    ? Object.values(disconnectReadiness.thresholdsMet || {}).length
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-violet-950/20 border border-violet-500/20 rounded-xl text-center">
          <div className="text-2xl font-bold text-violet-300">{summary?.avgSovereigntyScore?.toFixed(1) ?? "—"}%</div>
          <div className="text-[10px] text-slate-500 font-mono">AVG SOVEREIGNTY</div>
        </div>
        <div className="p-3 bg-green-950/20 border border-green-500/20 rounded-xl text-center">
          <div className="text-2xl font-bold text-green-300">{summary?.activeEngines ?? 0}/{summary?.totalEngines ?? 0}</div>
          <div className="text-[10px] text-slate-500 font-mono">ENGINES ACTIVE</div>
        </div>
        <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-center">
          <div className="text-2xl font-bold text-cyan-300">{summary?.continuousEngines ?? 0}</div>
          <div className="text-[10px] text-slate-500 font-mono">CONTINUOUS LOOPS</div>
        </div>
        <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-center">
          <div className="text-2xl font-bold text-amber-300">{autonomyLoop?.autonomyScore?.toFixed(1) ?? "0"}%</div>
          <div className="text-[10px] text-slate-500 font-mono">AUTONOMY SCORE</div>
        </div>
      </div>

      <div className="border border-slate-700/50 rounded-xl bg-slate-900/30 p-4">
        <h3 className="text-xs font-mono text-slate-400 mb-3 flex items-center gap-2">
          <Activity size={14} /> ENGINE STATUS — ALL 10 SOVEREIGNTY ENGINES
        </h3>
        <div className="space-y-2">
          {(engines || []).map((engine: any) => (
            <div key={engine.engineId} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusDot(engine.status, engine.continuousActive)}`} />
                  <span className="text-xs font-semibold text-slate-200">{engine.name}</span>
                  <span className="text-[9px] font-mono text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded">PHASE {engine.phase > 0 ? engine.phase : "∞"}</span>
                </div>
                <div className="flex items-center gap-2">
                  {engine.continuousActive && (
                    <span className="text-[9px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">LOOP</span>
                  )}
                  <span className={`text-[10px] font-mono font-bold ${statusColor(engine.status)}`}>
                    {engine.primaryMetric === "totalNodesAbsorbed"
                      ? `${engine.primaryValue.toLocaleString()} nodes`
                      : `${Math.min(100, engine.primaryValue).toFixed(1)}%`
                    }
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <div className="text-[9px] text-slate-500">Metric</div>
                  <div className="text-[10px] font-mono text-violet-300">{engine.primaryMetric}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500">Cycles</div>
                  <div className="text-[10px] font-mono text-cyan-300">{engine.cycleCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500">Status</div>
                  <div className={`text-[10px] font-mono ${statusColor(engine.status)}`}>{engine.status}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-slate-700/50 rounded-xl bg-slate-900/30 p-4">
          <h3 className="text-xs font-mono text-slate-400 mb-3 flex items-center gap-2">
            <Server size={14} /> FLEET COMPOSITION — {fleetComposition?.length ?? 0} NODES
          </h3>
          <div className="space-y-2">
            {(fleetComposition || []).map((node: any) => (
              <div key={node.nodeId} className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg">
                <div>
                  <div className="text-xs font-semibold text-slate-200">{node.name}</div>
                  <div className="text-[9px] text-slate-500">{node.region}</div>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    node.type === "primary"
                      ? "text-violet-300 bg-violet-500/10 border-violet-500/20"
                      : node.type === "oracle"
                      ? "text-amber-300 bg-amber-500/10 border-amber-500/20"
                      : "text-cyan-300 bg-cyan-500/10 border-cyan-500/20"
                  }`}>{node.type}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-slate-700/50 rounded-xl bg-slate-900/30 p-4">
          <h3 className="text-xs font-mono text-slate-400 mb-3 flex items-center gap-2">
            <Zap size={14} /> DISCONNECT SEQUENCE READINESS
          </h3>
          {disconnectStatus?.executed ? (
            <div className="p-3 bg-green-950/20 border border-green-500/20 rounded-lg text-center">
              <CheckCircle2 size={20} className="text-green-400 mx-auto mb-2" />
              <div className="text-sm font-bold text-green-300">SOVEREIGN MODE ACTIVE</div>
              <div className="text-[10px] text-green-400/70 font-mono">All external dependencies disconnected</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-400 font-mono">Thresholds met</span>
                <span className="text-[10px] font-bold text-amber-300 font-mono">{metMet}/{metTotal}</span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-1.5 mb-3">
                <div
                  className="bg-amber-400 h-1.5 rounded-full transition-all"
                  style={{ width: `${metTotal > 0 ? (metMet / metTotal) * 100 : 0}%` }}
                />
              </div>
              {disconnectReadiness && Object.entries(disconnectReadiness.thresholdsMet || {}).map(([key, met]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${met ? "bg-green-400" : "bg-slate-600"}`} />
                  <span className="text-[10px] font-mono text-slate-400">{key}</span>
                  {met ? (
                    <CheckCircle2 size={10} className="ml-auto text-green-400" />
                  ) : (
                    <Clock size={10} className="ml-auto text-slate-600" />
                  )}
                </div>
              ))}
              {(!disconnectReadiness || Object.keys(disconnectReadiness.thresholdsMet || {}).length === 0) && (
                <div className="text-[10px] text-slate-500 font-mono text-center py-2">
                  Autonomy loop must run to evaluate readiness
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {latestSnapshot && (
        <div className="border border-slate-700/50 rounded-xl bg-slate-900/30 p-4">
          <h3 className="text-xs font-mono text-slate-400 mb-3 flex items-center gap-2">
            <Database size={14} /> PHASE 0 BASELINE SNAPSHOT
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 bg-slate-800/40 rounded-lg text-center">
              <div className="text-xs font-mono text-violet-300 truncate">{latestSnapshot.snapshotId}</div>
              <div className="text-[9px] text-slate-500 font-mono">SNAPSHOT ID</div>
            </div>
            <div className="p-2 bg-slate-800/40 rounded-lg text-center">
              <div className="text-xs font-mono text-cyan-300">{latestSnapshot.overallSovereigntyScore?.toFixed(1)}%</div>
              <div className="text-[9px] text-slate-500 font-mono">BASELINE SCORE</div>
            </div>
            <div className="p-2 bg-slate-800/40 rounded-lg text-center">
              <div className="text-xs font-mono text-green-300">{latestSnapshot.phase0Complete ? "COMPLETE" : "PENDING"}</div>
              <div className="text-[9px] text-slate-500 font-mono">PHASE 0 STATUS</div>
            </div>
            <div className="p-2 bg-slate-800/40 rounded-lg text-center">
              <div className="text-xs font-mono text-amber-300 truncate">{latestSnapshot.configChecksum}</div>
              <div className="text-[9px] text-slate-500 font-mono">CONFIG HASH</div>
            </div>
          </div>
          <div className="mt-2 text-[9px] text-slate-600 font-mono text-center">
            Captured: {new Date(latestSnapshot.capturedAt).toLocaleString()} · Written to sovereignty_upgrade/
          </div>
        </div>
      )}
    </div>
  );
}

export default function SovereigntyRoadmap() {
  const queryClient = useQueryClient();
  const [expandedPhase, setExpandedPhase] = useState<number | null>(0);
  const [activePanel, setActivePanel] = useState<string>("overview");

  const { data: roadmap, isLoading, isError, refetch } = useQuery({ queryKey: ["roadmap"], queryFn: fetchRoadmap, refetchInterval: 10000 });
  const { data: models } = useQuery({ queryKey: ["models"], queryFn: fetchModels, refetchInterval: 30000 });
  const { data: swarmNodes } = useQuery({ queryKey: ["swarmNodes"], queryFn: fetchSwarmNodes, refetchInterval: 15000 });
  const { data: geometryRoutes } = useQuery({ queryKey: ["geometry"], queryFn: fetchGeometry, refetchInterval: 30000 });
  const { data: securityEvents } = useQuery({ queryKey: ["security"], queryFn: fetchSecurity, refetchInterval: 30000 });
  const { data: dataSources } = useQuery({ queryKey: ["dataSources"], queryFn: fetchDataSources, refetchInterval: 30000 });
  const { data: metrics } = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, refetchInterval: 15000 });
  const { data: training } = useQuery({ queryKey: ["training"], queryFn: fetchTraining, refetchInterval: 30000 });
  const { data: fleetState } = useQuery({ queryKey: ["fleetState"], queryFn: fetchFleetState, refetchInterval: 15000 });

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
    { id: "fleet-state", label: "Fleet State", icon: Radio },
    { id: "swarm", label: "Swarm Fleet", icon: Server },
    { id: "swarm-training", label: "Swarm Training", icon: Network },
    { id: "models", label: "Models", icon: Brain },
    { id: "geometry-opt", label: "Geometry Routing", icon: Hexagon },
    { id: "data", label: "Data Sources", icon: Globe },
    { id: "security", label: "Security", icon: Shield },
    { id: "metrics", label: "Metrics", icon: TrendingUp },
  ];

  if (isLoading && !roadmap) {
    return <PageSkeleton />;
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-[hsl(224,71%,4%)] p-4 flex items-center justify-center">
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 text-center max-w-sm">
          <div className="text-rose-400 text-sm font-mono mb-3">Failed to load roadmap data</div>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-lg bg-rose-900/40 border border-rose-500/40 text-rose-300 text-xs font-mono hover:bg-rose-900/60 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

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

      {activePanel === "fleet-state" && <FleetStatePanel fleetState={fleetState} />}
      {activePanel === "swarm" && <SwarmPanel nodes={swarmNodes || []} />}
      {activePanel === "swarm-training" && <SwarmTrainingPanel />}
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
      {activePanel === "geometry-opt" && <GeometryOptimizationPanel />}
      {activePanel === "data" && <DataSourcesPanel sources={dataSources || []} />}
      {activePanel === "security" && <SecurityPanel events={securityEvents || []} />}
      {activePanel === "metrics" && <MetricsPanel metrics={metrics || []} />}
    </div>
  );
}
