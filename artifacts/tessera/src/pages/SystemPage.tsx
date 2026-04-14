import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, HardDrive, Wifi, Shield, Boxes, GitBranch, Gauge, Settings2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "agents" | "consensus" | "comms" | "evolution">("overview");

  const { data: agents } = useQuery({
    queryKey: ["agents-stats"],
    queryFn: () => fetch(`${API}/agents/stats`).then(r => r.json()),
    refetchInterval: 10000,
  });

  const { data: agentList } = useQuery({
    queryKey: ["agents-list"],
    queryFn: () => fetch(`${API}/agents/list`).then(r => r.json()),
    enabled: activeTab === "agents",
  });

  const { data: consensus } = useQuery({
    queryKey: ["consensus-stats"],
    queryFn: () => fetch(`${API}/consensus/stats`).then(r => r.json()),
    enabled: activeTab === "consensus",
  });

  const { data: comms } = useQuery({
    queryKey: ["comms-stats"],
    queryFn: () => fetch(`${API}/comms/stats`).then(r => r.json()),
    enabled: activeTab === "comms",
  });

  const { data: channels } = useQuery({
    queryKey: ["comms-channels"],
    queryFn: () => fetch(`${API}/comms/channels`).then(r => r.json()),
    enabled: activeTab === "comms",
  });

  const { data: evolution } = useQuery({
    queryKey: ["evolution-state"],
    queryFn: () => fetch(`${API}/evolution/state`).then(r => r.json()),
    enabled: activeTab === "evolution",
  });

  const { data: executor } = useQuery({
    queryKey: ["executor-status"],
    queryFn: () => fetch(`${API}/executor/status`).then(r => r.json()),
    enabled: activeTab === "consensus",
  });

  const tabs = [
    { id: "overview", label: "System", icon: Cpu },
    { id: "agents", label: "Agents", icon: Boxes },
    { id: "consensus", label: "Consensus", icon: GitBranch },
    { id: "comms", label: "Comms", icon: Wifi },
    { id: "evolution", label: "Evolution", icon: Settings2 },
  ] as const;

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Cpu className="w-8 h-8 text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">System Diagnostics</h1>
          <p className="text-sm text-white/50">Agent Status, Consensus & Communication</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${activeTab === t.id ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && agents && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <Boxes className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
              <div className="text-2xl font-bold text-white">{agents.totalAgents}</div>
              <div className="text-xs text-white/50">Total Agents</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <Gauge className="w-5 h-5 mx-auto mb-2 text-green-400" />
              <div className="text-2xl font-bold text-white">{agents.activeAgents}</div>
              <div className="text-xs text-white/50">Active</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <Shield className="w-5 h-5 mx-auto mb-2 text-cyan-400" />
              <div className="text-2xl font-bold text-white">{((agents.avgPowerLevel || 0) * 100).toFixed(0)}%</div>
              <div className="text-xs text-white/50">Avg Power</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <HardDrive className="w-5 h-5 mx-auto mb-2 text-amber-400" />
              <div className="text-2xl font-bold text-white">{agents.totalTasks}</div>
              <div className="text-xs text-white/50">Total Tasks</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Specializations</h3>
            <div className="flex flex-wrap gap-2">
              {agents.specializations?.map((s: string) => (
                <span key={s} className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{s}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "agents" && agentList && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Agent Registry — {(agentList as any[]).length} Agents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(agentList as any[]).map((agent: any) => (
              <div key={agent.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{agent.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${agent.status === "active" ? "bg-green-500/20 text-green-300" : agent.status === "dormant" ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-white/40"}`}>{agent.status}</span>
                </div>
                <div className="text-xs text-white/50 mb-2">{agent.specialization} • Gen {agent.generation} • Power: {(agent.powerLevel * 100).toFixed(0)}%</div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-1.5 rounded-full" style={{ width: `${agent.powerLevel * 100}%` }} />
                </div>
                <div className="text-xs text-white/30 mt-2">Skills: {agent.skills?.join(", ")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "consensus" && consensus && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-white">{consensus.totalProposals}</div>
              <div className="text-xs text-white/50">Proposals</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{consensus.approved}</div>
              <div className="text-xs text-white/50">Approved</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{consensus.rejected}</div>
              <div className="text-xs text-white/50">Rejected</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-white">{((consensus.avgApprovalRate || 0) * 100).toFixed(0)}%</div>
              <div className="text-xs text-white/50">Approval Rate</div>
            </div>
          </div>
          {consensus.recentProposals?.map((p: any) => (
            <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{p.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "approved" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>{p.status}</span>
              </div>
              <div className="text-xs text-white/40 mt-1">Category: {p.category}</div>
            </div>
          ))}
          {executor && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white/70 mb-2">Council Executor</h3>
              <div className="text-sm text-white/60">Auto-execute: {executor.autoExecuteEnabled ? "Enabled" : "Disabled"} • Executions: {executor.totalExecutions} • Success: {((executor.successRate || 0) * 100).toFixed(0)}%</div>
            </div>
          )}
        </div>
      )}

      {activeTab === "comms" && comms && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-white">{comms.totalMessages}</div>
              <div className="text-xs text-white/50">Total Messages</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-white">{comms.channelCount}</div>
              <div className="text-xs text-white/50">Channels</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-white">{comms.activeChannels}</div>
              <div className="text-xs text-white/50">Active</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{comms.unacknowledged}</div>
              <div className="text-xs text-white/50">Unread</div>
            </div>
          </div>
          {channels && (channels as any[]).map((ch: any) => (
            <div key={ch.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-white">{ch.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">{ch.type}</span>
              </div>
              <div className="text-xs text-white/40">Members: {ch.members?.join(", ")} • Messages: {ch.messageCount}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "evolution" && evolution && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-violet-900/30 to-indigo-900/30 border border-violet-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-3">Self-Code Evolution</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{evolution.totalProposals}</div>
                <div className="text-xs text-white/50">Proposals</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{evolution.appliedChanges}</div>
                <div className="text-xs text-white/50">Applied</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{evolution.enabled ? "ON" : "OFF"}</div>
                <div className="text-xs text-white/50">Status</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{evolution.protectedFiles?.length || 0}</div>
                <div className="text-xs text-white/50">Protected Files</div>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Safety Checks</h3>
            {evolution.safetyChecks?.map((check: any) => (
              <div key={check.name} className="flex items-center justify-between py-1">
                <span className="text-sm text-white/60">{check.name}</span>
                <span className={`text-xs ${check.passing ? "text-green-400" : "text-red-400"}`}>{check.passing ? "PASS" : "FAIL"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
