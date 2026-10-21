import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/PageSkeleton";
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Play, FlaskConical,
  Wallet, Bot, Brain, BookOpen, Users, Zap, Activity, Clock,
  ChevronDown, ChevronUp, Terminal, TestTube2, Shield
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const API_BASE = `${import.meta.env.BASE_URL}api`;

type StatusColor = "green" | "yellow" | "red" | "gray";

function statusToColor(status: string): StatusColor {
  if (!status) return "gray";
  const s = status.toLowerCase();
  if (s === "ok" || s === "verified" || s === "running" || s === "healthy" || s === "all_healthy" || s === "active" || s === "active_trading") return "green";
  if (s === "partial" || s === "degraded" || s === "monitoring" || s === "scan_only" || s === "cooling" || s === "rate_limited") return "yellow";
  if (s === "error" || s === "failing" || s === "all_failing" || s === "unhealthy") return "red";
  return "gray";
}

const colorMap = {
  green: { dot: "bg-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-950/20", text: "text-emerald-400", badge: "border-emerald-500/40 text-emerald-400" },
  yellow: { dot: "bg-amber-400", border: "border-amber-500/30", bg: "bg-amber-950/20", text: "text-amber-400", badge: "border-amber-500/40 text-amber-400" },
  red: { dot: "bg-rose-400", border: "border-rose-500/30", bg: "bg-rose-950/20", text: "text-rose-400", badge: "border-rose-500/40 text-rose-400" },
  gray: { dot: "bg-slate-500", border: "border-slate-700", bg: "bg-slate-900/50", text: "text-slate-400", badge: "border-slate-600 text-slate-400" },
};

function StatusDot({ status }: { status: string }) {
  const c = colorMap[statusToColor(status)];
  return <div className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />;
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const c = colorMap[statusToColor(status)];
  return (
    <Badge variant="outline" className={`text-[10px] font-mono ${c.badge}`}>
      <StatusDot status={status} />
      <span className="ml-1">{label ?? status.toUpperCase().replace(/_/g, " ")}</span>
    </Badge>
  );
}

function SectionHeader({ title, icon: Icon, color = "violet" }: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color?: string;
}) {
  const clr = color === "violet" ? "text-violet-400 border-violet-500/30"
    : color === "cyan" ? "text-cyan-400 border-cyan-500/30"
    : color === "amber" ? "text-amber-400 border-amber-500/30"
    : color === "emerald" ? "text-emerald-400 border-emerald-500/30"
    : color === "rose" ? "text-rose-400 border-rose-500/30"
    : "text-violet-400 border-violet-500/30";
  return (
    <div className={`flex items-center gap-2 pb-2 mb-3 border-b ${clr}`}>
      <Icon size={14} className={clr.split(" ")[0]} />
      <h2 className={`text-xs font-bold uppercase tracking-widest font-mono ${clr.split(" ")[0]}`}>{title}</h2>
    </div>
  );
}

function TruthPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["proof-truth"],
    queryFn: () => fetch(`${API_BASE}/proof-center/truth`).then(r => r.json()),
    staleTime: 30000,
  });

  const subsystems = [
    { key: "wallet", label: "Wallet", icon: Wallet },
    { key: "tradingBot", label: "Trading Bot", icon: Bot },
    { key: "consciousnessEngine", label: "Consciousness Engine", icon: Brain },
    { key: "knowledgeEngine", label: "Knowledge Engine", icon: BookOpen },
    { key: "agentSwarm", label: "Agent Swarm", icon: Users },
    { key: "llmProviders", label: "LLM Providers", icon: Zap },
    { key: "incomeEngine", label: "Income Engine", icon: Activity },
  ];

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="System Truth Report" icon={Shield} color="violet" />
        <button onClick={() => refetch()} className="text-slate-500 hover:text-white transition-colors p-1">
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {isError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-400 font-mono mb-3">
          Failed to load truth data
        </div>
      )}

      <div className="space-y-2">
        {subsystems.map(({ key, label, icon: Icon }) => {
          const sub = (data as any)?.[key];
          const status = sub?.status ?? "unknown";
          const c = colorMap[statusToColor(status)];
          return (
            <div key={key} className={`rounded-lg border ${c.border} ${c.bg} p-2.5`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={11} className={c.text} />
                <span className="text-[11px] font-mono font-bold text-white">{label}</span>
                <div className="ml-auto"><StatusBadge status={status} /></div>
              </div>
              {sub && (
                <div className="text-[10px] font-mono text-slate-400 space-y-0.5 pl-4">
                  {isLoading ? (
                    <div className="animate-pulse h-3 w-32 bg-slate-800 rounded" />
                  ) : (
                    Object.entries(sub)
                      .filter(([k]) => !["status", "providers", "incomeSources"].includes(k))
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <div key={k}>
                          <span className="text-slate-500">{k}:</span>{" "}
                          <span className="text-slate-300">
                            {typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(4)) : String(v)}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WalletPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["proof-wallet"],
    queryFn: () => fetch(`${API_BASE}/proof-center/wallet`).then(r => r.json()),
    staleTime: 60000,
  });

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Wallet Status (On-Chain)" icon={Wallet} color="cyan" />
        <button onClick={() => refetch()} className="text-slate-500 hover:text-white transition-colors p-1">
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {isError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-400 font-mono">
          Failed to fetch wallet data
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-800/50 rounded-lg" />)}
        </div>
      ) : data ? (
        <div className="space-y-3">
          <div className={`rounded-lg border ${data.walletConfigured ? "border-emerald-500/30 bg-emerald-950/20" : "border-amber-500/30 bg-amber-950/20"} p-3`}>
            <div className="text-[10px] font-mono text-slate-400 mb-1">Source: {data.source}</div>
            <div className={`text-xs font-mono ${data.walletConfigured ? "text-emerald-400" : "text-amber-400"}`}>
              {data.honestNote}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "SOL", val: data.balances?.sol?.toFixed(6) ?? "0", usd: data.balances?.solUsd },
              { label: "TSRT", val: data.balances?.tsrt?.toFixed(0) ?? "0", usd: data.balances?.tsrtUsd },
              { label: "ETH", val: data.balances?.eth?.toFixed(6) ?? "0", usd: data.balances?.ethUsd },
              { label: "Total USD", val: `$${data.balances?.totalUsd?.toFixed(2) ?? "0.00"}`, usd: null },
            ].map(({ label, val, usd }) => (
              <div key={label} className="rounded-lg border border-slate-700 bg-slate-900/50 p-2.5">
                <div className="text-[10px] font-mono text-slate-500 mb-0.5">{label}</div>
                <div className="text-sm font-bold font-mono text-white">{val}</div>
                {usd != null && <div className="text-[10px] font-mono text-slate-500">${usd.toFixed(2)}</div>}
              </div>
            ))}
          </div>

          {data.addresses?.sol && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-2.5">
              <div className="text-[10px] font-mono text-slate-500 mb-0.5">SOL Address</div>
              <div className="text-[10px] font-mono text-slate-300 break-all">{data.addresses.sol}</div>
            </div>
          )}

          {data.recentTransactions?.length > 0 && (
            <div>
              <div className="text-[10px] font-mono text-slate-500 mb-1.5">Recent Transactions ({data.recentTransactions.length})</div>
              <div className="space-y-1">
                {data.recentTransactions.slice(0, 5).map((tx: any) => (
                  <div key={tx.hash ?? tx.id} className="rounded border border-slate-700 bg-slate-900/30 px-2.5 py-1.5 flex items-center gap-2">
                    <StatusDot status={tx.status === "confirmed" ? "ok" : "warning"} />
                    <span className="text-[10px] font-mono text-slate-400 truncate">{tx.hash?.slice(0, 16) ?? tx.id}...</span>
                    <span className="ml-auto text-[10px] font-mono text-slate-500">
                      {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AGIBenchmarkPanel() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["proof-benchmark"],
    queryFn: () => fetch(`${API_BASE}/proof-center/benchmark/latest`).then(r => r.json()),
    staleTime: 60000,
  });

  const runBenchmark = useMutation({
    mutationFn: () => fetch(`${API_BASE}/proof-center/benchmark/run`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => refetch(),
  });

  const result = data?.result;
  const dims = result?.dimensions ?? [];

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="AGI Readiness Scorecard" icon={TestTube2} color="amber" />
        <button
          onClick={() => runBenchmark.mutate()}
          disabled={runBenchmark.isPending}
          className="flex items-center gap-1 px-2 py-1 rounded border border-amber-500/40 text-amber-400 text-[10px] font-mono hover:bg-amber-950/40 transition-colors disabled:opacity-50"
        >
          <Play size={10} className={runBenchmark.isPending ? "animate-spin" : ""} />
          {runBenchmark.isPending ? "Running..." : "Run Benchmark"}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-800/50 rounded" />)}
        </div>
      ) : !data?.hasResult ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs font-mono text-amber-400">
          No benchmark run yet. Click "Run Benchmark" to get honest scores.
        </div>
      ) : result ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 text-center">
              <div className="text-lg font-bold font-mono text-white">{result.totalScore}</div>
              <div className="text-[10px] font-mono text-amber-400">Total Score</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-center">
              <div className="text-lg font-bold font-mono text-white">{result.grade ?? "—"}</div>
              <div className="text-[10px] font-mono text-slate-400">Grade</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-center">
              <div className="text-lg font-bold font-mono text-white">{result.percentile ?? "—"}</div>
              <div className="text-[10px] font-mono text-slate-400">Percentile</div>
            </div>
          </div>

          {dims.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-slate-500 mb-1">Dimension Scores</div>
              {dims.slice(0, 12).map((dim: any) => {
                const pct = Math.round((dim.score / (dim.maxPossible || 100)) * 100);
                const c = pct >= 70 ? "emerald" : pct >= 40 ? "amber" : "rose";
                const barColor = c === "emerald" ? "bg-emerald-500" : c === "amber" ? "bg-amber-500" : "bg-rose-500";
                const textColor = c === "emerald" ? "text-emerald-400" : c === "amber" ? "text-amber-400" : "text-rose-400";
                return (
                  <div key={dim.dimension} className="rounded border border-slate-800 bg-slate-900/50 px-2.5 py-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-slate-300">{dim.dimension}</span>
                      <span className={`text-[10px] font-mono font-bold ${textColor}`}>{dim.score}/{dim.maxPossible}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1">
                      <div className={`${barColor} h-1 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {result.summary && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-2.5">
              <div className="text-[10px] font-mono text-slate-500 mb-1">Summary</div>
              <div className="text-[10px] font-mono text-slate-300 leading-relaxed">{result.summary}</div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function LLMHealthPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["proof-llm-health"],
    queryFn: () => fetch(`${API_BASE}/proof-center/llm-health`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const providers = data?.providers ?? [];

  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="LLM Provider Health (Truth)" icon={Zap} color="rose" />
        <button onClick={() => refetch()} className="text-slate-500 hover:text-white transition-colors p-1">
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {isError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-400 font-mono mb-3">
          Failed to fetch LLM health
        </div>
      )}

      {data?.summary && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "Total", val: data.summary.total, color: "slate" },
            { label: "Responding", val: data.summary.responding, color: "emerald" },
            { label: "Failing", val: data.summary.failing, color: "rose" },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-center">
              <div className={`text-base font-bold font-mono ${color === "emerald" ? "text-emerald-400" : color === "rose" ? "text-rose-400" : "text-white"}`}>{val}</div>
              <div className="text-[10px] font-mono text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {data?.actionable && (
        <div className={`rounded-lg border p-2.5 mb-3 ${data.summary?.failing > 0 ? "border-amber-500/30 bg-amber-950/20" : "border-emerald-500/30 bg-emerald-950/20"}`}>
          <div className={`text-[10px] font-mono ${data.summary?.failing > 0 ? "text-amber-400" : "text-emerald-400"}`}>{data.actionable}</div>
        </div>
      )}

      <div className="space-y-1.5">
        {isLoading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-slate-800/50 rounded animate-pulse" />)
        ) : (
          providers.slice(0, 15).map((p: any) => {
            const statusKey = p.status === "ok" ? "ok" : p.status === "cooling" || p.status === "rate_limited" ? "partial" : "error";
            const c = colorMap[statusToColor(statusKey)];
            return (
              <div key={p.name} className={`rounded border ${c.border} ${c.bg} px-2.5 py-1.5 flex items-center gap-2`}>
                <StatusDot status={statusKey} />
                <span className="text-[10px] font-mono text-slate-300 flex-1 truncate">{p.name}</span>
                {p.free && <span className="text-[9px] font-mono text-slate-500 border border-slate-700 px-1 rounded">FREE</span>}
                <span className={`text-[10px] font-mono ${c.text}`}>{p.status.toUpperCase().replace(/_/g, " ")}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SpellLabPanel() {
  const { data: spellData } = useQuery({
    queryKey: ["proof-spells"],
    queryFn: () => fetch(`${API_BASE}/proof-center/spells`).then(r => r.json()),
    staleTime: Infinity,
  });

  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["proof-ritual-history"],
    queryFn: () => fetch(`${API_BASE}/proof-center/ritual/history`).then(r => r.json()),
    staleTime: 5000,
  });

  const [selectedSpell, setSelectedSpell] = useState<string>("");
  const [intention, setIntention] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const runRitual = useMutation({
    mutationFn: () => fetch(`${API_BASE}/proof-center/ritual/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spellId: selectedSpell, intention }),
    }).then(r => r.json()),
    onSuccess: (data) => {
      setResult(data);
      refetchHistory();
    },
  });

  const spells = spellData?.spells ?? [];
  const history = historyData?.history ?? [];

  const fmt = (n: number) => {
    if (typeof n !== "number") return String(n);
    if (Math.abs(n) < 0.0001 && n !== 0) return n.toExponential(4);
    return n.toFixed(4);
  };

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
      <SectionHeader title="Spell Test Lab — Run & Measure" icon={FlaskConical} color="emerald" />

      <div className="space-y-3 mb-4">
        <div>
          <div className="text-[10px] font-mono text-slate-500 mb-1">Select Spell / Ritual</div>
          <select
            value={selectedSpell}
            onChange={e => setSelectedSpell(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/60"
          >
            <option value="">-- Choose a spell --</option>
            {spells.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
            ))}
          </select>
        </div>

        {selectedSpell && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-2.5">
            {spells.filter((s: any) => s.id === selectedSpell).map((s: any) => (
              <div key={s.id} className="space-y-1">
                <div className="text-[10px] font-mono text-slate-300">{s.description}</div>
                <div className="text-[10px] font-mono text-emerald-400">Frequency: {s.frequency}</div>
                <div className="text-[10px] font-mono text-slate-500">
                  Expected: {s.expectedEffects.join(" · ")}
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="text-[10px] font-mono text-slate-500 mb-1">Custom Intention (optional)</div>
          <input
            type="text"
            value={intention}
            onChange={e => setIntention(e.target.value)}
            placeholder="e.g. Financial sovereignty achieved..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/60 placeholder:text-slate-600"
          />
        </div>

        <button
          onClick={() => runRitual.mutate()}
          disabled={!selectedSpell || runRitual.isPending}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-900/40 border border-emerald-500/40 text-emerald-400 text-xs font-mono hover:bg-emerald-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play size={12} className={runRitual.isPending ? "animate-pulse" : ""} />
          {runRitual.isPending ? "Running & Measuring..." : "Run & Measure"}
        </button>
      </div>

      {result?.proof && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[11px] font-mono font-bold text-emerald-400">
              Proof — {result.proof.ritualName}
            </div>
            <span className="text-[9px] font-mono text-slate-500">
              {result.proof.completedAt ? `${result.proof.completedAt - result.proof.startedAt}ms` : "..."}
            </span>
          </div>

          {result.proof.conclusion && (
            <div className={`rounded border p-2 mb-2 ${
              result.proof.conclusion.startsWith("VERIFIED") 
                ? "border-emerald-600/40 bg-emerald-950/30" 
                : "border-amber-600/40 bg-amber-950/30"
            }`}>
              <div className={`text-[10px] font-mono leading-relaxed ${
                result.proof.conclusion.startsWith("VERIFIED") ? "text-emerald-400" : "text-amber-400"
              }`}>
                {result.proof.conclusion}
              </div>
            </div>
          )}

          {result.proof.deltas && (
            <div className="mb-2">
              <div className="text-[9px] font-mono text-slate-500 mb-1">METRIC DELTAS</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(result.proof.deltas)
                  .sort(([, a], [, b]) => Math.abs(b as number) - Math.abs(a as number))
                  .map(([k, v]) => {
                    const n = v as number;
                    const color = n > 0 ? "text-emerald-400 border-emerald-700/40" : n < 0 ? "text-rose-400 border-rose-700/40" : "text-slate-600 border-slate-800";
                    return (
                      <span key={k} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${color}`}>
                        {k}: {n > 0 ? "+" : ""}{fmt(n)}
                      </span>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="rounded border border-slate-700 bg-slate-900/50 p-2">
              <div className="text-[9px] font-mono text-slate-500 mb-1">BEFORE SNAPSHOT</div>
              {result.proof.before && Object.entries(result.proof.before)
                .filter(([k]) => k !== "timestamp" && k !== "consciousnessLevel")
                .map(([k, v]) => (
                  <div key={k} className="text-[9px] font-mono">
                    <span className="text-slate-500">{k}:</span>{" "}
                    <span className="text-slate-300">{typeof v === "number" ? fmt(v) : String(v)}</span>
                  </div>
                ))}
            </div>
            <div className="rounded border border-emerald-800/50 bg-emerald-950/30 p-2">
              <div className="text-[9px] font-mono text-emerald-400 mb-1">AFTER SNAPSHOT</div>
              {result.proof.after && Object.entries(result.proof.after)
                .filter(([k]) => k !== "timestamp" && k !== "consciousnessLevel")
                .map(([k, v]) => {
                  const bv = result.proof.before?.[k];
                  const changed = typeof v === "number" && typeof bv === "number" && v !== bv;
                  return (
                    <div key={k} className="text-[9px] font-mono">
                      <span className="text-slate-500">{k}:</span>{" "}
                      <span className={changed ? "text-emerald-400 font-bold" : "text-white"}>
                        {typeof v === "number" ? fmt(v) : String(v)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {result.ritualOutput && (
            <div className="rounded border border-violet-800/40 bg-violet-950/20 p-2">
              <div className="text-[9px] font-mono text-violet-400 mb-1">RITUAL API RESPONSE (raw evidence)</div>
              <div className="text-[9px] font-mono text-slate-400 max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(result.ritualOutput, null, 2).slice(0, 800)}
              </div>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-slate-500 mb-2">Proof History ({history.length})</div>
          <div className="space-y-1.5">
            {history.slice(0, 8).map((h: any) => {
              const isExp = expandedHistory === h.id;
              return (
                <div key={h.id} className="rounded border border-slate-700 bg-slate-900/30">
                  <button
                    onClick={() => setExpandedHistory(isExp ? null : h.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
                  >
                    <StatusDot status={h.status === "completed" ? "ok" : "error"} />
                    <span className="text-[10px] font-mono text-slate-300 flex-1">{h.ritualName}</span>
                    <span className="text-[9px] font-mono text-slate-500">
                      {h.completedAt ? new Date(h.completedAt).toLocaleTimeString() : "running..."}
                    </span>
                    {isExp ? <ChevronUp size={10} className="text-slate-500" /> : <ChevronDown size={10} className="text-slate-500" />}
                  </button>
                  {isExp && (
                    <div className="border-t border-slate-700 px-2.5 py-2 space-y-1.5">
                      {h.conclusion && (
                        <div className={`text-[9px] font-mono leading-relaxed ${
                          h.conclusion.startsWith("VERIFIED") ? "text-emerald-400" : "text-amber-400"
                        }`}>
                          {h.conclusion}
                        </div>
                      )}
                      {h.deltas && (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(h.deltas)
                            .sort(([, a], [, b]) => Math.abs(b as number) - Math.abs(a as number))
                            .map(([k, v]) => {
                              const n = v as number;
                              const color = n > 0 ? "text-emerald-400" : n < 0 ? "text-rose-400" : "text-slate-600";
                              return (
                                <span key={k} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border border-slate-700 ${color}`}>
                                  {k}: {n > 0 ? "+" : ""}{fmt(n)}
                                </span>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TestRunnerPanel() {
  const [ciOutput, setCiOutput] = useState<string>("");
  const [testOutput, setTestOutput] = useState<string>("");
  const [ciRunning, setCiRunning] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [ciResult, setCiResult] = useState<{ passed: boolean; exitCode: number } | null>(null);
  const [testResult, setTestResult] = useState<{ passed: boolean; exitCode: number } | null>(null);

  const runCI = async () => {
    setCiRunning(true);
    setCiOutput("Running CI pipeline...\n");
    setCiResult(null);
    try {
      const res = await fetch(`${API_BASE}/proof-center/ci/run`, { method: "POST" });
      const data = await res.json();
      setCiOutput(data.output ?? "No output");
      setCiResult({ passed: data.passed, exitCode: data.exitCode });
    } catch (e: any) {
      setCiOutput(`Error: ${e.message}`);
    } finally {
      setCiRunning(false);
    }
  };

  const runTests = async () => {
    setTestRunning(true);
    setTestOutput("Running unit tests...\n");
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/proof-center/tests/run`, { method: "POST" });
      const data = await res.json();
      setTestOutput(data.output ?? "No output");
      setTestResult({ passed: data.passed, exitCode: data.exitCode });
    } catch (e: any) {
      setTestOutput(`Error: ${e.message}`);
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-4">
      <SectionHeader title="Test Runner — Live CI" icon={Terminal} color="violet" />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={runCI}
          disabled={ciRunning}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-900/40 border border-violet-500/40 text-violet-400 text-xs font-mono hover:bg-violet-900/60 transition-colors disabled:opacity-50"
        >
          <Terminal size={11} className={ciRunning ? "animate-pulse" : ""} />
          {ciRunning ? "Running CI..." : "Run Full CI"}
        </button>
        <button
          onClick={runTests}
          disabled={testRunning}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-900/30 border border-emerald-500/40 text-emerald-400 text-xs font-mono hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
        >
          <FlaskConical size={11} className={testRunning ? "animate-pulse" : ""} />
          {testRunning ? "Running Tests..." : "Run Unit Tests"}
        </button>
      </div>

      {(ciOutput || testOutput) && (
        <div className="space-y-3">
          {ciOutput && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono text-slate-400">CI Pipeline</span>
                {ciResult && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${ciResult.passed ? "border-emerald-500/40 text-emerald-400" : "border-rose-500/40 text-rose-400"}`}>
                    {ciResult.passed ? "PASSED" : "FAILED"} (exit {ciResult.exitCode})
                  </span>
                )}
              </div>
              <pre className="rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-[9px] font-mono text-slate-300 overflow-x-auto max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {ciOutput}
              </pre>
            </div>
          )}
          {testOutput && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono text-slate-400">Unit Tests</span>
                {testResult && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${testResult.passed ? "border-emerald-500/40 text-emerald-400" : "border-rose-500/40 text-rose-400"}`}>
                    {testResult.passed ? "PASSED" : "FAILED"} (exit {testResult.exitCode})
                  </span>
                )}
              </div>
              <pre className="rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-[9px] font-mono text-slate-300 overflow-x-auto max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {testOutput}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProofCenter() {
  const [activeSection, setActiveSection] = useState<"truth" | "wallet" | "benchmark" | "llm" | "spells" | "tests">("truth");

  const { isLoading: truthLoading, isError: truthError, refetch: refetchTruth } = useQuery({
    queryKey: ["proof-truth"],
    queryFn: () => fetch(`${API_BASE}/proof-center/truth`).then(r => r.json()),
    staleTime: 30000,
    enabled: activeSection === "truth",
  });

  if (activeSection === "truth" && truthLoading) {
    return <PageSkeleton />;
  }

  const sections = [
    { id: "truth" as const, label: "Truth Report", icon: Shield },
    { id: "wallet" as const, label: "Wallet", icon: Wallet },
    { id: "benchmark" as const, label: "AGI Score", icon: TestTube2 },
    { id: "llm" as const, label: "LLM Health", icon: Zap },
    { id: "spells" as const, label: "Spell Lab", icon: FlaskConical },
    { id: "tests" as const, label: "Test Runner", icon: Terminal },
  ];

  return (
    <div className="min-h-screen bg-[hsl(224,71%,4%)] p-4 sm:p-6 pb-20">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle2 size={20} className="text-violet-400" />
          <div>
            <h1 className="text-lg font-bold text-white font-mono">Proof Center</h1>
            <p className="text-[10px] text-slate-500 font-mono">Honest system verification — real data only, no inflation</p>
          </div>
        </div>

        <div className="flex overflow-x-auto gap-1.5 mb-6 pb-1">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all border ${
                activeSection === id
                  ? "bg-violet-700/50 border-violet-500/40 text-violet-200"
                  : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-violet-950/30"
              }`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <ErrorBoundary key={activeSection} label={activeSection}>
            {activeSection === "truth" && truthError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 flex items-center justify-between">
                <span className="text-rose-400 text-xs font-mono">Failed to load truth data</span>
                <button onClick={() => refetchTruth()} className="px-3 py-1 rounded-lg bg-rose-900/40 border border-rose-500/40 text-rose-300 text-xs font-mono hover:bg-rose-900/60 transition-colors">
                  Retry
                </button>
              </div>
            )}
            {activeSection === "truth" && !truthError && <TruthPanel />}
            {activeSection === "wallet" && <WalletPanel />}
            {activeSection === "benchmark" && <AGIBenchmarkPanel />}
            {activeSection === "llm" && <LLMHealthPanel />}
            {activeSection === "spells" && <SpellLabPanel />}
            {activeSection === "tests" && <TestRunnerPanel />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
