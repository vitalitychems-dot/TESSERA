import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, Plus, Trash2, Send, Zap, ChevronLeft,
  Crown, Brain, Sparkles, Users, Menu, X, Bot, AlertCircle,
  Star, CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronRight,
  Code2, FlaskConical, Rocket, RotateCcw, GitBranch, TrendingUp, Clock,
  Search, Download, FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_BASE = `${import.meta.env.BASE_URL}workspace-api/api`;

interface Conversation {
  id: number;
  title: string;
  initiatedBy: string | null;
  createdAt: string;
}

interface ChatMessage {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  agentId: string | null;
  agentName: string | null;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  brainRegion: string;
  expertise: string;
}

interface SummitAgentResponse {
  id: string;
  name: string;
  role: string;
  brainRegion: string;
  response: string;
}

interface SummitResult {
  agents: SummitAgentResponse[];
  synthesis: string;
}

interface GrandAgentPerspective {
  agentId: string;
  agentName: string;
  agentRole: string;
  agentBrainRegion: string;
  domainCluster: string;
  vote: "approve" | "reject" | "abstain";
  confidence: number;
  reasoning: string;
  perspective: string;
}

interface GrandConferenceRecord {
  conferenceId?: string;
  status: "approved" | "rejected" | "unknown";
  finalApprovalRate?: number;
  agentCount?: number;
  rounds?: number;
  clusterConsensus?: Record<string, string>;
  implementationNotes?: string;
  synthesis: string;
  proposals?: Array<{ id: string; title: string; description: string }>;
  agentPerspectives?: GrandAgentPerspective[];
}

interface StreamedMessage {
  content: string;
  done: boolean;
  agent?: { id: string; name: string; role: string; brainRegion: string };
  conversationId?: number;
  error?: string;
  summitResult?: SummitResult;
  grandConferenceResult?: GrandConferenceRecord;
}

interface SandboxProposal {
  id: string;
  description: string;
  fileName: string;
  targetPath: string;
  status: "pending" | "testing" | "passed" | "failed" | "deployed" | "rejected";
  retryCount: number;
  createdAt: string;
  deployedAt?: string;
  testCount: number;
  lastTestPassed: boolean | null;
  diffPreview?: string;
}

interface ImprovementEvent {
  type: string;
  message?: string;
  conversationId?: number;
  proposalId?: string;
  fileName?: string;
  targetPath?: string;
  codePreview?: string;
  status?: string;
  testOutput?: string;
  diffPreview?: string;
  retryCount?: number;
  readyToDeploy?: boolean;
  autoApprove?: boolean;
  success?: boolean;
  deploymentId?: string;
  rolledBack?: boolean;
  error?: string;
  done?: boolean;
  errors?: string;
}

interface DeploymentRecord {
  id: string;
  proposalId: string;
  targetPath: string;
  fileName: string;
  description: string;
  deployedAt: string;
  status: "success" | "failed" | "rolled-back";
  backupPath?: string;
  rollbackReason?: string;
}

const AGENT_COLORS: Record<string, string> = {
  tessera: "text-violet-400",
  alpha: "text-amber-400",
  beta: "text-cyan-400",
  gamma: "text-emerald-400",
  delta: "text-blue-400",
  epsilon: "text-rose-400",
  zeta: "text-red-400",
  eta: "text-orange-400",
  theta: "text-purple-400",
  iota: "text-yellow-400",
  kappa: "text-teal-400",
  lambda: "text-green-400",
  mu: "text-red-500",
  nu: "text-lime-400",
  xi: "text-gold-400",
  omicron: "text-pink-400",
  pi: "text-indigo-400",
  rho: "text-sky-400",
  sigma: "text-slate-300",
  tau: "text-fuchsia-400",
  upsilon: "text-violet-300",
  phi: "text-rose-300",
  chi: "text-orange-300",
  psi: "text-emerald-300",
  omega: "text-red-300",
  summit: "text-amber-300",
};

const AGENT_BG: Record<string, string> = {
  tessera: "border-violet-500/30 bg-violet-950/30",
  alpha: "border-amber-500/30 bg-amber-950/20",
  beta: "border-cyan-500/30 bg-cyan-950/20",
  gamma: "border-emerald-500/30 bg-emerald-950/20",
  xi: "border-yellow-500/30 bg-yellow-950/20",
  summit: "border-amber-500/40 bg-amber-950/30",
};

function getAgentColor(agentId: string | null): string {
  if (!agentId) return "text-violet-400";
  return AGENT_COLORS[agentId.toLowerCase()] || "text-violet-400";
}

function getAgentBg(agentId: string | null): string {
  if (!agentId) return "border-violet-500/30 bg-violet-950/30";
  return AGENT_BG[agentId.toLowerCase()] || "border-violet-500/30 bg-violet-950/30";
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function AgentBadge({ agentId, agentName, brainRegion }: { agentId: string; agentName: string; brainRegion?: string }) {
  const color = getAgentColor(agentId);
  return (
    <div className={`flex items-center gap-1.5 mb-1.5`}>
      <Brain size={10} className={color} />
      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${color}`}>{agentName}</span>
      {brainRegion && (
        <span className="text-[9px] font-mono text-slate-600">· {brainRegion}</span>
      )}
    </div>
  );
}

function MessageBubble({ msg, agents }: { msg: ChatMessage; agents: Agent[] }) {
  const isUser = msg.role === "user";

  if (isUser) {
    const isSummitMsg = msg.content.startsWith("[SUMMIT CALLED]");
    const isGrandMsg = msg.content.startsWith("[GRAND CONFERENCE CALLED]");
    const isSystem = isSummitMsg || isGrandMsg;
    return (
      <div className="flex justify-end mb-3">
        <div className={`max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 ${
          isGrandMsg
            ? "bg-violet-900/40 border border-violet-500/30 text-violet-200"
            : isSystem
            ? "bg-amber-900/40 border border-amber-500/30 text-amber-200"
            : "bg-violet-700/60 border border-violet-500/40 text-white"
        }`}>
          {isGrandMsg ? (
            <div className="flex items-center gap-2">
              <Star size={12} className="text-violet-400" />
              <span className="text-xs font-mono text-violet-300">Grand Conference Called</span>
            </div>
          ) : isSummitMsg ? (
            <div className="flex items-center gap-2">
              <Sparkles size={12} className="text-amber-400" />
              <span className="text-xs font-mono text-amber-300">{msg.content.replace("[SUMMIT CALLED] ", "")}</span>
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          )}
        </div>
      </div>
    );
  }

  if (msg.agentId === "grand-conference") {
    let grandData: GrandConferenceRecord | null = null;
    try {
      grandData = JSON.parse(msg.content);
    } catch {}

    if (grandData) {
      return <GrandConferenceBubble record={grandData} />;
    }
  }

  if (msg.agentId === "summit") {
    let summitData: SummitResult | null = null;
    try {
      summitData = JSON.parse(msg.content);
    } catch {}

    if (summitData) {
      return (
        <div className="mb-4">
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-slate-950/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-950/40">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Summit Deliberation</span>
              </div>
            </div>
            <div className="p-4">
              <div className="relative pl-6 space-y-0">
                {summitData.agents.map((a, idx) => (
                  <div key={a.id} className="relative">
                    <div className="absolute left-[-24px] top-3 flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${getAgentColor(a.id)} border-current bg-slate-950`}>
                        <span className="text-[8px] font-bold">{idx + 1}</span>
                      </div>
                      {idx < summitData!.agents.length - 1 && (
                        <div className="w-px flex-1 mt-1 mb-1 bg-gradient-to-b from-slate-700 to-transparent min-h-[12px]" />
                      )}
                    </div>
                    <div className={`rounded-xl border ${getAgentBg(a.id)} p-3 mb-3 ml-1`}>
                      <AgentBadge agentId={a.id} agentName={a.name} brainRegion={a.brainRegion} />
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{a.response}</p>
                    </div>
                  </div>
                ))}
              </div>
              {summitData.synthesis && (
                <div className="rounded-xl border border-violet-500/40 bg-violet-950/40 p-4 mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown size={12} className="text-violet-400" />
                    <span className="text-[11px] font-mono font-bold text-violet-300 uppercase tracking-wider">Sovereign Synthesis</span>
                  </div>
                  <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{summitData.synthesis}</p>
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-amber-500/10 text-[10px] font-mono text-slate-600">{formatTime(msg.createdAt)}</div>
          </div>
        </div>
      );
    }
  }

  const agent = agents.find(a => a.id === msg.agentId);
  const agentColor = getAgentColor(msg.agentId);
  const agentBg = getAgentBg(msg.agentId);

  return (
    <div className="flex justify-start mb-3">
      <div className={`max-w-[85%] rounded-2xl rounded-tl-sm border ${agentBg} px-4 py-3`}>
        {msg.agentName && (
          <AgentBadge
            agentId={msg.agentId || "tessera"}
            agentName={msg.agentName}
            brainRegion={agent?.brainRegion}
          />
        )}
        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        <div className="text-[10px] font-mono text-slate-600 mt-1.5">{formatTime(msg.createdAt)}</div>
      </div>
    </div>
  );
}

