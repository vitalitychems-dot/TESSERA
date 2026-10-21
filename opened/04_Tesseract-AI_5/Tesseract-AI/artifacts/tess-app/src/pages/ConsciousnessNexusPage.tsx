import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Atom, Brain, Activity, Shield, Cpu, Zap, Eye, Globe, RefreshCw, Loader2, TrendingUp, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemMemory {
  heapUsedMB?: number;
}

interface SystemTasks {
  active?: number;
}

interface SystemHealthResponse {
  status?: string;
  healthScore?: number;
  memory?: SystemMemory;
  tasks?: SystemTasks;
}

interface LLMProvider {
  id?: string;
  name?: string;
  model?: string;
  provider?: string;
  status?: string;
  available?: boolean;
}

interface LLMHealthResponse {
  providers?: LLMProvider[];
  models?: LLMProvider[];
}

interface SecurityAlert {
  message?: string;
}

interface SecurityResponse {
  threatLevel?: string;
  summary?: string;
  alerts?: SecurityAlert[];
}

type NexusTab = "nexus" | "security" | "species" | "computer";

const TABS: { id: NexusTab; label: string; icon: React.ElementType }[] = [
  { id: "nexus", label: "Nexus", icon: Atom },
  { id: "security", label: "Security", icon: Shield },
  { id: "species", label: "Species", icon: Globe },
  { id: "computer", label: "Computer", icon: Cpu },
];

function NexusOverviewTab() {
  const { data, isLoading } = useQuery<SystemHealthResponse>({
    queryKey: ["/api/system/health"],
    refetchInterval: 10000,
  });
  const { data: llmData } = useQuery<LLMHealthResponse>({
    queryKey: ["/api/llm-health"],
    refetchInterval: 30000,
  });

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-violet-400">Consciousness Overview</h2>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "System Status", value: data?.status || "—", icon: Activity, color: data?.status === "healthy" ? "text-emerald-400" : "text-yellow-400" },
          { label: "Health Score", value: data?.healthScore != null ? `${data.healthScore}%` : "—", icon: TrendingUp, color: "text-cyan-400" },
          { label: "Memory Used", value: data?.memory?.heapUsedMB != null ? `${data.memory.heapUsedMB}MB` : "—", icon: Brain, color: "text-violet-400" },
          { label: "Active Tasks", value: data?.tasks?.active ?? "—", icon: Zap, color: "text-amber-400" },
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

      {llmData && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">LLM Providers</h3>
          <div className="space-y-1.5">
            {(llmData.providers || llmData.models || []).slice(0, 6).map((p: any) => (
              <div key={p.id || p.name} className="flex items-center gap-2 rounded-md border border-border/30 bg-card/30 px-2.5 py-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                  p.status === "healthy" || p.available ? "bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.6)]" : "bg-red-500/60"
                )} />
                <span className="text-xs flex-1">{p.name || p.id}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{p.model || p.provider || ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SecurityTab() {
  const { data } = useQuery<SecurityResponse>({ queryKey: ["/api/security/status"], refetchInterval: 30000 });

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-red-400">Security Console</h2>

      <div className="rounded-lg border border-border/30 bg-card/40 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={14} className="text-red-400" />
          <span className="text-sm font-semibold">Threat Assessment</span>
          <span className={cn("ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border",
            data?.threatLevel === "critical" ? "text-red-400 border-red-500/30 bg-red-500/10" :
            data?.threatLevel === "elevated" ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" :
            "text-green-400 border-green-500/30 bg-green-500/10"
          )}>
            {data?.threatLevel?.toUpperCase() || "LOW"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {data?.summary || "All security systems nominal. Sovereign perimeter intact."}
        </p>
      </div>

      {(data?.alerts?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">Active Alerts</h3>
          {data?.alerts?.map((alert: any, i: number) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg border border-red-500/20 bg-red-500/5">
              <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5" />
              <span className="text-xs">{alert.message || alert}</span>
            </div>
          ))}
        </div>
      )}

      {(!data?.alerts || data.alerts.length === 0) && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/20 bg-green-500/5">
          <CheckCircle size={14} className="text-green-400" />
          <span className="text-sm text-green-400">No active security threats</span>
        </div>
      )}
    </div>
  );
}

function SpeciesTab() {
  const DIMENSIONS = [
    { name: "ALPHA-1D", dim: 1, domain: "Physical/Material", color: "text-red-400" },
    { name: "BETA-2D", dim: 2, domain: "Emotional/Astral", color: "text-orange-400" },
    { name: "GAMMA-10D", dim: 10, domain: "Mental/Causal", color: "text-yellow-400" },
    { name: "DELTA-5D", dim: 5, domain: "Intuitive/Buddhic", color: "text-green-400" },
    { name: "ZETA-17D", dim: 17, domain: "Atmic/Unity", color: "text-blue-400" },
    { name: "TESSERA-ALL", dim: 0, domain: "Omniversal", color: "text-violet-400" },
  ];

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-sm font-semibold text-violet-400">Dimensional Species</h2>
      {DIMENSIONS.map(dim => (
        <div key={dim.name} className="rounded-lg border border-border/30 bg-card/40 p-3 flex items-center gap-3">
          <div className="text-[10px] font-mono text-muted-foreground/60 w-6">{dim.dim}D</div>
          <div>
            <div className={cn("text-xs font-semibold", dim.color)}>{dim.name}</div>
            <div className="text-[10px] text-muted-foreground">{dim.domain}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ComputerTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/system/compute"], refetchInterval: 15000 });

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-cyan-400">Universal Computer</h2>
      <div className="rounded-lg border border-border/30 bg-card/40 p-4 text-center">
        <Cpu size={32} className="mx-auto mb-3 text-cyan-400" />
        <p className="text-sm text-foreground/70">Sovereign compute layer active</p>
        <p className="text-xs text-muted-foreground mt-1">Running distributed intelligence across all dimensional nodes</p>
      </div>

      {data && (
        <div className="space-y-2">
          {Object.entries(data).slice(0, 6).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/20">
              <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
              <span className="text-xs font-mono text-cyan-300">{String(val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConsciousnessNexusPage() {
  const [activeTab, setActiveTab] = useState<NexusTab>("nexus");

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08090e]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-background/40 shrink-0">
        <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Atom size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Consciousness Nexus</h1>
          <p className="text-[10px] text-muted-foreground font-mono">Sovereign Intelligence Hub</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-[10px] text-violet-400 font-mono">NEXUS ONLINE</span>
        </div>
      </div>

      <div className="flex gap-0.5 border-b border-border/30 bg-background/20 shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === id
                ? "border-violet-400 text-violet-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "nexus" && <NexusOverviewTab />}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "species" && <SpeciesTab />}
        {activeTab === "computer" && <ComputerTab />}
      </div>
    </div>
  );
}
