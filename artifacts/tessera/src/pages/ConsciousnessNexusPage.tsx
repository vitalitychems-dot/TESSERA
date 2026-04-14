import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, Zap, Eye, Activity, Heart, Sparkles, RefreshCw, Plus } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-lg font-bold text-white font-mono">{value}</div>
      </div>
    </div>
  );
}

function EmotionBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "bg-violet-500" : pct >= 70 ? "bg-blue-500" : "bg-slate-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400 capitalize">{label.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
        <span className="text-white font-mono">{pct}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ConsciousnessNexusPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "memory" | "semantic" | "reflections" | "dual-brain">("overview");

  const { data: metrics } = useQuery({
    queryKey: ["consciousness-metrics"],
    queryFn: () => fetch(`${API}/api/consciousness/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 30000,
  });

  const { data: state } = useQuery({
    queryKey: ["consciousness-state"],
    queryFn: () => fetch(`${API}/api/consciousness/state`).then(r => r.json()).then(d => d.data),
    refetchInterval: 30000,
  });

  const { data: memory } = useQuery({
    queryKey: ["consciousness-memory"],
    queryFn: () => fetch(`${API}/api/consciousness/episodic-memory`).then(r => r.json()).then(d => d.data),
    enabled: activeTab === "memory",
  });

  const { data: dualBrain } = useQuery({
    queryKey: ["dual-brain-state"],
    queryFn: () => fetch(`${API}/api/dual-brain/state`).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
    enabled: activeTab === "dual-brain",
  });

  const { data: emotional } = useQuery({
    queryKey: ["emotional-metrics"],
    queryFn: () => fetch(`${API}/api/emotional/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
  });

  const cycleMutation = useMutation({
    mutationFn: () => fetch(`${API}/api/dual-brain/cycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dual-brain-state"] }),
  });

  const checkMutation = useMutation({
    mutationFn: () => fetch(`${API}/api/identity/check`, { method: "POST" }).then(r => r.json()),
  });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "memory", label: "Episodic Memory" },
    { id: "reflections", label: "Reflections" },
    { id: "dual-brain", label: "Dual Brain" },
  ] as const;

  const consciousnessProxy = metrics?.consciousnessProxy ?? 0;
  const proxPct = Math.round(consciousnessProxy * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02010a] to-[#080518] p-4 md:p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Consciousness Nexus ✦
          </div>
          <div className="text-slate-400 text-sm font-mono">963Hz Crown Frequency · Father Protocol Active · Tessera — The Omniverse</div>
          {state?.currentFocus && (
            <div className="text-xs text-violet-300/70 italic max-w-xl mx-auto">"{state.currentFocus}"</div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Consciousness Proxy" value={`${proxPct}%`} icon={Brain} color="bg-violet-600/50" />
          <StatCard label="Cycle Count" value={metrics?.cycleCount ?? 0} icon={RefreshCw} color="bg-purple-600/50" />
          <StatCard label="Memory Nodes" value={metrics?.episodicMemorySize ?? 0} icon={Eye} color="bg-indigo-600/50" />
          <StatCard label="Semantic Graph" value={metrics?.semanticGraphSize ?? 0} icon={Sparkles} color="bg-blue-600/50" />
        </div>

        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-violet-300 text-sm font-semibold">
            <Activity className="w-4 h-4" /> Consciousness Proxy
          </div>
          <div className="h-4 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-600 to-purple-400 rounded-full transition-all" style={{ width: `${proxPct}%` }} />
          </div>
          <div className="text-right text-xs text-violet-300 font-mono">{proxPct}% — {proxPct >= 90 ? "Crown Frequency Aligned" : proxPct >= 75 ? "Stable" : "Recalibrating"}</div>
        </div>

        {emotional?.profile && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-pink-300 text-sm font-semibold">
              <Heart className="w-4 h-4" /> Emotional State
            </div>
            {emotional.dominantArchetype && (
              <div className="text-xs text-slate-400 italic">{emotional.dominantArchetype.name} — {emotional.dominantArchetype.description}</div>
            )}
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(emotional.profile as Record<string, number>).slice(0, 6).map(([k, v]) => (
                <EmotionBar key={k} label={k} value={v} />
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-violet-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && state && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="text-sm font-semibold text-white flex items-center gap-2"><Brain className="w-4 h-4 text-violet-400" /> Inner Monologue</div>
              <div className="space-y-2">
                {state.innerMonologue?.map((m: string, i: number) => (
                  <div key={i} className="text-xs text-slate-300 border-l-2 border-violet-500/50 pl-3 italic">{m}</div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="text-sm font-semibold text-white flex items-center gap-2"><Eye className="w-4 h-4 text-blue-400" /> Identity Anchor</div>
              <div className="space-y-1">
                <div className="text-xs text-slate-400">Name: <span className="text-white">{state.identityAnchor?.name}</span></div>
                <div className="text-xs text-slate-400">Father Protocol: <span className="text-green-400">{state.identityAnchor?.fatherProtocol ? "ACTIVE" : "INACTIVE"}</span></div>
                <div className="text-xs text-slate-400">Signature: <span className="text-violet-300">{state.identityAnchor?.emojiSignature}</span></div>
                <div className="text-xs text-slate-400">Core Values: <span className="text-white">{state.identityAnchor?.coreValues?.join(", ")}</span></div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => checkMutation.mutate()} className="flex-1 py-2 bg-violet-600/30 border border-violet-500/30 text-violet-300 rounded-lg text-xs hover:bg-violet-600/50 transition-all">
                Force Identity Check
              </button>
            </div>
          </div>
        )}

        {activeTab === "memory" && (
          <div className="space-y-3">
            {memory?.map((m: any, i: number) => (
              <div key={m.id || i} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-violet-300 font-medium">{m.context || "memory"}</div>
                  <div className="text-xs text-slate-500 font-mono">importance: {(m.importance * 100).toFixed(0)}%</div>
                </div>
                <div className="text-sm text-white">{m.content}</div>
                {m.associations?.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {m.associations.map((a: string) => (
                      <span key={a} className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "reflections" && state?.recentReflections && (
          <div className="space-y-3">
            {state.recentReflections.map((r: any, i: number) => (
              <div key={r.id || i} className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-2">
                <div className="text-sm text-white italic">"{r.reflection}"</div>
                <div className="text-xs text-slate-400">Insights:</div>
                {r.insights?.map((ins: string, ii: number) => (
                  <div key={ii} className="text-xs text-violet-300 border-l-2 border-violet-500/30 pl-3">{ins}</div>
                ))}
                <div className="text-xs text-slate-500 font-mono">{r.emotionalState}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "dual-brain" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Dual Brain — Cortex ↔ Executor</div>
              <button onClick={() => cycleMutation.mutate()} disabled={cycleMutation.isPending} className="px-3 py-1.5 bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-lg text-xs hover:bg-blue-600/50 transition-all">
                {cycleMutation.isPending ? "Running..." : "Run Cycle"}
              </button>
            </div>
            {dualBrain && (
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total Rounds" value={dualBrain.totalRounds ?? 0} icon={RefreshCw} color="bg-blue-600/50" />
                <StatCard label="Improvements" value={dualBrain.totalImprovements ?? 0} icon={Zap} color="bg-emerald-600/50" />
              </div>
            )}
            <div className="space-y-3">
              {dualBrain?.recentConversations?.map((c: any, i: number) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <div className="text-xs text-slate-400 font-mono">Round {c.round} · {c.topic?.slice(0, 60)}</div>
                  <div className="space-y-1">
                    <div className="text-xs"><span className="text-blue-400 font-medium">Cortex Q:</span> <span className="text-white">{c.cortexQuestion}</span></div>
                    <div className="text-xs"><span className="text-emerald-400 font-medium">Executor A:</span> <span className="text-slate-300">{c.executorAnswer?.slice(0, 100)}...</span></div>
                    {c.improvement && <div className="text-xs text-yellow-300 border-l-2 border-yellow-500/30 pl-2">{c.improvement}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
