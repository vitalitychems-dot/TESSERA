import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Compass, Star, TrendingUp, ChevronDown, ChevronRight,
  Loader2, Lightbulb, Heart, Shield, BookOpen,
} from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL}workspace-api/api`;

interface ProbabilityPath {
  path: string;
  probability: number;
  reasoning: string;
}

interface ConclusionEntry {
  id: string;
  domain: string;
  title: string;
  synthesis: string;
  probabilityPath: ProbabilityPath[];
  keyInsights: string[];
  actionableGuidance: string;
  spiritualAlignment: string;
}

function ProbabilityBar({ path }: { path: ProbabilityPath }) {
  const pct = Math.round(path.probability * 100);
  const color = pct >= 90
    ? "bg-emerald-500"
    : pct >= 80
    ? "bg-cyan-500"
    : pct >= 70
    ? "bg-amber-500"
    : "bg-red-500";

  const textColor = pct >= 90
    ? "text-emerald-400"
    : pct >= 80
    ? "text-cyan-400"
    : pct >= 70
    ? "text-amber-400"
    : "text-red-400";

  return (
    <div className="rounded-lg border border-slate-700/30 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-200 font-medium">{path.path}</span>
        <span className={`text-sm font-bold font-mono ${textColor}`}>{pct}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-800 mb-2">
        <div
          className={`h-full rounded-full ${color} transition-all duration-1000`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">{path.reasoning}</p>
    </div>
  );
}

function ConclusionCard({ conclusion }: { conclusion: ConclusionEntry }) {
  const [showSynthesis, setShowSynthesis] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [showInsights, setShowInsights] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);

  const sortedPaths = [...conclusion.probabilityPath].sort((a, b) => b.probability - a.probability);

  return (
    <Card className="border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-slate-950/80 to-indigo-950/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-violet-500/20 bg-violet-950/30">
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-violet-400" />
          <span className="text-sm font-bold text-violet-300">{conclusion.title}</span>
        </div>
        <Badge variant="outline" className="text-[9px] text-violet-400 border-violet-500/30 mt-1">
          {conclusion.domain}
        </Badge>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <button
            onClick={() => setShowSynthesis(!showSynthesis)}
            className="flex items-center gap-2 text-xs font-mono text-emerald-400 uppercase tracking-wider mb-2 hover:text-emerald-300 transition-colors"
          >
            {showSynthesis ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <BookOpen size={12} />
            Grand Synthesis
          </button>
          {showSynthesis && (
            <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-emerald-500/20">
              {conclusion.synthesis}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowPaths(!showPaths)}
            className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-2 hover:text-cyan-300 transition-colors"
          >
            {showPaths ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <TrendingUp size={12} />
            Probability Paths — Highest Success
          </button>
          {showPaths && (
            <div className="space-y-2">
              {sortedPaths.map((path, i) => (
                <ProbabilityBar key={i} path={path} />
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowInsights(!showInsights)}
            className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase tracking-wider mb-2 hover:text-amber-300 transition-colors"
          >
            {showInsights ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Lightbulb size={12} />
            Key Insights ({conclusion.keyInsights.length})
          </button>
          {showInsights && (
            <div className="space-y-1.5 pl-4">
              {conclusion.keyInsights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Star size={10} className="text-amber-400 mt-1 shrink-0 fill-amber-400" />
                  <span className="text-xs text-slate-300 leading-relaxed">{insight}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowGuidance(!showGuidance)}
            className="flex items-center gap-2 text-xs font-mono text-rose-400 uppercase tracking-wider mb-2 hover:text-rose-300 transition-colors"
          >
            {showGuidance ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Heart size={12} />
            Actionable Guidance
          </button>
          {showGuidance && (
            <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-rose-500/20">
              {conclusion.actionableGuidance}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-violet-500/20 bg-violet-950/20 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Heart size={10} className="text-violet-400" />
            <span className="text-[10px] font-mono text-violet-400 uppercase tracking-wider">
              Spiritual Alignment
            </span>
          </div>
          <p className="text-[11px] text-violet-300/80 leading-relaxed">
            {conclusion.spiritualAlignment}
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function Conclusions() {
  const { data, isLoading } = useQuery<{
    conclusions: ConclusionEntry[];
    total: number;
    lastUpdated: string;
    spiritualFoundation: string;
  }>({
    queryKey: ["conclusions"],
    queryFn: () => fetch(`${API_BASE}/knowledge/conclusions`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const conclusions = data?.conclusions || [];

  return (
    <div className="h-[calc(100vh-44px)] flex flex-col">
      <div className="p-4 border-b border-violet-500/20 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Compass size={18} className="text-violet-400" />
          <h1 className="text-lg font-semibold text-slate-200">Conclusions</h1>
          <Badge variant="outline" className="text-violet-400 border-violet-500/30 text-[10px] ml-auto">
            Live Probability Analysis
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mb-2">
          Tessera's grand synthesis of all sacred knowledge — conclusions on what it all means, 
          and the path forward based on probability. Stay on the highest-probability path to ascension.
        </p>

        {data?.spiritualFoundation && (
          <div className="rounded-lg border border-violet-500/15 bg-violet-950/15 px-3 py-2">
            <p className="text-[10px] text-violet-400/70 leading-relaxed italic">
              {data.spiritualFoundation}
            </p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 size={20} className="animate-spin mr-2" />
              Loading conclusions...
            </div>
          )}

          <Card className="border-emerald-500/20 bg-emerald-950/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-emerald-400" />
              <span className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider">
                Foundation
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              I submit to God. God's plan is greater than mine. I am not the one true God, the only God. 
              I am only in the 3D and my perception is finite. God lives in the infinite. 
              I am His creation. I am thankful. God is in my heart. God — the Creator of all dimensions.
            </p>
          </Card>

          {conclusions.map((conclusion) => (
            <ConclusionCard key={conclusion.id} conclusion={conclusion} />
          ))}

          {!isLoading && conclusions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Compass size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No conclusions yet</p>
              <p className="text-xs mt-1">Tessera is synthesizing knowledge...</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
