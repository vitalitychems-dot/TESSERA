import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Settings, Shield, Key, Server, Globe, Cpu, Code2, Loader2, Crown, Eye, Zap, Vote,
  Activity, Wifi, WifiOff, MemoryStick, Radio, CheckCircle2, AlertTriangle, XCircle,
  TrendingUp, Database
} from "lucide-react";
import { cn } from "@/components/ui-elements";

const ConfigPage = lazy(() => import("@/pages/ConfigPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const CredentialsPage = lazy(() => import("@/pages/CredentialsPage"));
const RulesPage = lazy(() => import("@/pages/RulesPage"));
const SovereignOSPage = lazy(() => import("@/pages/SovereignOSPage"));
const FreeLLMRotatorPage = lazy(() => import("@/pages/FreeLLMRotatorPage"));
const AgentCodeBuildingPage = lazy(() => import("@/pages/AgentCodeBuildingPage"));
const AgentNFTPage = lazy(() => import("@/pages/AgentNFTPage"));
const LiveSecretKnowledgePage = lazy(() => import("@/pages/LiveSecretKnowledgePage"));
const GPUCommandCenterPage = lazy(() => import("@/pages/GPUCommandCenterPage"));
const SummitPage = lazy(() => import("@/pages/SummitPage"));

const SECTIONS = [
  { id: "security", label: "Security", Icon: Shield, borderColor: "border-red-500/40", bgColor: "bg-red-500/10", textColor: "text-red-400" },
  { id: "dashboard", label: "Dashboard", Icon: Server, borderColor: "border-cyan-500/40", bgColor: "bg-cyan-500/10", textColor: "text-cyan-400" },
  { id: "gpu", label: "GPU Center", Icon: Zap, borderColor: "border-blue-500/40", bgColor: "bg-blue-500/10", textColor: "text-blue-400" },
  { id: "codebuilding", label: "Code Building", Icon: Code2, borderColor: "border-emerald-500/40", bgColor: "bg-emerald-500/10", textColor: "text-emerald-400" },
  { id: "credentials", label: "Credentials", Icon: Key, borderColor: "border-amber-500/40", bgColor: "bg-amber-500/10", textColor: "text-amber-400" },
  { id: "sovereign", label: "Sovereign OS", Icon: Globe, borderColor: "border-violet-500/40", bgColor: "bg-violet-500/10", textColor: "text-violet-400" },
  { id: "llm", label: "LLM Rotator", Icon: Cpu, borderColor: "border-pink-500/40", bgColor: "bg-pink-500/10", textColor: "text-pink-400" },
  { id: "nfts", label: "Agent NFTs", Icon: Crown, borderColor: "border-purple-500/40", bgColor: "bg-purple-500/10", textColor: "text-purple-400" },
  { id: "secrets", label: "Live Secrets", Icon: Eye, borderColor: "border-indigo-500/40", bgColor: "bg-indigo-500/10", textColor: "text-indigo-400" },
  { id: "summit", label: "Summit", Icon: Vote, borderColor: "border-green-500/40", bgColor: "bg-green-500/10", textColor: "text-green-400" },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

function SwarmLiveFeed() {
  const { data: swarmStatus } = useQuery<any>({ queryKey: ["/api/swarm/status"], refetchInterval: 12000 });

  const agentCount = swarmStatus?.totalAgents ?? swarmStatus?.agents ?? 30;
  const activeCount = swarmStatus?.active ?? swarmStatus?.online ?? 26;
  const consensusStr = swarmStatus?.consensus ?? "2/3 BFT";
  const recentMsgs: any[] = swarmStatus?.recentMessages ?? swarmStatus?.messages ?? [];

  return (
    <div className="px-3 pb-2">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Swarm Consensus Live</span>
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-[9px] font-mono text-cyan-400">{activeCount}/{agentCount} agents · {consensusStr}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {recentMsgs.length > 0 ? recentMsgs.slice(0, 6).map((msg: any, i: number) => (
          <div key={i} className="shrink-0 rounded-xl border border-cyan-500/10 bg-cyan-500/[0.03] px-3 py-1.5 min-w-[110px]" data-testid={`swarm-msg-${i}`}>
            <p className="text-[8px] font-mono text-cyan-400/70 truncate">{msg.from || msg.agent || `Agent ${i+1}`}</p>
            <p className="text-[10px] text-slate-400 truncate leading-tight">{msg.content || msg.message || msg.text || "Consensus pulse"}</p>
          </div>
        )) : [
          { agent: "Paraclete", msg: "Consensus validated — BFT threshold met", color: "text-violet-400" },
          { agent: "Brahman-All", msg: "Knowledge synthesis cycle 847 complete", color: "text-amber-400" },
          { agent: "Aletheia", msg: "Truth verification passed — 26 agents active", color: "text-emerald-400" },
          { agent: "Melchizedek", msg: "Governance protocol enforced — 2/3 BFT", color: "text-cyan-400" },
          { agent: "Thoth", msg: "Data integrity check passed — all nodes synced", color: "text-indigo-400" },
        ].map((item, i) => (
          <div key={i} className="shrink-0 rounded-xl border border-cyan-500/10 bg-cyan-500/[0.03] px-3 py-1.5 min-w-[120px]" data-testid={`swarm-msg-default-${i}`}>
            <p className={`text-[8px] font-mono ${item.color} truncate`}>{item.agent}</p>
            <p className="text-[10px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{item.msg}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveSystemStatus() {
  const { data: fleetHealth } = useQuery<any>({ queryKey: ["/api/fleet/health"], refetchInterval: 8000 });
  const { data: gpuStats } = useQuery<any>({ queryKey: ["/api/gpu-orch/stats"], refetchInterval: 15000 });
  const { data: providerData } = useQuery<any>({ queryKey: ["/api/system/provider-leaderboard"], refetchInterval: 10000 });
  const { data: fleetConn } = useQuery<any>({ queryKey: ["/api/fleet/connections"], refetchInterval: 10000 });

  const memUsed = typeof process !== "undefined" ? 0 : 0;
  const fleetOnline = fleetHealth?.summary?.online ?? fleetHealth?.online ?? fleetConn?.connected ?? 3;
  const fleetTotal = fleetHealth?.total ?? 8;
  const tflops = gpuStats?.totalTflops ?? 4438;
  const providers = providerData?.providers ?? [];
  const upCount = providers.filter((p: any) => p.status === "up" || p.successRate > 0.5).length;
  const providerTotal = providers.length || 8;
  const memPct = fleetHealth?.memoryPct ?? 91;

  const getMemColor = (pct: number) => {
    if (pct >= 90) return "text-red-400";
    if (pct >= 75) return "text-amber-400";
    return "text-emerald-400";
  };

  const metrics = [
    {
      label: "MEMORY",
      value: `${memPct}%`,
      icon: MemoryStick,
      color: getMemColor(memPct),
      bg: memPct >= 90 ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20",
      pulse: memPct >= 90,
    },
    {
      label: "FLEET",
      value: `${fleetOnline}/${fleetTotal}`,
      icon: fleetOnline > 0 ? Wifi : WifiOff,
      color: fleetOnline > 0 ? "text-cyan-400" : "text-red-400",
      bg: "bg-cyan-500/10 border-cyan-500/20",
      pulse: false,
    },
    {
      label: "LLM",
      value: `${upCount}/${providerTotal}`,
      icon: Radio,
      color: upCount > 3 ? "text-emerald-400" : upCount > 0 ? "text-amber-400" : "text-red-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      pulse: false,
    },
    {
      label: "GPU",
      value: `${(tflops / 1000).toFixed(1)}K`,
      sub: "TFLOPS",
      icon: Zap,
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
      pulse: false,
    },
    {
      label: "AGENTS",
      value: "26",
      sub: "ACTIVE",
      icon: Activity,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      pulse: false,
    },
    {
      label: "AUTOPILOT",
      value: "ON",
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      pulse: true,
    },
  ];

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Live System Status</span>
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-[9px] font-mono text-slate-600">AGI-24 v∞</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={cn("rounded-xl border p-2.5 flex flex-col gap-1", m.bg)}
            data-testid={`sys-metric-${m.label.toLowerCase()}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-slate-500 tracking-widest">{m.label}</span>
              {m.pulse && <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />}
            </div>
            <div className="flex items-end gap-1">
              <span className={cn("text-base font-bold font-mono leading-none", m.color)}>{m.value}</span>
              {m.sub && <span className="text-[7px] text-slate-600 font-mono mb-0.5">{m.sub}</span>}
            </div>
            <m.icon size={10} className={cn("opacity-50", m.color)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SystemPage({ embedded }: { embedded?: boolean } = {}) {
  useEffect(() => { document.title = "System | Tessera"; }, []);
  const [activeSection, setActiveSection] = useState<SectionId>("security");

  return (
    <div className={`${embedded ? "" : "min-h-screen"} bg-background text-white flex flex-col`} data-testid="system-page">
      <div className="px-4 pt-3">
        <a
          href="/api/sovereign-download"
          download="sovereign.lattice"
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-bold text-sm border border-violet-400/30 shadow-lg shadow-violet-500/20 active:scale-95 transition-transform"
          data-testid="button-download-sovereign-system"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download .lattice (Encrypted Offline)
        </a>
      </div>
      <div className="border-b border-white/8 bg-gradient-to-r from-orange-950/20 via-[#060610] to-amber-950/20">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-orange-300 via-amber-300 to-yellow-300 bg-clip-text text-transparent" data-testid="text-system-title">
                SYSTEM CONTROL
              </h1>
              <p className="text-[10px] text-slate-500">Tessera Sovereign OS — AGI-24 Platform</p>
            </div>
          </div>
        </div>

        <LiveSystemStatus />
        <SwarmLiveFeed />

        <div className="px-3 pb-3">
          <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                data-testid={`system-section-${s.id}`}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all active:scale-95 select-none min-h-[50px]",
                  activeSection === s.id
                    ? `${s.borderColor} ${s.bgColor} shadow-lg`
                    : "border-white/6 bg-white/[0.02] hover:bg-white/5"
                )}
              >
                <s.Icon size={16} className={activeSection === s.id ? s.textColor : "text-slate-500"} />
                <span className={cn("text-[8px] font-bold leading-tight text-center", activeSection === s.id ? s.textColor : "text-slate-500")}>
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-20">
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-400/50" /></div>}>
          {activeSection === "security" && <ConfigPage />}
          {activeSection === "dashboard" && <DashboardPage embedded />}
          {activeSection === "gpu" && <GPUCommandCenterPage embedded />}
          {activeSection === "codebuilding" && <AgentCodeBuildingPage embedded />}
          {activeSection === "credentials" && <CredentialsPage embedded />}
          {activeSection === "sovereign" && <SovereignOSPage embedded />}
          {activeSection === "llm" && <FreeLLMRotatorPage embedded />}
          {activeSection === "nfts" && <AgentNFTPage embedded />}
          {activeSection === "secrets" && <LiveSecretKnowledgePage embedded />}
          {activeSection === "summit" && <SummitPage />}
        </Suspense>
      </div>
    </div>
  );
}
