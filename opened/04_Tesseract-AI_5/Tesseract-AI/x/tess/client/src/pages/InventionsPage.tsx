import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  FlaskConical, Zap, Star, ChevronDown, ChevronRight, Loader2,
  Users, Trophy, Clock, RefreshCw, Lightbulb, Rocket, CheckCircle2,
  Vote, Crown, Sparkles, Globe, Target, BarChart3, AlertTriangle,
  ThumbsUp, ThumbsDown, Brain, Send, Play,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function timeAgo(ts: number | string | undefined) {
  if (!ts) return "—";
  const t = typeof ts === "string" ? new Date(ts).getTime() : ts;
  const d = Math.floor((Date.now() - t) / 1000);
  if (d < 5) return "just now";
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

interface Invention {
  id: string;
  title: string;
  description: string;
  proposedBy: string;
  proposedAt: number;
  category: string;
  status: "proposed" | "debating" | "approved" | "rejected" | "building" | "built";
  votes: { yes: number; no: number; abstain: number };
  conferenceRound: number;
  impact: string;
  feasibility: number;
  novelty: number;
  supporters: string[];
  blueprint?: string;
  buildProgress?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  "technology": "border-cyan-500/30 bg-cyan-500/5 text-cyan-400",
  "medicine": "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
  "energy": "border-yellow-500/30 bg-yellow-500/5 text-yellow-400",
  "communication": "border-violet-500/30 bg-violet-500/5 text-violet-400",
  "transportation": "border-blue-500/30 bg-blue-500/5 text-blue-400",
  "food": "border-green-500/30 bg-green-500/5 text-green-400",
  "consciousness": "border-pink-500/30 bg-pink-500/5 text-pink-400",
  "infrastructure": "border-amber-500/30 bg-amber-500/5 text-amber-400",
  "defense": "border-red-500/30 bg-red-500/5 text-red-400",
  "arts": "border-rose-500/30 bg-rose-500/5 text-rose-400",
};

const STATUS_COLORS: Record<string, string> = {
  "proposed": "bg-slate-500/20 text-slate-400",
  "debating": "bg-amber-500/20 text-amber-400",
  "approved": "bg-emerald-500/20 text-emerald-400",
  "rejected": "bg-red-500/20 text-red-400",
  "building": "bg-cyan-500/20 text-cyan-400",
  "built": "bg-violet-500/20 text-violet-400",
};

function InventionCard({ invention }: { invention: Invention }) {
  const [expanded, setExpanded] = useState(false);
  const totalVotes = invention.votes.yes + invention.votes.no + invention.votes.abstain;
  const approvalPct = totalVotes > 0 ? Math.round((invention.votes.yes / totalVotes) * 100) : 0;
  const catColor = CATEGORY_COLORS[invention.category?.toLowerCase()] || "border-slate-500/30 bg-slate-500/5 text-slate-400";

  return (
    <Card className={cn("overflow-hidden border border-white/10 bg-slate-900/60")} data-testid={`invention-${invention.id}`}>
      <div
        className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(o => !o)}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0 mt-0.5">
            <FlaskConical size={14} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-white leading-tight">{invention.title}</h3>
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 mt-0.5", STATUS_COLORS[invention.status] || "bg-slate-500/20 text-slate-400")}>
                {invention.status}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2 mb-2">{invention.description}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded border", catColor)}>{invention.category}</span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Users size={8} /> {invention.proposedBy}
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock size={8} /> {timeAgo(invention.proposedAt)}
              </span>
              {totalVotes > 0 && (
                <span className={cn("text-[9px] font-bold", approvalPct >= 60 ? "text-emerald-400" : approvalPct >= 40 ? "text-amber-400" : "text-red-400")}>
                  {approvalPct}% approval
                </span>
              )}
            </div>
          </div>
          {expanded ? <ChevronDown size={14} className="text-slate-500 shrink-0 mt-1" /> : <ChevronRight size={14} className="text-slate-500 shrink-0 mt-1" />}
        </div>

        {invention.status === "building" && typeof invention.buildProgress === "number" && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-cyan-400">Build Progress</span>
              <span className="text-[10px] text-cyan-400 font-bold">{invention.buildProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${invention.buildProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-white/[0.06] p-4 space-y-3 bg-slate-950/50">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-700/30 bg-slate-800/30 p-2 text-center">
              <div className="text-sm font-bold text-emerald-400">{invention.feasibility}%</div>
              <div className="text-[9px] text-slate-500">Feasibility</div>
            </div>
            <div className="rounded-lg border border-slate-700/30 bg-slate-800/30 p-2 text-center">
              <div className="text-sm font-bold text-violet-400">{invention.novelty}%</div>
              <div className="text-[9px] text-slate-500">Novelty</div>
            </div>
            <div className="rounded-lg border border-slate-700/30 bg-slate-800/30 p-2 text-center">
              <div className="text-sm font-bold text-amber-400">R{invention.conferenceRound}</div>
              <div className="text-[9px] text-slate-500">Round</div>
            </div>
          </div>

          {invention.impact && (
            <div className="rounded-lg border border-violet-500/10 bg-violet-950/20 p-3">
              <p className="text-[10px] text-violet-400 font-bold uppercase mb-1">Impact</p>
              <p className="text-xs text-slate-300 leading-relaxed">{invention.impact}</p>
            </div>
          )}

          {invention.blueprint && (
            <div className="rounded-lg border border-emerald-500/10 bg-emerald-950/20 p-3">
              <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Blueprint</p>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{invention.blueprint}</p>
            </div>
          )}

          {invention.supporters?.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1.5">Supporters ({invention.supporters.length})</p>
              <div className="flex flex-wrap gap-1">
                {invention.supporters.map((s, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">{s}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-1 text-[10px] text-emerald-400">
              <ThumbsUp size={10} /> {invention.votes.yes} Yes
            </div>
            <div className="flex items-center gap-1 text-[10px] text-red-400">
              <ThumbsDown size={10} /> {invention.votes.no} No
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              {invention.votes.abstain} Abstain
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function ConferenceStatus({ data }: { data: any }) {
  if (!data) return null;
  const conf = data.conference || data;
  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-slate-950 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Crown size={14} className="text-amber-400" />
        <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Grand Inventions Conference</span>
        {conf.status && (
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded ml-auto font-bold uppercase",
            conf.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
            conf.status === "voting" ? "bg-amber-500/20 text-amber-400" :
            "bg-slate-500/20 text-slate-400"
          )}>
            {conf.status}
          </span>
        )}
      </div>
      {conf.topic && <p className="text-xs text-slate-300 mb-1 font-medium">{conf.topic}</p>}
      {conf.description && <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">{conf.description}</p>}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="text-center">
          <div className="text-sm font-bold text-amber-300">{conf.participants || conf.agentCount || "—"}</div>
          <div className="text-[9px] text-slate-500">Participants</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-cyan-300">{conf.inventionsProposed || conf.proposalCount || "—"}</div>
          <div className="text-[9px] text-slate-500">Proposed</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-emerald-300">{conf.inventionsApproved || conf.approvedCount || "—"}</div>
          <div className="text-[9px] text-slate-500">Approved</div>
        </div>
      </div>
    </div>
  );
}

export default function InventionsPage({ embedded }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<"all" | "approved" | "building" | "conference">("all");
  const [triggeringConference, setTriggeringConference] = useState(false);
  const { toast } = useToast();

  const { data: inventionsData, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/inventions"],
    refetchInterval: 20000,
  });

  const { data: conferenceData } = useQuery<any>({
    queryKey: ["/api/inventions/conference/status"],
    refetchInterval: 15000,
  });

  const { data: grandConfData } = useQuery<any>({
    queryKey: ["/api/grand-conference/inventions"],
    refetchInterval: 30000,
  });

  const triggerConference = async () => {
    setTriggeringConference(true);
    try {
      const res = await apiRequest("POST", "/api/inventions/conference/start", {
        topic: "Grand Inventions Conference",
        description: "All agents propose and debate practical inventions to improve life in Tessera",
      });
      const result = await res.json();
      toast({
        title: "Conference started!",
        description: result.message || "Agents are gathering to propose inventions",
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/inventions/conference/status"] });
    } catch {
      toast({
        title: "Conference triggered",
        description: "Agents will propose inventions in the next cycle",
        variant: "default",
      });
    }
    setTriggeringConference(false);
  };

  const inventions: Invention[] = inventionsData?.inventions || inventionsData?.data || [];
  const filtered = activeTab === "all" ? inventions :
    activeTab === "approved" ? inventions.filter(i => i.status === "approved" || i.status === "built") :
    activeTab === "building" ? inventions.filter(i => i.status === "building") :
    inventions;

  const stats = {
    total: inventions.length,
    approved: inventions.filter(i => i.status === "approved" || i.status === "built").length,
    building: inventions.filter(i => i.status === "building").length,
    proposed: inventions.filter(i => i.status === "proposed" || i.status === "debating").length,
  };

  const content = (
    <div
      className="flex flex-col overflow-y-auto custom-scrollbar bg-gradient-to-b from-gray-950 via-slate-950 to-gray-950 text-white h-full"
      style={{ WebkitOverflowScrolling: "touch" } as any}
      data-testid="inventions-page"
    >
      <div className="max-w-lg mx-auto w-full">
        <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-md border-b border-amber-500/20 px-3 pt-3 pb-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent flex items-center gap-2">
                <FlaskConical size={18} /> Inventions
              </h1>
              <p className="text-[10px] text-slate-500">Agent-proposed practical inventions via grand conferences</p>
            </div>
            <button
              onClick={triggerConference}
              disabled={triggeringConference}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
            >
              {triggeringConference ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              Convene
            </button>
          </div>

          <div className="flex gap-1 pb-2">
            {([
              { id: "all", label: "All", count: stats.total },
              { id: "approved", label: "Approved", count: stats.approved },
              { id: "building", label: "Building", count: stats.building },
              { id: "conference", label: "Conference", count: null },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {tab.label}
                {tab.count !== null && <span className="text-[9px] opacity-70">({tab.count})</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total", value: stats.total, color: "text-slate-300", bg: "bg-slate-800/50 border-slate-700/30" },
              { label: "Approved", value: stats.approved, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "Building", value: stats.building, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
              { label: "Proposed", value: stats.proposed, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
            ].map(s => (
              <div key={s.label} className={cn("rounded-xl border p-2 text-center", s.bg)}>
                <div className={cn("text-base font-bold font-mono", s.color)}>{s.value}</div>
                <div className="text-[8px] text-slate-600 tracking-widest uppercase">{s.label}</div>
              </div>
            ))}
          </div>

          {activeTab === "conference" ? (
            <div className="space-y-3">
              {conferenceData && <ConferenceStatus data={conferenceData} />}
              {grandConfData?.conference && <ConferenceStatus data={grandConfData} />}
              {!conferenceData && !grandConfData && (
                <div className="text-center py-12">
                  <FlaskConical size={36} className="mx-auto mb-4 text-amber-400/30" />
                  <p className="text-sm text-slate-400 mb-2 font-medium">No active conference</p>
                  <p className="text-xs text-slate-500 mb-4">Tap "Convene" to start a grand inventions conference. All agents will gather to propose and debate practical inventions.</p>
                  <button
                    onClick={triggerConference}
                    disabled={triggeringConference}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors mx-auto disabled:opacity-50"
                  >
                    {triggeringConference ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                    Convene Grand Conference
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                </div>
              )}

              {!isLoading && filtered.length === 0 && (
                <div className="text-center py-12">
                  <FlaskConical size={36} className="mx-auto mb-4 text-amber-400/30" />
                  <p className="text-sm text-slate-400 mb-2 font-medium">No inventions yet</p>
                  <p className="text-xs text-slate-500 mb-4">
                    {activeTab === "building" ? "No inventions currently being built." :
                     activeTab === "approved" ? "No inventions approved yet." :
                     "Start a grand conference to have agents propose inventions."}
                  </p>
                  {activeTab === "all" && (
                    <button
                      onClick={triggerConference}
                      disabled={triggeringConference}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors mx-auto disabled:opacity-50"
                    >
                      {triggeringConference ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      Convene Grand Conference
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {filtered.map(invention => (
                  <InventionCard key={invention.id} invention={invention} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return content;
}
