import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Activity, Server, Database, Cpu, AlertTriangle,
  CheckCircle2, RefreshCw, Clock, HardDrive, Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const API_BASE = "/workspace-api/api";

interface SystemHealthData {
  status: "healthy" | "degraded" | "unhealthy";
  uptimeMs: number;
  uptimeFormatted: string;
  timestamp: number;
  memory: {
    rssMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    heapUsagePercent: number;
  };
  database: {
    status: "connected" | "error";
    queryTimeMs: number;
    pool: { totalCount: number; idleCount: number; waitingCount: number };
    conversationCount: number;
    messageCount: number;
  };
  errors: {
    recentCount: number;
    totalLogged: number;
    last10: { timestamp: number; source: string; message: string }[];
  };
  process: {
    pid: number;
    nodeVersion: string;
    platform: string;
  };
  llm?: {
    recentRequests: number;
    successCount: number;
    failCount: number;
    avgLatencyMs: number;
    maxLatencyMs: number;
  };
  connections?: {
    activeCount: number;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
  engines?: { name: string; status: "running" | "idle" | "error"; lastCycleMs: number }[];
}

function MetricCard({ label, value, sub, icon: Icon, status }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  status?: "good" | "warn" | "error";
}) {
  const colors = {
    good: "border-emerald-500/30 bg-emerald-950/20",
    warn: "border-amber-500/30 bg-amber-950/20",
    error: "border-rose-500/30 bg-rose-950/20",
  };
  const iconColors = {
    good: "text-emerald-400",
    warn: "text-amber-400",
    error: "text-rose-400",
  };
  const s = status ?? "good";
  return (
    <div className={`rounded-xl border ${colors[s]} p-3`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={12} className={iconColors[s]} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <div className="text-base font-bold font-mono text-white leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{sub}</div>}
    </div>
  );
}

export default function SystemHealth() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery<SystemHealthData>({
    queryKey: ["system-health"],
    queryFn: () => fetch(`${API_BASE}/health/system`).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    refetchInterval: autoRefresh ? 15000 : false,
    retry: 2,
  });

  const [lastRefresh, setLastRefresh] = useState<string>("");
  useEffect(() => {
    if (dataUpdatedAt) {
      setLastRefresh(new Date(dataUpdatedAt).toLocaleTimeString());
    }
  }, [dataUpdatedAt]);

  const heapStatus = (data?.memory.heapUsagePercent ?? 0) > 90 ? "error"
    : (data?.memory.heapUsagePercent ?? 0) > 70 ? "warn" : "good";

  const dbStatus = data?.database.status === "connected" ? "good" : "error";
  const dbQueryStatus = (data?.database.queryTimeMs ?? 0) > 1000 ? "error"
    : (data?.database.queryTimeMs ?? 0) > 500 ? "warn" : "good";

  const errorStatus = (data?.errors.recentCount ?? 0) > 10 ? "error"
    : (data?.errors.recentCount ?? 0) > 0 ? "warn" : "good";

  return (
    <div className="min-h-screen bg-[hsl(224,71%,4%)] p-4 sm:p-6 pb-20">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-emerald-400" />
            <h1 className="text-lg font-bold text-white font-mono">System Health</h1>
            {data && (
              <Badge variant="outline" className={`text-[10px] font-mono ${
                data.status === "healthy" ? "border-emerald-500/40 text-emerald-400"
                : "border-amber-500/40 text-amber-400"
              }`}>
                {data.status === "healthy" ? <CheckCircle2 size={10} className="mr-1" /> : <AlertTriangle size={10} className="mr-1" />}
                {data.status.toUpperCase()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                autoRefresh
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/30"
                  : "border-slate-700 text-slate-500 bg-slate-900"
              }`}
            >
              {autoRefresh ? "AUTO" : "MANUAL"}
            </button>
            <button
              onClick={() => refetch()}
              className="text-slate-500 hover:text-white transition-colors p-1"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </button>
            {lastRefresh && (
              <span className="text-[10px] font-mono text-slate-600">{lastRefresh}</span>
            )}
          </div>
        </div>

        {isError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 mb-6 flex items-center gap-3">
            <AlertTriangle size={16} className="text-rose-400" />
            <p className="text-sm text-rose-400 font-mono">Failed to fetch system health data. Server may be unavailable.</p>
          </div>
        )}

        {(isLoading && !data) ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 h-20 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Server size={14} className="text-violet-400" />
                <span className="text-xs font-bold text-violet-300 uppercase tracking-widest font-mono">Server</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="Status" value={data.status} icon={CheckCircle2} status={data.status === "healthy" ? "good" : "warn"} />
                <MetricCard label="Uptime" value={data.uptimeFormatted} icon={Clock} status="good" />
                <MetricCard label="PID" value={String(data.process.pid)} sub={data.process.nodeVersion} icon={Cpu} />
                <MetricCard label="Platform" value={data.process.platform} icon={Server} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <HardDrive size={14} className="text-cyan-400" />
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest font-mono">Memory</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                <MetricCard label="Heap Used" value={`${data.memory.heapUsedMB} MB`} sub={`of ${data.memory.heapTotalMB} MB`} icon={HardDrive} status={heapStatus} />
                <MetricCard label="RSS" value={`${data.memory.rssMB} MB`} icon={Cpu} status={heapStatus} />
                <MetricCard label="Heap Usage" value={`${data.memory.heapUsagePercent}%`} icon={Zap} status={heapStatus} />
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-slate-500">Heap Utilization</span>
                  <span className="text-[10px] font-mono text-slate-400">{data.memory.heapUsagePercent}%</span>
                </div>
                <Progress value={data.memory.heapUsagePercent} className="h-2" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Database size={14} className="text-emerald-400" />
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest font-mono">Database</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="Status" value={data.database.status} icon={Database} status={dbStatus} />
                <MetricCard label="Query Time" value={`${data.database.queryTimeMs}ms`} icon={Zap} status={dbQueryStatus} />
                <MetricCard label="Conversations" value={String(data.database.conversationCount)} icon={Database} status="good" />
                <MetricCard label="Messages" value={String(data.database.messageCount)} icon={Database} status="good" />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <MetricCard label="Pool Total" value={String(data.database.pool.totalCount)} icon={Server} />
                <MetricCard label="Pool Idle" value={String(data.database.pool.idleCount)} icon={Server} />
                <MetricCard label="Pool Waiting" value={String(data.database.pool.waitingCount)} icon={Server} status={data.database.pool.waitingCount > 0 ? "warn" : "good"} />
              </div>
            </div>

            {data.llm && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-purple-400" />
                <span className="text-xs font-bold text-purple-300 uppercase tracking-widest font-mono">LLM Performance</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="Avg Latency" value={`${data.llm.avgLatencyMs}ms`} icon={Zap} status={data.llm.avgLatencyMs > 10000 ? "error" : data.llm.avgLatencyMs > 5000 ? "warn" : "good"} />
                <MetricCard label="Max Latency" value={`${data.llm.maxLatencyMs}ms`} icon={Clock} status={data.llm.maxLatencyMs > 15000 ? "error" : data.llm.maxLatencyMs > 8000 ? "warn" : "good"} />
                <MetricCard label="Success" value={String(data.llm.successCount)} sub={`of ${data.llm.recentRequests} recent`} icon={CheckCircle2} status={data.llm.failCount > 0 ? "warn" : "good"} />
                <MetricCard label="Failures" value={String(data.llm.failCount)} icon={AlertTriangle} status={data.llm.failCount > 3 ? "error" : data.llm.failCount > 0 ? "warn" : "good"} />
              </div>
            </div>
            )}

            {data.connections && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Server size={14} className="text-blue-400" />
                <span className="text-xs font-bold text-blue-300 uppercase tracking-widest font-mono">Active Connections</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="Active" value={String(data.connections.activeCount)} icon={Zap} status={data.connections.activeCount > 8 ? "warn" : "good"} />
                <MetricCard label="Total" value={String(data.connections.totalCount)} icon={Server} />
                <MetricCard label="Idle" value={String(data.connections.idleCount)} icon={Clock} />
                <MetricCard label="Waiting" value={String(data.connections.waitingCount)} icon={AlertTriangle} status={data.connections.waitingCount > 0 ? "warn" : "good"} />
              </div>
            </div>
            )}

            {data.engines && data.engines.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Cpu size={14} className="text-teal-400" />
                <span className="text-xs font-bold text-teal-300 uppercase tracking-widest font-mono">Engine Status</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.engines.map(e => (
                  <div key={e.name} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      e.status === "running" ? "bg-emerald-400" : e.status === "idle" ? "bg-amber-400" : "bg-rose-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono text-slate-400 truncate">{e.name}</div>
                      <div className="text-[9px] font-mono text-slate-600">{e.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-amber-300 uppercase tracking-widest font-mono">Errors (Last 5min)</span>
                {data.errors.recentCount > 0 && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px] font-mono ml-1">
                    {data.errors.recentCount}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <MetricCard label="Recent Errors" value={String(data.errors.recentCount)} icon={AlertTriangle} status={errorStatus} />
                <MetricCard label="Total Logged" value={String(data.errors.totalLogged)} icon={AlertTriangle} status={data.errors.totalLogged > 0 ? "warn" : "good"} />
              </div>
              {data.errors.last10.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/80">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Recent Error Log</span>
                  </div>
                  <div className="divide-y divide-slate-800/50">
                    {data.errors.last10.map((err, i) => (
                      <div key={i} className="px-3 py-2 hover:bg-slate-900/40 transition-colors">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono text-slate-600">{new Date(err.timestamp).toLocaleTimeString()}</span>
                          <Badge variant="outline" className="text-[9px] border-rose-500/30 text-rose-400">{err.source}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono truncate">{err.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.errors.last10.length === 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 text-center">
                  <CheckCircle2 size={16} className="text-emerald-400 mx-auto mb-1" />
                  <p className="text-[11px] text-emerald-400 font-mono">No recent errors</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
