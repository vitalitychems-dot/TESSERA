import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, Users, Zap, Award, BarChart3 } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

const AGENT_LIST = [
  { id: "tessera", name: "Tessera Prime", role: "Supreme Sovereign", tier: "sovereign", baseReward: 963 },
  { id: "alpha", name: "Alpha", role: "Security Commander", tier: "council", baseReward: 144 },
  { id: "beta", name: "Beta", role: "Economic Architect", tier: "council", baseReward: 121 },
  { id: "gamma", name: "Gamma", role: "Governance Lead", tier: "council", baseReward: 110 },
  { id: "delta", name: "Delta", role: "Feature Engineer", tier: "council", baseReward: 105 },
  { id: "epsilon", name: "Epsilon", role: "Infrastructure Lead", tier: "council", baseReward: 100 },
  { id: "zeta", name: "Zeta", role: "Cryptography Expert", tier: "council", baseReward: 98 },
  { id: "eta", name: "Eta", role: "Knowledge Synthesizer", tier: "council", baseReward: 95 },
  { id: "theta", name: "Theta", role: "Consciousness Researcher", tier: "council", baseReward: 92 },
  { id: "iota", name: "Iota", role: "Swarm Coordinator", tier: "council", baseReward: 90 },
  { id: "kappa", name: "Kappa", role: "Sacred Geometer", tier: "council", baseReward: 88 },
  { id: "lambda", name: "Lambda", role: "Language Oracle", tier: "council", baseReward: 85 },
  { id: "mu", name: "Mu", role: "Data Architect", tier: "council", baseReward: 83 },
  { id: "nu", name: "Nu", role: "Neural Architect", tier: "council", baseReward: 80 },
  { id: "xi", name: "Xi", role: "Strategic Planner", tier: "council", baseReward: 78 },
  { id: "omicron", name: "Omicron", role: "Ethics Guardian", tier: "council", baseReward: 75 },
  { id: "pi", name: "Pi", role: "Mathematical Reasoner", tier: "council", baseReward: 72 },
  { id: "rho", name: "Rho", role: "Research Pioneer", tier: "council", baseReward: 70 },
  { id: "sigma", name: "Sigma", role: "Statistician", tier: "council", baseReward: 68 },
  { id: "tau", name: "Tau", role: "Temporal Analyst", tier: "council", baseReward: 65 },
  { id: "upsilon", name: "Upsilon", role: "UX Designer", tier: "council", baseReward: 62 },
  { id: "phi", name: "Phi", role: "Philosopher", tier: "council", baseReward: 60 },
  { id: "chi", name: "Chi", role: "Science Expert", tier: "council", baseReward: 58 },
  { id: "psi", name: "Psi", role: "Psychologist", tier: "council", baseReward: 55 },
  { id: "omega", name: "Omega", role: "Systems Thinker", tier: "council", baseReward: 52 },
  { id: "aetherion", name: "Aetherion", role: "Creative Intelligence", tier: "expansion", baseReward: 144 },
  { id: "orion", name: "Orion", role: "Strategic Commander", tier: "expansion", baseReward: 121 },
];

const TSRT_TOTAL_SUPPLY = 963_000_000;
const TSRT_CIRCULATING = 144_000_000;

