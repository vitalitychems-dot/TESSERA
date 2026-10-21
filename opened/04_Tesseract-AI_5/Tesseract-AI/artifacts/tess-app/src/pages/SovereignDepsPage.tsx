import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Package, RefreshCw, Loader2, CheckCircle, AlertTriangle, XCircle, ArrowUpRight, Server } from "lucide-react";
import { cn } from "@/lib/utils";

interface Dependency {
  name: string;
  version?: string;
  status: string;
  type?: string;
  latency?: number;
  notes?: string;
}

export default function SovereignDepsPage() {
  const { data, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ["/api/health/dependencies"],
    refetchInterval: 30000,
  });

  const deps: Dependency[] = data?.dependencies || data?.deps || [];

  function StatusIcon({ status }: { status: string }) {
    if (status === "healthy" || status === "ok" || status === "connected") {
      return <CheckCircle size={13} className="text-green-400 shrink-0" />;
    }
    if (status === "degraded" || status === "slow") {
      return <AlertTriangle size={13} className="text-yellow-400 shrink-0" />;
    }
    return <XCircle size={13} className="text-red-400 shrink-0" />;
  }

  const healthy = deps.filter(d => d.status === "healthy" || d.status === "ok" || d.status === "connected").length;
  const degraded = deps.filter(d => d.status === "degraded" || d.status === "slow").length;
  const failing = deps.length - healthy - degraded;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08090e]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-background/40 shrink-0">
        <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Database size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Sovereign Dependencies</h1>
          <p className="text-[10px] text-muted-foreground font-mono">Infrastructure Dependency Map</p>
        </div>
        <button onClick={() => refetch()} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {deps.length > 0 && (
          <div className="flex gap-2">
            {[
              { label: "Healthy", value: healthy, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              { label: "Degraded", value: degraded, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
              { label: "Failing", value: failing, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={cn("flex-1 rounded-lg border p-2.5 text-center", bg)}>
                <div className={cn("text-xl font-bold font-mono", color)}>{value}</div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
          </div>
        ) : deps.length === 0 ? (
          <div className="rounded-lg border border-border/30 bg-card/40 p-8 text-center">
            <Database size={32} className="mx-auto mb-3 text-violet-400/40" />
            <p className="text-sm text-muted-foreground">No dependency data available</p>
          </div>
        ) : (
          <div>
            {["database", "api", "service", ""].map(type => {
              const typeDeps = type ? deps.filter(d => d.type === type) : deps.filter(d => !d.type);
              if (!typeDeps.length) return null;
              return (
                <div key={type} className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 capitalize">
                    {type || "Other"}
                  </h3>
                  <div className="space-y-1.5">
                    {typeDeps.map((dep, i) => (
                      <div key={dep.name || i} className="flex items-center gap-3 rounded-md border border-border/30 bg-card/30 px-2.5 py-2.5">
                        <StatusIcon status={dep.status} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{dep.name}</div>
                          {dep.version && <div className="text-[10px] text-muted-foreground font-mono">{dep.version}</div>}
                          {dep.notes && <div className="text-[10px] text-muted-foreground/60 truncate">{dep.notes}</div>}
                        </div>
                        {dep.latency != null && (
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">{dep.latency}ms</span>
                        )}
                        <span className={cn("text-[10px] font-mono shrink-0",
                          dep.status === "healthy" || dep.status === "ok" ? "text-green-400" :
                          dep.status === "degraded" ? "text-yellow-400" : "text-red-400"
                        )}>
                          {dep.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
