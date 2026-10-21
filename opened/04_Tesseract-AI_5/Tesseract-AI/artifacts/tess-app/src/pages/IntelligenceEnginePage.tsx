import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, Zap, Activity, TrendingUp, RefreshCw, Loader2, Server, Network, Database, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface EngineStatus {
  status?: string;
  activeModels?: number;
  tasksPerHour?: number;
  avgLatency?: number;
}

interface LLMProviderEntry {
  id?: string;
  name?: string;
  available?: boolean;
  status?: string;
  score?: number;
  avgLatency?: number;
}

interface ProviderLeaderboardResponse {
  providers?: LLMProviderEntry[];
}

interface TaskEntry {
  id?: string;
  name?: string;
  description?: string;
  status?: string;
  agent?: string;
}

interface TasksResponse {
  tasks?: TaskEntry[];
}

function timeAgo(ts: number): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function IntelligenceEnginePage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: engineData, isLoading, refetch, isRefetching } = useQuery<EngineStatus>({
    queryKey: ["/api/intelligence-engine/status"],
    refetchInterval: 15000,
  });

  const { data: providerData } = useQuery<ProviderLeaderboardResponse>({
    queryKey: ["/api/provider-leaderboard"],
    refetchInterval: 60000,
  });

  const { data: tasksData } = useQuery<TasksResponse>({
    queryKey: ["/api/intelligence-engine/tasks"],
    refetchInterval: 10000,
  });

  const providers: LLMProviderEntry[] = providerData?.providers ?? [];
  const tasks: TaskEntry[] = tasksData?.tasks ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08090e]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-background/40 shrink-0">
        <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Brain size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Intelligence Engine</h1>
          <p className="text-[10px] text-muted-foreground font-mono">Sovereign AI Processing Layer</p>
        </div>
        <button
          onClick={() => refetch()}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Engine Status", value: engineData?.status || "Online", icon: Activity, color: "text-emerald-400" },
                { label: "Active Models", value: engineData?.activeModels ?? (providers?.filter((p: any) => p.available || p.status === "healthy")?.length ?? "—"), icon: Brain, color: "text-violet-400" },
                { label: "Tasks/Hour", value: engineData?.tasksPerHour ?? tasks?.length ?? "—", icon: Zap, color: "text-amber-400" },
                { label: "Avg Latency", value: engineData?.avgLatency ? `${engineData.avgLatency}ms` : "—", icon: TrendingUp, color: "text-cyan-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-lg border border-border/30 bg-card/40 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={12} className={color} />
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                  <div className={cn("text-lg font-bold font-mono", color)}>{value}</div>
                </div>
              ))}
            </div>

            {providers?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">Provider Leaderboard</h3>
                <div className="space-y-1.5">
                  {providers.slice(0, 8).map((p: any, i: number) => (
                    <div key={p.id || p.name || i} className="flex items-center gap-3 rounded-md border border-border/30 bg-card/30 px-2.5 py-2">
                      <span className="text-[10px] font-mono text-muted-foreground/60 w-5">{i + 1}</span>
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                        p.available || p.status === "healthy" ? "bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.6)]" : "bg-red-500/60"
                      )} />
                      <span className="text-xs flex-1 truncate">{p.name || p.id}</span>
                      {p.score != null && <span className="text-[10px] font-mono text-amber-300">{p.score}</span>}
                      {p.avgLatency != null && <span className="text-[10px] font-mono text-muted-foreground">{p.avgLatency}ms</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tasks?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">Active Tasks</h3>
                <div className="space-y-1.5">
                  {tasks.slice(0, 5).map((task: any, i: number) => (
                    <div key={task.id || i} className="rounded-md border border-border/30 bg-card/30 px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                          task.status === "running" ? "bg-amber-400 animate-pulse" :
                          task.status === "done" ? "bg-green-400" : "bg-muted-foreground/40"
                        )} />
                        <span className="text-xs truncate">{task.name || task.description || `Task ${i + 1}`}</span>
                        <span className="text-[10px] font-mono text-muted-foreground ml-auto shrink-0">{task.agent || ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!providers?.length && !tasks?.length && (
              <div className="rounded-lg border border-border/30 bg-card/40 p-8 text-center">
                <Brain size={32} className="mx-auto mb-3 text-violet-400/40" />
                <p className="text-sm text-muted-foreground">Intelligence Engine initializing...</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Connect to API to see live provider data</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
