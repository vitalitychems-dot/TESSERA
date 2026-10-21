import { useQuery } from "@tanstack/react-query";
import {
  Brain, MessageSquare, CheckCircle2, XCircle, MinusCircle,
  ArrowLeft, BarChart3, Clock, Target
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API_BASE = "/workspace-api/api";

interface AgentProfileData {
  agent: {
    id: string;
    name: string;
    role: string;
    brainRegion: string;
    expertise: string;
  };
  stats: {
    totalMessages: number;
    totalVotes: number;
    voteBreakdown: {
      approve: number;
      reject: number;
      abstain: number;
      total: number;
    };
    avgConfidence: number;
  };
  recentMessages: {
    id: number;
    conversationId: number;
    conversationTitle: string;
    contentPreview: string;
    createdAt: string;
  }[];
  recentVotes: {
    proposalId: string;
    round: number;
    vote: string;
    confidence: number;
    reasoning: string;
    createdAt: string;
  }[];
}

const AGENT_COLORS: Record<string, string> = {
  tessera: "text-violet-400", alpha: "text-amber-400", beta: "text-cyan-400",
  gamma: "text-emerald-400", delta: "text-blue-400", epsilon: "text-rose-400",
  zeta: "text-red-400", eta: "text-orange-400", theta: "text-purple-400",
  iota: "text-yellow-400", kappa: "text-teal-400", lambda: "text-green-400",
  mu: "text-red-500", nu: "text-lime-400", xi: "text-yellow-500",
  omicron: "text-pink-400", pi: "text-indigo-400", rho: "text-sky-400",
  sigma: "text-slate-300", tau: "text-fuchsia-400", upsilon: "text-violet-300",
  phi: "text-rose-300", chi: "text-orange-300", psi: "text-emerald-300",
  omega: "text-red-300",
};

function VoteIcon({ vote }: { vote: string }) {
  if (vote === "approve") return <CheckCircle2 size={12} className="text-emerald-400" />;
  if (vote === "reject") return <XCircle size={12} className="text-red-400" />;
  return <MinusCircle size={12} className="text-slate-500" />;
}

export default function AgentProfile({ agentId, onBack }: { agentId: string; onBack: () => void }) {
  const { data, isLoading, isError } = useQuery<AgentProfileData>({
    queryKey: ["agent-profile", agentId],
    queryFn: () => fetch(`${API_BASE}/agents/${agentId}/profile`).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
  });

  const color = AGENT_COLORS[agentId] ?? "text-violet-400";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(224,71%,4%)] p-4 sm:p-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-800 rounded w-48" />
            <div className="h-32 bg-slate-800 rounded-xl" />
            <div className="h-64 bg-slate-800 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[hsl(224,71%,4%)] p-4 sm:p-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors mb-4 text-sm font-mono">
            <ArrowLeft size={14} />Back
          </button>
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 text-center">
            <p className="text-rose-400 font-mono">Failed to load agent profile</p>
          </div>
        </div>
      </div>
    );
  }

  const { agent, stats, recentMessages, recentVotes } = data;
  const approveRate = stats.voteBreakdown.total > 0
    ? Math.round((stats.voteBreakdown.approve / stats.voteBreakdown.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[hsl(224,71%,4%)] p-4 sm:p-6 pb-20">
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors mb-4 text-sm font-mono">
          <ArrowLeft size={14} />Back to Chat
        </button>

        <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 to-slate-950/80 p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
              <Brain size={24} className="text-white" />
            </div>
            <div>
              <h1 className={`text-xl font-bold font-mono ${color}`}>{agent.name}</h1>
              <p className="text-xs text-slate-500 font-mono">{agent.role}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="outline" className="border-violet-500/30 text-violet-400 text-[10px] font-mono">
              {agent.brainRegion}
            </Badge>
            {agent.expertise.split(",").slice(0, 3).map(e => (
              <Badge key={e.trim()} variant="outline" className="border-slate-700 text-slate-400 text-[10px] font-mono">
                {e.trim()}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare size={12} className="text-cyan-400" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">Messages</span>
            </div>
            <div className="text-lg font-bold font-mono text-white">{stats.totalMessages}</div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 size={12} className="text-amber-400" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/70">Votes</span>
            </div>
            <div className="text-lg font-bold font-mono text-white">{stats.totalVotes}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Target size={12} className="text-emerald-400" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/70">Confidence</span>
            </div>
            <div className="text-lg font-bold font-mono text-white">{Math.round(stats.avgConfidence * 100)}%</div>
          </div>
          <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 size={12} className="text-violet-400" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-violet-400/70">Approve Rate</span>
            </div>
            <div className="text-lg font-bold font-mono text-white">{approveRate}%</div>
          </div>
        </div>

        {stats.voteBreakdown.total > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 mb-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-3">Vote Distribution</h3>
            <div className="flex gap-2 h-4 rounded-full overflow-hidden bg-slate-800">
              {stats.voteBreakdown.approve > 0 && (
                <div className="bg-emerald-500 transition-all" style={{ width: `${(stats.voteBreakdown.approve / stats.voteBreakdown.total) * 100}%` }} />
              )}
              {stats.voteBreakdown.reject > 0 && (
                <div className="bg-red-500 transition-all" style={{ width: `${(stats.voteBreakdown.reject / stats.voteBreakdown.total) * 100}%` }} />
              )}
              {stats.voteBreakdown.abstain > 0 && (
                <div className="bg-slate-600 transition-all" style={{ width: `${(stats.voteBreakdown.abstain / stats.voteBreakdown.total) * 100}%` }} />
              )}
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-mono">
              <span className="text-emerald-400">Approve: {stats.voteBreakdown.approve}</span>
              <span className="text-red-400">Reject: {stats.voteBreakdown.reject}</span>
              <span className="text-slate-500">Abstain: {stats.voteBreakdown.abstain}</span>
            </div>
          </div>
        )}

        {recentVotes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-amber-300 uppercase tracking-widest font-mono mb-3 flex items-center gap-2">
              <BarChart3 size={14} className="text-amber-400" />
              Voting History
            </h3>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <div className="divide-y divide-slate-800/50">
                {recentVotes.map((v, i) => (
                  <div key={i} className="px-3 py-2.5 hover:bg-slate-900/40 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <VoteIcon vote={v.vote} />
                      <span className={`text-[11px] font-bold font-mono ${
                        v.vote === "approve" ? "text-emerald-400" : v.vote === "reject" ? "text-red-400" : "text-slate-500"
                      }`}>
                        {v.vote.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600">
                        {Math.round(v.confidence * 100)}% confidence
                      </span>
                      <span className="text-[10px] font-mono text-slate-600 ml-auto">
                        Round {v.round}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{v.reasoning}</p>
                    <div className="text-[9px] font-mono text-slate-600 mt-1 flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(v.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {recentMessages.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-widest font-mono mb-3 flex items-center gap-2">
              <MessageSquare size={14} className="text-cyan-400" />
              Recent Messages
            </h3>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <div className="divide-y divide-slate-800/50">
                {recentMessages.map((m) => (
                  <div key={m.id} className="px-3 py-2.5 hover:bg-slate-900/40 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-violet-400 truncate flex-1">
                        {m.conversationTitle}
                      </span>
                      <span className="text-[9px] font-mono text-slate-600 flex-shrink-0">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">{m.contentPreview}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {recentMessages.length === 0 && recentVotes.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
            <Brain size={24} className="text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 font-mono">No activity recorded for this agent yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
