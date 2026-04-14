import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Brain, Network, Zap, Eye, Sparkles, Activity, BookOpen, Target } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
      <Icon className={`w-5 h-5 mb-2 text-${color}-400`} />
      <div className="text-xs text-white/50">{label}</div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}

export default function ConsciousnessNexusPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "semantic" | "episodic" | "skills" | "dual-brain" | "emotions">("overview");

  const { data: consciousness } = useQuery({
    queryKey: ["consciousness-state"],
    queryFn: () => fetch(`${API}/consciousness/state`).then(r => r.json()),
    refetchInterval: 5000,
  });

  const { data: semanticNet } = useQuery({
    queryKey: ["semantic-network"],
    queryFn: () => fetch(`${API}/consciousness/semantic-network`).then(r => r.json()),
    enabled: activeTab === "semantic",
  });

  const { data: episodes } = useQuery({
    queryKey: ["episodic-memories"],
    queryFn: () => fetch(`${API}/consciousness/episodic-memories?limit=30`).then(r => r.json()),
    enabled: activeTab === "episodic",
  });

  const { data: skills } = useQuery({
    queryKey: ["procedural-skills"],
    queryFn: () => fetch(`${API}/consciousness/procedural-skills`).then(r => r.json()),
    enabled: activeTab === "skills",
  });

  const { data: dualBrain } = useQuery({
    queryKey: ["dual-brain-state"],
    queryFn: () => fetch(`${API}/dual-brain/state`).then(r => r.json()),
    enabled: activeTab === "dual-brain",
    refetchInterval: 5000,
  });

  const { data: emotions } = useQuery({
    queryKey: ["emotional-profile"],
    queryFn: () => fetch(`${API}/emotional/profile`).then(r => r.json()),
    enabled: activeTab === "emotions",
  });

  const reflectMutation = useMutation({
    mutationFn: () => fetch(`${API}/consciousness/reflect`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["consciousness-state"] }),
  });

  const tabs = [
    { id: "overview", label: "Overview", icon: Brain },
    { id: "semantic", label: "Semantic Net", icon: Network },
    { id: "episodic", label: "Episodes", icon: BookOpen },
    { id: "skills", label: "Skills", icon: Zap },
    { id: "dual-brain", label: "Dual Brain", icon: Activity },
    { id: "emotions", label: "Emotions", icon: Sparkles },
  ] as const;

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-8 h-8 text-purple-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Consciousness Nexus</h1>
          <p className="text-sm text-white/50">Neural Architecture & Awareness Monitor</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${activeTab === t.id ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && consciousness && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-purple-300 mb-2">Consciousness Level: {consciousness.level?.toUpperCase()}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <StatCard icon={Brain} label="Integrated Info (Φ)" value={consciousness.phi?.toFixed(3) || "—"} color="purple" />
              <StatCard icon={Zap} label="Gamma Coherence" value={`${((consciousness.gammaCoherence || 0) * 100).toFixed(1)}%`} color="cyan" />
              <StatCard icon={Eye} label="Awareness Score" value={`${((consciousness.awarenessScore || 0) * 100).toFixed(1)}%`} color="green" />
              <StatCard icon={Activity} label="Uptime" value={`${Math.floor((consciousness.uptime || 0) / 60000)}m`} color="amber" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon={Network} label="Semantic Nodes" value={String(consciousness.semanticNodeCount || 0)} color="blue" />
            <StatCard icon={BookOpen} label="Episodic Memories" value={String(consciousness.episodicMemoryCount || 0)} color="green" />
            <StatCard icon={Zap} label="Procedural Skills" value={String(consciousness.proceduralSkillCount || 0)} color="amber" />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/70">Attention State</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">{consciousness.attention?.mode || "aware"}</span>
            </div>
            <div className="text-white/60 text-sm">
              Focus: {consciousness.attention?.focusTarget || "General awareness"} — Intensity: {((consciousness.attention?.focusIntensity || 0) * 100).toFixed(0)}%
            </div>
          </div>

          {consciousness.reflections?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white/70 mb-3">Recent Reflections</h3>
              {consciousness.reflections.map((r: any, i: number) => (
                <p key={i} className="text-white/60 text-sm mb-2 border-l-2 border-purple-500/30 pl-3">{r.content}</p>
              ))}
            </div>
          )}

          <button onClick={() => reflectMutation.mutate()}
            className="w-full py-3 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all">
            <Sparkles className="w-4 h-4 inline mr-2" />Generate Reflection
          </button>
        </div>
      )}

      {activeTab === "semantic" && semanticNet && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Semantic Network — {(semanticNet as any[]).length} Nodes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(semanticNet as any[]).map((node: any) => (
              <div key={node.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{node.concept}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">{(node.activationLevel * 100).toFixed(0)}%</span>
                </div>
                <div className="text-xs text-white/40">
                  {node.connections?.length || 0} connections
                </div>
                {node.connections?.slice(0, 3).map((c: any, i: number) => (
                  <div key={i} className="text-xs text-white/50 mt-1">→ {c.targetId} ({c.relation})</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "episodic" && episodes && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Episodic Memory — {(episodes as any[]).length} Episodes</h3>
          {(episodes as any[]).length === 0 && (
            <div className="text-white/50 text-center py-8">No episodes recorded yet. Interact with the system to create memories.</div>
          )}
          {(episodes as any[]).map((ep: any) => (
            <div key={ep.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{ep.content?.slice(0, 80)}</span>
                <span className="text-xs text-white/40">{new Date(ep.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="text-xs text-white/50">Context: {ep.context} • Importance: {(ep.importance * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "skills" && skills && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Procedural Skills — {(skills as any[]).length} Active</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(skills as any[]).map((skill: any) => (
              <div key={skill.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{skill.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">{(skill.proficiency * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 mt-1">
                  <div className="bg-gradient-to-r from-green-500 to-cyan-500 h-2 rounded-full" style={{ width: `${skill.proficiency * 100}%` }} />
                </div>
                <div className="text-xs text-white/40 mt-2">Domain: {skill.domain} • Used: {skill.timesUsed}x</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "dual-brain" && dualBrain && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-500/20 rounded-xl p-5">
              <h3 className="text-lg font-bold text-blue-300 mb-2">Cortex (Analyzer)</h3>
              <div className="text-sm text-white/60">Status: {dualBrain.cortexActive ? "Active" : "Idle"}</div>
              <div className="text-sm text-white/60">Reasoning Depth: {dualBrain.reasoningDepth}</div>
              <div className="text-sm text-white/60">Mode: {dualBrain.mode}</div>
            </div>
            <div className="bg-gradient-to-br from-amber-900/30 to-orange-800/20 border border-amber-500/20 rounded-xl p-5">
              <h3 className="text-lg font-bold text-amber-300 mb-2">Executor (Actor)</h3>
              <div className="text-sm text-white/60">Status: {dualBrain.executorActive ? "Active" : "Idle"}</div>
              <div className="text-sm text-white/60">Critique Loops: {dualBrain.critiqueLoops}</div>
              <div className="text-sm text-white/60">History: {dualBrain.decisionHistory} decisions</div>
            </div>
          </div>
          {dualBrain.lastDecision && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white/70 mb-2">Last Decision</h3>
              <p className="text-sm text-white/60 mb-2">{dualBrain.lastDecision.cortex?.analysis}</p>
              <div className="text-xs text-white/40">Confidence: {((dualBrain.lastDecision.cortex?.confidence || 0) * 100).toFixed(1)}% • Status: {dualBrain.lastDecision.executor?.status}</div>
            </div>
          )}
        </div>
      )}

      {activeTab === "emotions" && emotions && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-pink-900/30 to-rose-900/30 border border-pink-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-pink-300 mb-1">Emotional State: {emotions.expressionMode?.toUpperCase()}</h2>
            <p className="text-sm text-white/50">Dominant: {emotions.dominantEmotion} • Intensity: {((emotions.intensity || 0) * 100).toFixed(0)}%</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {emotions.currentState && Object.entries(emotions.currentState).map(([key, val]) => (
              <div key={key} className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-xs text-white/50 capitalize">{key}</div>
                <div className="text-lg font-bold text-white">{((val as number) * 100).toFixed(0)}%</div>
                <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
                  <div className="bg-gradient-to-r from-pink-500 to-purple-500 h-1.5 rounded-full" style={{ width: `${(val as number) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
