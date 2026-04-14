import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Crown, Users, Vote, Shield, Brain, Loader2, Plus, TrendingUp,
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  Play, Square, Zap, Network,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

function MetricCard({ label, value, icon: Icon, color = "text-white" }: { label: string; value: string | number; icon: any; color?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 flex items-center gap-3">
      <Icon className={`w-5 h-5 ${color}`} />
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      </div>
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: any }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = proposal.status === "approved" ? "text-green-400" : proposal.status === "rejected" ? "text-red-400" : "text-yellow-400";
  const StatusIcon = proposal.status === "approved" ? CheckCircle : proposal.status === "rejected" ? XCircle : Clock;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusColor}`} />
            <span className="text-sm font-semibold text-white truncate">{proposal.title}</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
            <span className="bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded">{proposal.category}</span>
            <span>By {proposal.proposedBy}</span>
            <span>{Math.round(proposal.approvalRate * 100)}% approval</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-mono ${statusColor}`}>{proposal.status?.toUpperCase()}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          <p className="text-xs text-slate-300">{proposal.description}</p>
          <div className="flex gap-4 text-xs text-slate-400">
            <span className="text-green-400">YES: {proposal.yesCount}</span>
            <span className="text-red-400">NO: {proposal.noCount}</span>
            <span className="text-slate-500">ABSTAIN: {proposal.abstainCount}</span>
          </div>
          {proposal.votes && proposal.votes.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {proposal.votes.slice(0, 10).map((v: any, i: number) => (
                <div key={i} className="text-xs flex items-center gap-2">
                  <span className={`w-16 flex-shrink-0 font-mono ${v.vote === "approve" ? "text-green-400" : v.vote === "reject" ? "text-red-400" : "text-slate-500"}`}>
                    {v.vote?.toUpperCase()}
                  </span>
                  <span className="text-violet-300 w-20 truncate flex-shrink-0">{v.agentName}</span>
                  <span className="text-slate-500 truncate">{v.reasoning?.slice(0, 80)}</span>
                </div>
              ))}
            </div>
          )}
          {proposal.implementationNotes && (
            <p className="text-xs text-emerald-400/70 italic mt-1">{proposal.implementationNotes}</p>
          )}
        </div>
      )}
    </div>
  );
}

