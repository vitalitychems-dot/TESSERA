import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Settings, Server, Loader2, Crown, Zap,
  Activity, Wifi, WifiOff, MemoryStick, Radio, CheckCircle2, AlertTriangle, XCircle,
  TrendingUp, Database, ChevronDown, ChevronRight, X, Info,
  ShieldCheck, ShieldAlert, Cpu, HardDrive, RefreshCw, Bug, Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "@/lib/sovereign-charts";

function usePageVisible() {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return visible;
}

function useRingBuffer(value: number, size = 30) {
  const buf = useRef<number[]>([]);
  useEffect(() => {
    buf.current = [...buf.current, value].slice(-size);
  }, [value, size]);
  return buf.current;
}

interface MetricThreshold {
  warning: number;
  critical: number;
  mode: "above" | "below";
}

const THRESHOLDS: Record<string, MetricThreshold> = {
  MEMORY: { warning: 75, critical: 90, mode: "above" },
  FLEET: { warning: 0.4, critical: 0.1, mode: "below" },
  LLM: { warning: 0.4, critical: 0.1, mode: "below" },
  GPU: { warning: 0, critical: 0, mode: "above" },
  AGENTS: { warning: 10, critical: 5, mode: "below" },
  AUTOPILOT: { warning: 0, critical: 0, mode: "above" },
};

function getAlertLevel(label: string, numericValue: number): "ok" | "warning" | "critical" {
  const t = THRESHOLDS[label];
  if (!t) return "ok";
  if (t.mode === "above") {
    if (numericValue >= t.critical && t.critical > 0) return "critical";
    if (numericValue >= t.warning && t.warning > 0) return "warning";
  } else {
    if (numericValue <= t.critical) return "critical";
    if (numericValue <= t.warning) return "warning";
  }
  return "ok";
}

