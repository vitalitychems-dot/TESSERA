import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Radio, Shield, CheckCircle2, XCircle, Mic, MicOff, Volume2, VolumeX, Send, RefreshCw, Wifi, WifiOff, Lock, Unlock, Plus, Trash2, ExternalLink, AudioLines, Zap, Globe, Github, FlaskConical, Pill, Smartphone, MessageCircle, Play, History, AlertTriangle, Eye, Cpu, HardDrive, Target, Skull, Activity, ChevronRight, X, Server } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface BridgeProvider {
  name: string;
  type: string;
  model: string;
  color: string;
}

interface BridgeConversationMessage {
  speaker: string;
  content: string;
  timestamp: number;
}

interface BridgeConversationData {
  id?: string;
  participants: string[];
  topic: string;
  messages: BridgeConversationMessage[];
  status: string;
  improvementsExecuted: number;
  startedAt?: number;
}

interface InterceptionData {
  id: string;
  auditLogId: number;
  requestedBy: string;
  method: string;
  targetUrl: string;
  status: number | null;
  durationMs: number | null;
  flagReason: string | null;
  timestamp: number;
  severity: string;
  attackType: string;
  realDataProtected: boolean;
  satkoteDeployed: boolean;
  satkoteId: string | null;
}

interface SatkoteData {
  id: string;
  auditLogId: number;
  targetEndpoint: string | null;
  status: string;
  severity: string;
  attackType: string;
  requestedBy: string | null;
  flagReason: string | null;
  detectedAt: number;
  scrapedIntel: string[];
}

interface DefenseState {
  satkoteNodes: SatkoteData[];
  interceptions: InterceptionData[];
  fakeDataPoolSize: number;
  defenseCycles: number;
  lastScan: number;
  totalInterceptionsBlocked: number;
  totalRequestsMonitored: number;
}

const SPEAKER_COLORS: Record<string, string> = {
  Grok: "text-blue-400",
  DeepSeek: "text-green-400",
  Gemini: "text-amber-400",
  Tessera: "text-violet-400",
  "Kimi-K2": "text-rose-400",
  "Kimi-K2.5": "text-pink-400",
  "Claude-Sonnet": "text-orange-400",
  "GPT-4.1": "text-emerald-400",
  "Llama-405B": "text-indigo-400",
  "Nemotron": "text-lime-400",
  "Hermes-3": "text-cyan-400",
  "Qwen3": "text-fuchsia-400",
  "Mistral-Large": "text-teal-400",
  "Codestral": "text-sky-400",
  "Perplexity": "text-purple-400",
  "Phi-4": "text-slate-300",
  "Cohere": "text-yellow-400",
};

