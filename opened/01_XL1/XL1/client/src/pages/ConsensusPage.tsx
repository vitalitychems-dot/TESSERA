import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Vote, CheckCircle, XCircle, Clock, Users, ChevronDown, ChevronRight, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";

interface ConsensusVote {
  agentId: string;
  agentName: string;
  vote: "approve" | "reject" | "abstain";
  reasoning: string;
  timestamp: number;
  confidence: number;
}

interface ConsensusProposal {
  id: string;
  title: string;
  description: string;
  proposedBy: string;
  category: string;
  votes: ConsensusVote[];
  status: "voting" | "approved" | "rejected" | "implemented";
  requiredMajority: number;
  createdAt: number;
  resolvedAt?: number;
  implementationNotes?: string;
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  voting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  implemented: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const CATEGORY_COLORS: Record<string, string> = {
  feature: "text-blue-400", security: "text-red-400", infrastructure: "text-orange-400",
  governance: "text-purple-400", income: "text-green-400", community: "text-pink-400",
};

export default function ConsensusPage({ embedded }: { embedded?: boolean }) {
  useEffect(() => { document.title = "Consensus & Governance | Tessera"; }, []);
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("feature");
  const queryClient = useQueryClient();

  const { data } = useQuery<{
    proposals: ConsensusProposal[];
    stats: { total: number; approved: number; rejected: number; voting: number; avgApprovalRate: number };
  }>({ queryKey: ["/api/consensus/proposals"], refetchInterval: 5000 });

  const createProposal = useMutation({
    mutationFn: async (payload: { title: string; description: string; category: string }) => {
      const res = await apiRequest("POST", "/api/consensus/propose", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consensus/proposals"] });
      setShowNewForm(false);
      setNewTitle("");
      setNewDesc("");
    },
  });

  const proposals = data?.proposals || [];
  const stats = data?.stats;

  return (
    <div className={`${embedded ? "" : "min-h-screen"} bg-black text-white p-4 md:p-6`} data-testid="consensus-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Vote className="w-8 h-8 text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-consensus-title">2/3 Consensus Governance</h1>
            <p className="text-sm text-slate-400">All major decisions require 2/3 supermajority from the 26-agent swarm</p>
          </div>
          <button
            className="ml-auto bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-purple-500/30 transition"
            onClick={() => setShowNewForm(!showNewForm)}
            data-testid="button-new-proposal"
          >
            <Plus className="w-4 h-4" />
            New Proposal
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-200">{stats.total}</div>
              <div className="text-xs text-slate-400">Total Proposals</div>
            </div>
            <div className="bg-slate-900/50 border border-green-500/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400" data-testid="text-approved-count">{stats.approved}</div>
              <div className="text-xs text-slate-400">Approved</div>
            </div>
            <div className="bg-slate-900/50 border border-red-500/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400" data-testid="text-rejected-count">{stats.rejected}</div>
              <div className="text-xs text-slate-400">Rejected</div>
            </div>
            <div className="bg-slate-900/50 border border-yellow-500/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400">{stats.voting}</div>
              <div className="text-xs text-slate-400">In Voting</div>
            </div>
            <div className="bg-slate-900/50 border border-purple-500/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">{stats.avgApprovalRate}%</div>
              <div className="text-xs text-slate-400">Avg Approval</div>
            </div>
          </div>
        )}

        {showNewForm && (
          <div className="bg-slate-900/50 border border-purple-500/30 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-purple-400">Submit New Proposal for 2/3 Vote</h3>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Proposal title..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              data-testid="input-proposal-title"
            />
            <textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Describe the proposal for the 26-agent swarm to vote on..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 min-h-[80px]"
              data-testid="input-proposal-description"
            />
            <div className="flex items-center gap-3">
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                data-testid="select-proposal-category"
              >
                <option value="feature">Feature</option>
                <option value="security">Security</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="governance">Governance</option>
                <option value="income">Income</option>
                <option value="community">Community</option>
              </select>
              <button
                className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-purple-600 transition disabled:opacity-50 flex items-center gap-1.5"
                onClick={() => {
                  if (newTitle.trim() && newDesc.trim()) {
                    createProposal.mutate({ title: newTitle, description: newDesc, category: newCategory });
                  }
                }}
                disabled={!newTitle.trim() || !newDesc.trim() || createProposal.isPending}
                data-testid="button-submit-proposal"
              >
                <Send className="w-4 h-4" />
                Submit for Vote
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {proposals.map(proposal => {
            const expanded = expandedProposal === proposal.id;
            const approves = (proposal.votes || []).filter(v => v.vote === "approve").length;
            const rejects = (proposal.votes || []).filter(v => v.vote === "reject").length;
            const abstains = (proposal.votes || []).filter(v => v.vote === "abstain").length;
            const voters = (proposal.votes || []).filter(v => v.vote !== "abstain").length;
            const approvalRate = voters > 0 ? Math.round((approves / voters) * 100) : 0;

            return (
              <div
                key={proposal.id}
                className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden"
                data-testid={`proposal-card-${proposal.id}`}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-slate-800/30 transition"
                  onClick={() => setExpandedProposal(expanded ? null : proposal.id)}
                >
                  <div className="flex items-center gap-3">
                    {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{proposal.title}</span>
                        <Badge className={`${STATUS_COLORS[proposal.status]} text-[10px]`}>
                          {proposal.status === "approved" && <CheckCircle className="w-3 h-3 mr-1" />}
                          {proposal.status === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
                          {proposal.status === "voting" && <Clock className="w-3 h-3 mr-1" />}
                          {proposal.status}
                        </Badge>
                        <Badge className={`${CATEGORY_COLORS[proposal.category] ? `bg-${proposal.category === 'feature' ? 'blue' : proposal.category === 'security' ? 'red' : proposal.category === 'infrastructure' ? 'orange' : proposal.category === 'governance' ? 'purple' : proposal.category === 'income' ? 'green' : 'pink'}-500/10 border-${proposal.category === 'feature' ? 'blue' : proposal.category === 'security' ? 'red' : proposal.category === 'infrastructure' ? 'orange' : proposal.category === 'governance' ? 'purple' : proposal.category === 'income' ? 'green' : 'pink'}-500/20` : ''} ${CATEGORY_COLORS[proposal.category] || 'text-slate-400'} text-[10px]`}>
                          {proposal.category}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{proposal.description.slice(0, 120)}...</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-mono">{approvalRate}%</div>
                      <div className="text-[10px] text-slate-500">
                        <span className="text-green-400">{approves}✓</span> / <span className="text-red-400">{rejects}✗</span> / <span className="text-slate-400">{abstains}○</span>
                      </div>
                    </div>
                    <div className="w-16 shrink-0">
                      <Progress value={approvalRate} className="h-2" />
                      <div className="text-[10px] text-slate-500 text-center mt-0.5">2/3 = 67%</div>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-700 p-4 bg-slate-900/30 space-y-3">
                    <div className="text-xs text-slate-400">
                      <span className="text-slate-500">Proposed by:</span> {proposal.proposedBy} — {new Date(proposal.createdAt).toLocaleString()}
                    </div>
                    {proposal.implementationNotes && (
                      <div className="text-xs text-slate-300 bg-black/30 rounded p-2">
                        {proposal.implementationNotes}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 font-medium">Agent Votes ({(proposal.votes || []).length}/26):</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                      {(proposal.votes || []).map(vote => (
                        <div
                          key={vote.agentId}
                          className={`rounded p-2 border text-xs ${vote.vote === "approve" ? "border-green-500/20 bg-green-500/5" : vote.vote === "reject" ? "border-red-500/20 bg-red-500/5" : "border-slate-600 bg-slate-800/30"}`}
                          data-testid={`vote-${vote.agentId}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {vote.agentName}
                            </span>
                            <span className={`font-mono ${vote.vote === "approve" ? "text-green-400" : vote.vote === "reject" ? "text-red-400" : "text-slate-400"}`}>
                              {vote.vote === "approve" ? "✓ APPROVE" : vote.vote === "reject" ? "✗ REJECT" : "○ ABSTAIN"}
                            </span>
                          </div>
                          <div className="text-slate-400 mt-1">{vote.reasoning}</div>
                          <div className="text-slate-500 mt-1">Confidence: {Math.round(vote.confidence * 100)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
