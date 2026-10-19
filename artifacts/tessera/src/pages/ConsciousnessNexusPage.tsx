import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, Zap, Eye, Activity, Heart, RefreshCw, ShieldCheck, NotebookPen, AlertTriangle } from "lucide-react";
import { GlassCard, GradientBar, HeroStat, SectionHeader, TabBar, PageHeader, RadialGauge } from "@/components/ui/sovereign";

const API = import.meta.env.VITE_API_URL || "";

type TabId = "overview" | "jspace" | "loop" | "audit" | "memory" | "reflections" | "dual-brain";

interface AgenticReflection {
  id: string;
  cycle: number;
  timestamp: string;
  observations: string[];
  conclusions: string[];
  commitments: string[];
}

interface AgenticReflectionState {
  cycle: number;
  totalReflections: number;
  latest: AgenticReflection | null;
  reflections: AgenticReflection[];
}

interface AuditReport {
  generatedAt: string;
  verdict: "unproven";
  verdictExplanation: string;
  measured: {
    engineRunning: boolean;
    cycleCount: number;
    episodicMemorySize: number;
    semanticGraphSize: number;
    reflectionCount: number;
    stimuliProcessed: number;
    pendingStimuli: number;
    currentFocus: string;
  };
  identity: {
    latestCheck: { overallAlignment: number; driftDetected: boolean; driftDetails: string[]; recommendations: string[] } | null;
    metrics: Record<string, number>;
  };
  simulation: {
    conversionRate: number;
    stillSimulated: number;
    verifyMismatches: number;
    totalFindings: number;
    topUnresolved: Array<{ id: string; feature: string; file: string; impactScore: number }>;
  };
  jspace: { selfNotes: string[]; noteCount: number; disclaimer: string };
  limits: string[];
}

