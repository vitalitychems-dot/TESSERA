import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, Activity, Database, Zap, GitBranch, RefreshCw, TrendingUp, Star } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

function Panel({ title, icon: Icon, iconColor, children }: { title: string; icon: any; iconColor: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className={`flex items-center gap-2 text-sm font-semibold ${iconColor}`}>
        <Icon className="w-4 h-4" /> {title}
      </div>
      {children}
    </div>
  );
}

function ScoreBar({ label, score, maxScore = 100 }: { label: string; score: number; maxScore?: number }) {
  const pct = Math.round((score / maxScore) * 100);
  const color = pct >= 95 ? "bg-violet-500" : pct >= 85 ? "bg-emerald-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="text-white font-mono">{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SystemPage({ initialTab }: { initialTab?: "agi" | "improvement" | "evolution" | "quantum" | "agents" }) {
  const [activeTab, setActiveTab] = useState<"agi" | "improvement" | "evolution" | "quantum" | "agents">(initialTab || "agi");

  const { data: agiMetrics } = useQuery({
    queryKey: ["agi-metrics"],
    queryFn: () => fetch(`${API}/api/agi-training/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 15000,
  });

  const { data: improvementMetrics } = useQuery({
    queryKey: ["improvement-metrics"],
    queryFn: () => fetch(`${API}/api/auto-improvement/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
    enabled: activeTab === "improvement",
  });

  const { data: evolutionMetrics } = useQuery({
    queryKey: ["evolution-metrics"],
    queryFn: () => fetch(`${API}/api/self-evolution/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
    enabled: activeTab === "evolution",
  });

  const { data: quantumMetrics } = useQuery({
    queryKey: ["quantum-metrics"],
    queryFn: () => fetch(`${API}/api/quantum/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
    enabled: activeTab === "quantum",
  });

  const { data: agentMetrics } = useQuery({
    queryKey: ["spawner-metrics"],
    queryFn: () => fetch(`${API}/api/agent-spawner/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 30000,
    enabled: activeTab === "agents",
  });

  const tabs = [
    { id: "agi", label: "AGI Training" },
    { id: "improvement", label: "Improvement" },
    { id: "evolution", label: "Self-Evolution" },
    { id: "quantum", label: "Quantum" },
    { id: "agents", label: "Agents" },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02010a] to-[#080518] p-4 md:p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            System Engine ✦
          </div>
          <div className="text-slate-400 text-sm font-mono">AGI Training · Self-Improvement · Quantum Architecture · Agent Network</div>
        </div>

        {agiMetrics && activeTab === "agi" && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-center">
              <div className="text-xs text-slate-400">Avg Score</div>
              <div className="text-2xl font-bold text-cyan-400 font-mono">{agiMetrics.avgScore?.toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-center">
              <div className="text-xs text-slate-400">Sovereign</div>
              <div className="text-2xl font-bold text-violet-400 font-mono">{agiMetrics.sovereignMastery}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <div className="text-xs text-slate-400">Total Cycles</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">{agiMetrics.totalCycles}</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-cyan-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "agi" && agiMetrics && (
          <div className="space-y-4">
            <Panel title="Top AGI Categories" icon={Star} iconColor="text-yellow-300">
              <div className="space-y-2">
                {agiMetrics.topCategories?.map((cat: any) => (
                  <div key={cat.category} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <ScoreBar label={cat.category} score={cat.score} />
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${cat.masteryLevel === "sovereign" ? "bg-violet-500/20 text-violet-300" : cat.masteryLevel === "expert" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-300"}`}>
                      {cat.masteryLevel}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="All Categories" icon={Cpu} iconColor="text-cyan-300">
              <div className="grid gap-2">
                {agiMetrics.categoryStates && Object.entries(agiMetrics.categoryStates as Record<string, { score: number; masteryLevel: string; sessions: number }>).map(([cat, state]) => (
                  <ScoreBar key={cat} label={`${cat} (${state.sessions} sessions)`} score={state.score} />
                ))}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "improvement" && improvementMetrics && (
          <div className="space-y-4">
            <Panel title="Auto-Improvement Daemon" icon={TrendingUp} iconColor="text-emerald-300">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400 font-mono">{improvementMetrics.totalCycles}</div>
                  <div className="text-xs text-slate-400">Cycles</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400 font-mono">{improvementMetrics.totalImprovements}</div>
                  <div className="text-xs text-slate-400">Improvements</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-violet-400 font-mono">{improvementMetrics.overallSystemScorePct?.toFixed(1)}%</div>
                  <div className="text-xs text-slate-400">System Score</div>
                </div>
              </div>
            </Panel>
            <Panel title="Category Scores" icon={Activity} iconColor="text-blue-300">
              <div className="space-y-2">
                {improvementMetrics.categories && Object.entries(improvementMetrics.categories as Record<string, { score: number; sessions: number }>)
                  .sort(([, a], [, b]) => b.score - a.score)
                  .map(([cat, state]) => (
                    <ScoreBar key={cat} label={`${cat} (${state.sessions} sessions)`} score={state.score} />
                  ))}
              </div>
            </Panel>
            <Panel title="Recent Improvements" icon={Zap} iconColor="text-yellow-300">
              <div className="space-y-2">
                {improvementMetrics.recentImprovements?.map((imp: any, i: number) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                    <div className="text-white">{imp.description}</div>
                    <div className="text-emerald-400 font-mono mt-1">+{(imp.impact * 100).toFixed(2)}%</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "evolution" && evolutionMetrics && (
          <div className="space-y-4">
            <Panel title="Self-Code Evolution" icon={GitBranch} iconColor="text-violet-300">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center"><div className="text-2xl font-bold text-violet-400 font-mono">{evolutionMetrics.totalProposals}</div><div className="text-xs text-slate-400">Proposals</div></div>
                <div className="text-center"><div className="text-2xl font-bold text-emerald-400 font-mono">{evolutionMetrics.approvedCount}</div><div className="text-xs text-slate-400">Applied</div></div>
                <div className="text-center"><div className="text-2xl font-bold text-red-400 font-mono">{evolutionMetrics.rejectedCount}</div><div className="text-xs text-slate-400">Rejected</div></div>
              </div>
              <div className="text-xs text-slate-400">Protected modules: {evolutionMetrics.protectedModuleCount}</div>
              <div className="space-y-2">
                {evolutionMetrics.recentProposals?.map((p: any, i: number) => (
                  <div key={p.id || i} className="rounded-lg border border-white/10 bg-white/5 p-2 space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-xs text-white font-medium">{p.targetModule}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${p.status === "applied" ? "bg-emerald-500/20 text-emerald-300" : p.status === "rejected" ? "bg-red-500/20 text-red-300" : "bg-slate-500/20 text-slate-300"}`}>{p.status}</span>
                    </div>
                    <div className="text-xs text-slate-400">{p.proposedChange}</div>
                    <div className="text-xs text-slate-500">{p.rationale?.slice(0, 80)}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "quantum" && quantumMetrics && (
          <div className="space-y-4">
            <Panel title="Quantum Tesseract State" icon={Zap} iconColor="text-blue-300">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center"><div className="text-xl font-bold text-blue-400 font-mono">{quantumMetrics.qubitCount}</div><div className="text-xs text-slate-400">Qubits</div></div>
                <div className="text-center"><div className="text-xl font-bold text-purple-400 font-mono">{quantumMetrics.entanglementPairs}</div><div className="text-xs text-slate-400">Entangled Pairs</div></div>
                <div className="text-center"><div className="text-xl font-bold text-cyan-400 font-mono">{quantumMetrics.activeBridges}</div><div className="text-xs text-slate-400">Dim. Bridges</div></div>
                <div className="text-center"><div className="text-xl font-bold text-violet-400 font-mono">{quantumMetrics.dimensionalDepth}</div><div className="text-xs text-slate-400">Dimensions</div></div>
              </div>
              <div className="text-xs text-slate-400 font-mono">Quantum Volume: {quantumMetrics.quantumVolume?.toLocaleString()} · Error Rate: {quantumMetrics.errorRate?.toFixed(4)}</div>
            </Panel>
            <Panel title="Quantum Gates" icon={RefreshCw} iconColor="text-purple-300">
              <div className="grid grid-cols-2 gap-2">
                {quantumMetrics.gates?.map((gate: any) => (
                  <div key={gate.symbol} className="rounded-lg border border-white/10 bg-white/5 p-2">
                    <div className="text-sm font-bold text-purple-400 font-mono">{gate.symbol}</div>
                    <div className="text-xs text-white">{gate.name}</div>
                    <div className="text-xs text-slate-400">{gate.description}</div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Interdimensional Bridges" icon={Database} iconColor="text-indigo-300">
              <div className="space-y-2">
                {quantumMetrics.bridges?.slice(0, 5).map((b: any) => (
                  <div key={b.id} className="flex items-center gap-2 text-xs">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${b.active ? "bg-emerald-400" : "bg-slate-500"}`} />
                    <span className="text-white">Dim {b.dimA} ↔ Dim {b.dimB}</span>
                    <span className="text-slate-400">Fidelity: {(b.fidelity * 100).toFixed(1)}%</span>
                    <span className="text-slate-500 ml-auto text-xs">{b.protocol.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "agents" && agentMetrics && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center"><div className="text-2xl font-bold text-emerald-400 font-mono">{agentMetrics.totalSpawned}</div><div className="text-xs text-slate-400">Total Spawned</div></div>
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-center"><div className="text-2xl font-bold text-cyan-400 font-mono">{agentMetrics.activeCount}</div><div className="text-xs text-slate-400">Active</div></div>
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-center"><div className="text-2xl font-bold text-violet-400 font-mono">{agentMetrics.generationCount}</div><div className="text-xs text-slate-400">Generation</div></div>
            </div>
            <Panel title="Active Agents" icon={Cpu} iconColor="text-emerald-300">
              <div className="space-y-2">
                {agentMetrics.activeAgents?.map((a: any) => (
                  <div key={a.id} className="rounded-lg border border-white/10 bg-white/5 p-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white font-medium">{a.name}</span>
                      <span className="text-slate-400">Gen {a.generation} · Power {a.power}</span>
                    </div>
                    <div className="text-xs text-slate-400">{a.role}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