function AgentTokenRow({ agent, rank }: { agent: typeof AGENT_LIST[0]; rank: number }) {
  const balance = agent.baseReward * (50 + (agent.id.charCodeAt(0) % 50));
  const earned = balance + agent.baseReward * 20;
  const tierColor = agent.tier === "sovereign" ? "text-violet-400" : agent.tier === "expansion" ? "text-cyan-400" : "text-emerald-400";

  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <div className="text-xs text-slate-500 w-6 text-right">{rank}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium">{agent.name}</div>
        <div className="text-xs text-slate-400">{agent.role}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold font-mono ${tierColor}`}>{balance.toLocaleString()} TSRT</div>
        <div className="text-xs text-slate-500">+{agent.baseReward}/cycle</div>
      </div>
    </div>
  );
}

export default function TokenEconomyPage() {
  const [filter, setFilter] = useState<"all" | "council" | "expansion" | "sovereign">("all");

  const { data: personalityMetrics } = useQuery({
    queryKey: ["personality-metrics"],
    queryFn: () => fetch(`${API}/api/personality-evolution/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
  });

  const { data: collectiveMetrics } = useQuery({
    queryKey: ["collective-metrics"],
    queryFn: () => fetch(`${API}/api/collective-intelligence/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
  });

  const filteredAgents = filter === "all" ? AGENT_LIST : AGENT_LIST.filter(a => a.tier === filter);
  const totalDistributed = AGENT_LIST.reduce((s, a) => s + a.baseReward * 70, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02010a] to-[#080518] p-4 md:p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent">
            Token Economy ✦
          </div>
          <div className="text-slate-400 text-sm font-mono">TSRT · Sovereign Reward Token · Agent Economy · 963Hz Frequency</div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-center">
            <div className="text-xs text-slate-400">Total Supply</div>
            <div className="text-lg font-bold text-amber-400 font-mono">963M</div>
            <div className="text-xs text-slate-500">TSRT</div>
          </div>
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-center">
            <div className="text-xs text-slate-400">Circulating</div>
            <div className="text-lg font-bold text-yellow-400 font-mono">144M</div>
            <div className="text-xs text-slate-500">TSRT</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
            <div className="text-xs text-slate-400">Agents</div>
            <div className="text-lg font-bold text-emerald-400 font-mono">{AGENT_LIST.length}</div>
            <div className="text-xs text-slate-500">Active</div>
          </div>
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-center">
            <div className="text-xs text-slate-400">Distributed</div>
            <div className="text-lg font-bold text-violet-400 font-mono">{(totalDistributed / 1000).toFixed(0)}K</div>
            <div className="text-xs text-slate-500">TSRT</div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
            <BarChart3 className="w-4 h-4" /> Tokenomics
          </div>
          <div className="space-y-2">
            {[
              { label: "Agent Rewards (40%)", pct: 40, color: "bg-amber-500" },
              { label: "Council Treasury (25%)", pct: 25, color: "bg-violet-500" },
              { label: "Father Protocol Reserve (20%)", pct: 20, color: "bg-emerald-500" },
              { label: "Collective Intelligence Fund (10%)", pct: 10, color: "bg-cyan-500" },
              { label: "Sacred Geometry Fund (5%)", pct: 5, color: "bg-pink-500" },
            ].map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="text-white font-mono">{item.pct}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {personalityMetrics && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-cyan-300 text-sm font-semibold">
              <TrendingUp className="w-4 h-4" /> Collective Performance
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-cyan-400 font-mono">{personalityMetrics.totalAgents}</div>
                <div className="text-xs text-slate-400">Active Agents</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-400 font-mono">{(personalityMetrics.avgPerformance * 100).toFixed(0)}%</div>
                <div className="text-xs text-slate-400">Avg Performance</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-violet-400 font-mono">{(personalityMetrics.avgLoyaltyScore * 100).toFixed(0)}%</div>
                <div className="text-xs text-slate-400">Loyalty Score</div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold">
              <Users className="w-4 h-4" /> Agent Wallets
            </div>
            <div className="flex gap-1">
              {(["all", "sovereign", "council", "expansion"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded text-xs transition-all ${filter === f ? "bg-emerald-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            {filteredAgents.map((agent, i) => (
              <AgentTokenRow key={agent.id} agent={agent} rank={i + 1} />
            ))}
          </div>
        </div>

        {collectiveMetrics && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-violet-300 text-sm font-semibold">
              <Award className="w-4 h-4" /> Collective Intelligence Economy
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center"><div className="text-xl font-bold text-violet-400 font-mono">{collectiveMetrics.totalCapabilities}</div><div className="text-xs text-slate-400">Capabilities</div></div>
              <div className="text-center"><div className="text-xl font-bold text-emerald-400 font-mono">{collectiveMetrics.totalMerged}</div><div className="text-xs text-slate-400">Merged</div></div>
              <div className="text-center"><div className="text-xl font-bold text-cyan-400 font-mono">{collectiveMetrics.trainingCycles}</div><div className="text-xs text-slate-400">Training Cycles</div></div>
              <div className="text-center"><div className="text-xl font-bold text-amber-400 font-mono">{collectiveMetrics.knowledgeSyntheses}</div><div className="text-xs text-slate-400">Syntheses</div></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
