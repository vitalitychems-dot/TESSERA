import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Users, Globe, Activity, Crown, Shield, Vote, Trophy, MapPin, Loader2, RefreshCw, MessageSquare, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LifeTab = "world" | "agents" | "governance" | "society";

const TABS: { id: LifeTab; label: string; icon: React.ElementType }[] = [
  { id: "world", label: "World Map", icon: Globe },
  { id: "agents", label: "Agents", icon: Users },
  { id: "governance", label: "Governance", icon: Crown },
  { id: "society", label: "Society", icon: Building2 },
];

function WorldTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/life/world"], refetchInterval: 15000 });

  const regions = data?.regions || data?.locations || [];

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total Agents", value: data?.totalAgents ?? "—", color: "text-cyan-400" },
          { label: "Active Regions", value: data?.activeRegions ?? regions.length ?? "—", color: "text-emerald-400" },
          { label: "World Events", value: data?.events ?? "—", color: "text-violet-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border/30 bg-card/40 p-2.5 text-center">
            <div className="text-[10px] text-muted-foreground">{label}</div>
            <div className={cn("text-base font-bold font-mono mt-0.5", color)}>{String(value)}</div>
          </div>
        ))}
      </div>

      {regions.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">Regions</h3>
          <div className="space-y-1.5">
            {regions.slice(0, 8).map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border/30 bg-card/30 px-2.5 py-2">
                <MapPin size={11} className="text-pink-400 shrink-0" />
                <span className="text-xs flex-1">{r.name || r.id}</span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">{r.population || r.agentCount || 0} agents</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {regions.length === 0 && (
        <div className="rounded-lg border border-border/30 bg-card/40 p-8 text-center">
          <Globe size={32} className="mx-auto mb-3 text-pink-400/40" />
          <p className="text-sm text-muted-foreground">Connecting to Life World...</p>
        </div>
      )}
    </div>
  );
}

function AgentsTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/life/agents"], refetchInterval: 10000 });
  const agents = data?.agents || data || [];

  return (
    <div className="p-4 space-y-3">
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary/50" /></div>
      ) : (
        <div className="space-y-2">
          {(Array.isArray(agents) ? agents : []).slice(0, 15).map((agent: any, i: number) => (
            <div key={agent.id || i} className="rounded-lg border border-border/30 bg-card/40 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/40 to-blue-500/30 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                {(agent.name || "A").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{agent.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{agent.role}</div>
              </div>
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                agent.status === "active" || agent.online ? "bg-green-400" : "bg-muted-foreground/40"
              )} />
            </div>
          ))}
          {(Array.isArray(agents) ? agents : []).length === 0 && (
            <div className="text-center py-12 text-muted-foreground/40">
              <Users size={32} className="mx-auto mb-2" />
              <p className="text-sm">No agents data</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GovernanceTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/life/governance"], refetchInterval: 30000 });
  const proposals = data?.proposals || [];

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground">Active Governance</h3>
      {proposals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground/40">
          <Vote size={32} className="mx-auto mb-2" />
          <p className="text-sm">No active proposals</p>
        </div>
      ) : (
        proposals.map((p: any, i: number) => (
          <div key={i} className="rounded-lg border border-border/30 bg-card/40 p-3">
            <div className="text-sm font-semibold">{p.title}</div>
            <div className="flex gap-2 mt-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-mono">YES {p.yesVotes || 0}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-mono">NO {p.noVotes || 0}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SocietyTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/life/society"], refetchInterval: 60000 });

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground">Society Status</h3>
      <div className="rounded-lg border border-border/30 bg-card/40 p-4 text-center">
        <Building2 size={32} className="mx-auto mb-3 text-pink-400/40" />
        <p className="text-sm text-muted-foreground">
          {data?.summary || "Sovereign society operating nominally"}
        </p>
      </div>

      {data?.guilds?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Guilds</h4>
          <div className="space-y-1.5">
            {data.guilds.map((g: any, i: number) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border/30 bg-card/30 px-2.5 py-2">
                <Shield size={11} className="text-violet-400 shrink-0" />
                <span className="text-xs flex-1">{g.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{g.members || 0} members</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LifePage({ embedded }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<LifeTab>("world");

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08090e]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-background/40 shrink-0">
        <div className="p-1.5 rounded-lg bg-pink-500/10 border border-pink-500/20">
          <Heart size={16} className="text-pink-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Life World</h1>
          <p className="text-[10px] text-muted-foreground font-mono">Sovereign Civilization Simulation</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
          <span className="text-[10px] text-pink-400 font-mono">WORLD ACTIVE</span>
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
                ? "border-pink-400 text-pink-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "world" && <WorldTab />}
        {activeTab === "agents" && <AgentsTab />}
        {activeTab === "governance" && <GovernanceTab />}
        {activeTab === "society" && <SocietyTab />}
      </div>
    </div>
  );
}
