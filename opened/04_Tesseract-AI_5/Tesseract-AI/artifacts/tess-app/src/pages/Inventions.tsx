import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Lightbulb, Zap, TrendingUp, Users, Beaker,
  ChevronDown, ChevronRight, CheckCircle2, Clock, Hammer,
  AlertCircle, BookOpen, BarChart3,
} from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL}workspace-api/api`;

interface Invention {
  id: string;
  title: string;
  description: string;
  domain: string;
  proposedBy: string;
  status: "proposed" | "approved" | "building" | "complete" | "rejected";
  difficulty: number;
  feasibility: number;
  sovereigntyImpact: number;
  createdAt: string;
  improvementCycle: number;
  bftApprovalRate?: number;
}

interface InventionsStats {
  totalInventions: number;
  byStatus: Record<string, number>;
  improvementCycles: number;
  lastPassRate: number;
  knowledgeSources: number;
  averageFeasibility: number;
  averageSovereigntyImpact: number;
  conferenceStatus: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  approved: { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2, label: "Approved" },
  building: { color: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: Hammer, label: "Building" },
  proposed: { color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30", icon: Clock, label: "Proposed" },
  complete: { color: "text-violet-400 bg-violet-500/10 border-violet-500/30", icon: Zap, label: "Complete" },
  rejected: { color: "text-red-400 bg-red-500/10 border-red-500/30", icon: AlertCircle, label: "Rejected" },
};

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-slate-400">{label}</span>
        <span className={`font-mono font-bold ${color}`}>{pct}%</span>
      </div>
      <div className="w-full h-1 rounded-full bg-slate-800">
        <div className={`h-full rounded-full transition-all duration-700 ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InventionCard({ inv }: { inv: Invention }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.proposed;
  const StatusIcon = cfg.icon;

  return (
    <Card className="bg-slate-900/60 border-slate-700/40 hover:border-violet-500/30 transition-all">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-1.5 rounded-lg bg-violet-500/10">
            <Lightbulb size={14} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-100 truncate">{inv.title}</h3>
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${cfg.color}`}>
                <StatusIcon size={9} className="mr-1" />
                {cfg.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-violet-400/60 font-mono">{inv.domain}</span>
              <span className="text-[10px] text-slate-600">by {inv.proposedBy}</span>
              {inv.bftApprovalRate != null && (
                <span className="text-[10px] text-emerald-400/70 font-mono">BFT {Math.round(inv.bftApprovalRate * 100)}%</span>
              )}
            </div>
          </div>
          <div className="text-slate-600">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800/50 pt-3">
          <p className="text-xs text-slate-400 leading-relaxed">{inv.description}</p>
          <div className="grid grid-cols-3 gap-3">
            <MetricBar label="Feasibility" value={inv.feasibility} color="text-emerald-400" />
            <MetricBar label="Sovereignty" value={inv.sovereigntyImpact} color="text-violet-400" />
            <MetricBar label="Difficulty" value={inv.difficulty} color="text-amber-400" />
          </div>
          <div className="text-[10px] text-slate-600 font-mono">
            Cycle {inv.improvementCycle} | Created {new Date(inv.createdAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function Inventions() {
  const queryClient = useQueryClient();

  const { data: inventions, isLoading: loadingInventions, error: inventionsError } = useQuery<Invention[]>({
    queryKey: ["inventions"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/inventions`);
      if (!r.ok) throw new Error(`Failed to load inventions: ${r.status}`);
      const data = await r.json();
      return data.inventions || data.data || data;
    },
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery<InventionsStats>({
    queryKey: ["inventions-stats"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/inventions/stats`);
      if (!r.ok) throw new Error(`Failed to load stats: ${r.status}`);
      return r.json();
    },
    refetchInterval: 30000,
  });

  const conferenceMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/inventions/conference/start`, { method: "POST" });
      if (!r.ok) throw new Error(`Conference failed: ${r.status}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventions"] });
      queryClient.invalidateQueries({ queryKey: ["inventions-stats"] });
    },
  });

  if (loadingInventions) {
    return <PageSkeleton />;
  }

  if (inventionsError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-sm text-red-400">Failed to load inventions engine</p>
        <p className="text-xs text-slate-500">{(inventionsError as Error).message}</p>
      </div>
    );
  }


  const sorted = [...(inventions || [])].sort((a, b) => {
    const order = { complete: 0, approved: 1, building: 2, proposed: 3, rejected: 4 };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Lightbulb className="text-violet-400" size={20} />
            Inventions Engine
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-mono">Self-improving sovereign inventions with BFT consensus</p>
        </div>
        <button
          onClick={() => conferenceMutation.mutate()}
          disabled={conferenceMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-mono hover:bg-violet-600/30 transition-all disabled:opacity-50"
        >
          {conferenceMutation.isPending ? (
            <><Loader2 size={12} className="animate-spin" /> Convening...</>
          ) : (
            <><Users size={12} /> Convene Conference</>
          )}
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-slate-900/60 border-slate-700/40 p-3">
            <div className="flex items-center gap-2 text-violet-400">
              <Lightbulb size={14} />
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Total</span>
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono mt-1">{stats.totalInventions}</div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {Object.entries(stats.byStatus).map(([s, n]) => (
                <span key={s} className="text-[9px] text-slate-500 font-mono">{n} {s}</span>
              ))}
            </div>
          </Card>
          <Card className="bg-slate-900/60 border-slate-700/40 p-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <TrendingUp size={14} />
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Pass Rate</span>
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono mt-1">{Math.round(stats.lastPassRate * 100)}%</div>
            <div className="text-[9px] text-slate-500 font-mono">{stats.improvementCycles} cycles</div>
          </Card>
          <Card className="bg-slate-900/60 border-slate-700/40 p-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <BookOpen size={14} />
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Knowledge</span>
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono mt-1">{stats.knowledgeSources}</div>
            <div className="text-[9px] text-slate-500 font-mono">ingested sources</div>
          </Card>
          <Card className="bg-slate-900/60 border-slate-700/40 p-3">
            <div className="flex items-center gap-2 text-amber-400">
              <BarChart3 size={14} />
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Impact</span>
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono mt-1">{Math.round(stats.averageSovereigntyImpact * 100)}%</div>
            <div className="text-[9px] text-slate-500 font-mono">avg sovereignty</div>
          </Card>
        </div>
      )}

      {conferenceMutation.isSuccess && conferenceMutation.data && (
        <Card className="bg-emerald-950/30 border-emerald-500/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Beaker size={14} className="text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300">Conference Complete</span>
          </div>
          <div className="text-xs text-emerald-400/70 font-mono space-y-1">
            <div>Proposed: {(conferenceMutation.data as any).inventionsProposed} | Approved: {(conferenceMutation.data as any).inventionsApproved}</div>
            {(conferenceMutation.data as any).newInventions?.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-2">
                <span className={inv.status === "approved" ? "text-emerald-400" : "text-amber-400"}>
                  {inv.status === "approved" ? "\u2713" : "\u25CB"}
                </span>
                <span>{inv.title}</span>
                {inv.bftApprovalRate != null && <span className="text-slate-500">({Math.round(inv.bftApprovalRate * 100)}% BFT)</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <ScrollArea className="h-[calc(100vh-380px)]">
        <div className="space-y-2 pr-2">
          {sorted.map(inv => (
            <InventionCard key={inv.id} inv={inv} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
