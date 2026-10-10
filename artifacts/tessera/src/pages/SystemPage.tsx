import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Activity, Cpu, Database, GitBranch, Pause, Play, Shield, Zap, Clock, AlertTriangle, CheckCircle2, Network, CircleHelp, Orbit, Layers3, RefreshCw } from "lucide-react";
import { GlassCard, SectionHeader, PageHeader, MiniStat, TabLoadingSkeleton } from "@/components/ui/sovereign";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { QueryErrorFallback } from "@/components/ui/QueryErrorFallback";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import type { SystemDestination } from "@/lib/navigation-registry";

const API = import.meta.env.VITE_API_URL || "";
type LegacyTab = "agi" | "improvement" | "evolution" | "quantum" | "agents" | "health";
type SystemTab = SystemDestination;
type Metrics = Record<string, any>;

const tabForLegacy: Record<LegacyTab, SystemTab> = {
  agi: "learning", improvement: "learning", evolution: "learning",
  quantum: "architecture", agents: "operations", health: "operations",
};
const subsectionForLegacy: Partial<Record<LegacyTab, string>> = {
  agi: "training-activity", improvement: "improvement-activity",
  evolution: "self-evolution", agents: "agents-runtime", health: "evolution-health",
  quantum: "quantum-architecture",
};
async function fetchApi<T = Metrics>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`);
  const json = await response.json();
  return json.data;
}
function MetricQueryState({ loading, error, retry, label }: { loading: boolean; error: unknown; retry: () => void; label: string }) {
  if (loading) return <TabLoadingSkeleton />;
  if (error) return <QueryErrorFallback error={error as Error} onRetry={retry} label={label} />;
  return null;
}
function DataLine({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === "") return null;
  return <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/[0.05] py-2 last:border-0">
    <span className="text-xs text-slate-400">{label}</span><span className="font-mono text-xs text-slate-200">{String(value)}</span>
  </div>;
}

export default function SystemPage({ initialTab }: { initialTab?: LegacyTab }) {
  const mappedInitial = initialTab ? tabForLegacy[initialTab] : "capability";
  const [activeTab, setActiveTab] = useState<SystemTab>(mappedInitial);
  const scrolledToInitial = useRef(false);
  const initialSection = initialTab ? subsectionForLegacy[initialTab] : undefined;

  const agi = useQuery({ queryKey: ["agi-metrics"], queryFn: () => fetchApi(`${API}/api/agi-training/metrics`), refetchInterval: 15000, enabled: activeTab === "learning" });
  const improvement = useQuery({ queryKey: ["improvement-metrics"], queryFn: () => fetchApi(`${API}/api/auto-improvement/metrics`), refetchInterval: 60000, enabled: activeTab === "learning" });
  const evolution = useQuery({ queryKey: ["evolution-metrics"], queryFn: () => fetchApi(`${API}/api/self-evolution/metrics`), refetchInterval: 60000, enabled: activeTab === "learning" });
  const health = useQuery({ queryKey: ["evolution-health"], queryFn: () => fetchApi(`${API}/api/evolution-health`), refetchInterval: 10000, enabled: activeTab === "operations" });
  const agents = useQuery({ queryKey: ["spawner-metrics"], queryFn: () => fetchApi(`${API}/api/agent-spawner/metrics`), refetchInterval: 30000, enabled: activeTab === "operations" });
  const quantum = useQuery({ queryKey: ["quantum-metrics"], queryFn: () => fetchApi(`${API}/api/quantum/metrics`), refetchInterval: 60000, enabled: activeTab === "architecture" });
  const tabs = useMemo(() => [
    { id: "capability", label: "Capability" },
    { id: "learning", label: "Learning" },
    { id: "operations", label: "Operations" },
    { id: "architecture", label: "Architecture" },
  ], []);
  useEffect(() => {
    setActiveTab(initialTab ? tabForLegacy[initialTab] : "capability");
    scrolledToInitial.current = false;
  }, [initialTab]);
  useEffect(() => {
    if (!initialSection || scrolledToInitial.current) return;
    const target = document.getElementById(initialSection);
    if (!target) return;
    scrolledToInitial.current = true;
    requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  }, [initialSection, activeTab, agi.isSuccess, improvement.isSuccess, evolution.isSuccess, health.isSuccess, agents.isSuccess, quantum.isSuccess]);

  const mutateHealth = (action: "pause" | "resume" | "reset", moduleId: string) => fetch(
    `${API}/api/evolution-health/${action}/${moduleId}`,
    { method: "POST", headers: { "x-admin-token": localStorage.getItem("t9_admin_token") || "" } },
  ).then(async (response) => {
    if (!response.ok) throw new Error(`Health control failed (${response.status})`);
    return response.json();
  });
  const pause = useMutation({ mutationFn: (id: string) => mutateHealth("pause", id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["evolution-health"] }) });
  const resume = useMutation({ mutationFn: (id: string) => mutateHealth("resume", id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["evolution-health"] }) });
  const reset = useMutation({ mutationFn: (id: string) => mutateHealth("reset", id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["evolution-health"] }) });
  const mutationError = pause.error || resume.error || reset.error;
  const inFlight = pause.isPending || resume.isPending || reset.isPending;

  return <main className="min-h-[100dvh] bg-gradient-to-b from-[#02010a] to-[#080518] px-4 py-5 md:p-6 pb-24">
    <div className="max-w-5xl mx-auto space-y-5 sovereign-stagger">
      <PageHeader title="System Engine" subtitle="Evidence, learning activity, operations, and architecture" gradient="bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300" />
      <nav aria-label="System Engine sections" className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 md:grid-cols-4" data-testid="system-engine-tabs">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return <button key={tab.id} type="button" aria-current={selected ? "page" : undefined}
            onClick={() => setActiveTab(tab.id as SystemTab)}
            className={cn("min-h-10 rounded-lg px-2 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 md:px-4",
              selected ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.25)]" : "text-slate-400 hover:bg-white/[0.06] hover:text-white")}
            data-testid={`system-tab-${tab.id}`}>{tab.label}</button>;
        })}
      </nav>

      {activeTab === "capability" && <SectionErrorBoundary name="Capability">
        <GlassCard glow="cyan" animate>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06]"><CircleHelp className="w-5 h-5 text-cyan-300" /></div>
            <div className="min-w-0">
              <SectionHeader icon={Activity} title="Evaluation evidence" color="cyan" />
              <div className="mt-4 text-lg font-semibold text-cyan-100" data-testid="status-capability-not-evaluated">Not evaluated</div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                No category-aligned evaluation result, sample count, or evaluation timestamp is exposed by the available System Engine metrics. Activity counts and count-derived training indicators are not capability measurements.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                <span className="rounded-full border border-white/[0.08] px-2.5 py-1">Evaluation source: unavailable</span>
                <span className="rounded-full border border-white/[0.08] px-2.5 py-1">No score inferred</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </SectionErrorBoundary>}

      {activeTab === "learning" && <SectionErrorBoundary name="Learning">
        <div className="space-y-4">
          <MetricQueryState loading={agi.isLoading || improvement.isLoading || evolution.isLoading} error={agi.error || improvement.error || evolution.error}
            retry={() => { void agi.refetch(); void improvement.refetch(); void evolution.refetch(); }} label="Learning activity" />
          {(agi.data || improvement.data || evolution.data) && <>
            <GlassCard glow="cyan" animate>
              <div id="training-activity" className="scroll-mt-4">
                <SectionHeader icon={Cpu} title="AGI Training activity" color="cyan" />
                <p className="text-[11px] text-slate-500 mt-1">Source: GET /api/agi-training/metrics · operational counters, not evaluation evidence</p>
                <div className="grid grid-cols-2 gap-3 mt-4 md:grid-cols-3">
                  <MiniStat value={agi.data?.totalCycles ?? "—"} label="Training cycles · count" color="cyan" />
                  <MiniStat value={agi.data?.totalCategories ?? "—"} label="Configured categories · count" color="violet" />
                  <MiniStat value={agi.data?.dataSourceCounts ? Object.values(agi.data.dataSourceCounts as Record<string, number>).reduce((sum, value) => sum + Number(value || 0), 0) : "—"} label="Source records · aggregate count" color="emerald" />
                </div>
                {agi.data?.dataSourceCounts && <div className="mt-4 border-t border-white/[0.06] pt-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Reported source counts</p>
                  {Object.entries(agi.data.dataSourceCounts as Record<string, number>).map(([source, count]) => <DataLine key={source} label={`${source} · records`} value={count} />)}
                </div>}
                <p className="text-[10px] text-slate-600 mt-3">The API does not expose an observation timestamp for these counters.</p>
              </div>
            </GlassCard>
            <GlassCard glow="emerald" animate>
              <div id="improvement-activity" className="scroll-mt-4">
                <SectionHeader icon={Activity} title="Auto-Improvement" color="emerald" />
                <p className="text-[11px] text-slate-500 mt-1">Source: GET /api/auto-improvement/metrics · activity totals</p>
                <div className="grid grid-cols-2 gap-3 mt-4 md:grid-cols-3">
                  <MiniStat value={improvement.data?.totalCycles ?? "—"} label="Daemon cycles · count" color="emerald" />
                  <MiniStat value={improvement.data?.totalImprovements ?? "—"} label="Recorded improvements · count" color="cyan" />
                  <MiniStat value={improvement.data?.categoryCount ?? "—"} label="Tracked categories · count" color="violet" />
                </div>
                {improvement.data?.lastCycleAt && <p className="text-[10px] text-slate-500 font-mono mt-3">Last cycle reported: {new Date(improvement.data.lastCycleAt).toLocaleString()}</p>}
                <div className="mt-4 space-y-2">
                  {(improvement.data?.recentImprovements ?? []).length ? (improvement.data?.recentImprovements ?? []).map((item: Metrics, index: number) => <div key={item.id ?? index} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-xs text-slate-200">{item.description}</p>
                    {item.impact !== undefined && <p className="text-[10px] font-mono text-emerald-300 mt-1">Reported impact field: {String(item.impact)}</p>}
                  </div>) : <p className="text-xs text-slate-500 py-2">No recent improvements returned.</p>}
                </div>
              </div>
            </GlassCard>
            <GlassCard glow="violet" animate>
              <div id="self-evolution" className="scroll-mt-4">
                <SectionHeader icon={GitBranch} title="Self-Evolution proposals" color="violet" />
                <p className="text-[11px] text-slate-500 mt-1">Source: GET /api/self-evolution/metrics · proposal and protected-module counts</p>
                <div className="grid grid-cols-2 gap-3 mt-4 md:grid-cols-4">
                  <MiniStat value={evolution.data?.totalProposals ?? "—"} label="Proposals · count" color="violet" />
                  <MiniStat value={evolution.data?.approvedCount ?? "—"} label="Applied · count" color="emerald" />
                  <MiniStat value={evolution.data?.rejectedCount ?? "—"} label="Rejected · count" color="rose" />
                  <MiniStat value={evolution.data?.protectedModuleCount ?? "—"} label="Protected modules · count" color="cyan" />
                </div>
                {evolution.data?.lastEvolutionAt && <p className="text-[10px] text-slate-500 font-mono mt-3">Last evolution reported: {new Date(evolution.data.lastEvolutionAt).toLocaleString()}</p>}
                <div className="space-y-2 mt-4">
                  {(evolution.data?.recentProposals ?? []).length ? (evolution.data?.recentProposals ?? []).map((proposal: Metrics, index: number) => <div key={proposal.id ?? index} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex justify-between gap-3"><span className="text-xs text-slate-100">{proposal.targetModule}</span><span className="text-[10px] uppercase text-slate-400">{proposal.status}</span></div>
                    <p className="text-xs text-slate-400 mt-1">{proposal.proposedChange}</p>
                    {proposal.rationale && <p className="text-[10px] text-slate-500 mt-1">{proposal.rationale}</p>}
                  </div>) : <p className="text-xs text-slate-500 py-2">No recent proposals returned.</p>}
                </div>
              </div>
            </GlassCard>
          </>}
        </div>
      </SectionErrorBoundary>}

      {activeTab === "operations" && <SectionErrorBoundary name="Operations">
        <div className="space-y-4">
          <MetricQueryState loading={health.isLoading || agents.isLoading} error={health.error || agents.error}
            retry={() => { void health.refetch(); void agents.refetch(); }} label="System operations" />
          {(health.data || agents.data) && <>
            {health.data && <div id="evolution-health" className="scroll-mt-4 space-y-4">
              <GlassCard glow="cyan" animate>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><SectionHeader icon={Shield} title="Evolution Health" color="cyan" /><p className="text-[11px] text-slate-500 mt-1">Source: GET /api/evolution-health · health and throttle telemetry</p></div>
                  <button type="button" disabled={inFlight} onClick={() => health.refetch()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/[0.05] disabled:opacity-50" data-testid="button-refresh-evolution-health"><RefreshCw size={13} />Refresh</button>
                </div>
                {health.data.improvement && <div className="grid grid-cols-2 gap-3 mt-4 md:grid-cols-3">
                  <MiniStat value={health.data.improvement.overallCodeHealth ?? "—"} label="Code health · reported %" color="emerald" />
                  <MiniStat value={health.data.improvement.patches?.successRate ?? "—"} label="Patch success · reported %" color="cyan" />
                  <MiniStat value={health.data.improvement.testing?.passRate ?? "—"} label="Test pass · reported %" color="violet" />
                  <MiniStat value={health.data.improvement.improvementCycles ?? "—"} label="Improvement cycles · count" color="amber" />
                </div>}
                <p className="text-[10px] text-slate-600 mt-3">Observation timestamp is not provided by this endpoint.</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {health.data.throttle?.globalPaused
                    ? <button type="button" disabled={inFlight} onClick={() => resume.mutate("_all")} className="min-h-10 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs text-emerald-300 disabled:opacity-50" data-testid="button-resume-all"><Play size={13} className="inline mr-1.5" />Resume all</button>
                    : <button type="button" disabled={inFlight} onClick={() => pause.mutate("_all")} className="min-h-10 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 text-xs text-amber-300 disabled:opacity-50" data-testid="button-pause-all"><Pause size={13} className="inline mr-1.5" />Pause all</button>}
                  {mutationError && <span role="alert" className="self-center text-xs text-rose-300">Control request failed. Check authorization and retry.</span>}
                </div>
              </GlassCard>
              {health.data.throttle?.modules?.length > 0 && <GlassCard animate>
                <SectionHeader icon={Activity} title="Throttle modules" color="violet" />
                <div className="space-y-2 mt-3">{health.data.throttle.modules.map((module: Metrics) => <div key={module.moduleId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex items-center gap-2 text-xs text-slate-100"><span>{module.paused ? <Pause size={13} className="text-amber-300" /> : module.cooldownRemainingMs > 0 ? <Clock size={13} className="text-orange-300" /> : module.consecutiveFailures > 0 ? <AlertTriangle size={13} className="text-amber-300" /> : <CheckCircle2 size={13} className="text-emerald-300" />}</span>{module.moduleId}</div>
                      <p className="text-[10px] text-slate-500 mt-1">{module.totalSuccesses} successes · {module.totalFailures} failures · {module.successRate}% reported success</p>
                      {module.cooldownRemainingMs > 0 && <p className="text-[10px] text-orange-300 mt-1">Cooldown remaining: {Math.ceil(module.cooldownRemainingMs / 1000)} seconds</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {module.consecutiveFailures > 0 && <button type="button" disabled={inFlight} onClick={() => reset.mutate(module.moduleId)} className="min-h-10 rounded-md border border-cyan-400/20 px-3 text-xs text-cyan-200 disabled:opacity-50" data-testid={`button-reset-module-${module.moduleId}`}>Reset</button>}
                      <button type="button" disabled={inFlight} onClick={() => (module.paused ? resume : pause).mutate(module.moduleId)} className="min-h-10 rounded-md border border-white/10 px-3 text-xs text-slate-200 disabled:opacity-50" data-testid={`${module.paused ? "button-resume" : "button-pause"}-module-${module.moduleId}`}>{module.paused ? "Resume" : "Pause"}</button>
                    </div>
                  </div>
                </div>)}</div>
              </GlassCard>}
              <GlassCard animate>
                <SectionHeader icon={Database} title="Scheduler" color="blue" />
                <p className="text-[11px] text-slate-500 mt-1">Source: GET /api/evolution-health · scheduler counters</p>
                <div className="grid grid-cols-2 gap-3 mt-4 md:grid-cols-3">
                  <MiniStat value={health.data.scheduler?.totalTasks ?? "—"} label="Scheduled tasks · count" color="blue" />
                  <MiniStat value={health.data.scheduler?.activeTasks ?? "—"} label="Active tasks · count" color="emerald" />
                  <MiniStat value={health.data.scheduler?.runningNow ?? "—"} label="Currently running · count" color="cyan" />
                </div>
              </GlassCard>
            </div>}
            {agents.data && <GlassCard glow="violet" animate>
              <div id="agents-runtime" className="scroll-mt-4">
                <SectionHeader icon={Network} title="Agent runtime" color="violet" />
                <p className="text-[11px] text-slate-500 mt-1">Source: GET /api/agent-spawner/metrics · spawn runtime counters</p>
                <div className="grid grid-cols-2 gap-3 mt-4 md:grid-cols-3">
                  <MiniStat value={agents.data.totalSpawned ?? "—"} label="Spawned · agents" color="emerald" />
                  <MiniStat value={agents.data.activeCount ?? "—"} label="Active · agents" color="cyan" />
                  <MiniStat value={agents.data.generationCount ?? "—"} label="Generation · count" color="violet" />
                </div>
                <p className="text-[10px] text-slate-600 mt-3">The API does not expose an observation timestamp.</p>
                <div className="space-y-2 mt-4">
                  {(agents.data.activeAgents ?? []).length ? agents.data.activeAgents.map((agent: Metrics, index: number) => <div key={agent.id ?? index} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex justify-between gap-3 text-xs"><span className="text-slate-100">{agent.name}</span><span className="font-mono text-slate-500">Generation {agent.generation}</span></div>
                    {agent.role && <p className="text-[10px] text-slate-400 mt-1">{agent.role}</p>}
                  </div>) : <p className="text-xs text-slate-500 py-2">No active agents returned.</p>}
                </div>
              </div>
            </GlassCard>}
          </>}
        </div>
      </SectionErrorBoundary>}

      {activeTab === "architecture" && <SectionErrorBoundary name="Architecture">
        <div className="space-y-4">
          <MetricQueryState loading={quantum.isLoading} error={quantum.error} retry={() => quantum.refetch()} label="Quantum architecture" />
          <GlassCard glow="violet" animate>
            <SectionHeader icon={Layers3} title="Architecture evidence" color="violet" />
            <p className="text-xs leading-relaxed text-slate-400 mt-3">This screen does not claim model-weight ownership, dedicated hardware, distributed inference, or production training. No supporting deployment evidence is exposed here; those capabilities remain unverified.</p>
            <div className="grid grid-cols-1 gap-2 mt-4 sm:grid-cols-3">
              {[["Model ownership", "Unverified"], ["Dedicated accelerator hardware", "Unverified"], ["Distributed inference", "Unverified"]].map(([label, status]) => <div key={label} className="rounded-lg border border-amber-400/10 bg-amber-400/[0.03] p-3"><p className="text-xs text-slate-300">{label}</p><p className="text-[10px] uppercase tracking-widest text-amber-300 mt-1">{status}</p></div>)}
            </div>
          </GlassCard>
          {quantum.data && <GlassCard glow="blue" animate>
            <div id="quantum-architecture" className="scroll-mt-4">
              <SectionHeader icon={Orbit} title="Quantum subsystem" color="blue" />
              <p className="text-[11px] text-slate-400 mt-1">Source: GET /api/quantum/metrics · simulated subsystem state, not physical quantum hardware telemetry</p>
              <div className="grid grid-cols-2 gap-3 mt-4 md:grid-cols-4">
                <MiniStat value={quantum.data.qubitCount ?? "—"} label="Simulated qubits · count" color="blue" />
                <MiniStat value={quantum.data.entanglementPairs ?? "—"} label="Simulated entangled pairs · count" color="violet" />
                <MiniStat value={quantum.data.activeBridges ?? "—"} label="Active bridge records · count" color="cyan" />
                <MiniStat value={quantum.data.dimensionalDepth ?? "—"} label="Configured dimensional depth" color="amber" />
              </div>
              <div className="mt-4 border-t border-white/[0.06] pt-3">
                <DataLine label="Quantum volume · model-derived" value={quantum.data.quantumVolume} />
                <DataLine label="Error rate · model-derived" value={quantum.data.errorRate} />
                <DataLine label="Gates applied · counter" value={quantum.data.gatesApplied} />
              </div>
              {quantum.data.gates?.length > 0 && <div className="mt-4"><p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Defined simulation gates</p><div className="grid grid-cols-2 gap-2">
                {quantum.data.gates.map((gate: Metrics) => <div key={gate.symbol} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><span className="font-mono text-sm text-violet-300">{gate.symbol}</span><p className="text-xs text-slate-200 mt-1">{gate.name}</p><p className="text-[10px] text-slate-500 mt-1">{gate.description}</p></div>)}
              </div></div>}
              {quantum.data.bridges?.length > 0 && <div className="mt-4"><p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Modeled bridges</p><div className="space-y-2">{quantum.data.bridges.slice(0, 5).map((bridge: Metrics) => <div key={bridge.id} className="flex items-center gap-2 rounded-lg border border-white/[0.05] p-2 text-xs"><span className={cn("w-2 h-2 rounded-full", bridge.active ? "bg-emerald-400" : "bg-slate-500")} /><span className="text-slate-300">Dimension {bridge.dimA} ↔ {bridge.dimB}</span><span className="ml-auto text-slate-500 font-mono">Fidelity field {bridge.fidelity}</span></div>)}</div></div>}
              <p className="text-[10px] text-slate-600 mt-4">Reported values describe software simulation/state. No external hardware source or observation timestamp is supplied.</p>
            </div>
          </GlassCard>}
        </div>
      </SectionErrorBoundary>}
    </div>
  </main>;
}