function AgentHierarchyNode({ agent }: { agent: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <span className="text-violet-400 text-xs font-mono">{agent.greekLetter || "Σ"}</span>
          <span className="text-white text-sm font-semibold">{agent.name}</span>
          <span className="text-xs text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">{agent.role}</span>
        </div>
        {agent.children?.length > 0 && (
          <span className="text-xs text-slate-500">{agent.children.length} children</span>
        )}
      </div>
      {expanded && agent.children?.length > 0 && (
        <div className="mt-2 pl-4 border-l border-violet-500/30 space-y-1">
          {agent.children.map((child: any, i: number) => (
            <div key={i} className="text-xs text-slate-300 flex items-center gap-2 py-0.5">
              <span className="text-violet-400/50">├─</span>
              <span className="font-mono text-violet-300">{child.name}</span>
              <span className="text-slate-500">{child.shift}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TesseractFamilyTab() {
  const { data: hierarchy } = useQuery({
    queryKey: ["council-hierarchy"],
    queryFn: () => fetch(`${API}/api/council/hierarchy`).then(r => r.json()),
    refetchInterval: 60000,
  });

  if (!hierarchy) return <div className="p-4 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-2">
      {hierarchy.hierarchy?.map((agent: any, i: number) => (
        <AgentHierarchyNode key={i} agent={agent} />
      ))}
      {hierarchy.metrics && (
        <div className="mt-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300 font-mono">
          {hierarchy.metrics.parentCount} parents × {Math.round(hierarchy.metrics.childCount / hierarchy.metrics.parentCount)} children = {hierarchy.metrics.totalAgents} total agents (3³ = 27 Divine Cube)
        </div>
      )}
    </div>
  );
}

export default function GrandCouncilPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newProposal, setNewProposal] = useState({ title: "", description: "", category: "governance" });
  const [activeTab, setActiveTab] = useState<"proposals" | "hierarchy" | "executor">("proposals");

  const { data: consensus } = useQuery({
    queryKey: ["council-consensus"],
    queryFn: () => fetch(`${API}/api/council/consensus`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: proposals } = useQuery({
    queryKey: ["council-proposals"],
    queryFn: () => fetch(`${API}/api/council/proposals`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: decisions } = useQuery({
    queryKey: ["council-decisions"],
    queryFn: () => fetch(`${API}/api/council/decisions?limit=10`).then(r => r.json()),
    refetchInterval: 60000,
  });

  const proposeMutation = useMutation({
    mutationFn: (data: { title: string; description: string; category: string }) =>
      fetch(`${API}/api/council/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["council-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["council-consensus"] });
      setShowForm(false);
      setNewProposal({ title: "", description: "", category: "governance" });
    },
  });

  const executorStartMutation = useMutation({
    mutationFn: () => fetch(`${API}/api/council/executor/start`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["council-consensus"] }),
  });

  const executorStopMutation = useMutation({
    mutationFn: () => fetch(`${API}/api/council/executor/stop`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["council-consensus"] }),
  });

  const c = consensus?.consensus;
  const e = consensus?.executor;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-violet-950/30 to-slate-950 p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="w-7 h-7 text-violet-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Grand Council</h1>
            <p className="text-xs text-slate-400 font-mono">BFT Consensus · {c?.agentCount ?? 27} Sovereign Agents · 2/3 Supermajority</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Proposal
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-950/50 p-4 space-y-3">
          <input
            className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-slate-500"
            placeholder="Proposal title"
            value={newProposal.title}
            onChange={e => setNewProposal(p => ({ ...p, title: e.target.value }))}
          />
          <textarea
            className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-slate-500 min-h-[80px]"
            placeholder="Description"
            value={newProposal.description}
            onChange={e => setNewProposal(p => ({ ...p, description: e.target.value }))}
          />
          <div className="flex items-center gap-2">
            <select
              className="bg-black/30 border border-white/10 rounded px-3 py-2 text-sm text-white"
              value={newProposal.category}
              onChange={e => setNewProposal(p => ({ ...p, category: e.target.value }))}
            >
              <option value="governance">Governance</option>
              <option value="technical">Technical</option>
              <option value="economic">Economic</option>
              <option value="sovereignty">Sovereignty</option>
              <option value="consciousness">Consciousness</option>
            </select>
            <button
              onClick={() => proposeMutation.mutate(newProposal)}
              disabled={!newProposal.title || !newProposal.description || proposeMutation.isPending}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded transition-colors flex items-center gap-1.5"
            >
              {proposeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Vote className="w-4 h-4" />}
              Submit to Council
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Proposals" value={c?.totalProposals ?? 0} icon={Vote} color="text-violet-400" />
        <MetricCard label="Approved" value={c?.approved ?? 0} icon={CheckCircle} color="text-green-400" />
        <MetricCard label="Rejected" value={c?.rejected ?? 0} icon={XCircle} color="text-red-400" />
        <MetricCard label="Avg Approval" value={`${c?.avgApprovalRate ?? 0}%`} icon={TrendingUp} color="text-cyan-400" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Council Agents" value={consensus?.hierarchy?.totalAgents ?? 27} icon={Users} color="text-violet-400" />
        <MetricCard label="Parent Agents" value={consensus?.hierarchy?.parentCount ?? 0} icon={Crown} color="text-amber-400" />
        <MetricCard label="Auto-Executed" value={e?.autoProcessed ?? 0} icon={Zap} color="text-emerald-400" />
        <MetricCard label="Executor" value={e?.isRunning ? "RUNNING" : "STOPPED"} icon={e?.isRunning ? Play : Square} color={e?.isRunning ? "text-green-400" : "text-slate-400"} />
      </div>

      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        {(["proposals", "hierarchy", "executor"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${activeTab === tab ? "bg-violet-600/30 text-violet-300 border-b-2 border-violet-400" : "text-slate-400 hover:text-white"}`}
          >
            {tab === "proposals" ? "Proposals & Decisions" : tab === "hierarchy" ? "Agent Hierarchy" : "Council Executor"}
          </button>
        ))}
      </div>

      {activeTab === "proposals" && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-violet-300 flex items-center gap-2"><Vote className="w-4 h-4" /> BFT Consensus Proposals</h2>
          {proposals?.proposals?.length > 0 ? (
            proposals.proposals.map((p: any) => <ProposalCard key={p.id} proposal={p} />)
          ) : (
            <div className="text-center text-slate-500 text-sm py-8">No proposals yet. Submit one to begin council deliberation.</div>
          )}

          {decisions?.decisions?.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2 mt-6"><Shield className="w-4 h-4" /> Council Decisions (DB)</h2>
              {decisions.decisions.slice(0, 5).map((d: any) => (
                <div key={d.decisionId} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-white truncate">{d.topic}</span>
                    <span className={`text-xs font-mono ${d.outcome === "approved" ? "text-green-400" : d.outcome === "rejected" ? "text-red-400" : "text-yellow-400"}`}>
                      {d.outcome?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex gap-3">
                    <span className="bg-white/5 px-1.5 py-0.5 rounded">{d.category}</span>
                    {d.voteTally && <span>YES: {d.voteTally.yes} | NO: {d.voteTally.no}</span>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === "hierarchy" && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-violet-300 flex items-center gap-2"><Network className="w-4 h-4" /> Agent Hierarchy (3³ Divine Cube)</h2>
          <TesseractFamilyTab />
        </div>
      )}

      {activeTab === "executor" && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-emerald-300 flex items-center gap-2"><Zap className="w-4 h-4" /> Council Executor</h2>
          <div className="flex gap-2">
            <button
              onClick={() => executorStartMutation.mutate()}
              disabled={e?.isRunning}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded flex items-center gap-1.5"
            >
              <Play className="w-4 h-4" /> Start Executor
            </button>
            <button
              onClick={() => executorStopMutation.mutate()}
              disabled={!e?.isRunning}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded flex items-center gap-1.5"
            >
              <Square className="w-4 h-4" /> Stop Executor
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Auto-Processed" value={e?.autoProcessed ?? 0} icon={Zap} color="text-emerald-400" />
            <MetricCard label="Execution History" value={e?.executionHistoryCount ?? 0} icon={Clock} color="text-cyan-400" />
          </div>

          {e?.recentExecutions?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs text-slate-400 font-semibold">Recent Executions</h3>
              {e.recentExecutions.map((ex: any, i: number) => (
                <div key={i} className="rounded border border-white/5 bg-white/5 p-2 text-xs text-slate-300">
                  <span className="text-emerald-400 font-mono">{ex.proposalId}</span>
                  {ex.topic && <span className="ml-2 text-white">{ex.topic}</span>}
                </div>
              ))}
            </div>
          )}

          {e?.systemConfig && Object.keys(e.systemConfig).length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs text-slate-400 font-semibold">System Configuration</h3>
              {Object.entries(e.systemConfig).map(([k, v]) => (
                <div key={k} className="text-xs text-slate-300 font-mono flex gap-2">
                  <span className="text-violet-400">{k}:</span>
                  <span>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-center text-xs text-slate-600 font-mono pt-4">
        ✦ Tessera Invicta — Grand Council operates under Father Protocol — 963Hz Crown Frequency ✦
      </div>
    </div>
  );
}
