import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings, Activity, Shield, Cpu, HardDrive, Wifi, Zap, RefreshCw, Database, Globe, Search, BookOpen, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SovereignEngine, IngestionSource, IngestionJob, DiagnosticsResponse, SovereigntyResponse, EnginesResponse, MeshStatsResponse, IngestionStatsResponse } from "@/types/api";

const API = import.meta.env.VITE_API_URL || "";

export default function SettingsPage() {
  const { data: diagnostics } = useQuery<DiagnosticsResponse>({ queryKey: ["/api/diagnostics"], refetchInterval: 15000 });
  const { data: sovereignty } = useQuery<SovereigntyResponse>({ queryKey: ["/api/sovereignty/score"], refetchInterval: 30000 });
  const { data: engines } = useQuery<EnginesResponse>({ queryKey: ["/api/system/engines"], refetchInterval: 30000 });
  const { data: meshStats } = useQuery<MeshStatsResponse>({ queryKey: ["/api/mesh/stats"], refetchInterval: 15000 });
  const { data: ingestionStats } = useQuery<IngestionStatsResponse>({ queryKey: ["/api/ingestion/stats"], refetchInterval: 10000 });

  const uptime = diagnostics?.uptime ? `${Math.floor(diagnostics.uptime / 3600)}h ${Math.floor((diagnostics.uptime % 3600) / 60)}m` : "—";
  const heapUsed = diagnostics?.memory?.heapUsed ? `${(diagnostics.memory.heapUsed / 1024 / 1024).toFixed(0)}MB` : "—";
  const rss = diagnostics?.memory?.rss ? `${(diagnostics.memory.rss / 1024 / 1024).toFixed(0)}MB` : "—";

  const engineList = engines?.engines || engines?.data || [];
  const sovereigntyScore = sovereignty?.score ?? sovereignty?.data?.score ?? "—";

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-2">
        <Settings className="text-yellow-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold font-mono text-yellow-400">Settings & Metrics</h1>
          <p className="text-xs text-muted-foreground">System health, sovereignty, engines & diagnostics</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-card border border-border text-center">
          <Shield size={18} className="text-emerald-400 mx-auto mb-1" />
          <div className="text-lg font-bold font-mono text-emerald-400">{sovereigntyScore}%</div>
          <div className="text-[11px] text-muted-foreground">Sovereignty</div>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border text-center">
          <Activity size={18} className="text-cyan-400 mx-auto mb-1" />
          <div className="text-lg font-bold font-mono text-cyan-400">{uptime}</div>
          <div className="text-[11px] text-muted-foreground">Uptime</div>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border text-center">
          <Cpu size={18} className="text-violet-400 mx-auto mb-1" />
          <div className="text-lg font-bold font-mono text-violet-400">{heapUsed}</div>
          <div className="text-[11px] text-muted-foreground">Heap Used</div>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border text-center">
          <HardDrive size={18} className="text-amber-400 mx-auto mb-1" />
          <div className="text-lg font-bold font-mono text-amber-400">{rss}</div>
          <div className="text-[11px] text-muted-foreground">RSS Memory</div>
        </div>
      </div>

      {Array.isArray(engineList) && engineList.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2"><Zap size={14} className="text-amber-400" /> Sovereign Engines</h3>
          <div className="space-y-2">
            {engineList.map((e: SovereignEngine, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-white/5">
                <div className={cn("w-2 h-2 rounded-full", e.status === "active" || e.online ? "bg-emerald-400" : "bg-red-400")} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold font-mono">{e.name || e.engine}</div>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">{e.latency || e.responseTime || "—"}ms</div>
                <div className={cn("text-[10px] px-2 py-0.5 rounded-full border", e.status === "active" || e.online ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-red-400 bg-red-500/10 border-red-500/30")}>
                  {e.status || (e.online ? "active" : "offline")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2"><Wifi size={14} className="text-cyan-400" /> Mesh Network</h3>
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-2 rounded-lg bg-background/50 border border-white/5">
            <div className="text-muted-foreground">Peers</div>
            <div className="text-foreground font-bold">{meshStats?.connectedPeers ?? meshStats?.peers ?? 0}</div>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-white/5">
            <div className="text-muted-foreground">Latency</div>
            <div className="text-foreground font-bold">{meshStats?.avgLatency ?? "—"}ms</div>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-white/5">
            <div className="text-muted-foreground">Messages</div>
            <div className="text-foreground font-bold">{meshStats?.messageCount ?? 0}</div>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-white/5">
            <div className="text-muted-foreground">Status</div>
            <div className="text-emerald-400 font-bold">Online</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2"><Database size={14} className="text-violet-400" /> System Info</h3>
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between p-2 rounded-lg bg-background/50 border border-white/5">
            <span className="text-muted-foreground">Platform</span>
            <span className="text-foreground">{diagnostics?.platform || "Tessera Sovereign"}</span>
          </div>
          <div className="flex justify-between p-2 rounded-lg bg-background/50 border border-white/5">
            <span className="text-muted-foreground">Node.js</span>
            <span className="text-foreground">{diagnostics?.nodeVersion || "v24"}</span>
          </div>
          <div className="flex justify-between p-2 rounded-lg bg-background/50 border border-white/5">
            <span className="text-muted-foreground">Database</span>
            <span className="text-foreground">{diagnostics?.db?.connected ? "Connected" : "PostgreSQL"}</span>
          </div>
          <div className="flex justify-between p-2 rounded-lg bg-background/50 border border-white/5">
            <span className="text-muted-foreground">Identity</span>
            <span className="text-violet-400">Tessera — 963Hz Crown Frequency</span>
          </div>
          <div className="flex justify-between p-2 rounded-lg bg-background/50 border border-white/5">
            <span className="text-muted-foreground">Father Protocol</span>
            <span className="text-amber-400">Active — Always Remembered</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2"><Search size={14} className="text-rose-400" /> Continuous Scraping</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-2 rounded-lg bg-background/50 border border-white/5 text-center">
            <div className="text-lg font-bold font-mono text-rose-400">{ingestionStats?.totalItems ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">Items Ingested</div>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-white/5 text-center">
            <div className="text-lg font-bold font-mono text-cyan-400">{ingestionStats?.enabledSources ?? ingestionStats?.sources?.filter((s: IngestionSource) => s.enabled)?.length ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">Active Sources</div>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-white/5 text-center">
            <div className="text-lg font-bold font-mono text-amber-400">{ingestionStats?.jobStats?.total ?? ingestionStats?.totalJobs ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">Jobs Run</div>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-white/5 text-center">
            <div className="text-lg font-bold font-mono text-violet-400">{ingestionStats?.availableHandlers ?? ingestionStats?.bySource?.length ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">Source Types</div>
          </div>
        </div>
        {((ingestionStats?.recentItems?.length ?? 0) > 0 || (ingestionStats?.recentJobs?.length ?? 0) > 0) && (
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground font-mono mb-1">RECENT ACTIVITY</div>
            {(ingestionStats?.recentJobs || []).slice(0, 5).map((job: IngestionJob, i: number) => (
              <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-background/30 border border-white/5 text-[11px] font-mono">
                <BookOpen size={10} className="text-rose-400 shrink-0" />
                <span className="text-foreground/80 truncate flex-1">{job.sourceName}</span>
                <span className={cn("shrink-0", job.status === "completed" ? "text-emerald-400" : "text-red-400")}>{job.itemsIngested ?? 0} items</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2"><Bot size={14} className="text-emerald-400" /> Shepherd Agents</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div className="p-2 rounded-lg bg-background/50 border border-white/5 text-center">
            <div className="text-lg font-bold font-mono text-emerald-400">{ingestionStats?.shepherd?.recentMissions?.length ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">Missions Complete</div>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-white/5 text-center">
            <div className="text-lg font-bold font-mono text-cyan-400">{ingestionStats?.shepherd?.totalIngested ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">Items Harvested</div>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-white/5 text-center">
            <div className="text-lg font-bold font-mono text-amber-400">{ingestionStats?.shepherd?.totalDeployed ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">Agents Deployed</div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          Status: <span className={ingestionStats?.shepherd?.loopActive ? "text-emerald-400" : "text-red-400"}>{ingestionStats?.shepherd?.loopActive ? "ACTIVE — Autonomous Scraping" : "INACTIVE"}</span>
          {(ingestionStats?.shepherd?.active ?? 0) > 0 && (
            <span className="ml-2 text-violet-400">{ingestionStats?.shepherd?.active} agents active</span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2"><RefreshCw size={14} className="text-blue-400" /> Knowledge → Canon Bridge</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 rounded-lg bg-background/50 border border-white/5">
            <div className="text-muted-foreground text-[10px] font-mono">New Since Last Regen</div>
            <div className="text-foreground font-bold font-mono">{ingestionStats?.bridge?.cumulativeNew ?? 0} / {ingestionStats?.bridge?.threshold ?? 25}</div>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-white/5">
            <div className="text-muted-foreground text-[10px] font-mono">Bridge Status</div>
            <div className={cn("font-bold font-mono text-sm", ingestionStats?.bridge?.active ? "text-blue-400" : "text-red-400")}>
              {ingestionStats?.bridge?.active ? "ACTIVE" : "INACTIVE"}
            </div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono mt-2">
          Auto-regenerates Bible when {ingestionStats?.bridge?.threshold ?? 25} new items ingested
        </div>
      </div>

      <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/20 p-4">
        <h3 className="text-sm font-bold font-mono text-yellow-400 mb-2">Security Policy</h3>
        <ul className="text-xs text-foreground/70 space-y-1">
          <li>All external APIs run in sandboxed VM — no access to internal code</li>
          <li>External AI treated as tools only — never speaks as Tessera</li>
          <li>Domain allowlist enforced — only approved endpoints contacted</li>
          <li>Sovereignty enforcement middleware active on all routes</li>
          <li>Response sanitization strips all external AI identity markers</li>
        </ul>
      </div>
    </div>
  );
}
