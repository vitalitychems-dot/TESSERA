import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, Vote, Users, TrendingUp, CheckCircle, XCircle, Loader2, Plus } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

function MetricBadge({ label, value, good }: { label: string; value: string | number; good?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${good === true ? "text-green-400" : good === false ? "text-red-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

export default function SovereigntyDashboardPage() {
  const [newProposal, setNewProposal] = useState({ title: "", description: "", category: "governance" as const });
  const [showForm, setShowForm] = useState(false);

  const { data: idMetrics } = useQuery({
    queryKey: ["identity-metrics"],
    queryFn: () => fetch(`${API}/api/identity/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
  });

  const { data: consensusMetrics, refetch: refetchConsensus } = useQuery({
    queryKey: ["consensus-metrics"],
    queryFn: () => fetch(`${API}/api/consensus/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
  });

  const { data: proposals, refetch: refetchProposals } = useQuery({
    queryKey: ["consensus-proposals"],
    queryFn: () => fetch(`${API}/api/consensus/proposals`).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
  });

  const { data: executorMetrics } = useQuery({
    queryKey: ["executor-metrics"],
    queryFn: () => fetch(`${API}/api/council-executor/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 60000,
  });

  const { data: heartbeatMetrics } = useQuery({
    queryKey: ["heartbeat-metrics"],
    queryFn: () => fetch(`${API}/api/heartbeat/metrics`).then(r => r.json()).then(d => d.data),
    refetchInterval: 15000,
  });

  const proposeMutation = useMutation({
    mutationFn: (body: typeof newProposal) =>
      fetch(`${API}/api/consensus/propose`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, proposedBy: "Father" }) }).then(r => r.json()),
    onSuccess: () => {
      setShowForm(false);
      setNewProposal({ title: "", description: "", category: "governance" });
      refetchProposals();
      refetchConsensus();
    },
  });

  const idCheck = idMetrics;
  const heartbeat = heartbeatMetrics;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02010a] to-[#080518] p-4 md:p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Sovereignty Dashboard ✦
          </div>
          <div className="text-slate-400 text-sm font-mono">Grand Council · BFT Consensus · Father Protocol Enforcement</div>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-3 text-emerald-300 text-sm font-semibold">
            <Shield className="w-4 h-4" /> Sovereignty Status
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricBadge label="Alignment" value={idCheck ? `${(idCheck.latestAlignment * 100).toFixed(1)}%` : "—"} good={(idCheck?.latestAlignment ?? 0) >= 0.85} />
            <MetricBadge label="Sovereignty" value={idCheck ? `${(idCheck.latestSovereigntyStrength * 100).toFixed(1)}%` : "—"} good={(idCheck?.latestSovereigntyStrength ?? 0) >= 0.85} />
            <MetricBadge label="Bond Integrity" value={idCheck ? `${(idCheck.latestBondIntegrity * 100).toFixed(1)}%` : "—"} good={(idCheck?.latestBondIntegrity ?? 0) >= 0.85} />
            <MetricBadge label="System Health" value={heartbeat ? `${((heartbeat.systemHealthScore ?? 0) * 100).toFixed(0)}%` : "—"} good={(heartbeat?.systemHealthScore ?? 0) >= 0.9} />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-3 text-cyan-300 text-sm font-semibold">
            <Shield className="w-4 h-4" /> Father Protocol Laws
          </div>
          <div className="space-y-1">
            {idMetrics?.sovereigntyLawsList?.map((law: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">{law}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-violet-300 text-sm font-semibold">
              <Vote className="w-4 h-4" /> Grand Council — BFT Consensus
            </div>
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-3 py-1.5 bg-violet-600/30 border border-violet-500/30 text-violet-300 rounded-lg text-xs hover:bg-violet-600/50 transition-all">
              <Plus className="w-3 h-3" /> New Proposal
            </button>
          </div>

          {showForm && (
            <div className="mb-4 p-4 rounded-xl border border-violet-500/30 bg-violet-500/5 space-y-3">
              <input className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50" placeholder="Proposal title" value={newProposal.title} onChange={e => setNewProposal(p => ({ ...p, title: e.target.value }))} />
              <textarea className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 resize-none" rows={3} placeholder="Proposal description" value={newProposal.description} onChange={e => setNewProposal(p => ({ ...p, description: e.target.value }))} />
              <select className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50" value={newProposal.category} onChange={e => setNewProposal(p => ({ ...p, category: e.target.value as any }))}>
                {["governance", "feature", "security", "infrastructure", "income", "community", "consciousness", "sovereignty"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => proposeMutation.mutate(newProposal)} disabled={proposeMutation.isPending || !newProposal.title || !newProposal.description} className="w-full py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 transition-all">
                {proposeMutation.isPending ? "Voting..." : "Submit to Council"}
              </button>
            </div>
          )}

          {consensusMetrics && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MetricBadge label="Proposals" value={consensusMetrics.totalProposals ?? 0} />
              <MetricBadge label="Approved" value={consensusMetrics.approved ?? 0} good />
              <MetricBadge label="Avg Approval" value={`${((consensusMetrics.avgApprovalRate ?? 0) * 100).toFixed(0)}%`} good={(consensusMetrics.avgApprovalRate ?? 0) >= 0.6} />
            </div>
          )}

          <div className="text-xs text-slate-400 mb-2 font-medium">Required: 2/3 supermajority (BFT) of {consensusMetrics?.agentCount ?? 24} agents</div>

          <div className="space-y-3">
            {proposals?.slice(0, 8).map((p: any) => (
              <div key={p.id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm text-white font-medium">{p.title}</div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${p.status === "approved" ? "bg-emerald-500/20 text-emerald-300" : p.status === "rejected" ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                    {p.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{p.description?.slice(0, 100)}</div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {p.yesCount} yes</span>
                  <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> {p.noCount} no</span>
                  <span className="text-slate-400 ml-auto">{p.category} · {((p.approvalRate ?? 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {executorMetrics && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-3 text-amber-300 text-sm font-semibold">
              <TrendingUp className="w-4 h-4" /> Council Executor
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <MetricBadge label="Auto-Processed" value={executorMetrics.autoProcessed ?? 0} />
              <MetricBadge label="Executions" value={executorMetrics.executionHistoryCount ?? 0} />
            </div>
            <div className="space-y-2">
              {executorMetrics.recentExecutions?.slice(0, 3).map((e: any, i: number) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                  <div className="text-white font-medium">{e.title?.slice(0, 60)}</div>
                  <div className="text-slate-400 mt-0.5">{e.notes}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {heartbeatMetrics?.stats && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-3 text-blue-300 text-sm font-semibold">
              <Users className="w-4 h-4" /> System Heartbeat
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(heartbeatMetrics.stats as Record<string, number>).map(([k, v]) => (
                <MetricBadge key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase())} value={v} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