const SPEAKER_BG: Record<string, string> = {
  Grok: "bg-blue-500/10 border-blue-500/20",
  DeepSeek: "bg-green-500/10 border-green-500/20",
  Gemini: "bg-amber-500/10 border-amber-500/20",
  Tessera: "bg-violet-500/10 border-violet-500/20",
  "Kimi-K2": "bg-rose-500/10 border-rose-500/20",
  "Kimi-K2.5": "bg-pink-500/10 border-pink-500/20",
  "Claude-Sonnet": "bg-orange-500/10 border-orange-500/20",
  "GPT-4.1": "bg-emerald-500/10 border-emerald-500/20",
  "Llama-405B": "bg-indigo-500/10 border-indigo-500/20",
  "Nemotron": "bg-lime-500/10 border-lime-500/20",
  "Hermes-3": "bg-cyan-500/10 border-cyan-500/20",
  "Qwen3": "bg-fuchsia-500/10 border-fuchsia-500/20",
  "Mistral-Large": "bg-teal-500/10 border-teal-500/20",
  "Codestral": "bg-sky-500/10 border-sky-500/20",
  "Perplexity": "bg-purple-500/10 border-purple-500/20",
  "Phi-4": "bg-slate-500/10 border-slate-500/20",
  "Cohere": "bg-yellow-500/10 border-yellow-500/20",
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  violet: { bg: "bg-violet-500/15", border: "border-violet-500/40", text: "text-violet-400", glow: "shadow-[0_0_12px_rgba(139,92,246,0.3)]" },
  blue: { bg: "bg-blue-500/15", border: "border-blue-500/40", text: "text-blue-400", glow: "shadow-[0_0_12px_rgba(59,130,246,0.3)]" },
  green: { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-400", glow: "shadow-[0_0_12px_rgba(34,197,94,0.3)]" },
  amber: { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-400", glow: "shadow-[0_0_12px_rgba(245,158,11,0.3)]" },
  rose: { bg: "bg-rose-500/15", border: "border-rose-500/40", text: "text-rose-400", glow: "shadow-[0_0_12px_rgba(244,63,94,0.3)]" },
  pink: { bg: "bg-pink-500/15", border: "border-pink-500/40", text: "text-pink-400", glow: "shadow-[0_0_12px_rgba(236,72,153,0.3)]" },
  orange: { bg: "bg-orange-500/15", border: "border-orange-500/40", text: "text-orange-400", glow: "shadow-[0_0_12px_rgba(249,115,22,0.3)]" },
  emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-400", glow: "shadow-[0_0_12px_rgba(16,185,129,0.3)]" },
  indigo: { bg: "bg-indigo-500/15", border: "border-indigo-500/40", text: "text-indigo-400", glow: "shadow-[0_0_12px_rgba(99,102,241,0.3)]" },
  lime: { bg: "bg-lime-500/15", border: "border-lime-500/40", text: "text-lime-400", glow: "shadow-[0_0_12px_rgba(132,204,22,0.3)]" },
  cyan: { bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-400", glow: "shadow-[0_0_12px_rgba(6,182,212,0.3)]" },
  fuchsia: { bg: "bg-fuchsia-500/15", border: "border-fuchsia-500/40", text: "text-fuchsia-400", glow: "shadow-[0_0_12px_rgba(192,38,211,0.3)]" },
  teal: { bg: "bg-teal-500/15", border: "border-teal-500/40", text: "text-teal-400", glow: "shadow-[0_0_12px_rgba(20,184,166,0.3)]" },
  sky: { bg: "bg-sky-500/15", border: "border-sky-500/40", text: "text-sky-400", glow: "shadow-[0_0_12px_rgba(14,165,233,0.3)]" },
  purple: { bg: "bg-purple-500/15", border: "border-purple-500/40", text: "text-purple-400", glow: "shadow-[0_0_12px_rgba(168,85,247,0.3)]" },
  slate: { bg: "bg-slate-500/15", border: "border-slate-500/40", text: "text-slate-300", glow: "shadow-[0_0_12px_rgba(100,116,139,0.3)]" },
  yellow: { bg: "bg-yellow-500/15", border: "border-yellow-500/40", text: "text-yellow-400", glow: "shadow-[0_0_12px_rgba(234,179,8,0.3)]" },
};

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: "bg-red-500/15", border: "border-red-500/40", text: "text-red-400", dot: "bg-red-500" },
  high: { bg: "bg-orange-500/15", border: "border-orange-500/40", text: "text-orange-400", dot: "bg-orange-500" },
  medium: { bg: "bg-yellow-500/15", border: "border-yellow-500/40", text: "text-yellow-400", dot: "bg-yellow-500" },
  low: { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-400", dot: "bg-green-500" },
};


type ViewMode = "providers" | "attackers" | "attacker-detail";

export function CrossAppContent({ initialView = "providers", embedded = false }: { initialView?: ViewMode; embedded?: boolean }) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [selectedAttacker, setSelectedAttacker] = useState<string | null>(null);
  const convEndRef = useRef<HTMLDivElement>(null);

  const { data: providers } = useQuery<BridgeProvider[]>({
    queryKey: ["/api/bridge/providers"],
    refetchInterval: 300000,
  });

  const { data: liveConversation } = useQuery<BridgeConversationData>({
    queryKey: ["/api/bridge/conversation"],
    refetchInterval: 30000,
  });

  const { data: conversationHistory } = useQuery<BridgeConversationData[]>({
    queryKey: ["/api/bridge/conversation/history"],
    refetchInterval: 30000,
  });

  const { data: defenseState } = useQuery<DefenseState>({
    queryKey: ["/api/security/defense-state"],
    refetchInterval: 30000,
  });

  const { data: realThreats } = useQuery<{ stats: any; events: any[]; blockedIPs: string[] }>({
    queryKey: ["/api/security/real-threats"],
    refetchInterval: 30000,
  });

  const { data: attackerDetail, isError: attackerError } = useQuery<{ interception: InterceptionData; satkoteNode: SatkoteData | null }>({
    queryKey: [selectedAttacker ? `/api/security/attacker/${selectedAttacker}` : "/api/security/attacker/_"],
    enabled: !!selectedAttacker,
    refetchInterval: 30000,
  });

  const startConversationMutation = useMutation({
    mutationFn: async (topic?: string) => {
      const res = await apiRequest("POST", "/api/bridge/conversation/start", topic ? { topic } : {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bridge/conversation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bridge/conversation/history"] });
    },
  });

  useEffect(() => {
    convEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveConversation?.messages?.length]);

  const openAttackerDetail = (interceptionId: string) => {
    setSelectedAttacker(interceptionId);
    setViewMode("attacker-detail");
  };

  const activeSatkotes = defenseState?.satkoteNodes?.filter(n => n.status === "monitoring" || n.status === "active").length || 0;
  const criticalThreats = defenseState?.interceptions?.filter(i => i.severity === "critical").length || 0;
  const highThreats = defenseState?.interceptions?.filter(i => i.severity === "high").length || 0;

  return (
    <div className="flex h-full text-foreground overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden tessera-page backdrop-blur-md">
        {!embedded && (
          <div className="border-b border-white/[0.06] px-4 py-3" style={{ background: "rgba(6,4,16,0.45)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/" className="text-gray-500 hover:text-white transition-colors" data-testid="link-back-chat">
                  <ArrowLeft size={18} />
                </Link>
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <Radio size={18} className="text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }} data-testid="text-page-title">
                    Cross-App Bridge
                  </h1>
                  <p className="text-[11px] font-mono text-indigo-400 tracking-wider uppercase">
                    {providers?.length || 0} Providers • {defenseState?.totalInterceptionsBlocked || 0} Attacks Blocked • {activeSatkotes} Satkotes Active
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode("providers")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${viewMode === "providers" ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" : "bg-white/5 text-gray-400 border-white/10"}`}
                  data-testid="button-view-providers"
                >
                  <Cpu size={13} />
                  Providers
                </button>
                <button
                  onClick={() => setViewMode("attackers")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${viewMode === "attackers" ? "bg-red-500/20 text-red-300 border-red-500/40" : "bg-white/5 text-gray-400 border-white/10"}`}
                  data-testid="button-view-attackers"
                >
                  <Skull size={13} />
                  Attackers
                  {(defenseState?.interceptions?.length || 0) > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/30 text-red-300 text-[11px]">
                      {defenseState?.interceptions?.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {viewMode === "providers" && (
            <div className="h-full overflow-y-auto p-4 custom-scrollbar" style={{ background: "rgba(6,4,16,0.45)" }}>
              <div className="mb-4">
                <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-3" data-testid="text-providers-header">
                  Connected AI Providers ({providers?.length || 0})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {providers?.map((provider) => {
                    const colors = COLOR_MAP[provider.color] || COLOR_MAP.violet;
                    return (
                      <motion.button
                        key={provider.name}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { window.dispatchEvent(new CustomEvent('provider-select', { detail: provider })); }}
                        className={`relative p-4 rounded-xl border ${colors.bg} ${colors.border} ${colors.glow} cursor-pointer transition-all hover:brightness-125`}
                        data-testid={`card-provider-${provider.name}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-2 h-2 rounded-full ${provider.type === "puter-free" ? "bg-green-400" : provider.type === "internal" ? "bg-violet-400" : "bg-blue-400"} animate-pulse`} />
                          <span className={`text-[11px] font-mono uppercase tracking-wider ${colors.text}`}>
                            {provider.type === "puter-free" ? "FREE" : provider.type === "internal" ? "SOVEREIGN" : "API"}
                          </span>
                        </div>
                        <h3 className={`text-sm font-bold ${colors.text} truncate`}>{provider.name}</h3>
                        <p className="text-[11px] text-gray-500 font-mono truncate mt-1">{provider.model}</p>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={16} className="text-red-400" />
                    <span className="text-[11px] font-mono text-red-400 uppercase">Attacks Flagged</span>
                  </div>
                  <span className="text-2xl font-bold text-red-300" data-testid="text-attacks-blocked">{defenseState?.totalInterceptionsBlocked || 0}</span>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={16} className="text-purple-400" />
                    <span className="text-[11px] font-mono text-purple-400 uppercase">Counter-Intel Nodes</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-300" data-testid="text-satkotes-active">{activeSatkotes}</span>
                </div>
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-orange-400" />
                    <span className="text-[11px] font-mono text-orange-400 uppercase">Critical Threats</span>
                  </div>
                  <span className="text-2xl font-bold text-orange-300" data-testid="text-critical-threats">{criticalThreats}</span>
                </div>
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity size={16} className="text-yellow-400" />
                    <span className="text-[11px] font-mono text-yellow-400 uppercase">Requests Monitored</span>
                  </div>
                  <span className="text-2xl font-bold text-yellow-300" data-testid="text-requests-monitored">{defenseState?.totalRequestsMonitored || 0}</span>
                </div>
              </div>

              {defenseState?.interceptions && defenseState.interceptions.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-mono text-red-400 uppercase tracking-wider">
                      Recent Attackers — Click to View Reverse Engineering
                    </h2>
                    <button
                      onClick={() => setViewMode("attackers")}
                      className="text-[11px] font-mono text-red-400 hover:text-red-300 flex items-center gap-1"
                      data-testid="button-view-all-attackers"
                    >
                      View All <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {defenseState.interceptions.slice(-6).reverse().map((atk) => {
                      const sevColors = SEVERITY_COLORS[atk.severity] || SEVERITY_COLORS.low;
                      return (
                        <motion.button
                          key={atk.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => openAttackerDetail(atk.id)}
                          className={`p-4 rounded-xl border ${sevColors.bg} ${sevColors.border} text-left cursor-pointer transition-all hover:brightness-125`}
                          data-testid={`card-attacker-${atk.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${sevColors.dot} animate-pulse`} />
                              <span className={`text-[11px] font-mono uppercase font-bold ${sevColors.text}`}>{atk.severity}</span>
                            </div>
                            {atk.satkoteDeployed && (
                              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                SATKOTE
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <Skull size={14} className={sevColors.text} />
                            <span className="text-sm font-bold text-white truncate max-w-[180px]">{atk.attackType}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 font-mono truncate">{atk.targetUrl?.slice(0, 50)}</p>
                          <p className="text-[11px] text-gray-500 font-mono">{atk.method} • {atk.requestedBy?.slice(0, 20)}</p>
                          {atk.satkoteDeployed && (
                            <div className="mt-2 flex items-center gap-2">
                              <Eye size={10} className="text-purple-400" />
                              <span className="text-[11px] font-mono text-purple-400">Counter-intelligence active</span>
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {viewMode === "attackers" && (
            <div className="h-full overflow-y-auto p-4 custom-scrollbar" style={{ background: "rgba(6,4,16,0.45)" }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-mono text-red-400 uppercase tracking-wider" data-testid="text-attackers-header">
                    Live Threat Intelligence — Real Server Monitoring
                  </h2>
                  <p className="text-[11px] text-gray-500 font-mono mt-1">
                    Real attack data from Tesseract's own server. Every event below is an actual threat detected in live traffic.
                  </p>
                </div>
                <span className="text-[11px] font-mono px-2 py-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 animate-pulse">● LIVE</span>
              </div>

              {/* Real Threat Stats Panel */}
              <div className="mb-4 p-3 rounded-xl bg-red-500/8 border border-red-500/25" data-testid="real-threat-stats">
                <div className="text-[11px] font-mono text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
                  Real Intrusion Detection System — {(realThreats?.stats?.requestsMonitored || 0).toLocaleString()} requests monitored
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Total Threats", value: realThreats?.stats?.totalInterceptions || 0, color: "text-red-400" },
                    { label: "IPs Blocked", value: realThreats?.stats?.blockedCount || 0, color: "text-orange-400" },
                    { label: "Domain Probes", value: realThreats?.stats?.unauthorizedDomainAttempts || 0, color: "text-amber-400" },
                    { label: "SQLi Attempts", value: realThreats?.stats?.sqlInjectionAttempts || 0, color: "text-yellow-400" },
                  ].map(s => (
                    <div key={s.label} className="bg-black/30 rounded-lg p-2">
                      <div className={`text-lg font-bold font-mono ${s.color}`} data-testid={`stat-${s.label.toLowerCase().replace(/\s/g,"-")}`}>{s.value}</div>
                      <div className="text-[11px] text-gray-500">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  {[
                    { label: "XSS Attempts", value: realThreats?.stats?.xssAttempts || 0, color: "text-rose-400" },
                    { label: "Scanner Bots", value: realThreats?.stats?.scannerBots || 0, color: "text-violet-400" },
                    { label: "Dir Traversal", value: realThreats?.stats?.dirTraversalAttempts || 0, color: "text-cyan-400" },
                  ].map(s => (
                    <div key={s.label} className="bg-black/30 rounded-lg p-1.5">
                      <div className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</div>
                      <div className="text-[11px] text-gray-500">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real Threat Events Feed */}
              {realThreats?.events && realThreats.events.length > 0 && (
                <div className="mb-4">
                  <div className="text-[11px] font-mono text-red-400 uppercase tracking-wider mb-2">
                    ● Live Threat Events ({realThreats.events.length} detected)
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                    {realThreats.events.slice(0, 30).map((evt: any) => (
                      <div key={evt.id} className={`flex items-start gap-2 p-2 rounded-lg border text-[11px] font-mono ${
                        evt.severity === "CRITICAL" ? "bg-red-500/10 border-red-500/30" :
                        evt.severity === "HIGH" ? "bg-orange-500/10 border-orange-500/25" :
                        evt.severity === "MEDIUM" ? "bg-amber-500/10 border-amber-500/20" :
                        "bg-gray-500/10 border-gray-500/15"
                      }`} data-testid={`threat-event-${evt.id}`}>
                        <span className={`px-1 py-0.5 rounded text-[11px] font-bold flex-shrink-0 ${
                          evt.severity === "CRITICAL" ? "bg-red-500/30 text-red-300" :
                          evt.severity === "HIGH" ? "bg-orange-500/30 text-orange-300" :
                          evt.severity === "MEDIUM" ? "bg-amber-500/30 text-amber-300" :
                          "bg-gray-500/30 text-gray-400"
                        }`}>{evt.severity}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-red-300 font-bold">{evt.attackType?.replace(/-/g, " ").toUpperCase()}</span>
                            <span className="text-gray-500">{evt.method}</span>
                            <span className="text-gray-400 truncate max-w-[120px]">{evt.path}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-yellow-400">{evt.sourceIP || evt.ip}</span>
                            {(evt.country || evt.city) && <span className="text-gray-500">{[evt.city, evt.country].filter(Boolean).join(", ")}</span>}
                            {evt.isp && <span className="text-gray-600 truncate max-w-[100px]">{evt.isp}</span>}
                            <span className={`ml-auto px-1 py-0.5 rounded text-[11px] ${evt.status === "BLOCKED" ? "text-red-300 bg-red-500/20" : "text-green-300 bg-green-500/10"}`}>{evt.status}</span>
                          </div>
                        </div>
                        <span className="text-gray-600 flex-shrink-0 text-[11px]">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {realThreats?.events?.length === 0 && (
                <div className="mb-4 p-3 rounded-xl bg-green-500/5 border border-green-500/15 text-center">
                  <div className="text-[11px] font-mono text-green-400">● No threats detected yet — server is clean</div>
                  <div className="text-[11px] text-gray-500 mt-1">System is monitoring {(realThreats?.stats?.requestsMonitored || 0).toLocaleString()} requests for attack patterns</div>
                </div>
              )}

              {/* Divider for SATKOTE simulation section */}
              <div className="border-t border-white/5 pt-3 mb-3">
                <div className="text-[11px] font-mono text-purple-400 uppercase tracking-wider mb-2 opacity-60">
                  Sovereign Mesh Simulation (SATKOTE)
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-mono text-red-400 uppercase tracking-wider" data-testid="text-attackers-header-satkote">
                    Counter-Intelligence Operations
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] font-mono text-gray-500 block">Critical Threats</span>
                    <span className="text-lg font-bold text-red-300" data-testid="text-total-critical">{criticalThreats}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono text-gray-500 block">High Threats</span>
                    <span className="text-lg font-bold text-orange-300" data-testid="text-total-high">{highThreats}</span>
                  </div>
                </div>
              </div>

              {defenseState?.satkoteNodes && defenseState.satkoteNodes.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-[11px] font-mono text-purple-400 uppercase tracking-wider mb-3">
                    Counter-Intel Nodes ({defenseState.satkoteNodes.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {defenseState.satkoteNodes.map((node) => {
                      const sevColors = SEVERITY_COLORS[node.severity] || SEVERITY_COLORS.low;
                      return (
                        <motion.div
                          key={node.id}
                          whileHover={{ scale: 1.01 }}
                          className="p-4 rounded-xl bg-purple-500/8 border border-purple-500/25 cursor-pointer"
                          onClick={() => {
                            const relatedInt = defenseState.interceptions?.find(i => i.satkoteId === node.id);
                            if (relatedInt) openAttackerDetail(relatedInt.id);
                          }}
                          data-testid={`card-satkote-${node.id}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Server size={14} className="text-purple-400" />
                              <span className="text-xs font-mono font-bold text-purple-300">{node.id}</span>
                            </div>
                            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full text-white uppercase ${sevColors.dot} bg-opacity-80`}>{node.severity}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] text-gray-400 font-mono">{node.attackType}</span>
                            <span className="text-[11px] text-gray-600">•</span>
                            <span className="text-[11px] text-gray-400 font-mono">{node.targetEndpoint?.slice(0, 40)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono font-bold text-white" data-testid={`text-node-status-${node.id}`}>{node.status.toUpperCase()}</span>
                            <span className="text-[11px] text-gray-500 font-mono">{new Date(node.detectedAt).toLocaleTimeString()}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              <h3 className="text-[11px] font-mono text-red-400 uppercase tracking-wider mb-3">
                All Interceptions ({defenseState?.interceptions?.length || 0})
              </h3>
              <div className="space-y-2">
                {defenseState?.interceptions?.slice().reverse().map((atk) => {
                  const sevColors = SEVERITY_COLORS[atk.severity] || SEVERITY_COLORS.low;
                  return (
                    <motion.button
                      key={atk.id}
                      whileHover={{ scale: 1.005 }}
                      onClick={() => openAttackerDetail(atk.id)}
                      className={`w-full p-3 rounded-xl border ${sevColors.bg} ${sevColors.border} text-left cursor-pointer transition-all hover:brightness-125 flex items-center gap-4`}
                      data-testid={`card-interception-${atk.id}`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${sevColors.dot} shrink-0 ${atk.severity === "critical" ? "animate-pulse" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate max-w-[120px]">{atk.attackType}</span>
                          <span className={`text-[11px] font-mono uppercase font-bold ${sevColors.text}`}>{atk.severity}</span>
                          <span className="text-[11px] font-mono text-gray-500">{atk.method}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-gray-400 font-mono truncate max-w-[150px]">{atk.targetUrl?.slice(0, 50)}</span>
                          <span className="text-[11px] text-gray-600">•</span>
                          <span className="text-[11px] text-gray-500 font-mono">{new Date(atk.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {atk.satkoteDeployed && (
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">SATKOTE</span>
                        )}
                        <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${atk.severity === "critical" ? "bg-red-500/20 text-red-300" : atk.severity === "high" ? "bg-orange-500/20 text-orange-300" : "bg-blue-500/20 text-blue-300"}`}>
                          {atk.severity.toUpperCase()}
                        </span>
                        <ChevronRight size={14} className="text-gray-600" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "attacker-detail" && (
            <div className="h-full overflow-y-auto p-4 custom-scrollbar" style={{ background: "rgba(6,4,16,0.45)" }}>
              <button
                onClick={() => { setSelectedAttacker(null); setViewMode("attackers"); }}
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors"
                data-testid="button-back-attackers"
              >
                <ArrowLeft size={16} />
                Back to Attackers
              </button>

              {attackerDetail?.interception ? (
                <div className="space-y-4">
                  <div className={`p-5 rounded-xl border ${SEVERITY_COLORS[attackerDetail.interception.severity]?.bg || "bg-red-500/10"} ${SEVERITY_COLORS[attackerDetail.interception.severity]?.border || "border-red-500/20"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Skull size={24} className={SEVERITY_COLORS[attackerDetail.interception.severity]?.text || "text-red-400"} />
                        <div>
                          <h2 className="text-xl font-bold text-white" data-testid="text-attacker-ip">{attackerDetail.interception.attackType}</h2>
                          <p className="text-sm text-gray-400 font-mono truncate max-w-[300px]">{attackerDetail.interception.targetUrl}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-mono uppercase font-bold ${SEVERITY_COLORS[attackerDetail.interception.severity]?.text}`}>
                          {attackerDetail.interception.severity} THREAT
                        </span>
                        <p className="text-[11px] text-gray-500 font-mono mt-1">{attackerDetail.interception.id}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <div className="p-3 rounded-lg bg-black/20">
                        <span className="text-[11px] font-mono text-gray-500 uppercase block">HTTP Method</span>
                        <span className="text-sm font-bold text-white">{attackerDetail.interception.method || "unknown"}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-black/20">
                        <span className="text-[11px] font-mono text-gray-500 uppercase block">HTTP Status</span>
                        <span className="text-sm font-bold text-white">{attackerDetail.interception.status ?? "blocked"}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-black/20">
                        <span className="text-[11px] font-mono text-gray-500 uppercase block">Requester</span>
                        <span className="text-[11px] font-bold text-white truncate block">{attackerDetail.interception.requestedBy || "unknown"}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-black/20">
                        <span className="text-[11px] font-mono text-gray-500 uppercase block">Duration</span>
                        <span className="text-sm font-bold text-white">{attackerDetail.interception.durationMs != null ? `${attackerDetail.interception.durationMs}ms` : "N/A"}</span>
                      </div>
                    </div>

                    {attackerDetail.interception.flagReason && (
                      <div className="mt-4">
                        <span className="text-[11px] font-mono text-gray-500 uppercase">Flag Reason (from audit log)</span>
                        <div className="mt-2">
                          <span className="text-[11px] font-mono px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {attackerDetail.interception.flagReason}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {attackerDetail.satkoteNode && (
                    <div className="p-5 rounded-xl bg-purple-500/10 border border-purple-500/30">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Target size={22} className="text-purple-400" />
                          <div>
                            <h3 className="text-lg font-bold text-purple-300" data-testid="text-satkote-id">{attackerDetail.satkoteNode.id}</h3>
                            <p className="text-[11px] text-gray-400 font-mono">Counter-Intelligence Node — Monitoring Active Threat</p>
                          </div>
                        </div>
                        <span className="text-sm font-mono px-3 py-1 rounded-full text-white bg-purple-500">
                          {attackerDetail.satkoteNode.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                        <div className="p-3 rounded-lg bg-black/20">
                          <span className="text-[11px] font-mono text-gray-500 uppercase block">Severity</span>
                          <span className="text-sm font-bold text-orange-300 uppercase">{attackerDetail.satkoteNode.severity}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-black/20">
                          <span className="text-[11px] font-mono text-gray-500 uppercase block">Attack Type</span>
                          <span className="text-sm font-bold text-red-300">{attackerDetail.satkoteNode.attackType}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-black/20">
                          <span className="text-[11px] font-mono text-gray-500 uppercase block">Detected</span>
                          <span className="text-sm font-bold text-cyan-300">{new Date(attackerDetail.satkoteNode.detectedAt).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      {attackerDetail.satkoteNode.scrapedIntel.length > 0 && (
                        <div className="mb-4">
                          <span className="text-[11px] font-mono text-gray-500 uppercase">Intelligence Gathered from Audit Log</span>
                          <div className="mt-2 space-y-1">
                            {attackerDetail.satkoteNode.scrapedIntel.map((intel, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/8 border border-cyan-500/15">
                                <CheckCircle2 size={10} className="text-cyan-400 shrink-0" />
                                <span className="text-[11px] font-mono text-cyan-300">{intel}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!attackerDetail.satkoteNode && (
                    <div className="p-5 rounded-xl bg-gray-500/10 border border-gray-500/20 text-center">
                      <Shield size={32} className="text-gray-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-400 font-mono">No Satkote node deployed for this attacker</p>
                      <p className="text-[11px] text-gray-600 mt-1">Satkote auto-deploys for CRITICAL and HIGH severity threats only</p>
                    </div>
                  )}
                </div>
              ) : attackerError ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <AlertTriangle size={24} className="text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-red-400 font-mono">Failed to load attacker details</p>
                    <button
                      onClick={() => { setSelectedAttacker(null); setViewMode("attackers"); }}
                      className="mt-3 px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-sm border border-white/10"
                      data-testid="button-error-back"
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <RefreshCw size={24} className="text-gray-500 mx-auto mb-2 animate-spin" />
                    <p className="text-sm text-gray-500 font-mono">Loading attacker details...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CrossAppBridgePage({ embedded }: { embedded?: boolean }) {
  useEffect(() => { document.title = "Cross-App Bridge | Tessera"; }, []);
  if (embedded) return <CrossAppContent />;
  return (
    <div className="flex h-full overflow-hidden">
      
      <CrossAppContent />
    </div>
  );
}