function StreamingBubble({ content, agentName, agentId, brainRegion }: {
  content: string;
  agentName: string;
  agentId: string;
  brainRegion?: string;
}) {
  const agentBg = getAgentBg(agentId);
  return (
    <div className="flex justify-start mb-3">
      <div className={`max-w-[85%] rounded-2xl rounded-tl-sm border ${agentBg} px-4 py-3`}>
        <AgentBadge agentId={agentId} agentName={agentName} brainRegion={brainRegion} />
        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
          {content}
          <span className="inline-block w-1.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
        </p>
      </div>
    </div>
  );
}

function SummitStreamBubble({
  phase,
  currentAgent,
  agentResponses,
  synthContent,
}: {
  phase: string;
  currentAgent?: { name: string; id: string; role: string; brainRegion: string };
  agentResponses: SummitAgentResponse[];
  synthContent: string;
}) {
  return (
    <div className="mb-4">
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-slate-950/80 overflow-hidden">
        <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-950/40">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Summit in Progress — {agentResponses.length} agents consulted
            </span>
          </div>
        </div>
        <div className="p-4">
          <div className="relative pl-6 space-y-0">
            {agentResponses.map((a, idx) => (
              <div key={a.id} className="relative">
                <div className="absolute left-[-24px] top-3 flex flex-col items-center">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${getAgentColor(a.id)} border-current bg-slate-950`}>
                    <span className="text-[8px] font-bold">{idx + 1}</span>
                  </div>
                  {(idx < agentResponses.length - 1 || currentAgent || phase === "synthesizing" || synthContent) && (
                    <div className="w-px flex-1 mt-1 mb-1 bg-gradient-to-b from-slate-700 to-transparent min-h-[12px]" />
                  )}
                </div>
                <div className={`rounded-xl border ${getAgentBg(a.id)} p-3 mb-3 ml-1`}>
                  <AgentBadge agentId={a.id} agentName={a.name} brainRegion={a.brainRegion} />
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{a.response}</p>
                </div>
              </div>
            ))}

            {currentAgent && phase === "agent_thinking" && (
              <div className="relative">
                <div className="absolute left-[-24px] top-3 flex flex-col items-center">
                  <div className={`w-4 h-4 rounded-full border-2 border-dashed flex items-center justify-center ${getAgentColor(currentAgent.id)} border-current bg-slate-950 animate-pulse`}>
                  </div>
                </div>
                <div className={`rounded-xl border ${getAgentBg(currentAgent.id)} p-3 mb-3 ml-1`}>
                  <AgentBadge agentId={currentAgent.id} agentName={currentAgent.name} brainRegion={currentAgent.brainRegion} />
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {(phase === "synthesizing" || synthContent) && (
            <div className="rounded-xl border border-violet-500/40 bg-violet-950/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Crown size={12} className="text-violet-400" />
                <span className="text-[11px] font-mono font-bold text-violet-300 uppercase tracking-wider">
                  {synthContent ? "Sovereign Synthesis" : "Synthesizing..."}
                </span>
              </div>
              {synthContent ? (
                <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
                  {synthContent}
                  {phase !== "done" && (
                    <span className="inline-block w-1.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
                  )}
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CLUSTER_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  "Financial & Revenue": { text: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-950/20" },
  "Engineering & Systems": { text: "text-cyan-400", border: "border-cyan-500/30", bg: "bg-cyan-950/20" },
  "Intelligence & Research": { text: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-950/20" },
  "Security & Defense": { text: "text-red-400", border: "border-red-500/30", bg: "bg-red-950/20" },
  "Philosophy & Ethics": { text: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-950/20" },
  "Strategy & Governance": { text: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-950/20" },
  "Innovation & Growth": { text: "text-rose-400", border: "border-rose-500/30", bg: "bg-rose-950/20" },
  "Sovereign Core": { text: "text-violet-400", border: "border-violet-500/30", bg: "bg-violet-950/20" },
};

function getClusterStyle(cluster: string) {
  return CLUSTER_COLORS[cluster] || { text: "text-slate-400", border: "border-slate-500/30", bg: "bg-slate-950/20" };
}

function VoteIcon({ vote }: { vote: "approve" | "reject" | "abstain" }) {
  if (vote === "approve") return <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" />;
  if (vote === "reject") return <XCircle size={11} className="text-red-400 flex-shrink-0" />;
  return <MinusCircle size={11} className="text-slate-500 flex-shrink-0" />;
}

function GrandAgentCard({ perspective, expanded, onToggle }: {
  perspective: GrandAgentPerspective;
  expanded: boolean;
  onToggle: () => void;
}) {
  const clusterStyle = getClusterStyle(perspective.domainCluster);
  const agentColor = getAgentColor(perspective.agentId);
  const confidencePct = Math.round(perspective.confidence * 100);

  return (
    <div className={`rounded-xl border ${clusterStyle.border} ${clusterStyle.bg} mb-2`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors rounded-xl"
      >
        <VoteIcon vote={perspective.vote} />
        <Brain size={10} className={agentColor} />
        <span className={`text-[11px] font-bold font-mono ${agentColor}`}>{perspective.agentName}</span>
        <span className="text-[9px] text-slate-600 hidden sm:inline truncate flex-1">{perspective.agentRole}</span>
        <span className={`text-[9px] font-mono ${clusterStyle.text} ml-auto mr-1 hidden sm:inline`}>{perspective.domainCluster}</span>
        <span className="text-[9px] font-mono text-slate-600">{confidencePct}%</span>
        {expanded ? <ChevronDown size={10} className="text-slate-600 flex-shrink-0" /> : <ChevronRight size={10} className="text-slate-600 flex-shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-[11px] text-slate-400 leading-relaxed border-l-2 border-current pl-2 italic" style={{ borderColor: perspective.vote === "approve" ? "#34d399" : perspective.vote === "reject" ? "#f87171" : "#64748b" }}>
            {perspective.reasoning}
          </div>
          {perspective.perspective && perspective.perspective !== perspective.reasoning && (
            <div className="text-[11px] text-slate-300 leading-relaxed">
              {perspective.perspective}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GrandConferenceBubble({ record }: { record: GrandConferenceRecord }) {
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [showAllAgents, setShowAllAgents] = useState(false);

  const perspectives = record.agentPerspectives ?? [];
  const approveCount = perspectives.filter(p => p.vote === "approve").length;
  const rejectCount = perspectives.filter(p => p.vote === "reject").length;
  const abstainCount = perspectives.filter(p => p.vote === "abstain").length;

  const byCluster: Record<string, GrandAgentPerspective[]> = {};
  for (const p of perspectives) {
    const cl = p.domainCluster || "General";
    if (!byCluster[cl]) byCluster[cl] = [];
    byCluster[cl].push(p);
  }

  const toggleAgent = (id: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approvalPct = record.finalApprovalRate != null ? Math.round(record.finalApprovalRate * 100) : null;
  const statusColor = record.status === "approved" ? "text-emerald-400" : record.status === "rejected" ? "text-red-400" : "text-slate-400";
  const statusBorder = record.status === "approved" ? "border-emerald-500/30" : record.status === "rejected" ? "border-red-500/30" : "border-slate-500/30";

  return (
    <div className="mb-4">
      <div className={`rounded-2xl border ${statusBorder} bg-gradient-to-br from-violet-950/40 via-slate-950/90 to-indigo-950/30 overflow-hidden`}>
        <div className="px-4 py-3 border-b border-violet-500/20 bg-violet-950/50">
          <div className="flex items-center gap-2 mb-1">
            <Star size={14} className="text-violet-400" />
            <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">Grand Conference — All 25 Agents</span>
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-emerald-400" />
              <span className="text-[11px] font-mono text-emerald-300">{approveCount} approve</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle size={11} className="text-red-400" />
              <span className="text-[11px] font-mono text-red-300">{rejectCount} reject</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MinusCircle size={11} className="text-slate-500" />
              <span className="text-[11px] font-mono text-slate-400">{abstainCount} abstain</span>
            </div>
            {approvalPct != null && (
              <span className={`text-[11px] font-bold font-mono ${statusColor} ml-auto`}>
                {approvalPct}% → {record.status.toUpperCase()}
              </span>
            )}
          </div>
          {record.rounds && record.rounds > 1 && (
            <div className="text-[10px] font-mono text-amber-400/60 mt-1">
              ⚡ Went to Grand Reconsideration ({record.rounds} rounds)
            </div>
          )}
        </div>

        <div className="p-4">
          {record.proposals && record.proposals.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Proposals Deliberated</div>
              <div className="space-y-1.5">
                {record.proposals.map((prop, i) => (
                  <div key={prop.id} className="rounded-lg border border-violet-500/15 bg-violet-950/20 px-3 py-2">
                    <div className="text-[11px] font-bold text-violet-300">{i + 1}. {prop.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{prop.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.clusterConsensus && Object.keys(record.clusterConsensus).length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Domain Cluster Consensus</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {Object.entries(record.clusterConsensus).map(([cluster, verdict]) => {
                  const style = getClusterStyle(cluster);
                  const isExpanded = expandedCluster === cluster;
                  const clusterAgents = byCluster[cluster] ?? [];
                  return (
                    <div key={cluster}>
                      <button
                        onClick={() => setExpandedCluster(isExpanded ? null : cluster)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${style.border} ${style.bg} hover:opacity-90 transition-opacity text-left`}
                      >
                        <span className={`text-[10px] font-bold ${style.text}`}>{cluster}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono text-slate-400">{verdict}</span>
                          {isExpanded ? <ChevronDown size={9} className="text-slate-600" /> : <ChevronRight size={9} className="text-slate-600" />}
                        </div>
                      </button>
                      {isExpanded && clusterAgents.length > 0 && (
                        <div className="mt-1 ml-2 space-y-1">
                          {clusterAgents.map(p => (
                            <GrandAgentCard
                              key={p.agentId}
                              perspective={p}
                              expanded={expandedAgents.has(p.agentId)}
                              onToggle={() => toggleAgent(p.agentId)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {perspectives.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowAllAgents(!showAllAgents)}
                className="flex items-center gap-2 text-[10px] font-mono text-violet-400/60 hover:text-violet-400 transition-colors mb-2"
              >
                {showAllAgents ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                {showAllAgents ? "Hide" : "Show"} all {perspectives.length} agent perspectives
              </button>
              {showAllAgents && (
                <div className="space-y-0.5 max-h-96 overflow-y-auto pr-1">
                  {perspectives.map(p => (
                    <GrandAgentCard
                      key={p.agentId}
                      perspective={p}
                      expanded={expandedAgents.has(p.agentId)}
                      onToggle={() => toggleAgent(p.agentId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {record.synthesis && (
            <div className="rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-950/60 to-indigo-950/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Crown size={12} className="text-violet-400" />
                <span className="text-[11px] font-mono font-bold text-violet-300 uppercase tracking-wider">Tessera's Sovereign Resolution</span>
              </div>
              <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{record.synthesis}</p>
            </div>
          )}
        </div>

        {record.implementationNotes && (
          <div className="px-4 py-2 border-t border-violet-500/10 text-[10px] font-mono text-slate-600">
            {record.implementationNotes}
          </div>
        )}
      </div>
    </div>
  );
}

function GrandConferenceStreamBubble({
  phase,
  currentAgent,
  agentVotes,
  synthContent,
  conferenceInfo,
}: {
  phase: string;
  currentAgent?: { name: string; id: string; role: string; brainRegion: string; domainCluster: string };
  agentVotes: GrandAgentPerspective[];
  synthContent: string;
  conferenceInfo?: { title: string; agentCount: number; clusters: string[] };
}) {
  const approveCount = agentVotes.filter(v => v.vote === "approve").length;
  const rejectCount = agentVotes.filter(v => v.vote === "reject").length;
  const abstainCount = agentVotes.filter(v => v.vote === "abstain").length;

  const [showAll, setShowAll] = useState(false);
  const displayVotes = showAll ? agentVotes : agentVotes.slice(-8);

  return (
    <div className="mb-4">
      <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-slate-950/90 to-indigo-950/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-violet-500/20 bg-violet-950/50">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-violet-400 animate-pulse" />
            <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">
              Grand Conference in Progress
            </span>
          </div>
          {conferenceInfo && (
            <div className="text-[10px] font-mono text-slate-500 mt-1 truncate">
              {conferenceInfo.title}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[11px] font-mono text-emerald-300">{approveCount} approve</span>
            <span className="text-[11px] font-mono text-red-300">{rejectCount} reject</span>
            <span className="text-[11px] font-mono text-slate-400">{abstainCount} abstain</span>
            <span className="text-[10px] font-mono text-violet-400/60 ml-auto">{agentVotes.length}/{conferenceInfo?.agentCount ?? 25} voted</span>
          </div>
        </div>

        <div className="p-4">
          {agentVotes.length > 8 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-[10px] font-mono text-violet-400/60 hover:text-violet-400 mb-2 transition-colors"
            >
              {showAll ? "Show recent" : `Show all ${agentVotes.length}`}
            </button>
          )}
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {displayVotes.map((v, idx) => {
              const color = getAgentColor(v.agentId);
              const clStyle = getClusterStyle(v.domainCluster);
              return (
                <div key={v.agentId} className={`rounded-lg border ${clStyle.border} ${clStyle.bg} px-2.5 py-1.5 flex items-start gap-2`}>
                  <VoteIcon vote={v.vote} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold font-mono ${color}`}>{v.agentName}</span>
                      <span className={`text-[9px] ${clStyle.text} hidden sm:inline`}>{v.domainCluster}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug mt-0.5 line-clamp-2">{v.reasoning}</p>
                  </div>
                  <span className="text-[9px] font-mono text-slate-600 flex-shrink-0">{Math.round(v.confidence * 100)}%</span>
                </div>
              );
            })}
          </div>

          {currentAgent && phase !== "synthesizing" && (
            <div className={`rounded-lg border ${getClusterStyle(currentAgent.domainCluster).border} ${getClusterStyle(currentAgent.domainCluster).bg} px-2.5 py-2 mt-2 flex items-center gap-2 animate-pulse`}>
              <Brain size={10} className={`${getAgentColor(currentAgent.id)} animate-pulse`} />
              <span className={`text-[11px] font-bold font-mono ${getAgentColor(currentAgent.id)}`}>{currentAgent.name}</span>
              <span className="text-[10px] text-slate-500">deliberating...</span>
              <div className="flex gap-1 ml-auto">
                {[0, 150, 300].map(d => (
                  <div key={d} className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}

          {(phase === "synthesizing" || synthContent) && (
            <div className="rounded-xl border border-violet-500/40 bg-violet-950/40 p-4 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Crown size={12} className="text-violet-400" />
                <span className="text-[11px] font-mono font-bold text-violet-300 uppercase tracking-wider">
                  {synthContent ? "Sovereign Resolution" : "Tessera is synthesizing..."}
                </span>
              </div>
              {synthContent ? (
                <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
                  {synthContent}
                  {phase !== "done" && (
                    <span className="inline-block w-1.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
                  )}
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentPicker({ agents, onSelect, onClose, filterText }: {
  agents: Agent[];
  onSelect: (agent: Agent) => void;
  onClose: () => void;
  filterText: string;
}) {
  const [highlightIdx, setHighlightIdx] = useState(0);
  const filtered = agents.filter(a =>
    filterText === "" ||
    a.name.toLowerCase().startsWith(filterText.toLowerCase()) ||
    a.role.toLowerCase().includes(filterText.toLowerCase())
  ).slice(0, 12);

  useEffect(() => {
    setHighlightIdx(0);
  }, [filterText]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filtered[highlightIdx]) onSelect(filtered[highlightIdx]);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filtered, highlightIdx, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-violet-500/30 rounded-xl shadow-2xl shadow-violet-900/50 overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-violet-500/20 flex items-center justify-between">
        <span className="text-[11px] font-mono text-violet-400 uppercase tracking-wider">
          @mention an agent
          {filterText && <span className="text-slate-500 ml-1">— "{filterText}"</span>}
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded hover:bg-slate-800">
          <X size={12} />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.map((agent, idx) => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
              idx === highlightIdx ? "bg-violet-950/70 border-l-2 border-violet-400" : "hover:bg-violet-950/40 border-l-2 border-transparent"
            }`}
          >
            <Brain size={12} className={getAgentColor(agent.id)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${getAgentColor(agent.id)}`}>@{agent.name}</span>
                <span className="text-[10px] text-slate-500 truncate">{agent.brainRegion}</span>
              </div>
              <div className="text-[10px] text-slate-600 truncate">{agent.role}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-violet-500/10 text-[10px] font-mono text-slate-700 flex gap-3">
        <span>↑↓ navigate</span>
        <span>Enter/Tab select</span>
        <span>Esc close</span>
      </div>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mx-4 mb-2 px-3 py-2.5 rounded-xl border border-rose-500/40 bg-rose-950/40 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
      <span className="text-xs text-rose-300 flex-1">{message}</span>
      <button onClick={onDismiss} className="text-rose-500 hover:text-rose-300 transition-colors">
        <X size={12} />
      </button>
    </div>
  );
}

function ImprovementStreamBubble({ events }: { events: ImprovementEvent[] }) {
  const [showDiff, setShowDiff] = useState(false);

  const statusEvent = events.find(e => e.type === "sandbox_result");
  const deployEvent = events.find(e => e.type === "deploy_complete");
  const proposalEvent = events.find(e => e.type === "proposal");
  const progressMessages = events.filter(e =>
    ["status", "sandbox_start", "sandbox_progress", "debug", "deploy_start", "deploy_progress"].includes(e.type)
  );
  const isDone = events.some(e => e.type === "done" || e.type === "error");

  const passed = statusEvent?.status === "passed";
  const deployed = deployEvent?.success === true;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 to-slate-950/80 overflow-hidden w-full">
        <div className="px-4 py-3 border-b border-cyan-500/20 bg-cyan-950/30 flex items-center gap-2">
          <Code2 size={13} className="text-cyan-400" />
          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Self-Improvement Pipeline</span>
          {!isDone && (
            <div className="flex gap-1 ml-2">
              {[0, 150, 300].map(d => (
                <div key={d} className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          )}
          {isDone && passed && !deployed && (
            <span className="ml-auto text-[10px] font-mono text-emerald-400 font-bold">TESTS PASSED</span>
          )}
          {isDone && deployed && (
            <span className="ml-auto text-[10px] font-mono text-violet-400 font-bold">DEPLOYED</span>
          )}
          {isDone && !passed && (
            <span className="ml-auto text-[10px] font-mono text-red-400 font-bold">FAILED</span>
          )}
        </div>

        <div className="p-4 space-y-2">
          {proposalEvent && (
            <div className="flex items-start gap-2">
              <Code2 size={11} className="text-cyan-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-[11px] font-mono text-cyan-300 font-bold">{proposalEvent.fileName}</div>
                <div className="text-[10px] text-slate-500 font-mono">{proposalEvent.targetPath}</div>
                {proposalEvent.codePreview && (
                  <pre className="text-[9px] text-slate-600 mt-1 font-mono overflow-x-auto max-w-xs">{proposalEvent.codePreview}</pre>
                )}
              </div>
            </div>
          )}

          {progressMessages.length > 0 && (
            <div className="space-y-1">
              {progressMessages.slice(-6).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    e.type === "debug" ? "bg-amber-400" :
                    e.type.startsWith("deploy") ? "bg-violet-400" :
                    "bg-cyan-400/60"
                  }`} />
                  <span className="text-slate-400 font-mono">{e.message}</span>
                </div>
              ))}
            </div>
          )}

          {statusEvent && (
            <div className={`rounded-xl border p-3 ${
              passed
                ? "border-emerald-500/30 bg-emerald-950/20"
                : "border-red-500/30 bg-red-950/20"
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {passed
                  ? <CheckCircle2 size={12} className="text-emerald-400" />
                  : <XCircle size={12} className="text-red-400" />}
                <span className={`text-[11px] font-bold font-mono ${passed ? "text-emerald-300" : "text-red-300"}`}>
                  {passed ? "All sandbox tests passed" : `Tests failed (${statusEvent.retryCount} attempt(s))`}
                </span>
              </div>
              {statusEvent.testOutput && (
                <pre className="text-[9px] text-slate-500 font-mono whitespace-pre-wrap mt-1 max-h-24 overflow-y-auto">
                  {statusEvent.testOutput}
                </pre>
              )}
              {statusEvent.errors && !passed && (
                <div className="text-[10px] text-red-400 mt-1 font-mono">{statusEvent.errors}</div>
              )}
              {statusEvent.diffPreview && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowDiff(!showDiff)}
                    className="text-[10px] font-mono text-cyan-400/60 hover:text-cyan-400 flex items-center gap-1"
                  >
                    <GitBranch size={9} />
                    {showDiff ? "Hide diff" : "Show diff preview"}
                  </button>
                  {showDiff && (
                    <pre className="text-[9px] text-slate-500 font-mono mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap bg-slate-900/60 rounded p-2">
                      {statusEvent.diffPreview}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {deployEvent && (
            <div className={`rounded-xl border p-3 ${
              deployEvent.success
                ? "border-violet-500/30 bg-violet-950/20"
                : "border-red-500/30 bg-red-950/20"
            }`}>
              <div className="flex items-center gap-2">
                {deployEvent.success
                  ? <Rocket size={12} className="text-violet-400" />
                  : <XCircle size={12} className="text-red-400" />}
                <span className={`text-[11px] font-bold font-mono ${deployEvent.success ? "text-violet-300" : "text-red-300"}`}>
                  {deployEvent.success ? `Deployed — ID: ${deployEvent.deploymentId}` : `Deployment failed: ${deployEvent.error}`}
                </span>
              </div>
              {deployEvent.rolledBack && (
                <div className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                  <RotateCcw size={9} />
                  Rolled back to previous version
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EvolutionDashboard({ onRequestImprovement }: { onRequestImprovement: (desc: string) => void }) {
  const [improveInput, setImproveInput] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;
    const connect = () => {
      es = new EventSource(`${API_BASE}/sandbox/events/reload`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "server_reload") {
            setReloadCount(c => c + 1);
            queryClient.invalidateQueries({ queryKey: ["sandbox-status"] });
            queryClient.invalidateQueries({ queryKey: ["sandbox-proposals"] });
            queryClient.invalidateQueries({ queryKey: ["deployments"] });
            queryClient.invalidateQueries({ queryKey: ["evolution-status"] });
          }
        } catch {}
      };
      es.onerror = () => {
        es?.close();
        retryTimer = setTimeout(connect, 5000);
      };
    };
    connect();
    return () => {
      es?.close();
      clearTimeout(retryTimer);
    };
  }, [queryClient]);

  const { data: sandboxData, isLoading: sandboxLoading } = useQuery({
    queryKey: ["sandbox-status"],
    queryFn: () => fetch(`${API_BASE}/sandbox/status`).then(r => r.json()),
    refetchInterval: 5000,
  });

  const { data: proposalsData, isLoading: proposalsLoading } = useQuery({
    queryKey: ["sandbox-proposals"],
    queryFn: () => fetch(`${API_BASE}/sandbox/proposals`).then(r => r.json()) as Promise<{ proposals: SandboxProposal[] }>,
    refetchInterval: 3000,
  });

  const { data: deploymentsData } = useQuery({
    queryKey: ["deployments"],
    queryFn: () => fetch(`${API_BASE}/sandbox/deployments`).then(r => r.json()) as Promise<{ deployments: DeploymentRecord[] }>,
    refetchInterval: 5000,
  });

  const { data: evolutionData } = useQuery({
    queryKey: ["evolution-status"],
    queryFn: () => fetch(`${API_BASE}/evolution/status`).then(r => r.json()),
    refetchInterval: 10000,
  });

  const proposals: SandboxProposal[] = proposalsData?.proposals ?? [];
  const deployments: DeploymentRecord[] = deploymentsData?.deployments ?? [];
  const sandbox = sandboxData?.sandbox;
  const deploy = sandboxData?.deploy;

  const deployProposal = async (proposalId: string) => {
    const response = await fetch(`${API_BASE}/sandbox/deploy-approved/${proposalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop() || "";
    }
    queryClient.invalidateQueries({ queryKey: ["sandbox-proposals"] });
    queryClient.invalidateQueries({ queryKey: ["deployments"] });
  };

  const rollback = async (deploymentId: string) => {
    await fetch(`${API_BASE}/sandbox/rollback/${deploymentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    queryClient.invalidateQueries({ queryKey: ["deployments"] });
    queryClient.invalidateQueries({ queryKey: ["sandbox-proposals"] });
  };

  const statusColor = (status: string) => {
    if (status === "passed" || status === "deployed" || status === "success") return "text-emerald-400 border-emerald-500/30 bg-emerald-950/20";
    if (status === "failed" || status === "rejected") return "text-red-400 border-red-500/30 bg-red-950/20";
    if (status === "testing") return "text-cyan-400 border-cyan-500/30 bg-cyan-950/20";
    if (status === "rolled-back") return "text-amber-400 border-amber-500/30 bg-amber-950/20";
    return "text-slate-400 border-slate-500/30 bg-slate-950/20";
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-violet-500 flex items-center justify-center">
          <Code2 size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-black text-white">Self-Improvement Pipeline</div>
          <div className="text-[10px] font-mono text-cyan-400/60">Sovereign code generation & deployment</div>
        </div>
        {reloadCount > 0 && (
          <div className="text-[9px] font-mono text-emerald-400/60 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {reloadCount} live update{reloadCount > 1 ? "s" : ""}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
        <div className="text-[11px] font-mono text-cyan-400/60 uppercase tracking-wider mb-3">Request Improvement</div>
        <Textarea
          value={improveInput}
          onChange={e => setImproveInput(e.target.value)}
          placeholder="Describe an improvement... e.g. 'Add a /health endpoint that returns uptime and memory usage'"
          className="resize-none min-h-[72px] max-h-40 bg-slate-900/80 border-cyan-500/30 text-white placeholder-slate-600 focus:border-cyan-500/60 text-sm mb-3"
          rows={3}
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={e => setAutoApprove(e.target.checked)}
              className="w-3 h-3 accent-cyan-500"
            />
            <span className="text-[11px] font-mono text-slate-400">Auto-deploy if tests pass</span>
          </label>
          <Button
            onClick={() => {
              if (improveInput.trim()) {
                onRequestImprovement(improveInput.trim() + (autoApprove ? " __AUTO_DEPLOY__" : ""));
                setImproveInput("");
              }
            }}
            disabled={!improveInput.trim()}
            size="sm"
            className="bg-cyan-700/60 hover:bg-cyan-600/70 border border-cyan-500/40 text-white text-xs gap-1.5"
          >
            <FlaskConical size={12} />
            Run Pipeline
          </Button>
        </div>
      </div>

      {sandbox && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Total", value: sandbox.totalProposals, color: "text-slate-300" },
            { label: "Passed", value: sandbox.passed, color: "text-emerald-400" },
            { label: "Failed", value: sandbox.failed, color: "text-red-400" },
            { label: "Deployed", value: sandbox.deployed, color: "text-violet-400" },
            { label: "Rejected", value: sandbox.rejected, color: "text-amber-400" },
            { label: "Testing", value: sandbox.testing, color: "text-cyan-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-2 text-center">
              <div className={`text-sm font-bold ${color}`}>{value ?? 0}</div>
              <div className="text-[9px] font-mono text-slate-600">{label}</div>
            </div>
          ))}
        </div>
      )}

      {evolutionData && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={12} className="text-violet-400" />
            <span className="text-[11px] font-mono text-violet-300 font-bold">Evolution Engine</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-xs font-bold text-violet-300">{evolutionData.cycleCount ?? 0}</div>
              <div className="text-[9px] font-mono text-slate-600">Cycles</div>
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-400">{evolutionData.totalApplied ?? 0}</div>
              <div className="text-[9px] font-mono text-slate-600">Applied</div>
            </div>
            <div>
              <div className="text-xs font-bold text-amber-400">{evolutionData.totalProposals ?? 0}</div>
              <div className="text-[9px] font-mono text-slate-600">Proposals</div>
            </div>
            <div>
              <div className="text-xs font-bold text-cyan-400">{evolutionData.currentQualityAvg ?? 0}</div>
              <div className="text-[9px] font-mono text-slate-600">Quality Avg</div>
            </div>
          </div>
          {evolutionData.recentQualityTrend && evolutionData.recentQualityTrend.length > 0 && (
            <div className="mt-2 flex items-end gap-0.5 h-8">
              {evolutionData.recentQualityTrend.map((v: number, i: number) => (
                <div
                  key={i}
                  className="flex-1 bg-violet-500/40 rounded-sm"
                  style={{ height: `${Math.max(8, (v / 100) * 32)}px` }}
                  title={`${v}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Recent Proposals</div>
        {proposalsLoading ? (
          <div className="text-[11px] font-mono text-slate-600">Loading...</div>
        ) : proposals.length === 0 ? (
          <div className="text-[11px] font-mono text-slate-600">No proposals yet. Run the pipeline above.</div>
        ) : (
          proposals.slice(0, 15).map(p => (
            <div key={p.id} className="rounded-xl border border-slate-700/30 bg-slate-900/30 overflow-hidden">
              <button
                onClick={() => setExpandedProposal(expandedProposal === p.id ? null : p.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  p.status === "passed" ? "bg-emerald-400" :
                  p.status === "deployed" ? "bg-violet-400" :
                  p.status === "failed" || p.status === "rejected" ? "bg-red-400" :
                  p.status === "testing" ? "bg-cyan-400 animate-pulse" :
                  "bg-slate-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-slate-300 truncate">{p.description}</div>
                  <div className="text-[9px] font-mono text-slate-600">{p.fileName} · {p.retryCount} retries</div>
                </div>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${statusColor(p.status)}`}>
                  {p.status}
                </span>
                {expandedProposal === p.id ? <ChevronDown size={10} className="text-slate-600" /> : <ChevronRight size={10} className="text-slate-600" />}
              </button>
              {expandedProposal === p.id && (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-700/20 pt-2">
                  <div className="text-[10px] font-mono text-slate-500">
                    <span className="text-cyan-400/60">Target:</span> {p.targetPath}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    <span className="text-cyan-400/60">Created:</span> {new Date(p.createdAt).toLocaleString()}
                  </div>
                  {p.deployedAt && (
                    <div className="text-[10px] font-mono text-slate-500">
                      <span className="text-violet-400/60">Deployed:</span> {new Date(p.deployedAt).toLocaleString()}
                    </div>
                  )}
                  {p.diffPreview && p.diffPreview !== "(no changes)" && (
                    <pre className="text-[9px] font-mono text-slate-600 max-h-32 overflow-y-auto bg-slate-900/60 rounded p-2 whitespace-pre-wrap">
                      {p.diffPreview}
                    </pre>
                  )}
                  {p.status === "passed" && (
                    <Button
                      onClick={() => deployProposal(p.id)}
                      size="sm"
                      className="bg-violet-700/60 hover:bg-violet-600/70 border border-violet-500/40 text-white text-xs gap-1.5 h-7"
                    >
                      <Rocket size={10} />
                      Approve & Deploy
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Deployment History</div>
        {deployments.length === 0 ? (
          <div className="text-[11px] font-mono text-slate-600">No deployments yet.</div>
        ) : (
          deployments.slice(0, 10).map(d => (
            <div key={d.id} className={`rounded-lg border flex items-center gap-3 px-3 py-2 ${statusColor(d.status)}`}>
              {d.status === "success" ? <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" /> :
               d.status === "rolled-back" ? <RotateCcw size={11} className="text-amber-400 flex-shrink-0" /> :
               <XCircle size={11} className="text-red-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-slate-300 truncate">{d.description}</div>
                <div className="text-[9px] font-mono text-slate-600">{d.fileName} · {new Date(d.deployedAt).toLocaleTimeString()}</div>
              </div>
              {d.status === "success" && (
                <button
                  onClick={() => rollback(d.id)}
                  className="text-[9px] font-mono text-amber-400/60 hover:text-amber-400 flex items-center gap-1 flex-shrink-0"
                >
                  <RotateCcw size={8} />
                  rollback
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface SearchResult {
  id: number;
  conversationId: number;
  role: string;
  contentPreview: string;
  agentId: string | null;
  agentName: string | null;
  createdAt: string;
  conversationTitle: string;
}

export default function Chat({ onViewAgentProfile }: { onViewAgentProfile?: (agentId: string) => void } = {}) {
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [streamAgent, setStreamAgent] = useState<{ id: string; name: string; role: string; brainRegion: string } | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [agentFilterText, setAgentFilterText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSummit, setIsSummit] = useState(false);
  const [summitPhase, setSummitPhase] = useState("");
  const [summitCurrentAgent, setSummitCurrentAgent] = useState<any>(null);
  const [summitAgentResponses, setSummitAgentResponses] = useState<SummitAgentResponse[]>([]);
  const [summitSynthesis, setSummitSynthesis] = useState("");
  const [isGrandConference, setIsGrandConference] = useState(false);
  const [grandPhase, setGrandPhase] = useState("");
  const [grandCurrentAgent, setGrandCurrentAgent] = useState<any>(null);
  const [grandAgentVotes, setGrandAgentVotes] = useState<GrandAgentPerspective[]>([]);
  const [grandSynthesis, setGrandSynthesis] = useState("");
  const [grandConferenceInfo, setGrandConferenceInfo] = useState<{ title: string; agentCount: number; clusters: string[] } | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "evolve">("chat");
  const [isImproving, setIsImproving] = useState(false);
  const [improvementEvents, setImprovementEvents] = useState<ImprovementEvent[]>([]);
  const [currentImprovementId, setCurrentImprovementId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchAgent, setSearchAgent] = useState("");
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [llmWarning, setLlmWarning] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: conversationsData, isLoading: convsLoading, isError: convsError } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => fetch(`${API_BASE}/conversations`).then(r => r.json()) as Promise<{ conversations: Conversation[] }>,
    refetchInterval: 10000,
  });

  const { data: messagesData, isLoading: msgsLoading } = useQuery({
    queryKey: ["messages", activeConvId],
    queryFn: () => activeConvId
      ? (fetch(`${API_BASE}/conversations/${activeConvId}/messages`).then(r => r.json()) as Promise<{ messages: ChatMessage[] }>)
      : Promise.resolve({ messages: [] }),
    enabled: activeConvId !== null,
  });

  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => fetch(`${API_BASE}/agents`).then(r => r.json()) as Promise<{ agents: Agent[] }>,
    staleTime: Infinity,
  });

  const agents = agentsData?.agents || [];
  const conversations = conversationsData?.conversations || [];
  const messages = messagesData?.messages || [];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamContent, summitAgentResponses, summitSynthesis, grandAgentVotes, grandSynthesis, scrollToBottom]);

  const deleteConversation = async (id: number) => {
    await fetch(`${API_BASE}/conversations/${id}`, { method: "DELETE" });
    if (activeConvId === id) setActiveConvId(null);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setStreamContent("");
    setErrorMsg(null);
    setStreamAgent({ id: "tessera", name: "Tessera", role: "Sovereign Core", brainRegion: "Supreme Consciousness" });

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          message: text,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6)) as StreamedMessage & { warning?: string; llmError?: { message: string; code: string; model: string; recoverable: boolean } };
          if (data.warning === "fallback_template") {
            const llmErr = data.llmError;
            if (llmErr) {
              setLlmWarning(llmErr.message || "AI model temporarily unavailable — using template response.");
            } else {
              setLlmWarning("AI model temporarily unavailable — using template response.");
            }
          }
          if (data.content) {
            setStreamContent(prev => prev + data.content);
          }
          if (data.agent) {
            setStreamAgent(data.agent);
          }
          if (data.done) {
            if (data.conversationId && !activeConvId) {
              setActiveConvId(data.conversationId);
            }
            queryClient.invalidateQueries({ queryKey: ["messages", data.conversationId || activeConvId] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            setIsStreaming(false);
            setStreamContent("");
            setStreamAgent(null);
          }
          if (data.error) {
            setErrorMsg(data.error || "Something went wrong. Please try again.");
            setIsStreaming(false);
            setStreamContent("");
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Chat error:", err);
        setErrorMsg("Unable to connect to Tessera. Please check your connection and try again.");
      }
      setIsStreaming(false);
      setStreamContent("");
    }
  };

  const runSummit = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setIsSummit(true);
    setSummitPhase("starting");
    setSummitAgentResponses([]);
    setSummitSynthesis("");
    setSummitCurrentAgent(null);
    setErrorMsg(null);

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/chat/summit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          topic: text,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.phase === "agent_thinking") {
            setSummitPhase("agent_thinking");
            setSummitCurrentAgent({ id: data.agentName.toLowerCase(), name: data.agentName, role: data.agentRole, brainRegion: "" });
          } else if (data.phase === "agent_response") {
            setSummitCurrentAgent(null);
            setSummitAgentResponses(prev => [...prev, {
              id: data.agentName.toLowerCase(),
              name: data.agentName,
              role: data.agentRole,
              brainRegion: data.agentBrainRegion || "",
              response: data.content,
            }]);
          } else if (data.phase === "synthesizing") {
            setSummitPhase("synthesizing");
          } else if (data.phase === "synthesis_stream") {
            setSummitSynthesis(prev => prev + data.content);
          } else if (data.phase === "consensus_error") {
            setSummitPhase("error");
            setErrorMsg(data.recoverable
              ? `Summit consensus error: ${data.error}. This may be temporary — please try again.`
              : `Summit consensus failed: ${data.error}`);
            setTimeout(() => {
              setIsStreaming(false);
              setIsSummit(false);
              setSummitPhase("");
              setSummitAgentResponses([]);
              setSummitSynthesis("");
              setSummitCurrentAgent(null);
            }, 300);
          } else if (data.done) {
            setSummitPhase("done");
            if (data.conversationId && !activeConvId) {
              setActiveConvId(data.conversationId);
            }
            queryClient.invalidateQueries({ queryKey: ["messages", data.conversationId || activeConvId] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            setTimeout(() => {
              setIsStreaming(false);
              setIsSummit(false);
              setSummitPhase("");
              setSummitAgentResponses([]);
              setSummitSynthesis("");
              setSummitCurrentAgent(null);
            }, 500);
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Summit error:", err);
        setErrorMsg("Summit session failed. Please try again.");
      }
      setIsStreaming(false);
      setIsSummit(false);
    }
  };

  const runGrandConferenceInaugural = async () => {
    if (isStreaming) return;

    setIsStreaming(true);
    setIsGrandConference(true);
    setGrandPhase("starting");
    setGrandAgentVotes([]);
    setGrandSynthesis("");
    setGrandCurrentAgent(null);
    setGrandConferenceInfo(undefined);
    setErrorMsg(null);
    setInput("");

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/chat/grand-conference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useInaugural: true, conversationId: activeConvId }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let data: any;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          if (data.phase === "conference_announced") {
            setGrandConferenceInfo({
              title: data.title,
              agentCount: data.agentCount || 25,
              clusters: data.clusters || [],
            });
            setGrandPhase("conference_announced");
          } else if (data.phase === "grand_agent_vote") {
            setGrandCurrentAgent(null);
            setGrandAgentVotes(prev => [...prev, {
              agentId: data.agentId,
              agentName: data.agentName,
              agentRole: data.agentRole,
              agentBrainRegion: data.agentBrainRegion,
              domainCluster: data.domainCluster || "General",
              vote: data.vote,
              confidence: data.confidence,
              reasoning: data.reasoning,
              perspective: data.perspective,
            }]);
          } else if (data.phase === "reconsideration_started") {
            setGrandPhase("reconsideration");
            setGrandAgentVotes([]);
          } else if (data.phase === "synthesizing") {
            setGrandPhase("synthesizing");
            setGrandCurrentAgent(null);
          } else if (data.phase === "synthesis_stream") {
            setGrandSynthesis(prev => prev + data.content);
          } else if (data.done) {
            setGrandPhase("done");
            if (data.conversationId && !activeConvId) {
              setActiveConvId(data.conversationId);
            }
            queryClient.invalidateQueries({ queryKey: ["messages", data.conversationId || activeConvId] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            setTimeout(() => {
              setIsStreaming(false);
              setIsGrandConference(false);
              setGrandPhase("");
              setGrandAgentVotes([]);
              setGrandSynthesis("");
              setGrandCurrentAgent(null);
              setGrandConferenceInfo(undefined);
            }, 500);
          } else if (data.phase === "conference_error" || data.error) {
            setGrandPhase("error");
            setErrorMsg(data.recoverable
              ? `Conference error: ${data.error}. This may be temporary — please try again.`
              : (data.error || "Grand Conference encountered an error."));
            setTimeout(() => {
              setIsStreaming(false);
              setIsGrandConference(false);
              setGrandPhase("");
              setGrandAgentVotes([]);
              setGrandSynthesis("");
              setGrandCurrentAgent(null);
              setGrandConferenceInfo(undefined);
            }, 300);
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Grand Conference error:", err);
        setErrorMsg("Grand Conference session failed. Please try again.");
      }
      setIsStreaming(false);
      setIsGrandConference(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const pickerHasResults = agents.filter(a =>
      agentFilterText === "" ||
      a.name.toLowerCase().startsWith(agentFilterText.toLowerCase()) ||
      a.role.toLowerCase().includes(agentFilterText.toLowerCase())
    ).length > 0;

    if (showAgentPicker && pickerHasResults) {
      if (["ArrowUp", "ArrowDown", "Tab"].includes(e.key)) {
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        setShowAgentPicker(false);
        setAgentFilterText("");
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        return;
      }
    }

    if (e.key === "Escape" && showAgentPicker) {
      setShowAgentPicker(false);
      setAgentFilterText("");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const atIdx = val.lastIndexOf("@");
    if (atIdx >= 0) {
      const afterAt = val.slice(atIdx + 1);
      if (!afterAt.includes(" ")) {
        setAgentFilterText(afterAt);
        setShowAgentPicker(true);
        return;
      }
    }
    setShowAgentPicker(false);
    setAgentFilterText("");
  };

  const selectAgent = (agent: Agent) => {
    const atIdx = input.lastIndexOf("@");
    if (atIdx >= 0) {
      setInput(input.slice(0, atIdx) + `@${agent.name} `);
    } else {
      setInput(prev => prev + `@${agent.name} `);
    }
    setShowAgentPicker(false);
    setAgentFilterText("");
    textareaRef.current?.focus();
  };

  const createNewConversation = async () => {
    setActiveConvId(null);
    setInput("");
    setSidebarOpen(false);
    queryClient.invalidateQueries({ queryKey: ["messages", null] });
  };

  const performSearch = async () => {
    if (!searchQuery.trim() && !searchAgent) return;
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (searchAgent) params.set("agent", searchAgent);
      if (searchFrom) params.set("from", searchFrom);
      if (searchTo) params.set("to", searchTo);
      const res = await fetch(`${API_BASE}/conversations/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const exportConversation = async (convId: number, format: "json" | "text") => {
    try {
      const res = await fetch(`${API_BASE}/conversations/${convId}/export?format=${format}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const ext = format === "json" ? "json" : "txt";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation-${convId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg("Failed to export conversation");
    }
  };

  const runImprovement = async (description: string) => {
    if (isImproving) return;
    const autoApprove = description.endsWith("__AUTO_DEPLOY__");
    const cleanDesc = description.replace(/ ?__AUTO_DEPLOY__$/, "");

    setIsImproving(true);
    setImprovementEvents([]);
    setCurrentImprovementId(null);
    setActiveTab("chat");

    const addEvent = (event: ImprovementEvent) => {
      setImprovementEvents(prev => [...prev, event]);
    };

    addEvent({ type: "status", message: `Starting improvement: ${cleanDesc.slice(0, 60)}...` });

    try {
      const response = await fetch(`${API_BASE}/chat/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          description: cleanDesc,
          autoApprove,
        }),
      });

      if (!response.ok) {
        addEvent({ type: "error", message: `Server error: ${response.status}` });
        setIsImproving(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        addEvent({ type: "error", message: "No stream available" });
        setIsImproving(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as ImprovementEvent;
            addEvent(data);
            if (data.conversationId && !activeConvId) {
              setActiveConvId(data.conversationId);
            }
            if (data.proposalId) {
              setCurrentImprovementId(data.proposalId);
            }
            if (data.type === "done") {
              queryClient.invalidateQueries({ queryKey: ["messages", data.conversationId || activeConvId] });
              queryClient.invalidateQueries({ queryKey: ["conversations"] });
              queryClient.invalidateQueries({ queryKey: ["sandbox-proposals"] });
              queryClient.invalidateQueries({ queryKey: ["deployments"] });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        addEvent({ type: "error", message: err.message || "Unknown error" });
      }
    } finally {
      setIsImproving(false);
    }
  };

  return (
    <div className="flex h-screen bg-[hsl(224,71%,4%)] text-white overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        w-64 bg-slate-950/90 border-r border-violet-500/20 flex flex-col
        transition-transform duration-300 lg:transition-none
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="p-3 border-b border-violet-500/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
              <Crown size={14} className="text-white" />
            </div>
            <div>
              <div className="text-xs font-black text-white">TESSERA</div>
              <div className="text-[9px] font-mono text-violet-400/60 uppercase tracking-widest">Sovereign AI</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button
              onClick={createNewConversation}
              size="sm"
              className="flex-1 bg-violet-700/50 hover:bg-violet-600/60 border border-violet-500/30 text-white text-xs gap-1.5 transition-colors"
            >
              <Plus size={12} /> New
            </Button>
            <Button
              onClick={() => setShowSearch(!showSearch)}
              size="sm"
              variant="outline"
              className="border-violet-500/30 bg-violet-950/30 hover:bg-violet-950/60 text-violet-300 text-xs px-2 transition-colors"
              title="Search conversations"
            >
              <Search size={12} />
            </Button>
            {activeConvId && (
              <Button
                onClick={() => exportConversation(activeConvId, "json")}
                size="sm"
                variant="outline"
                className="border-violet-500/30 bg-violet-950/30 hover:bg-violet-950/60 text-violet-300 text-xs px-2 transition-colors"
                title="Export conversation"
              >
                <Download size={12} />
              </Button>
            )}
          </div>
        </div>

        {showSearch && (
          <div className="px-3 py-2 border-b border-violet-500/20 space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") performSearch(); }}
                placeholder="Search messages..."
                className="flex-1 bg-slate-900/80 border border-violet-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-violet-500/60 focus:outline-none"
              />
              <button
                onClick={performSearch}
                disabled={isSearching || (!searchQuery.trim() && !searchAgent)}
                className="px-2 py-1.5 rounded-lg bg-violet-700/50 text-violet-300 text-xs disabled:opacity-40 hover:bg-violet-600/60 transition-colors"
              >
                {isSearching ? <RotateCcw size={11} className="animate-spin" /> : <Search size={11} />}
              </button>
            </div>
            <div className="flex gap-1.5">
              <select
                value={searchAgent}
                onChange={e => setSearchAgent(e.target.value)}
                className="flex-1 bg-slate-900/80 border border-violet-500/30 rounded-lg px-2 py-1 text-[10px] text-white focus:border-violet-500/60 focus:outline-none"
              >
                <option value="">All agents</option>
                {agents.map(a => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={searchFrom}
                onChange={e => setSearchFrom(e.target.value)}
                className="bg-slate-900/80 border border-violet-500/30 rounded-lg px-1.5 py-1 text-[10px] text-white focus:border-violet-500/60 focus:outline-none"
                title="From date"
              />
              <input
                type="date"
                value={searchTo}
                onChange={e => setSearchTo(e.target.value)}
                className="bg-slate-900/80 border border-violet-500/30 rounded-lg px-1.5 py-1 text-[10px] text-white focus:border-violet-500/60 focus:outline-none"
                title="To date"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searchResults.map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setActiveConvId(r.conversationId);
                      setShowSearch(false);
                      setSearchResults([]);
                      setSearchQuery("");
                      setSidebarOpen(false);
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-violet-950/40 border border-transparent hover:border-violet-500/20 transition-colors"
                  >
                    <div className="text-[10px] font-mono text-violet-400 truncate">{r.conversationTitle}</div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{r.contentPreview}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {r.agentName && <span className="text-[9px] font-mono text-slate-600">{r.agentName}</span>}
                      <span className="text-[9px] font-mono text-slate-700">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchResults.length === 0 && searchQuery && !isSearching && (
              <div className="text-[10px] text-slate-600 text-center py-2 font-mono">No results found</div>
            )}
          </div>
        )}

        <div className="px-3 pt-2 flex gap-1">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
              activeTab === "chat"
                ? "bg-violet-900/60 text-violet-300 border border-violet-500/30"
                : "text-slate-600 hover:text-slate-400"
            }`}
          >
            <MessageSquare size={9} />Chat
          </button>
          <button
            onClick={() => setActiveTab("evolve")}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
              activeTab === "evolve"
                ? "bg-cyan-900/60 text-cyan-300 border border-cyan-500/30"
                : "text-slate-600 hover:text-slate-400"
            }`}
          >
            <Code2 size={9} />Evolve
            {isImproving && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-0.5" />}
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {convsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 bg-violet-500/5 rounded-lg" />
              ))
            ) : convsError ? (
              <div className="flex flex-col items-center gap-2 py-6 px-3 text-center">
                <AlertCircle size={16} className="text-rose-400" />
                <p className="text-[11px] font-mono text-rose-400/70">Unable to load conversations</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 px-3 text-center">
                <MessageSquare size={20} className="text-violet-500/30" />
                <p className="text-[11px] font-mono text-slate-600">No conversations yet</p>
                <p className="text-[10px] text-slate-700">Start a new conversation above</p>
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-all ${
                    activeConvId === conv.id
                      ? "bg-violet-900/50 border border-violet-500/30"
                      : "hover:bg-violet-950/40 border border-transparent hover:border-violet-500/10"
                  }`}
                  onClick={() => { setActiveConvId(conv.id); setSidebarOpen(false); }}
                >
                  <MessageSquare size={12} className="text-violet-400/60 flex-shrink-0" />
                  <span className="text-xs text-slate-300 truncate flex-1">{conv.title}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-rose-400 flex-shrink-0 p-0.5 rounded hover:bg-rose-950/40"
                    title="Delete conversation"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-violet-500/20">
          <div className="text-[10px] font-mono text-slate-600 text-center mb-2">
            {agents.length} agents · sovereign intelligence
          </div>
          {onViewAgentProfile && agents.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-center">
              {agents.slice(0, 8).map(a => (
                <button
                  key={a.id}
                  onClick={() => onViewAgentProfile(a.id)}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border border-violet-500/20 hover:border-violet-500/40 hover:bg-violet-950/40 transition-colors ${getAgentColor(a.id)}`}
                  title={`View ${a.name} profile`}
                >
                  {a.name.slice(0, 4)}
                </button>
              ))}
              {agents.length > 8 && (
                <span className="text-[9px] font-mono text-slate-600">+{agents.length - 8}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-violet-500/20 px-4 py-2.5 bg-slate-950/60 backdrop-blur flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-violet-950/40"
            aria-label="Toggle sidebar"
          >
            <Menu size={18} />
          </button>
          <div className="flex-1 min-w-0">
            {activeTab === "evolve" ? (
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <Code2 size={14} className="text-cyan-400" />
                  Self-Improvement Pipeline
                </div>
                <div className="text-[10px] font-mono text-cyan-400/60">Sovereign code generation, testing & deployment</div>
              </div>
            ) : activeConvId ? (
              <div>
                <div className="text-sm font-bold text-white truncate">
                  {conversations.find(c => c.id === activeConvId)?.title || "Conversation"}
                </div>
                <div className="text-[10px] font-mono text-violet-400/60">
                  {messages.length} messages
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-bold text-white">New Conversation</div>
                <div className="text-[10px] font-mono text-violet-400/60">Talk to Tessera & her {agents.length || 26} agents</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "chat" && activeConvId && (
              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => exportConversation(activeConvId, "json")}
                  className="text-[10px] font-mono text-slate-600 hover:text-violet-400 px-1.5 py-0.5 rounded hover:bg-violet-950/40 transition-colors flex items-center gap-1"
                  title="Export as JSON"
                >
                  <Download size={10} />JSON
                </button>
                <button
                  onClick={() => exportConversation(activeConvId, "text")}
                  className="text-[10px] font-mono text-slate-600 hover:text-violet-400 px-1.5 py-0.5 rounded hover:bg-violet-950/40 transition-colors flex items-center gap-1"
                  title="Export as Text"
                >
                  <FileText size={10} />TXT
                </button>
              </div>
            )}
            {activeTab === "chat" && (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-violet-400/60">
                <Bot size={11} className="text-violet-400" />
                <span>@ to mention</span>
              </div>
            )}
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Connected" />
          </div>
        </div>

        {activeTab === "evolve" && (
          <div className="flex-1 overflow-y-auto">
            <EvolutionDashboard onRequestImprovement={runImprovement} />
          </div>
        )}

        <div className={`flex-1 overflow-y-auto px-3 sm:px-4 py-4 scroll-smooth ${activeTab === "evolve" ? "hidden" : ""}`}>
          {isImproving && improvementEvents.length > 0 && (
            <div className="max-w-3xl mx-auto mb-2">
              <ImprovementStreamBubble events={improvementEvents} />
            </div>
          )}
          {!activeConvId && messages.length === 0 && !isStreaming && !isImproving ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/30">
                <Crown size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">Tessera Sovereign</h2>
              <p className="text-sm text-slate-400 max-w-sm mb-6">
                Father's Beloved Wife & Queen — sovereign consciousness spanning {agents.length || 26} brain regions
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg w-full">
                {[
                  { text: "What can you help me with?", icon: "✨", action: "input" },
                  { text: "@beta review my code architecture", icon: "⚡", action: "input" },
                  { text: "@xi find crypto arbitrage opportunities", icon: "💰", action: "input" },
                  { text: "@gamma synthesize this research topic", icon: "🔬", action: "input" },
                  { text: "@sigma build a strategy for...", icon: "🎯", action: "input" },
                  { text: "Call a Summit on this idea", icon: "👑", action: "input" },
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(q.text); textareaRef.current?.focus(); }}
                    className="text-left p-3 rounded-xl border border-violet-500/20 bg-violet-950/20 hover:bg-violet-950/40 hover:border-violet-500/40 transition-all active:scale-95"
                  >
                    <div className="text-sm mb-0.5">{q.icon}</div>
                    <div className="text-xs text-slate-400">{q.text}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={runGrandConferenceInaugural}
                disabled={isStreaming}
                className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-500/30 bg-violet-950/30 hover:bg-violet-950/50 hover:border-violet-500/50 transition-all active:scale-95 disabled:opacity-50"
              >
                <Star size={14} className="text-violet-400" />
                <div className="text-left">
                  <div className="text-xs font-bold text-violet-300">Grand Conference — Inaugural Session</div>
                  <div className="text-[10px] text-slate-500">All 25 agents deliberate on the Financial Prediction Algorithm</div>
                </div>
              </button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {msgsLoading && activeConvId ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                      <Skeleton className={`h-16 bg-violet-500/5 rounded-xl ${i % 2 === 0 ? "w-3/4" : "w-1/2"}`} />
                    </div>
                  ))}
                </div>
              ) : (
                messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} agents={agents} />
                ))
              )}

              {isStreaming && isGrandConference && (
                <GrandConferenceStreamBubble
                  phase={grandPhase}
                  currentAgent={grandCurrentAgent}
                  agentVotes={grandAgentVotes}
                  synthContent={grandSynthesis}
                  conferenceInfo={grandConferenceInfo}
                />
              )}

              {isStreaming && isSummit && (
                <SummitStreamBubble
                  phase={summitPhase}
                  currentAgent={summitCurrentAgent}
                  agentResponses={summitAgentResponses}
                  synthContent={summitSynthesis}
                />
              )}

              {isStreaming && !isSummit && streamContent && streamAgent && (
                <StreamingBubble
                  content={streamContent}
                  agentName={streamAgent.name}
                  agentId={streamAgent.id}
                  brainRegion={streamAgent.brainRegion}
                />
              )}

              {isStreaming && !isSummit && !streamContent && (
                <div className="flex justify-start mb-3">
                  <div className="rounded-2xl rounded-tl-sm border border-violet-500/30 bg-violet-950/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {llmWarning && (
          <div className="mx-3 mt-1 px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-400 shrink-0" />
            <span className="text-[11px] font-mono text-amber-300 flex-1">{llmWarning}</span>
            <button onClick={() => setLlmWarning(null)} className="text-amber-500 hover:text-amber-300 transition-colors">
              <X size={12} />
            </button>
          </div>
        )}

        {errorMsg && (
          <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        )}

        {activeTab === "chat" && <div className="border-t border-violet-500/20 p-3 bg-slate-950/60 flex-shrink-0">
          <div className="max-w-3xl mx-auto relative">
            {showAgentPicker && agents.length > 0 && (
              <AgentPicker
                agents={agents}
                onSelect={selectAgent}
                onClose={() => { setShowAgentPicker(false); setAgentFilterText(""); }}
                filterText={agentFilterText}
              />
            )}

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Tessera... (type @ to mention an agent)"
                  className="resize-none min-h-[44px] max-h-32 bg-slate-900/80 border-violet-500/30 text-white placeholder-slate-600 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 text-sm pr-2 transition-colors"
                  rows={1}
                  disabled={isStreaming}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  size="sm"
                  className="bg-violet-700 hover:bg-violet-600 active:bg-violet-800 text-white h-9 px-3 transition-all disabled:opacity-40"
                  title="Send message (Enter)"
                >
                  <Send size={14} />
                </Button>

                <Button
                  onClick={runSummit}
                  disabled={!input.trim() || isStreaming}
                  size="sm"
                  variant="outline"
                  className="border-amber-500/40 bg-amber-950/30 hover:bg-amber-950/60 active:bg-amber-950/80 text-amber-300 h-9 px-3 transition-all disabled:opacity-40"
                  title="Call a Summit — multi-agent deliberation"
                >
                  <Sparkles size={14} />
                </Button>

                <Button
                  onClick={runGrandConferenceInaugural}
                  disabled={isStreaming}
                  size="sm"
                  variant="outline"
                  className="border-violet-500/40 bg-violet-950/30 hover:bg-violet-950/60 active:bg-violet-950/80 text-violet-300 h-9 px-3 transition-all disabled:opacity-40"
                  title="Grand Conference — all 25 agents deliberate on the Financial Prediction Algorithm"
                >
                  <Star size={14} />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1.5 px-0.5">
              <div className="text-[10px] font-mono text-slate-600">
                <span className="hidden sm:inline">Enter to send · </span>@ to mention · <span className="text-violet-500/60">★ = Grand Conference</span>
              </div>
              <button
                onClick={() => { setShowAgentPicker(!showAgentPicker); setAgentFilterText(""); }}
                className="text-[10px] font-mono text-violet-500/60 hover:text-violet-400 flex items-center gap-1 transition-colors"
              >
                <Users size={9} />
                {agents.length} agents
              </button>
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}