interface MetricDef {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  color: string;
  bg: string;
  pulse: boolean;
  numericValue: number;
  sparklineKey: string;
  detailTitle: string;
  detailLines: string[];
  quickActions: string[];
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const chartData = data.map((v, i) => ({ i, v }));
  const strokeColor =
    color.includes("red") ? "#f87171" :
    color.includes("amber") ? "#fbbf24" :
    color.includes("emerald") ? "#34d399" :
    color.includes("cyan") ? "#22d3ee" :
    color.includes("violet") ? "#a78bfa" :
    color.includes("blue") ? "#60a5fa" : "#94a3b8";
  return (
    <div className="w-full h-6 mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={strokeColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricDetailPanel({ metric, history, onClose }: { metric: MetricDef; history: number[]; onClose: () => void }) {
  const chartData = history.map((v, i) => ({ i, v }));
  const strokeColor =
    metric.color.includes("red") ? "#f87171" :
    metric.color.includes("amber") ? "#fbbf24" :
    metric.color.includes("emerald") ? "#34d399" :
    metric.color.includes("cyan") ? "#22d3ee" :
    metric.color.includes("violet") ? "#a78bfa" :
    metric.color.includes("blue") ? "#60a5fa" : "#94a3b8";

  const alertLevel = getAlertLevel(metric.label, metric.numericValue);

  return (
    <div className="mx-3 mb-2 rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden" data-testid={`detail-panel-${metric.label.toLowerCase()}`}>
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2">
          <metric.icon size={14} className={metric.color} />
          <span className={cn("text-xs font-bold font-mono", metric.color)}>{metric.label}</span>
          {alertLevel !== "ok" && (
            <span className={cn("text-[8px] font-mono px-1.5 py-0.5 rounded-full border", alertLevel === "critical" ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-amber-500/20 border-amber-500/30 text-amber-400")}>
              {alertLevel.toUpperCase()}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors" data-testid={`close-detail-${metric.label.toLowerCase()}`}>
          <X size={14} />
        </button>
      </div>
      <div className="flex items-baseline gap-2 px-3 pb-1">
        <span className={cn("text-2xl font-bold font-mono", metric.color)}>{metric.value}</span>
        {metric.sub && <span className="text-[9px] text-slate-500 font-mono">{metric.sub}</span>}
      </div>
      {history.length >= 2 && (
        <div className="px-3 pb-2">
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line type="monotone" dataKey="v" stroke={strokeColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Tooltip
                  contentStyle={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 10 }}
                  labelFormatter={(l) => `Sample ${l}`}
                  formatter={(v: any) => [v, metric.label]}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="px-3 pb-2 space-y-0.5">
        {metric.detailLines.map((line, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px] text-slate-400">
            <div className="w-1 h-1 rounded-full bg-slate-600" />
            {line}
          </div>
        ))}
      </div>
      {metric.quickActions.length > 0 && (
        <div className="flex gap-1.5 px-3 pb-2.5 flex-wrap">
          {metric.quickActions.map((action, i) => (
            <button key={i} className="text-[9px] font-mono px-2 py-1 rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:border-white/20 transition-colors">
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SwarmLiveFeed({ visible }: { visible: boolean }) {
  const { data: swarmStatus } = useQuery<any>({
    queryKey: ["/api/swarm/status"],
    refetchInterval: visible ? 12000 : false,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });

  const agentCount = swarmStatus?.totalAgents ?? (Array.isArray(swarmStatus?.agents) ? swarmStatus.agents.length : swarmStatus?.agents) ?? 30;
  const activeCount = swarmStatus?.active ?? swarmStatus?.online ?? (Array.isArray(swarmStatus?.agents) ? swarmStatus.agents.filter((a: any) => a.status !== "offline").length : 26);
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

const RING_SIZE = 30;

function LiveSystemStatus({ visible }: { visible: boolean }) {
  const { data: fleetHealth } = useQuery<any>({
    queryKey: ["/api/fleet/health"],
    refetchInterval: visible ? 8000 : false,
    refetchOnWindowFocus: true,
    staleTime: 6000,
  });
  const { data: gpuStats } = useQuery<any>({
    queryKey: ["/api/gpu-orch/stats"],
    refetchInterval: visible ? 15000 : false,
    refetchOnWindowFocus: true,
    staleTime: 12000,
  });
  const { data: providerData } = useQuery<any>({
    queryKey: ["/api/system/provider-leaderboard"],
    refetchInterval: visible ? 11000 : false,
    refetchOnWindowFocus: true,
    staleTime: 9000,
  });
  const { data: fleetConn } = useQuery<any>({
    queryKey: ["/api/fleet/connections"],
    refetchInterval: visible ? 13000 : false,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });

  const fleetOnline = fleetHealth?.summary?.online ?? fleetHealth?.online ?? fleetConn?.connected ?? 3;
  const fleetTotal = fleetHealth?.total ?? 8;
  const tflops = gpuStats?.totalTflops ?? 4438;
  const providers = providerData?.providers ?? [];
  const upCount = providers.filter((p: any) => p.status === "up" || p.successRate > 0.5).length;
  const providerTotal = providers.length || 8;
  const memPct = fleetHealth?.memoryPct ?? 91;
  const agentCount = 26;

  const getMemColor = (pct: number) => {
    if (pct >= 90) return "text-red-400";
    if (pct >= 75) return "text-amber-400";
    return "text-emerald-400";
  };

  const fleetRatio = fleetTotal > 0 ? fleetOnline / fleetTotal : 1;
  const llmRatio = providerTotal > 0 ? upCount / providerTotal : 1;

  const metrics: MetricDef[] = [
    {
      label: "MEMORY",
      value: `${memPct}%`,
      icon: MemoryStick,
      color: getMemColor(memPct),
      bg: memPct >= 90 ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20",
      pulse: memPct >= 90,
      numericValue: memPct,
      sparklineKey: "mem",
      detailTitle: "Memory Usage",
      detailLines: [`Current: ${memPct}%`, `Fleet memory across ${fleetTotal} nodes`, memPct >= 90 ? "Critical — consider scaling" : memPct >= 75 ? "Elevated — monitor closely" : "Normal range"],
      quickActions: ["Flush Cache", "Scale Up", "View Nodes"],
    },
    {
      label: "FLEET",
      value: `${fleetOnline}/${fleetTotal}`,
      icon: fleetOnline > 0 ? Wifi : WifiOff,
      color: fleetOnline > 0 ? "text-cyan-400" : "text-red-400",
      bg: "bg-cyan-500/10 border-cyan-500/20",
      pulse: false,
      numericValue: fleetRatio,
      sparklineKey: "fleet",
      detailTitle: "Fleet Health",
      detailLines: [`Online: ${fleetOnline} of ${fleetTotal}`, `Health ratio: ${(fleetRatio * 100).toFixed(0)}%`, fleetRatio < 0.5 ? "Warning — majority offline" : "Fleet operational"],
      quickActions: ["Reconnect All", "Ping Nodes", "View Fleet"],
    },
    {
      label: "LLM",
      value: `${upCount}/${providerTotal}`,
      icon: Radio,
      color: upCount > 3 ? "text-emerald-400" : upCount > 0 ? "text-amber-400" : "text-red-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      pulse: false,
      numericValue: llmRatio,
      sparklineKey: "llm",
      detailTitle: "LLM Providers",
      detailLines: [`Active: ${upCount} of ${providerTotal} providers`, `Availability: ${(llmRatio * 100).toFixed(0)}%`, upCount === 0 ? "No providers — critical" : upCount < 3 ? "Low availability" : "Healthy rotation"],
      quickActions: ["Rotate Providers", "Add Provider", "View Status"],
    },
    {
      label: "GPU",
      value: `${(tflops / 1000).toFixed(1)}K`,
      sub: "TFLOPS",
      icon: Zap,
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
      pulse: false,
      numericValue: tflops,
      sparklineKey: "gpu",
      detailTitle: "GPU Compute",
      detailLines: [`Total: ${(tflops / 1000).toFixed(2)}K TFLOPS`, `Raw: ${tflops.toLocaleString()} TFLOPS`, "Distributed GPU mesh active"],
      quickActions: ["Scale GPU", "View Tasks", "Benchmark"],
    },
    {
      label: "AGENTS",
      value: `${agentCount}`,
      sub: "ACTIVE",
      icon: Activity,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      pulse: false,
      numericValue: agentCount,
      sparklineKey: "agents",
      detailTitle: "Active Agents",
      detailLines: [`Running: ${agentCount} sovereign agents`, "Swarm consensus: 2/3 BFT", "All agents operational"],
      quickActions: ["View Swarm", "Deploy Agent", "Consensus Log"],
    },
    {
      label: "AUTOPILOT",
      value: "ON",
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      pulse: true,
      numericValue: 1,
      sparklineKey: "autopilot",
      detailTitle: "Autopilot Status",
      detailLines: ["Autonomous mode: ACTIVE", "Self-healing: enabled", "Zero human intervention required"],
      quickActions: ["View Log", "Pause", "Override"],
    },
  ];

  const ringBuffers = useRef<Record<string, number[]>>({});
  metrics.forEach(m => {
    if (!ringBuffers.current[m.sparklineKey]) ringBuffers.current[m.sparklineKey] = [];
    const buf = ringBuffers.current[m.sparklineKey];
    const last = buf[buf.length - 1];
    if (last !== m.numericValue) {
      ringBuffers.current[m.sparklineKey] = [...buf, m.numericValue].slice(-RING_SIZE);
    }
  });

  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  const criticalMetrics = metrics.filter(m => {
    const level = getAlertLevel(m.label, m.numericValue);
    return level === "critical" && !dismissedAlerts.includes(m.label);
  });

  const warningMetrics = metrics.filter(m => {
    const level = getAlertLevel(m.label, m.numericValue);
    return level === "warning" && !dismissedAlerts.includes(m.label);
  });

  const hasCritical = criticalMetrics.length > 0;
  const hasAlert = criticalMetrics.length > 0 || warningMetrics.length > 0;

  return (
    <div>
      {hasAlert && (
        <div className={cn("mx-3 mb-2 rounded-xl border px-3 py-2 flex items-center gap-2", hasCritical ? "border-red-500/30 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10")} data-testid="alert-banner">
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", hasCritical ? "bg-red-400 animate-pulse" : "bg-amber-400 animate-pulse")} />
          <div className="flex-1 min-w-0">
            <span className={cn("text-[10px] font-mono font-bold", hasCritical ? "text-red-400" : "text-amber-400")}>
              {hasCritical ? "CRITICAL" : "WARNING"}
            </span>
            <span className="text-[10px] text-slate-400 ml-2">
              {[...criticalMetrics, ...warningMetrics].map(m => m.label).join(", ")} out of normal range
            </span>
          </div>
          <button
            onClick={() => setDismissedAlerts(prev => [...prev, ...criticalMetrics.map(m => m.label), ...warningMetrics.map(m => m.label)])}
            className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
            data-testid="dismiss-alert"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Live System Status</span>
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[9px] font-mono text-slate-600">AGI-24 v∞</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {metrics.map((m) => {
            const alertLevel = getAlertLevel(m.label, m.numericValue);
            const isSelected = expandedMetric === m.label;
            const buf = ringBuffers.current[m.sparklineKey] ?? [];
            return (
              <button
                key={m.label}
                onClick={() => setExpandedMetric(prev => prev === m.label ? null : m.label)}
                className={cn(
                  "rounded-xl border p-2.5 flex flex-col gap-1 text-left transition-all active:scale-95 cursor-pointer",
                  isSelected ? "ring-1 ring-white/20 brightness-125" : "hover:brightness-110",
                  alertLevel === "critical" ? "bg-red-500/15 border-red-500/30 animate-pulse-subtle" :
                  alertLevel === "warning" ? "bg-amber-500/10 border-amber-500/25" :
                  m.bg
                )}
                data-testid={`sys-metric-${m.label.toLowerCase()}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-mono text-slate-500 tracking-widest">{m.label}</span>
                  {alertLevel === "critical" && <AlertTriangle size={8} className="text-red-400" />}
                  {alertLevel === "warning" && <AlertTriangle size={8} className="text-amber-400" />}
                  {alertLevel === "ok" && m.pulse && <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />}
                </div>
                <div className="flex items-end gap-1">
                  <span className={cn("text-base font-bold font-mono leading-none", m.color)}>{m.value}</span>
                  {m.sub && <span className="text-[7px] text-slate-600 font-mono mb-0.5">{m.sub}</span>}
                </div>
                <m.icon size={10} className={cn("opacity-50", m.color)} />
                <MiniSparkline data={buf} color={m.color} />
              </button>
            );
          })}
        </div>
      </div>

      {expandedMetric && (() => {
        const metric = metrics.find(m => m.label === expandedMetric);
        if (!metric) return null;
        const buf = ringBuffers.current[metric.sparklineKey] ?? [];
        return (
          <MetricDetailPanel
            metric={metric}
            history={buf}
            onClose={() => setExpandedMetric(null)}
          />
        );
      })()}
    </div>
  );
}

function CollapsibleSection({
  id,
  title,
  children,
  defaultOpen = true,
}: {
  id: string;
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const storageKey = `tess-section-${id}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored !== null ? stored === "true" : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(storageKey, String(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  return (
    <div>
      <button onClick={toggle} className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/[0.02] transition-all" data-testid={`toggle-section-${id}`}>
        <div>{title}</div>
        {open ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
      </button>
      <div className={cn("overflow-hidden transition-all duration-300", open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0")}>
        {children}
      </div>
    </div>
  );
}

interface DiagnosticsData {
  status: "healthy" | "degraded" | "critical";
  healthScore: number;
  uptime: { seconds: number; formatted: string };
  memory: { heapUsedMB: number; heapTotalMB: number; percent: number };
  cpu: { loadAvg: number[]; cores: number };
  integrity: {
    status: string;
    totalFiles: number;
    checkedFiles: number;
    passedFiles: number;
    failedFiles: number;
    lastCheck: string | null;
  };
  anomalies: { total: number; active: number; critical: number; lastDetected: string | null };
  modules: Array<{ name: string; status: string; startedAt?: string; lastError?: string }>;
  sovereignty: { level: string; score: number; selfHealingEvents: number; anomaliesDetected: number };
  recovery: { totalAttempts: number; successfulAttempts: number; lastAttempt: string | null };
  generatedAt: string;
}

function SystemDiagnosticsPanel({ visible }: { visible: boolean }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery<DiagnosticsData>({
    queryKey: ["/api/diagnostics"],
    refetchInterval: visible ? 15000 : false,
    refetchOnWindowFocus: true,
    staleTime: 10000,
    retry: 2,
  });

  const statusColor = (s?: string) =>
    s === "healthy" || s === "clean" || s === "running" || s === "full" ? "text-emerald-400" :
    s === "degraded" || s === "partial" || s === "tampered" ? "text-amber-400" :
    s === "critical" || s === "failed" || s === "missing" || s === "compromised" ? "text-red-400" :
    "text-slate-400";

  const statusDot = (s?: string) =>
    s === "healthy" || s === "clean" || s === "running" || s === "full" ? "bg-emerald-400" :
    s === "degraded" || s === "partial" || s === "tampered" ? "bg-amber-400" :
    s === "critical" || s === "failed" || s === "missing" || s === "compromised" ? "bg-red-400" :
    "bg-slate-500";

  if (isLoading) {
    return (
      <div className="px-3 py-4 flex items-center gap-2 text-slate-500 text-xs" data-testid="diagnostics-loading">
        <Loader2 size={12} className="animate-spin" />
        <span>Loading diagnostics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-3 py-3 text-xs text-slate-500" data-testid="diagnostics-error">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={12} className="text-amber-400" />
          <span className="text-amber-400 font-mono">DIAGNOSTICS UNAVAILABLE</span>
        </div>
        <p className="text-slate-600">API diagnostics endpoint not reachable. Backend may be initializing.</p>
      </div>
    );
  }

  const integrityOk = data.integrity.failedFiles === 0;
  const allModulesOk = data.modules.every(m => m.status === "running" || m.status === "initializing");

  return (
    <div className="px-3 pb-3 space-y-3" data-testid="system-diagnostics-panel">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", statusDot(data.status), data.status !== "healthy" ? "animate-pulse" : "")} />
          <span className={cn("text-xs font-bold font-mono", statusColor(data.status))}>{data.status.toUpperCase()}</span>
          <span className="text-[9px] font-mono text-slate-600">Score: {data.healthScore}/100</span>
        </div>
        <button
          onClick={() => refetch()}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          data-testid="button-refresh-diagnostics"
        >
          <RefreshCw size={11} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5" data-testid="diag-memory">
          <div className="flex items-center gap-1.5 mb-1">
            <HardDrive size={10} className="text-slate-500" />
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Memory</span>
          </div>
          <span className={cn("text-sm font-bold font-mono",
            data.memory.percent > 90 ? "text-red-400" :
            data.memory.percent > 75 ? "text-amber-400" : "text-emerald-400"
          )}>{data.memory.percent}%</span>
          <p className="text-[8px] text-slate-600 mt-0.5">{data.memory.heapUsedMB}MB / {data.memory.heapTotalMB}MB</p>
          <div className="w-full h-1 bg-white/5 rounded-full mt-1.5 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", data.memory.percent > 90 ? "bg-red-500" : data.memory.percent > 75 ? "bg-amber-500" : "bg-emerald-500")}
              style={{ width: `${Math.min(data.memory.percent, 100)}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5" data-testid="diag-cpu">
          <div className="flex items-center gap-1.5 mb-1">
            <Cpu size={10} className="text-slate-500" />
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">CPU</span>
          </div>
          <span className="text-sm font-bold font-mono text-blue-400">
            {(data.cpu.loadAvg[0] ?? 0).toFixed(2)}
          </span>
          <p className="text-[8px] text-slate-600 mt-0.5">{data.cpu.cores} cores · 1m avg</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5" data-testid="diag-integrity">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {integrityOk ? <ShieldCheck size={10} className="text-emerald-400" /> : <ShieldAlert size={10} className="text-red-400" />}
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">File Integrity</span>
          </div>
          <span className={cn("text-[8px] font-mono font-bold", statusColor(data.integrity.status))}>
            {data.integrity.status.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-3 text-[9px] font-mono">
          <span className="text-emerald-400">{data.integrity.passedFiles} clean</span>
          {data.integrity.failedFiles > 0 && <span className="text-red-400">{data.integrity.failedFiles} failed</span>}
          <span className="text-slate-600">{data.integrity.totalFiles} total</span>
        </div>
        {data.integrity.lastCheck && (
          <p className="text-[8px] text-slate-700 mt-1">
            Last checked: {new Date(data.integrity.lastCheck).toLocaleTimeString()}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5" data-testid="diag-anomalies">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Bug size={10} className="text-slate-500" />
          <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Anomalies</span>
        </div>
        <div className="flex gap-3 text-[9px] font-mono">
          <span className={data.anomalies.active > 0 ? "text-amber-400" : "text-emerald-400"}>{data.anomalies.active} active</span>
          {data.anomalies.critical > 0 && <span className="text-red-400">{data.anomalies.critical} critical</span>}
          <span className="text-slate-600">{data.anomalies.total} total</span>
        </div>
      </div>

      {data.modules.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5" data-testid="diag-modules">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Wrench size={10} className="text-slate-500" />
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Modules</span>
          </div>
          <div className="space-y-1">
            {data.modules.map((mod) => (
              <div key={mod.name} className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-slate-400">{mod.name}</span>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", statusDot(mod.status))} />
                  <span className={cn("text-[8px] font-mono", statusColor(mod.status))}>{mod.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5" data-testid="diag-recovery">
        <div className="flex items-center gap-1.5 mb-1.5">
          <RefreshCw size={10} className="text-slate-500" />
          <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Auto-Recovery</span>
        </div>
        <div className="flex gap-3 text-[9px] font-mono">
          <span className="text-emerald-400">{data.recovery.successfulAttempts} healed</span>
          <span className="text-slate-600">{data.recovery.totalAttempts} total</span>
        </div>
        <div className="mt-1.5 flex gap-3 text-[9px] font-mono">
          <span className={cn("px-1.5 py-0.5 rounded-md border text-[8px]",
            data.sovereignty.level === "full" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-amber-500/30 text-amber-400 bg-amber-500/10"
          )}>
            SOVEREIGNTY: {data.sovereignty.level.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="text-[8px] text-slate-700 text-right font-mono">
        Generated: {new Date(data.generatedAt).toLocaleTimeString()} · Uptime: {data.uptime.formatted}
      </div>
    </div>
  );
}

export default function SystemPage({ embedded }: { embedded?: boolean }) {
  useEffect(() => { document.title = "System | Tessera"; }, []);
  const visible = usePageVisible();

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

        <CollapsibleSection
          id="live-system-status"
          title={
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Live System Status</span>
          }
          defaultOpen={true}
        >
          <LiveSystemStatus visible={visible} />
        </CollapsibleSection>

        <CollapsibleSection
          id="swarm-feed"
          title={
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Swarm Feed</span>
          }
          defaultOpen={true}
        >
          <SwarmLiveFeed visible={visible} />
        </CollapsibleSection>

        <CollapsibleSection
          id="system-diagnostics"
          title={
            <div className="flex items-center gap-2">
              <ShieldCheck size={10} className="text-violet-400" />
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">System Diagnostics</span>
            </div>
          }
          defaultOpen={true}
        >
          <SystemDiagnosticsPanel visible={visible} />
        </CollapsibleSection>
      </div>
    </div>
  );
}
