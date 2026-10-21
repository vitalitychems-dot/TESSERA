import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Shield, Users, Eye, Key, Crown, RefreshCw, Loader2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type SocietyTab = "overview" | "members" | "protocols" | "operations";

const TABS: { id: SocietyTab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "members", label: "Members", icon: Users },
  { id: "protocols", label: "Protocols", icon: Key },
  { id: "operations", label: "Operations", icon: Activity },
];

function OverviewTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/secret-society/status"], refetchInterval: 30000 });

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={14} className="text-amber-400" />
          <span className="text-sm font-semibold text-amber-400">Classified</span>
        </div>
        <p className="text-xs text-muted-foreground">
          This section contains highly sensitive operational data. Access is restricted to cleared agents only.
        </p>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/30 bg-card/40 p-3">
            <div className="text-[10px] text-muted-foreground">Society Members</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">{data.memberCount ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-border/30 bg-card/40 p-3">
            <div className="text-[10px] text-muted-foreground">Active Missions</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">{data.activeMissions ?? "—"}</div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {["Alpha Circle", "Beta Division", "Gamma Operatives", "Delta Council", "Omega Inner Sanctum"].map((tier, i) => (
          <div key={tier} className="flex items-center gap-3 rounded-md border border-amber-500/10 bg-amber-500/5 px-3 py-2">
            <Crown size={11} className="text-amber-400/60 shrink-0" />
            <span className="text-xs">{tier}</span>
            <div className="ml-auto flex gap-0.5">
              {Array.from({ length: 5 - i }).map((_, j) => (
                <div key={j} className="w-1 h-1 rounded-full bg-amber-400/60" />
              ))}
              {Array.from({ length: i }).map((_, j) => (
                <div key={j} className="w-1 h-1 rounded-full bg-amber-400/10" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MembersTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/secret-society/members"], refetchInterval: 60000 });
  const members = data?.members || [];

  return (
    <div className="p-4 space-y-3">
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-amber-400" /></div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground/40">
          <Lock size={32} className="mx-auto mb-2" />
          <p className="text-sm">Member registry restricted</p>
        </div>
      ) : (
        members.map((m: any, i: number) => (
          <div key={i} className="flex items-center gap-3 rounded-md border border-amber-500/10 bg-amber-500/5 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-300">
              {(m.codename || m.name || "?").charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{m.codename || m.name}</div>
              <div className="text-[10px] text-amber-500/60 font-mono">{m.clearanceLevel || m.tier || "—"}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ProtocolsTab() {
  const PROTOCOLS = [
    { code: "ALPHA-1", name: "Silent Entry", desc: "Zero-trace infiltration procedures" },
    { code: "BETA-7", name: "Dead Drop", desc: "Secure information exchange protocols" },
    { code: "GAMMA-3", name: "Ghost Protocol", desc: "Identity concealment and asset protection" },
    { code: "DELTA-9", name: "Black Swan", desc: "Crisis response and containment" },
    { code: "OMEGA-0", name: "Sovereign Shield", desc: "Maximum security defensive posture" },
  ];

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground">Operational Protocols</h3>
      {PROTOCOLS.map(p => (
        <div key={p.code} className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-amber-400/60">[{p.code}]</span>
            <span className="text-sm font-semibold">{p.name}</span>
            <Lock size={10} className="text-amber-400/40 ml-auto" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
        </div>
      ))}
    </div>
  );
}

function OperationsTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/secret-society/operations"], refetchInterval: 30000 });
  const ops = data?.operations || [];

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground">Active Operations</h3>
      {ops.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground/40">
          <Shield size={32} className="mx-auto mb-2" />
          <p className="text-sm">All operations classified</p>
        </div>
      ) : (
        ops.map((op: any, i: number) => (
          <div key={i} className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
            <div className="text-xs font-semibold">{op.codename || `Operation ${i + 1}`}</div>
            <div className={cn("text-[10px] font-mono mt-0.5",
              op.status === "active" ? "text-amber-400 animate-pulse" : "text-muted-foreground"
            )}>{op.status || "classified"}</div>
          </div>
        ))
      )}
    </div>
  );
}

export default function SecretSocietyPage() {
  const [activeTab, setActiveTab] = useState<SocietyTab>("overview");

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08090e]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-background/40 shrink-0">
        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Lock size={16} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Secret Society</h1>
          <p className="text-[10px] text-muted-foreground font-mono">Eyes Only — Clearance Required</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[10px] text-red-400 font-mono">CLASSIFIED</span>
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
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "members" && <MembersTab />}
        {activeTab === "protocols" && <ProtocolsTab />}
        {activeTab === "operations" && <OperationsTab />}
      </div>
    </div>
  );
}
