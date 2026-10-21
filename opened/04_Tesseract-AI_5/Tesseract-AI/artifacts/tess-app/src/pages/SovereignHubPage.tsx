import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Server, Activity, Globe, Database, RefreshCw, Loader2, Zap, Network, Lock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SovereignHubPage() {
  const { data, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ["/api/sovereign-hub/status"],
    refetchInterval: 30000,
  });

  const { data: infraData } = useQuery<any>({
    queryKey: ["/api/tessera/infrastructure/status"],
    refetchInterval: 30000,
  });

  const services = data?.services || infraData?.services || [];
  const metrics = data?.metrics || {};

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08090e]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-background/40 shrink-0">
        <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Shield size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Sovereign Hub</h1>
          <p className="text-[10px] text-muted-foreground font-mono">Infrastructure & Operations Control</p>
        </div>
        <button onClick={() => refetch()} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
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
                { label: "Hub Status", value: data?.status || infraData?.status || "Online", icon: Shield, color: "text-emerald-400" },
                { label: "Services", value: services.length || "—", icon: Server, color: "text-cyan-400" },
                { label: "Uptime", value: data?.uptime || infraData?.uptime || "—", icon: Activity, color: "text-violet-400" },
                { label: "Nodes", value: data?.nodeCount || infraData?.nodeCount || "—", icon: Network, color: "text-amber-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-lg border border-border/30 bg-card/40 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={12} className={color} />
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                  <div className={cn("text-lg font-bold font-mono truncate", color)}>{String(value)}</div>
                </div>
              ))}
            </div>

            {services.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">Active Services</h3>
                <div className="space-y-1.5">
                  {services.map((svc: any, i: number) => (
                    <div key={svc.id || svc.name || i} className="flex items-center gap-3 rounded-md border border-border/30 bg-card/30 px-2.5 py-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                        svc.status === "online" || svc.status === "healthy" ? "bg-green-400" :
                        svc.status === "degraded" ? "bg-yellow-400 animate-pulse" : "bg-red-500/60"
                      )} />
                      <span className="text-xs flex-1 truncate">{svc.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">{svc.status || "ok"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {services.length === 0 && (
              <div className="rounded-lg border border-border/30 bg-card/40 p-8 text-center">
                <Server size={32} className="mx-auto mb-3 text-violet-400/40" />
                <p className="text-sm text-muted-foreground">Connecting to Sovereign Hub...</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
