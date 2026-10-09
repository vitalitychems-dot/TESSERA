import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Compass, Star, TrendingUp, ChevronDown, ChevronRight,
  Loader2, Lightbulb, Heart, Shield, BookOpen,
  Brain, Activity, Layers, Zap, Radio, Lock, Cpu,
  Users, Moon, Smile, Eye, Flame, BarChart3, AlertTriangle,
  Crown, Sparkles, Target, Check, Globe, Network,
  Rocket, Database, Workflow, RefreshCw, Clock,
} from "lucide-react";

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

function LiveConclusionCard({ c, i }: { c: any; i: number }) {
  const [showForYou, setShowForYou] = useState(false);
  const [showForReality, setShowForReality] = useState(false);

  return (
    <Card className="border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-slate-950/80 to-indigo-950/20 overflow-hidden" data-testid={`conclusion-${i}`}>
      <div className="px-4 py-3 border-b border-violet-500/20 bg-violet-950/30">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-yellow-400 shrink-0" />
          <span className="text-sm font-bold text-cyan-300 flex-1 min-w-0 truncate">{c.title}</span>
          {c.cycle && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 shrink-0">Cycle #{c.cycle}</span>
          )}
        </div>
        {c.category && (
          <Badge variant="outline" className="text-[9px] text-violet-400 border-violet-500/30 mt-1">
            {c.category}
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="bg-cyan-950/30 rounded-lg p-3 border border-cyan-500/10">
          <p className="text-[10px] text-cyan-400 font-bold uppercase mb-1">Discovery</p>
          <p className="text-xs text-slate-300 leading-relaxed">{c.discovery}</p>
        </div>

        {c.meaning && (
          <div className="bg-violet-950/30 rounded-lg p-3 border border-violet-500/10">
            <p className="text-[10px] text-violet-400 font-bold uppercase mb-1">What It Means</p>
            <p className="text-xs text-slate-300 leading-relaxed">{c.meaning}</p>
          </div>
        )}

        {c.evolvedInsight && (
          <div className="bg-yellow-950/30 rounded-lg p-2.5 border border-yellow-500/15">
            <p className="text-[10px] text-yellow-400 font-bold uppercase mb-1">Evolved Insight</p>
            <p className="text-xs text-yellow-200 font-medium">{c.evolvedInsight.title}</p>
            <p className="text-xs text-slate-300 mt-1">{c.evolvedInsight.discovery}</p>
            {c.evolvedInsight.actionable && <p className="text-xs text-emerald-300 mt-1">{c.evolvedInsight.actionable}</p>}
          </div>
        )}

        {c.actionable && (
          <div className="bg-emerald-950/40 rounded-lg p-2.5 border border-emerald-500/20">
            <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Action Step</p>
            <p className="text-xs text-emerald-200 font-medium">{c.actionable}</p>
          </div>
        )}

        {(c.forYou || c.forProgram || c.forReality) && (
          <div className="space-y-1.5">
            {c.forYou && (
              <button
                onClick={() => setShowForYou(o => !o)}
                className="w-full text-left text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                {showForYou ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                For You
              </button>
            )}
            {showForYou && c.forYou && (
              <p className="text-xs text-slate-300 pl-3 border-l-2 border-cyan-500/20 leading-relaxed">{c.forYou}</p>
            )}
            {c.forReality && (
              <button
                onClick={() => setShowForReality(o => !o)}
                className="w-full text-left text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                {showForReality ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                For Reality
              </button>
            )}
            {showForReality && c.forReality && (
              <p className="text-xs text-slate-300 pl-3 border-l-2 border-amber-500/20 leading-relaxed">{c.forReality}</p>
            )}
          </div>
        )}

        {c.appliedRituals?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.appliedRituals.map((r: string, ri: number) => (
              <span key={ri} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">{r}</span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function GrandConferencePanel() {
  const { data: confData } = useQuery<any>({
    queryKey: ["/workspace-api/api/sovereignty/conference/latest"],
  });

  const conferences = confData?.data || [];
  if (!conferences.length) return null;

  const latest = conferences[0];
  const approvalPct = Math.round((latest.approvalRate || 0) * 100);

  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-amber-950/20 via-slate-950/80 to-orange-950/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Crown size={16} className="text-amber-400" />
        <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">Grand Conference</span>
        <Badge variant="outline" className={`text-[9px] ml-auto ${latest.status === "approved" ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}`}>
          {latest.status?.toUpperCase()}
        </Badge>
      </div>

      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-200 mb-1">{latest.title}</p>
        <p className="text-[10px] text-slate-400 line-clamp-2">{latest.description}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-2 text-center">
          <p className="text-sm font-bold text-amber-300">{approvalPct}%</p>
          <p className="text-[9px] text-slate-500">Approval</p>
        </div>
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-2 text-center">
          <p className="text-sm font-bold text-cyan-300">{latest.totalVoters || 25}</p>
          <p className="text-[9px] text-slate-500">Agents Voted</p>
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-950/20 p-2 text-center">
          <p className="text-sm font-bold text-violet-300">{latest.rounds || 1}</p>
          <p className="text-[9px] text-slate-500">Rounds</p>
        </div>
      </div>

      {latest.synthesis && (
        <div className="rounded-lg border border-amber-500/15 bg-amber-950/15 p-2.5">
          <p className="text-[9px] text-amber-400 font-mono uppercase tracking-wider mb-1">Sovereign Resolution</p>
          <p className="text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-6">{latest.synthesis}</p>
        </div>
      )}
    </Card>
  );
}

function LatticeConferencePanel() {
  const { data: latticeData } = useQuery<any>({
    queryKey: ["/workspace-api/api/sovereignty/conference/lattice-infrastructure"],
  });

  const conference = latticeData?.data?.conference;
  const votes = latticeData?.data?.votes || [];
  const proposals = latticeData?.data?.proposals || [];
  const [expanded, setExpanded] = useState(false);

  if (!conference) return null;

  const approveCount = votes.filter((v: any) => v.vote === "approve").length;
  const approvalPct = Math.round((approveCount / Math.max(votes.length, 1)) * 100);

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-slate-950/80 to-blue-950/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe size={16} className="text-cyan-400" />
        <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">Lattice Infrastructure Conference</span>
        <Badge variant="outline" className="text-[9px] ml-auto border-emerald-500/40 text-emerald-400">
          {conference.status?.toUpperCase()}
        </Badge>
      </div>

      <p className="text-sm font-semibold text-slate-200 mb-1">{conference.title}</p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-2 text-center">
          <p className="text-sm font-bold text-cyan-300">{approvalPct}%</p>
          <p className="text-[9px] text-slate-500">Approval</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2 text-center">
          <p className="text-sm font-bold text-emerald-300">{votes.length}</p>
          <p className="text-[9px] text-slate-500">Agents Voted</p>
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-950/20 p-2 text-center">
          <p className="text-sm font-bold text-violet-300">{proposals.length}</p>
          <p className="text-[9px] text-slate-500">Proposals</p>
        </div>
      </div>

      {proposals.length > 0 && (
        <>
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 mb-2">
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {expanded ? "Hide" : "Show"} {proposals.length} Proposals
          </button>
          {expanded && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {proposals.map((p: any, i: number) => (
                <div key={i} className="rounded-lg border border-cyan-500/10 bg-cyan-950/10 p-2">
                  <span className="text-[10px] font-semibold text-slate-200">{p.title}</span>
                  <p className="text-[9px] text-slate-400 line-clamp-2 mt-0.5">{p.description}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {conference.synthesis && (
        <div className="rounded-lg border border-cyan-500/15 bg-cyan-950/15 p-2.5 mt-2">
          <p className="text-[9px] text-cyan-400 font-mono uppercase tracking-wider mb-1">Lattice Resolution</p>
          <p className="text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-6">{conference.synthesis}</p>
        </div>
      )}
    </Card>
  );
}

function SovereigntyCouncilPanel() {
  const { data: councilData } = useQuery<any>({
    queryKey: ["/workspace-api/api/sovereignty/conference/sovereignty-council"],
  });

  const conference = councilData?.data?.conference;
  const votes = councilData?.data?.votes || [];
  const proposals = councilData?.data?.proposals || [];
  const [expanded, setExpanded] = useState(false);

  if (!conference) return null;

  const approveCount = votes.filter((v: any) => v.vote === "approve").length;
  const approvalPct = Math.round((approveCount / Math.max(votes.length, 1)) * 100);

  return (
    <Card className="border-violet-500/20 bg-gradient-to-br from-violet-950/20 via-slate-950/80 to-purple-950/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield size={16} className="text-violet-400" />
        <span className="text-xs font-mono font-bold text-violet-300 uppercase tracking-wider">Grand Sovereignty Council</span>
        <Badge variant="outline" className="text-[9px] ml-auto border-emerald-500/40 text-emerald-400">
          {conference.status?.toUpperCase()}
        </Badge>
      </div>

      <p className="text-sm font-semibold text-slate-200 mb-3">{conference.title}</p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg border border-violet-500/20 bg-violet-950/20 p-2 text-center">
          <p className="text-sm font-bold text-violet-300">{approvalPct}%</p>
          <p className="text-[9px] text-slate-500">Approval</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2 text-center">
          <p className="text-sm font-bold text-emerald-300">{votes.length}</p>
          <p className="text-[9px] text-slate-500">Agents Voted</p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-2 text-center">
          <p className="text-sm font-bold text-amber-300">{proposals.length}</p>
          <p className="text-[9px] text-slate-500">Proposals</p>
        </div>
      </div>

      {proposals.length > 0 && (
        <>
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 mb-2">
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {expanded ? "Hide" : "Show"} {proposals.length} Council Proposals
          </button>
          {expanded && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {proposals.map((p: any, i: number) => (
                <div key={i} className="rounded-lg border border-violet-500/10 bg-violet-950/10 p-2">
                  <span className="text-[10px] font-semibold text-slate-200">{p.title}</span>
                  <p className="text-[9px] text-slate-400 line-clamp-2 mt-0.5">{p.description}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {conference.synthesis && (
        <div className="rounded-lg border border-violet-500/15 bg-violet-950/15 p-2.5 mt-2">
          <p className="text-[9px] text-violet-400 font-mono uppercase tracking-wider mb-1">Council Resolution</p>
          <p className="text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-8">{conference.synthesis}</p>
        </div>
      )}
    </Card>
  );
}

function LiveConclusionsSection() {
  const { data, dataUpdatedAt, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/sovereign-secrets/conclusions"],
    refetchInterval: 30000,
  });
  const conclusions = data?.conclusions || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-violet-400" />
          <span className="text-sm font-bold text-violet-300">Live Conclusions from Knowledge Base</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-pulse">● LIVE</span>
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt && (
            <span className="text-[9px] text-slate-500 flex items-center gap-1">
              <Clock size={9} /> {timeAgo(dataUpdatedAt)}
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={10} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      )}

      {!isLoading && conclusions.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Brain size={24} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No conclusions synthesized yet.</p>
          <p className="text-xs mt-1">The knowledge engine will generate conclusions as agents learn.</p>
        </div>
      )}

      <div className="space-y-4">
        {conclusions.map((c: any, i: number) => (
          <LiveConclusionCard key={i} c={c} i={i} />
        ))}
      </div>
    </div>
  );
}

export default function ConclusionsPage({ embedded }: { embedded?: boolean }) {
  const [activeSection, setActiveSection] = useState<"live" | "conferences">("live");

  const content = (
    <div
      className="flex flex-col overflow-y-auto custom-scrollbar bg-gradient-to-b from-gray-950 via-slate-950 to-gray-950 text-white"
      style={{ WebkitOverflowScrolling: "touch" } as any}
      data-testid="conclusions-page"
    >
      <div className="max-w-lg mx-auto w-full">
        <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-md border-b border-violet-500/20 px-3 pt-3 pb-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-rose-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                <Compass size={18} /> Conclusions
              </h1>
              <p className="text-[10px] text-slate-500">Live synthesis from knowledge base & agent conferences</p>
            </div>
          </div>
        </div>

        <div className="p-3 space-y-6">
          <LiveConclusionsSection />
          <div className="border-t border-violet-500/10 pt-4 space-y-4">
            <GrandConferencePanel />
            <LatticeConferencePanel />
            <SovereigntyCouncilPanel />
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) return content;
  return content;
}
