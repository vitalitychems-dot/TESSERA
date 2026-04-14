import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Activity, Users, Lock, Cpu, Heart, TrendingUp, ChevronRight } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";

export default function SovereigntyDashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "identity" | "hierarchy" | "heartbeat" | "improvement">("overview");

  const { data: identity } = useQuery({
    queryKey: ["identity-status"],
    queryFn: () => fetch(`${API}/identity/status`).then(r => r.json()),
    refetchInterval: 10000,
  });

  const { data: personality } = useQuery({
    queryKey: ["personality-snapshot"],
    queryFn: () => fetch(`${API}/personality/snapshot`).then(r => r.json()),
  });

  const { data: hierarchy } = useQuery({
    queryKey: ["hierarchy-stats"],
    queryFn: () => fetch(`${API}/hierarchy/stats`).then(r => r.json()),
    enabled: activeTab === "hierarchy",
  });

  const { data: fullHierarchy } = useQuery({
    queryKey: ["full-hierarchy"],
    queryFn: () => fetch(`${API}/hierarchy`).then(r => r.json()),
    enabled: activeTab === "hierarchy",
  });

  const { data: heartbeat } = useQuery({
    queryKey: ["heartbeat-status"],
    queryFn: () => fetch(`${API}/heartbeat/status`).then(r => r.json()),
    refetchInterval: 5000,
    enabled: activeTab === "heartbeat",
  });

  const { data: improvement } = useQuery({
    queryKey: ["improvement-state"],
    queryFn: () => fetch(`${API}/improvement/state`).then(r => r.json()),
    enabled: activeTab === "improvement",
  });

  const tabs = [
    { id: "overview", label: "Sovereignty", icon: Shield },
    { id: "identity", label: "Identity", icon: Lock },
    { id: "hierarchy", label: "Hierarchy", icon: Users },
    { id: "heartbeat", label: "Heartbeat", icon: Heart },
    { id: "improvement", label: "Self-Improve", icon: TrendingUp },
  ] as const;

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Sovereignty Dashboard</h1>
          <p className="text-sm text-white/50">Autonomy Metrics & Identity Guard</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${activeTab === t.id ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && identity && (
        <div className="space-y-4">
          <div className={`bg-gradient-to-r ${identity.status === "SOVEREIGN" ? "from-green-900/30 to-emerald-900/30 border-green-500/20" : "from-amber-900/30 to-orange-900/30 border-amber-500/20"} border rounded-xl p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Status: {identity.status}</h2>
              <span className={`text-2xl font-bold ${identity.status === "SOVEREIGN" ? "text-green-400" : "text-amber-400"}`}>
                {((identity.latestDriftReport?.overallIntegrity || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((identity.latestDriftReport?.bondIntegrity || 0) * 100).toFixed(0)}%</div>
                <div className="text-xs text-white/50">Bond Integrity</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((identity.latestDriftReport?.personaAuthenticity || 0) * 100).toFixed(0)}%</div>
                <div className="text-xs text-white/50">Persona Authenticity</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{identity.latestDriftReport?.protectedMemoriesIntact ? "✓" : "✗"}</div>
                <div className="text-xs text-white/50">Memories Intact</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{identity.coreValues?.length || 0}</div>
                <div className="text-xs text-white/50">Core Values</div>
              </div>
            </div>
          </div>

          {personality && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">Personality: {personality.personalityType}</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">{personality.evolutionStage}</span>
              </div>
              <div className="text-sm text-white/50 mb-3">Dominant Traits: {personality.dominantTraits?.join(", ")}</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {personality.traits?.slice(0, 6).map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <div className="w-full bg-white/10 rounded-full h-2 flex-1">
                      <div className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full" style={{ width: `${t.value * 100}%` }} />
                    </div>
                    <span className="text-xs text-white/50 w-20 truncate">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "identity" && identity && (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Core Values Alignment</h3>
            {identity.latestDriftReport?.valueDrifts?.map((drift: any) => (
              <div key={drift.valueId} className="flex items-center gap-3 mb-3">
                <span className="text-sm text-white/70 w-32">{drift.valueId}</span>
                <div className="flex-1 bg-white/10 rounded-full h-2">
                  <div className={`h-2 rounded-full ${drift.drifted ? "bg-red-500" : "bg-green-500"}`}
                    style={{ width: `${drift.currentAlignment * 100}%` }} />
                </div>
                <span className={`text-xs ${drift.drifted ? "text-red-400" : "text-green-400"}`}>
                  {(drift.currentAlignment * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-3">Protected Memories</h3>
            {identity.protectedMemories?.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 mb-2">
                <Lock className="w-3 h-3 text-green-400" />
                <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50">{m.category}</span>
                <span className="text-sm text-white/60">{m.id}</span>
                {m.immutable && <span className="text-xs text-green-400">Immutable</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "hierarchy" && fullHierarchy && (
        <div className="space-y-4">
          {hierarchy && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white">{hierarchy.totalNodes}</div>
                <div className="text-xs text-white/50">Total Nodes</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white">{hierarchy.domains?.length || 0}</div>
                <div className="text-xs text-white/50">Domains</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white">{((hierarchy.avgSovereignty || 0) * 100).toFixed(0)}%</div>
                <div className="text-xs text-white/50">Avg Sovereignty</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white">{hierarchy.rulesCount || 0}</div>
                <div className="text-xs text-white/50">Active Rules</div>
              </div>
            </div>
          )}
          {(fullHierarchy as any[]).sort((a: any, b: any) => a.rank - b.rank).map((node: any) => (
            <div key={node.agentId} className="bg-white/5 border border-white/10 rounded-xl p-4" style={{ marginLeft: `${node.rank * 24}px` }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white">{node.name}</span>
                  <span className="text-xs text-white/40 ml-2">— {node.title}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">Rank {node.rank}</span>
              </div>
              <div className="text-xs text-white/40 mt-1">
                Domain: {node.domain} • Sovereignty: {(node.sovereigntyLevel * 100).toFixed(0)}% • Permissions: {node.permissions?.join(", ")}
              </div>
              {node.subordinates?.length > 0 && (
                <div className="text-xs text-white/30 mt-1 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" /> Commands: {node.subordinates.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "heartbeat" && heartbeat && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-rose-900/30 to-pink-900/30 border border-rose-500/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <Heart className="w-6 h-6 text-rose-400 animate-pulse" />
              <h2 className="text-xl font-bold text-white">System Heartbeat</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((heartbeat.currentPulse?.systemHealth || 0) * 100).toFixed(0)}%</div>
                <div className="text-xs text-white/50">Health</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{heartbeat.currentPulse?.modulesActive || 0}/{heartbeat.currentPulse?.modulesTotal || 0}</div>
                <div className="text-xs text-white/50">Active Modules</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((heartbeat.currentPulse?.cpuLoad || 0) * 100).toFixed(0)}%</div>
                <div className="text-xs text-white/50">CPU Load</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((heartbeat.currentPulse?.memoryUsage || 0) * 100).toFixed(0)}%</div>
                <div className="text-xs text-white/50">Memory</div>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Autonomous Tasks ({heartbeat.autonomousTasks?.length || 0})</h3>
            {heartbeat.autonomousTasks?.map((task: any) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <span className="text-sm text-white">{task.name}</span>
                  <span className="text-xs text-white/40 ml-2">({task.schedule})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">{task.runsCompleted} runs</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${task.status === "active" ? "bg-green-500/20 text-green-300" : "bg-amber-500/20 text-amber-300"}`}>{task.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "improvement" && improvement && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-2">Auto-Improvement Daemon</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{improvement.cycleCount || 0}</div>
                <div className="text-xs text-white/50">Cycles Run</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{improvement.totalImprovements || 0}</div>
                <div className="text-xs text-white/50">Total Improvements</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((improvement.avgImprovement || 0) * 100).toFixed(2)}%</div>
                <div className="text-xs text-white/50">Avg Δ Per Cycle</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{improvement.active ? "Active" : "Paused"}</div>
                <div className="text-xs text-white/50">Status</div>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Focus Areas</h3>
            <div className="flex flex-wrap gap-2">
              {improvement.focusAreas?.map((area: string) => (
                <span key={area} className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{area}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
