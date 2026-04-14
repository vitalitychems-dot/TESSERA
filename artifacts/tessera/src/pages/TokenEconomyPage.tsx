import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Coins, TrendingUp, BarChart3, Zap, Target, ArrowUpRight } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";

export default function TokenEconomyPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "training" | "swarm" | "quantum">("overview");

  const { data: economy } = useQuery({
    queryKey: ["economy-stats"],
    queryFn: () => fetch(`${API}/economy/stats`).then(r => r.json()),
  });

  const { data: training } = useQuery({
    queryKey: ["training-state"],
    queryFn: () => fetch(`${API}/training/state`).then(r => r.json()),
    enabled: activeTab === "training",
  });

  const { data: swarm } = useQuery({
    queryKey: ["swarm-stats"],
    queryFn: () => fetch(`${API}/swarm/stats`).then(r => r.json()),
    enabled: activeTab === "swarm",
  });

  const { data: quantum } = useQuery({
    queryKey: ["quantum-state"],
    queryFn: () => fetch(`${API}/quantum/state`).then(r => r.json()),
    enabled: activeTab === "quantum",
  });

  const trainMutation = useMutation({
    mutationFn: (domain: string) => fetch(`${API}/training/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-state"] }),
  });

  const optimizeMutation = useMutation({
    mutationFn: (objective: string) => fetch(`${API}/swarm/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective, dimensions: 5, iterations: 50 }),
    }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["swarm-stats"] }),
  });

  const tabs = [
    { id: "overview", label: "Economy", icon: Coins },
    { id: "training", label: "AGI Training", icon: Zap },
    { id: "swarm", label: "Swarm Optimizer", icon: Target },
    { id: "quantum", label: "Quantum", icon: BarChart3 },
  ] as const;

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Coins className="w-8 h-8 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Token Economy & Advanced Systems</h1>
          <p className="text-sm text-white/50">TSRT Economics, AGI Training, Quantum Computing</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${activeTab === t.id ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && economy && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-amber-900/30 to-yellow-900/30 border border-amber-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-amber-300 mb-4">TSRT Token Economy</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{economy.totalCirculation?.toLocaleString() || "—"}</div>
                <div className="text-xs text-white/50">Circulation</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{economy.treasury?.toLocaleString() || "—"}</div>
                <div className="text-xs text-white/50">Treasury</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{economy.gdp?.toLocaleString() || "—"}</div>
                <div className="text-xs text-white/50">GDP</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white flex items-center justify-center gap-1">
                  <ArrowUpRight className="w-4 h-4 text-green-400" />
                  {economy.inflationRate?.toFixed(2) || "0"}%
                </div>
                <div className="text-xs text-white/50">Inflation</div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Token Utility</h3>
            <div className="space-y-2 text-sm text-white/60">
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-400" /> Knowledge access and premium content</div>
              <div className="flex items-center gap-2"><Coins className="w-4 h-4 text-amber-400" /> Agent task delegation and computation</div>
              <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-400" /> Governance voting weight</div>
              <div className="flex items-center gap-2"><Target className="w-4 h-4 text-purple-400" /> Invention blueprint access</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "training" && training && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-blue-300 mb-2">AGI Self-Training Engine</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{training.totalSessions}</div>
                <div className="text-xs text-white/50">Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((training.overallProficiency || 0) * 100).toFixed(1)}%</div>
                <div className="text-xs text-white/50">Proficiency</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{training.domains?.length || 0}</div>
                <div className="text-xs text-white/50">Domains</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{training.trainingMethods?.length || 0}</div>
                <div className="text-xs text-white/50">Methods</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {training.domains?.map((d: any) => (
              <div key={d.domain} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white capitalize">{d.domain.replace(/-/g, " ")}</span>
                  <span className="text-xs text-white/40">{d.sessionsCompleted} sessions</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full" style={{ width: `${d.proficiency * 100}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-white/40">{(d.proficiency * 100).toFixed(1)}%</span>
                  <button onClick={() => trainMutation.mutate(d.domain)}
                    className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all">
                    Train
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "swarm" && swarm && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-emerald-300 mb-2">Particle Swarm Optimizer</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{swarm.totalOptimizations}</div>
                <div className="text-xs text-white/50">Optimizations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((swarm.avgConvergence || 0) * 100).toFixed(1)}%</div>
                <div className="text-xs text-white/50">Avg Convergence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{swarm.objectives?.length || 0}</div>
                <div className="text-xs text-white/50">Objectives</div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Available Objectives</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {swarm.objectives?.map((obj: string) => (
                <button key={obj} onClick={() => optimizeMutation.mutate(obj)}
                  className="text-left bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all">
                  <span className="text-sm text-white capitalize">{obj.replace(/-/g, " ")}</span>
                  <Target className="w-4 h-4 text-emerald-400 float-right" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "quantum" && quantum && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-violet-900/30 to-purple-900/30 border border-violet-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-violet-300 mb-2">Quantum Tesseract</h2>
            <p className="text-sm text-white/50 mb-4">4-dimensional hypercube quantum processor</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{quantum.dimensions}D</div>
                <div className="text-xs text-white/50">Dimensions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{quantum.vertices}</div>
                <div className="text-xs text-white/50">Vertices</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{quantum.quantumCircuits}</div>
                <div className="text-xs text-white/50">Circuits</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((quantum.coherence || 0) * 100).toFixed(0)}%</div>
                <div className="text-xs text-white/50">Coherence</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">{quantum.edges}</div>
              <div className="text-xs text-white/50">Edges</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">{quantum.faces}</div>
              <div className="text-xs text-white/50">Faces</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">{quantum.cells}</div>
              <div className="text-xs text-white/50">Cells</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">{quantum.entanglementPairs}</div>
              <div className="text-xs text-white/50">Entangled Pairs</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