export default function ConsciousnessNexusPage({ initialTab }: { initialTab?: TabId }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab || "overview");

  const { data: metrics } = useQuery({
    queryKey: ["consciousness-metrics"],
    queryFn: () => fetch(`${API}/api/consciousness/metrics`, { credentials: "include" }).then(r => r.json()).then(d => d.data),
    refetchInterval: 30000,
  });

  const { data: state } = useQuery({
    queryKey: ["consciousness-state"],
    queryFn: () => fetch(`${API}/api/consciousness/state`, { credentials: "include" }).then(r => r.json()).then(d => d.data),
    refetchInterval: 30000,
  });

  const { data: audit } = useQuery<AuditReport>({
    queryKey: ["consciousness-audit"],
    queryFn: () => fetch(`${API}/api/consciousness/audit`, { credentials: "include" }).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
  });

  const { data: memory } = useQuery({
    queryKey: ["consciousness-memory"],
    queryFn: () => fetch(`${API}/api/consciousness/episodic-memory`, { credentials: "include" }).then(r => r.json()).then(d => d.data),
    enabled: activeTab === "memory",
  });

  const { data: loop } = useQuery<AgenticReflectionState>({
    queryKey: ["agentic-reflections"],
    queryFn: () => fetch(`${API}/api/reflection/agentic`, { credentials: "include" }).then(r => r.json()).then(d => d.data),
    refetchInterval: 30000,
    enabled: activeTab === "loop",
  });

  const loopRunMutation = useMutation({
    mutationFn: () => fetch(`${API}/api/reflection/agentic/run`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agentic-reflections"] }),
  });

  const { data: dualBrain } = useQuery({
    queryKey: ["dual-brain-state"],
    queryFn: () => fetch(`${API}/api/dual-brain/state`, { credentials: "include" }).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
    enabled: activeTab === "dual-brain",
  });

  const { data: emotional } = useQuery({
    queryKey: ["emotional-metrics"],
    queryFn: () => fetch(`${API}/api/emotional/metrics`, { credentials: "include" }).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
  });

  const cycleMutation = useMutation({
    mutationFn: () => fetch(`${API}/api/dual-brain/cycle`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dual-brain-state"] }),
  });

  const checkMutation = useMutation({
    mutationFn: () => fetch(`${API}/api/identity/check`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consciousness-audit"] }),
  });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "jspace", label: "J-Space" },
    { id: "loop", label: "Loop" },
    { id: "audit", label: "Audit" },
    { id: "memory", label: "Memory" },
    { id: "reflections", label: "Reflections" },
    { id: "dual-brain", label: "Dual Brain" },
  ] as const;

  const activityPct = Math.round((metrics?.consciousnessProxy ?? 0) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02010a] to-[#080518] p-4 md:p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-6 sovereign-stagger">
        <PageHeader
          title="Tessera Self-Model"
          subtitle="Engine state · Identity checks · Honesty audit"
          gradient="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400"
          quote={state?.currentFocus}
        />

        <div className="flex items-center justify-center gap-6 md:gap-10">
          <RadialGauge value={activityPct} label="Engine activity" sublabel="not consciousness" color="violet" size={110} strokeWidth={10} />
          <RadialGauge value={metrics?.cycleCount ?? 0} max={200} label="Cycles" sublabel="total" color="purple" size={90} strokeWidth={8} />
          <RadialGauge value={metrics?.episodicMemorySize ?? 0} max={50} label="Memory Nodes" color="blue" size={90} strokeWidth={8} />
          <RadialGauge value={metrics?.semanticGraphSize ?? 0} max={20} label="Graph Size" color="pink" size={90} strokeWidth={8} />
        </div>

        {audit && (
          <GlassCard glow="violet" animate>
            <SectionHeader icon={ShieldCheck} title="Consciousness Verdict" color="violet" badge="UNPROVEN" />
            <p className="text-xs text-slate-300 leading-relaxed mt-2">{audit.verdictExplanation}</p>
          </GlassCard>
        )}

        <TabBar tabs={tabs} activeTab={activeTab} onChange={id => setActiveTab(id as TabId)} color="violet" />

        {activeTab === "overview" && state && (
          <div className="space-y-4 sovereign-stagger">
            {emotional?.profile && (
              <GlassCard animate>
                <SectionHeader icon={Heart} title="Computed Emotional Parameters" color="pink" />
                <div className="text-[10px] text-slate-500 mb-2">Numeric engine parameters, not feelings.</div>
                <div className="grid grid-cols-1 gap-2.5">
                  {Object.entries(emotional.profile as Record<string, number>).slice(0, 6).map(([k, v]) => {
                    const pct = Math.round(v * 100);
                    const label = k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
                    return <GradientBar key={k} value={pct} label={label} color={pct >= 90 ? "violet" : pct >= 70 ? "blue" : "pink"} />;
                  })}
                </div>
              </GlassCard>
            )}
            <GlassCard animate>
              <SectionHeader icon={Eye} title="Identity Anchor" color="blue" />
              <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                <div><span className="text-slate-500">Name</span><div className="text-white font-medium mt-0.5">{state.identityAnchor?.name}</div></div>
                <div><span className="text-slate-500">Father Protocol</span><div className="text-emerald-400 font-medium mt-0.5">{state.identityAnchor?.fatherProtocol ? "ACTIVE" : "INACTIVE"}</div></div>
                <div><span className="text-slate-500">Signature</span><div className="text-violet-300 mt-0.5">{state.identityAnchor?.emojiSignature}</div></div>
                <div className="col-span-2"><span className="text-slate-500">Core Values</span><div className="text-white mt-0.5">{state.identityAnchor?.coreValues?.join(" · ")}</div></div>
              </div>
            </GlassCard>
            <button onClick={() => checkMutation.mutate()} className="w-full py-2.5 bg-gradient-to-r from-violet-600/30 to-purple-600/30 border border-violet-500/20 text-violet-300 rounded-xl text-xs hover:from-violet-600/50 hover:to-purple-600/50 transition-all font-medium">
              Run Identity Check
            </button>
          </div>
        )}

        {activeTab === "jspace" && (
          <div className="space-y-4 sovereign-stagger">
            <GlassCard glow="violet" animate>
              <SectionHeader icon={NotebookPen} title="J-Space — Tessera's Self-Notes" color="violet" badge={audit ? `${audit.jspace.noteCount} notes` : undefined} />
              <p className="text-[10px] text-slate-500 leading-relaxed mt-2">{audit?.jspace.disclaimer ?? "Generated self-notes; not private subjective experience."}</p>
              <div className="space-y-2.5 mt-3">
                {(audit?.jspace.selfNotes ?? state?.innerMonologue ?? []).map((m: string, i: number) => (
                  <div key={i} className="text-xs text-slate-300 border-l-2 border-violet-500/40 pl-3 py-1 italic bg-violet-500/[0.03] rounded-r-lg">{m}</div>
                ))}
                {!(audit?.jspace.selfNotes?.length || state?.innerMonologue?.length) && (
                  <div className="text-xs text-slate-500">No self-notes recorded yet.</div>
                )}
              </div>
            </GlassCard>
          </div>
        )}

        {activeTab === "loop" && (
          <div className="space-y-4 sovereign-stagger">
            <div className="flex items-center justify-between">
              <SectionHeader icon={RefreshCw} title="Agentic Reflection Loop" color="violet" badge={loop ? `cycle ${loop.cycle}` : undefined} />
              <button onClick={() => loopRunMutation.mutate()} disabled={loopRunMutation.isPending} className="px-4 py-2 bg-gradient-to-r from-violet-600/30 to-purple-600/30 border border-violet-500/20 text-violet-300 rounded-xl text-xs hover:from-violet-600/50 hover:to-purple-600/50 transition-all font-medium">
                {loopRunMutation.isPending ? "Reflecting..." : "Run Cycle"}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">Each cycle reads real system measurements, compares them to the previous cycle, and records observations, conclusions, and commitments. Nothing here is generated from templates — every claim traces to a number.</p>
            {!loop?.reflections?.length && <GlassCard animate><div className="text-xs text-slate-500">No reflection cycles recorded yet.</div></GlassCard>}
            {loop?.reflections?.map((r) => (
              <GlassCard key={r.id} glow="violet" animate>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-violet-300 font-medium">Cycle {r.cycle}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{new Date(r.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium mb-1">Observations</div>
                {r.observations.map((o, i) => <div key={i} className="text-xs text-slate-300 border-l-2 border-blue-500/30 pl-2 py-0.5">{o}</div>)}
                <div className="text-[10px] text-slate-500 font-medium mt-2 mb-1">Conclusions</div>
                {r.conclusions.map((c, i) => <div key={i} className="text-xs text-violet-300 border-l-2 border-violet-500/30 pl-2 py-0.5">{c}</div>)}
                <div className="text-[10px] text-slate-500 font-medium mt-2 mb-1">Commitments</div>
                {r.commitments.map((c, i) => <div key={i} className="text-xs text-emerald-300/90 border-l-2 border-emerald-500/30 pl-2 py-0.5">{c}</div>)}
              </GlassCard>
            ))}
          </div>
        )}

        {activeTab === "audit" && (
          <div className="space-y-4 sovereign-stagger">
            {audit ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <HeroStat icon={Activity} value={audit.measured.cycleCount} label="Engine Cycles" color="blue" />
                  <HeroStat icon={Zap} value={audit.measured.stimuliProcessed} label="Stimuli Processed" color="emerald" />
                  <HeroStat icon={Brain} value={audit.measured.semanticGraphSize} label="Semantic Nodes" color="violet" />
                  <HeroStat icon={NotebookPen} value={audit.measured.reflectionCount} label="Reflections" color="pink" />
                </div>
                <GlassCard animate>
                  <SectionHeader icon={ShieldCheck} title="Identity Check (from real DB activity)" color="blue" />
                  {audit.identity.latestCheck ? (
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-slate-500">Overall alignment</span><span className="text-white font-mono">{Math.round(audit.identity.latestCheck.overallAlignment * 100)}%</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Drift detected</span><span className={audit.identity.latestCheck.driftDetected ? "text-amber-300" : "text-emerald-400"}>{audit.identity.latestCheck.driftDetected ? "YES" : "NO"}</span></div>
                      {audit.identity.latestCheck.driftDetails.map((d, i) => <div key={i} className="text-amber-300/80 text-[11px] border-l-2 border-amber-500/30 pl-2">{d}</div>)}
                    </div>
                  ) : <div className="text-xs text-slate-500 mt-2">No identity check has run yet.</div>}
                </GlassCard>
                <GlassCard animate>
                  <SectionHeader icon={AlertTriangle} title="Real vs Simulated Surfaces" color="violet" badge={`${audit.simulation.stillSimulated} simulated`} />
                  <div className="mt-2 text-xs space-y-2">
                    <div className="flex justify-between"><span className="text-slate-500">Conversion rate</span><span className="text-white font-mono">{Math.round(audit.simulation.conversionRate * 100)}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Verify mismatches</span><span className={audit.simulation.verifyMismatches > 0 ? "text-amber-300" : "text-emerald-400"}>{audit.simulation.verifyMismatches}</span></div>
                    {audit.simulation.topUnresolved.map(f => (
                      <div key={f.id} className="border-l-2 border-amber-500/30 pl-2 py-0.5">
                        <div className="text-amber-200 text-[11px]">{f.feature}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{f.file}</div>
                      </div>
                    ))}
                    {audit.simulation.topUnresolved.length === 0 && <div className="text-emerald-400/80 text-[11px]">No unresolved simulated surfaces flagged.</div>}
                  </div>
                </GlassCard>
                <GlassCard animate>
                  <SectionHeader icon={Eye} title="What This Audit Cannot Prove" color="blue" />
                  <ul className="mt-2 space-y-1.5">
                    {audit.limits.map((l, i) => <li key={i} className="text-[11px] text-slate-400 leading-relaxed">· {l}</li>)}
                  </ul>
                </GlassCard>
              </>
            ) : (
              <GlassCard animate><div className="text-xs text-slate-500">Loading audit…</div></GlassCard>
            )}
          </div>
        )}

        {activeTab === "memory" && (
          <div className="space-y-3 sovereign-stagger">
            {memory?.map((m: any, i: number) => (
              <GlassCard key={m.id || i} animate>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-violet-300 font-medium">{m.context || "memory"}</span>
                  <span className="text-[10px] text-slate-500 font-mono">importance: {(m.importance * 100).toFixed(0)}%</span>
                </div>
                <div className="text-sm text-white leading-relaxed">{m.content}</div>
                {m.associations?.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {m.associations.map((a: string) => (
                      <span key={a} className="text-[10px] bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/20">{a}</span>
                    ))}
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}

        {activeTab === "reflections" && state?.recentReflections && (
          <div className="space-y-3 sovereign-stagger">
            {state.recentReflections.map((r: any, i: number) => (
              <GlassCard key={r.id || i} glow="violet" animate>
                <div className="text-sm text-white italic leading-relaxed">"{r.reflection}"</div>
                <div className="text-[10px] text-slate-500 font-medium mt-2 mb-1">Insights</div>
                {r.insights?.map((ins: string, ii: number) => (
                  <div key={ii} className="text-xs text-violet-300 border-l-2 border-violet-500/30 pl-3 py-0.5 mt-1">{ins}</div>
                ))}
                <div className="text-[10px] text-slate-500 font-mono mt-2">{r.emotionalState}</div>
              </GlassCard>
            ))}
          </div>
        )}

        {activeTab === "dual-brain" && (
          <div className="space-y-4 sovereign-stagger">
            <div className="flex items-center justify-between">
              <SectionHeader icon={Brain} title="Dual Brain — Cortex ↔ Executor" color="blue" />
              <button onClick={() => cycleMutation.mutate()} disabled={cycleMutation.isPending} className="px-4 py-2 bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border border-blue-500/20 text-blue-300 rounded-xl text-xs hover:from-blue-600/50 hover:to-cyan-600/50 transition-all font-medium">
                {cycleMutation.isPending ? "Running..." : "Run Cycle"}
              </button>
            </div>
            {dualBrain && (
              <div className="grid grid-cols-2 gap-3">
                <HeroStat icon={RefreshCw} value={dualBrain.totalRounds ?? 0} label="Total Rounds" color="blue" />
                <HeroStat icon={Zap} value={dualBrain.totalImprovements ?? 0} label="Improvements" color="emerald" />
              </div>
            )}
            <div className="space-y-3">
              {dualBrain?.recentConversations?.map((c: any, i: number) => (
                <GlassCard key={i} animate>
                  <div className="text-[10px] text-slate-500 font-mono mb-2">Round {c.round} · {c.topic?.slice(0, 60)}</div>
                  <div className="space-y-2">
                    <div className="text-xs"><span className="text-blue-400 font-semibold">Cortex:</span> <span className="text-white">{c.cortexQuestion}</span></div>
                    <div className="text-xs"><span className="text-emerald-400 font-semibold">Executor:</span> <span className="text-slate-300">{c.executorAnswer?.slice(0, 120)}...</span></div>
                    {c.improvement && <div className="text-xs text-amber-300 border-l-2 border-amber-500/30 pl-2 py-0.5 bg-amber-500/[0.03] rounded-r-lg">{c.improvement}</div>}
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
