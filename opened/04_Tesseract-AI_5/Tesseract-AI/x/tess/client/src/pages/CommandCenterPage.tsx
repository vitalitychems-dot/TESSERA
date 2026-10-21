import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Activity, Shield, Brain, BarChart3, Target, GraduationCap, Cpu, Users,
  ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Zap, Eye,
  DollarSign, Server, Clock, CheckCircle, AlertTriangle, XCircle,
  Gauge, Globe, Layers, Sparkles, ShieldAlert, CheckCircle2, Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const BLOCK_CONFIGS = [
  {
    id: "health", label: "System Health", sub: "Uptime, agents, tasks, memory",
    icon: Activity, gradient: "from-emerald-600 to-green-700",
    border: "border-emerald-500/40", bg: "bg-emerald-950/30", text: "text-emerald-400",
    glow: "shadow-emerald-500/20",
  },
  {
    id: "security", label: "Security", sub: "Threats, firewall, blocked IPs",
    icon: ShieldAlert, gradient: "from-red-600 to-rose-700",
    border: "border-red-500/40", bg: "bg-red-950/30", text: "text-red-400",
    glow: "shadow-red-500/20",
  },
  {
    id: "metrics", label: "Sovereignty Metrics", sub: "50 metrics across 10 categories",
    icon: BarChart3, gradient: "from-cyan-600 to-blue-700",
    border: "border-cyan-500/40", bg: "bg-cyan-950/30", text: "text-cyan-400",
    glow: "shadow-cyan-500/20",
  },
  {
    id: "intelligence", label: "Intelligence", sub: "Benchmarks, AI providers, training",
    icon: Brain, gradient: "from-violet-600 to-purple-700",
    border: "border-violet-500/40", bg: "bg-violet-950/30", text: "text-violet-400",
    glow: "shadow-violet-500/20",
  },
  {
    id: "training", label: "Training & Evolution", sub: "Skills, XP, GitHub repos",
    icon: GraduationCap, gradient: "from-amber-600 to-orange-700",
    border: "border-amber-500/40", bg: "bg-amber-950/30", text: "text-amber-400",
    glow: "shadow-amber-500/20",
  },
  {
    id: "competitors", label: "Competitor Intel", sub: "GPT-4, Claude, Gemini comparison",
    icon: Target, gradient: "from-pink-600 to-rose-700",
    border: "border-pink-500/40", bg: "bg-pink-950/30", text: "text-pink-400",
    glow: "shadow-pink-500/20",
  },
];

function ExpandBlock({ config, children, defaultOpen = false }: {
  config: typeof BLOCK_CONFIGS[0]; children: any; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = config.icon;
  return (
    <div className={cn("rounded-xl border overflow-hidden transition-all shadow-lg", config.border, config.bg, open && config.glow)} data-testid={`block-${config.id}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-white/5 transition-colors active:bg-white/10"
        data-testid={`button-toggle-${config.id}`}
      >
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br shrink-0", config.gradient)}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn("text-sm font-bold", config.text)}>{config.label}</div>
          <div className="text-[11px] text-muted-foreground truncate">{config.sub}</div>
        </div>
        {open ? <ChevronDown size={16} className="text-muted-foreground shrink-0" /> : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 border-t border-white/5">{children}</div>}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className={color} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn("text-lg font-bold font-mono", color)}>{value}</div>
    </div>
  );
}

function HealthBlock() {
  const { data: overview } = useQuery<any>({ queryKey: ["/api/monitor/overview"], refetchInterval: 10000 });
  const o = overview || {};

  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Agents" value={o.agentCount || 0} icon={Users} color="text-green-400" />
        <StatCard label="Tasks" value={o.totalTasks || 0} icon={Zap} color="text-cyan-400" />
        <StatCard label="Uptime" value={o.uptime ? formatDuration(o.uptime) : "—"} icon={Clock} color="text-blue-400" />
        <StatCard label="Memory" value={o.memoryUsage ? `${Math.round(o.memoryUsage)}%` : "—"} icon={Cpu} color="text-orange-400" />
      </div>
      {o.subsystems && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Subsystems</span>
          {Object.entries(o.subsystems || {}).slice(0, 6).map(([key, val]: [string, any]) => (
            <div key={key} className="flex items-center gap-2 bg-black/20 rounded p-2">
              <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{key}</span>
              <span className={cn("text-xs font-mono", val?.status === "active" || val?.status === "healthy" ? "text-green-400" : "text-yellow-400")}>{val?.status || "unknown"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SecurityBlock() {
  const { data: overview } = useQuery<any>({ queryKey: ["/api/monitor/overview"], refetchInterval: 10000 });
  const { data: rateLimits } = useQuery<any>({ queryKey: ["/api/monitor/rate-limits"], refetchInterval: 20000 });
  const o = overview || {};

  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatCard label="Threats Blocked" value={o.threatsBlocked || 0} icon={Shield} color="text-red-400" />
        <StatCard label="Blocked IPs" value={o.blockedIps || 0} icon={ShieldAlert} color="text-orange-400" />
        <StatCard label="Security Score" value={`${o.securityScore ?? 0}%`} icon={CheckCircle} color="text-green-400" />
      </div>
      {rateLimits && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Rate Limits</span>
          {Object.entries(rateLimits).slice(0, 4).map(([key, val]: [string, any]) => (
            <div key={key} className="flex items-center gap-2 bg-black/20 rounded p-2">
              <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{key}</span>
              <span className="text-xs font-mono text-cyan-400">{val?.remaining ?? "—"}/{val?.limit ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricsBlock() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data } = useQuery<any>({ queryKey: ["/api/metrics"], refetchInterval: 10000 });
  const metrics = data?.metrics || [];

  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Overall" value={`${data?.overallHealth || 0}%`} icon={Gauge} color="text-cyan-400" />
        <StatCard label="Improving" value={data?.improving || 0} icon={TrendingUp} color="text-green-400" />
        <StatCard label="Declining" value={data?.declining || 0} icon={TrendingDown} color="text-red-400" />
        <StatCard label="At Target" value={data?.atTarget || 0} icon={Target} color="text-yellow-400" />
      </div>
      <div className="space-y-1">
        {metrics.slice(0, 15).map((m: any) => {
          const progress = m.targetValue === 0 ? 100 : Math.min(100, (m.currentValue / m.targetValue) * 100);
          return (
            <div key={m.id} className="bg-black/20 rounded p-2 cursor-pointer hover:bg-white/5 transition" onClick={() => setExpanded(expanded === m.id ? null : m.id)} data-testid={`metric-${m.id}`}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-8">{m.id}</span>
                <span className="text-xs flex-1 truncate">{m.name}</span>
                {m.trend === "improving" && <TrendingUp size={12} className="text-green-400" />}
                {m.trend === "declining" && <TrendingDown size={12} className="text-red-400" />}
                {m.trend === "stable" && <Minus size={12} className="text-slate-400" />}
                <span className="text-xs font-mono text-cyan-400">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1 mt-1.5" />
              {expanded === m.id && (
                <div className="mt-2 text-[11px] text-muted-foreground space-y-1">
                  <div>Category: <span className="text-cyan-300">{m.category}</span></div>
                  <div>Current: {m.currentValue?.toFixed(1)} / Target: {m.targetValue} {m.unit}</div>
                  <div>Strategy: {m.autoImproveStrategy}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IntelligenceBlock() {
  const { data: providers } = useQuery<any>({ queryKey: ["/api/llm/fallback-status"], refetchInterval: 15000 });
  const { data: benchmarks } = useQuery<any>({ queryKey: ["/api/benchmark/status"], refetchInterval: 30000 });

  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="LLM Providers" value={providers?.providers?.length || 0} icon={Server} color="text-violet-400" />
        <StatCard label="Benchmark Score" value={benchmarks?.percentage ? `${benchmarks.percentage.toFixed(1)}%` : "—"} icon={Brain} color="text-purple-400" />
      </div>
      {providers?.providers && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Top Providers</span>
          {providers.providers.slice(0, 8).map((p: any) => (
            <div key={p.name || p.id} className="flex items-center gap-2 bg-black/20 rounded p-2">
              <div className={cn("w-2 h-2 rounded-full shrink-0", p.status === "active" || p.available ? "bg-green-400" : "bg-red-500")} />
              <span className="text-xs font-mono flex-1 truncate">{p.name || p.id}</span>
              <span className="text-[10px] text-muted-foreground">{p.calls || 0} calls</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrainingBlock() {
  const { data } = useQuery<any>({ queryKey: ["/api/training/domains"], refetchInterval: 15000 });
  const domains = data?.domains || [];
  const { data: evolution } = useQuery<any>({ queryKey: ["/api/monitor/evolution"], refetchInterval: 30000 });

  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Domains" value={domains.length} icon={GraduationCap} color="text-amber-400" />
        <StatCard label="Evolution" value={evolution?.level ? `Lvl ${Math.round(evolution.level)}` : "—"} icon={Sparkles} color="text-orange-400" />
      </div>
      <div className="space-y-1">
        {domains.slice(0, 10).map((d: any) => (
          <div key={d.id} className="bg-black/20 rounded p-2" data-testid={`domain-${d.id}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs flex-1 truncate">{d.name}</span>
              <span className="text-[10px] font-mono text-amber-400">Lvl {d.currentLevel}/{d.maxLevel}</span>
            </div>
            <Progress value={(d.xp / (d.xpToNext || 1)) * 100} className="h-1 mt-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitorBlock() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data } = useQuery<any>({ queryKey: ["/api/competitor/analysis"], refetchInterval: 15000 });
  const competitors = data?.competitors || [];

  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatCard label="Surpassed" value={data?.surpassed || 0} icon={CheckCircle} color="text-green-400" />
        <StatCard label="Our Avg" value={`${data?.avgOurScore || 0}%`} icon={TrendingUp} color="text-cyan-400" />
        <StatCard label="Improving" value={data?.improving || 0} icon={Target} color="text-yellow-400" />
      </div>
      <div className="space-y-1.5">
        {competitors.map((c: any) => (
          <div key={c.id} className="bg-black/20 rounded p-2 cursor-pointer hover:bg-white/5 transition" onClick={() => setExpanded(expanded === c.id ? null : c.id)} data-testid={`competitor-${c.id}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold flex-1">{c.name}</span>
              <span className="text-[10px] text-muted-foreground">{c.company}</span>
              <Badge className={cn("text-[9px]", c.gap >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                {c.gap >= 0 ? "+" : ""}{c.gap}
              </Badge>
            </div>
            <div className="flex gap-2 mt-1.5">
              <div className="flex-1">
                <div className="text-[10px] text-cyan-400 mb-0.5">Us: {c.ourScore}%</div>
                <Progress value={c.ourScore} className="h-1" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-pink-400 mb-0.5">Them: {c.theirScore}%</div>
                <Progress value={c.theirScore} className="h-1" />
              </div>
            </div>
            {expanded === c.id && (
              <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                <div>Strengths: {c.strengths?.join(", ")}</div>
                <div>Weaknesses: {c.weaknesses?.join(", ")}</div>
                <div>Strategy: {c.cloneStrategy}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ApprovalGateBlock() {
  const { data: pendingApprovals, isLoading } = useQuery<any[]>({
    queryKey: ["/api/sovereign/approvals/pending"],
    refetchInterval: 5000,
  });
  const { data: gateState } = useQuery<{ required: boolean }>({
    queryKey: ["/api/sovereign/approval-gate"],
  });

  const toggleGate = useMutation({
    mutationFn: async (required: boolean) => {
      const res = await apiRequest("POST", "/api/sovereign/approval-gate", { required });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sovereign/approval-gate"] }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/sovereign/approvals/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sovereign/approvals/pending"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/sovereign/approvals/${id}/reject`, {});
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sovereign/approvals/pending"] }),
  });

  const approvals = Array.isArray(pendingApprovals) ? pendingApprovals : [];
  const gateEnabled = gateState?.required !== false;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-violet-400" />
          <span className="text-xs font-mono text-muted-foreground">Manual approval required before autonomous task execution</span>
        </div>
        <button
          onClick={() => toggleGate.mutate(!gateEnabled)}
          disabled={toggleGate.isPending}
          data-testid="button-toggle-approval-gate"
          className={cn(
            "px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all",
            gateEnabled
              ? "bg-violet-500/20 border-violet-500/30 text-violet-300"
              : "bg-gray-500/20 border-gray-500/30 text-gray-400"
          )}
        >
          {gateEnabled ? "Gate ON" : "Gate OFF"}
        </button>
      </div>

      {isLoading ? (
        <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" /></div>
      ) : approvals.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground font-mono">
          {gateEnabled ? "No tasks awaiting approval" : "Approval gate disabled — tasks auto-execute"}
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map((approval: any) => (
            <div key={approval.id} data-testid={`approval-item-${approval.id}`} className="rounded-lg border border-violet-500/20 bg-violet-950/20 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Clock size={12} className="text-violet-400 mt-0.5 shrink-0 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-foreground font-mono whitespace-normal break-words" data-testid="text-task-description">{approval.taskDescription || "Sovereign Task"}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Type: {approval.taskType} · {approval.consultations?.length || 0} agents consulted</div>
                </div>
              </div>
              {approval.consultations?.length > 0 && (
                <div className="bg-black/20 rounded p-2 border border-violet-500/10 space-y-1">
                  {approval.consultations.map((c: any, i: number) => (
                    <div key={i} className="text-[10px] text-muted-foreground font-mono">
                      <span className="text-violet-300 font-bold">[{c.agent || c.name || `Agent ${i+1}`}]:</span>{" "}
                      <span className="whitespace-normal break-words">{c.response || c.opinion || c.statement || ""}</span>
                    </div>
                  ))}
                </div>
              )}
              {approval.proposedActions?.length > 0 && (
                <div className="bg-black/30 rounded p-2 border border-violet-500/10 max-h-[200px] overflow-y-auto">
                  {approval.proposedActions.map((a: string, i: number) => (
                    <div key={i} className="text-[10px] text-muted-foreground font-mono whitespace-normal break-words mb-1">{a}</div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => approveMutation.mutate(approval.id)}
                  disabled={approveMutation.isPending}
                  data-testid={`button-approve-task-${approval.id}`}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-mono hover:bg-green-500/15 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 size={10} /> Approve
                </button>
                <button
                  onClick={() => rejectMutation.mutate(approval.id)}
                  disabled={rejectMutation.isPending}
                  data-testid={`button-reject-task-${approval.id}`}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-mono hover:bg-red-500/15 transition-all disabled:opacity-50"
                >
                  <XCircle size={10} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommandCenterPage({ embedded }: { embedded?: boolean }) {
  useEffect(() => { document.title = "Command Center | Tessera"; }, []);

  return (
    <div className={`${embedded ? "" : "min-h-screen"} bg-background text-foreground`} data-testid="command-center-page">
      <div className="max-w-3xl mx-auto p-3 sm:p-6 space-y-3 pb-24">
        <div className="text-center space-y-1 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent" data-testid="text-command-title">
            Command Center
          </h1>
          <p className="text-xs text-muted-foreground">All systems, metrics & intelligence in one place</p>
        </div>

        <ExpandBlock config={{
          id: "approvals", label: "Task Approval Gate", sub: "Manual approval for autonomous tasks",
          icon: Shield, gradient: "from-violet-600 to-purple-700",
          border: "border-violet-500/40", bg: "bg-violet-950/30", text: "text-violet-400",
          glow: "shadow-violet-500/20",
        }} defaultOpen={true}>
          <ApprovalGateBlock />
        </ExpandBlock>

        <div className="space-y-3">
          {BLOCK_CONFIGS.map((config) => (
            <ExpandBlock key={config.id} config={config} defaultOpen={config.id === "health"}>
              {config.id === "health" && <HealthBlock />}
              {config.id === "security" && <SecurityBlock />}
              {config.id === "metrics" && <MetricsBlock />}
              {config.id === "intelligence" && <IntelligenceBlock />}
              {config.id === "training" && <TrainingBlock />}
              {config.id === "competitors" && <CompetitorBlock />}
            </ExpandBlock>
          ))}
        </div>
      </div>
    </div>
  );
}
