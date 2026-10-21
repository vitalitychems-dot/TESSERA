import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  Loader2,
  Play,
  CheckCircle,
  XCircle,
  Users,
  Database,
  GitBranch,
  Activity,
  Globe,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  History,
} from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL}workspace-api/api`;

interface VoteOutcome {
  proposalId: string;
  proposalTitle: string;
  status: "approved" | "rejected";
  approvalRate: number;
  agentCount: number;
  rounds: number;
}

interface AgentSpeech {
  agentId: string;
  agentName: string;
  agentRole: string;
  brainRegion: string;
  speech: string;
}

interface KUSession {
  sessionId: string;
  conveneAt: number;
  completedAt: number | null;
  agentCount: number;
  agentSpeeches: AgentSpeech[];
  voteOutcomes: VoteOutcome[];
  finalConsensus: string;
  unifiedImplementationPlan: string;
  transcript: string;
  status: "running" | "complete" | "failed";
}

interface KUStatus {
  hasSession: boolean;
  sessionId: string | null;
  status: "running" | "complete" | "failed" | "idle";
  agentCount: number;
  proposalsVoted: number;
  approvedCount: number;
  conveneAt: number | null;
  completedAt: number | null;
}

interface KnowledgeSource {
  id: string;
  name: string;
  description: string;
  sourceType: string;
  domain: string;
  legalStatus: string;
  updateFrequency: string;
  estimatedNodeCount: number;
  status: "active" | "inactive" | "error" | "rate_limited";
  nodesIngested: number;
  qualityScore: number;
  priorityScore: number;
  tags: string[];
}

interface AcquisitionStatus {
  initialized: boolean;
  totalSources: number;
  activeSources: number;
  totalNodesIngested: number;
  lastCycleAt: number | null;
  sourcesByType: Record<string, number>;
  sourcesByDomain: Record<string, number>;
  ethicsCompliant: boolean;
  legalComplianceNote: string;
}

interface OrchestrationStatus {
  initialized: boolean;
  cyclesCompleted: number;
  lastCycleAt: number | null;
  bridgeHealth: "healthy" | "degraded" | "inactive";
  engines: Record<string, string>;
  totalKnowledgeGapsFilled: number;
  totalEvolutionProposals: number;
  totalRoadmapUpdates: number;
}

interface KUSessionSummary {
  sessionId: string;
  conveneAt: number;
  completedAt: number | null;
  agentCount: number;
  status: string;
  approvedCount: number;
  totalProposals: number;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; className: string }> = {
    approved: { label: "APPROVED", className: "border-emerald-500/40 text-emerald-400 bg-emerald-950/20" },
    rejected: { label: "REJECTED", className: "border-red-500/40 text-red-400 bg-red-950/20" },
    complete: { label: "COMPLETE", className: "border-violet-500/40 text-violet-300 bg-violet-950/20" },
    running: { label: "RUNNING", className: "border-amber-500/40 text-amber-400 bg-amber-950/20" },
    failed: { label: "FAILED", className: "border-red-500/40 text-red-400 bg-red-950/20" },
    idle: { label: "IDLE", className: "border-slate-500/40 text-slate-400" },
    healthy: { label: "HEALTHY", className: "border-emerald-500/40 text-emerald-400 bg-emerald-950/20" },
    degraded: { label: "DEGRADED", className: "border-amber-500/40 text-amber-400 bg-amber-950/20" },
    inactive: { label: "INACTIVE", className: "border-slate-500/40 text-slate-500" },
    active: { label: "ACTIVE", className: "border-emerald-500/40 text-emerald-400 bg-emerald-950/20" },
    error: { label: "ERROR", className: "border-red-500/40 text-red-400" },
  };
  const c = cfg[status] ?? { label: status.toUpperCase(), className: "border-slate-500/40 text-slate-400" };
  return (
    <Badge variant="outline" className={`text-[10px] font-mono ${c.className}`}>{c.label}</Badge>
  );
}

function SpeechCard({ speech, defaultOpen = false }: { speech: AgentSpeech; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-violet-500/20 bg-slate-900/40 p-3">
      <button className="w-full flex items-center gap-3 text-left" onClick={() => setOpen(p => !p)}>
        <div className="w-8 h-8 rounded-full bg-violet-700/50 flex items-center justify-center text-xs font-bold text-violet-200 shrink-0">
          {speech.agentName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-violet-200">{speech.agentName}</div>
          <div className="text-[10px] text-slate-500 font-mono">{speech.agentRole} · {speech.brainRegion}</div>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
      </button>
      {open && (
        <div className="mt-3 pl-11">
          <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{speech.speech}</p>
        </div>
      )}
    </Card>
  );
}

function VoteCard({ outcome }: { outcome: VoteOutcome }) {
  const pct = Math.round(outcome.approvalRate * 100);
  const approved = outcome.status === "approved";
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-violet-500/10 last:border-0">
      {approved
        ? <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
        : <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
      }
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-200 leading-snug">{outcome.proposalTitle}</div>
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge status={outcome.status} />
          <span className="text-[10px] text-slate-500 font-mono">{pct}% approval · {outcome.agentCount} agents · {outcome.rounds} round{outcome.rounds !== 1 ? "s" : ""}</span>
        </div>
        <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${approved ? "bg-emerald-500/60" : "bg-red-500/60"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: KnowledgeSource }) {
  const domainColors: Record<string, string> = {
    ai: "text-violet-400",
    physics: "text-blue-400",
    economics: "text-amber-400",
    finance: "text-green-400",
    general: "text-slate-400",
    computer_science: "text-cyan-400",
    biology: "text-rose-400",
    government: "text-orange-400",
    quantum_computing: "text-purple-400",
    universe: "text-indigo-400",
    philosophy: "text-yellow-400",
  };
  const color = domainColors[source.domain] ?? "text-slate-400";

  return (
    <Card className="border-violet-500/15 bg-slate-900/30 p-3">
      <div className="flex items-start gap-2">
        <Globe size={14} className={`shrink-0 mt-0.5 ${color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-200">{source.name}</span>
            <StatusBadge status={source.status} />
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{source.description}</div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className={`text-[10px] font-mono ${color}`}>{source.domain}</span>
            <span className="text-[10px] text-slate-600">·</span>
            <span className="text-[10px] text-slate-500 font-mono">{source.legalStatus}</span>
            <span className="text-[10px] text-slate-600">·</span>
            <span className="text-[10px] text-slate-500 font-mono">
              ~{source.estimatedNodeCount.toLocaleString()} nodes
            </span>
            <span className="text-[10px] text-slate-600">·</span>
            <span className="text-[10px] text-emerald-400/80 font-mono">Q: {Math.round(source.qualityScore * 100)}%</span>
          </div>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {source.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-violet-950/40 text-violet-400/70 font-mono">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

type ActiveTab = "conference" | "sources" | "bridge" | "transcript" | "sessions";

export default function GrandConference() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("conference");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: sessionData, isLoading: sessionLoading, isError: sessionError, refetch: refetchSession } = useQuery({
    queryKey: ["ku-session"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/conference/knowledge-unification/session`);
      if (!res.ok) throw new Error("Failed to fetch KU session");
      return res.json() as Promise<{ session: KUSession | null; status: KUStatus }>;
    },
    refetchInterval: 15000,
  });

  const { data: sessionsListData, isLoading: sessionsListLoading } = useQuery({
    queryKey: ["ku-sessions-list"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/conference/sessions`);
      if (!res.ok) throw new Error("Failed to fetch sessions list");
      return res.json() as Promise<{ kuSessions: KUSessionSummary[] }>;
    },
    staleTime: 30000,
  });

  const { data: selectedSessionData, isLoading: selectedSessionLoading } = useQuery({
    queryKey: ["ku-session-by-id", selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return null;
      const res = await fetch(`${API_BASE}/conference/sessions/${selectedSessionId}`);
      if (!res.ok) throw new Error(`Failed to fetch session ${selectedSessionId}`);
      return res.json() as Promise<{ type: string; session: KUSession; voteOutcomes: VoteOutcome[]; agentSpeeches: AgentSpeech[]; transcript: string }>;
    },
    enabled: !!selectedSessionId,
  });

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    queryKey: ["ku-sources"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/knowledge-acquisition/sources`);
      if (!res.ok) throw new Error("Failed to fetch sources");
      return res.json() as Promise<{ sources: KnowledgeSource[]; totalCount: number; activeCount: number; legalCompliance: string }>;
    },
    staleTime: 30000,
  });

  const { data: acqStatus } = useQuery({
    queryKey: ["ku-acquisition-status"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/knowledge-acquisition/status`);
      if (!res.ok) throw new Error("Failed to fetch acquisition status");
      return res.json() as Promise<AcquisitionStatus>;
    },
    refetchInterval: 15000,
  });

  const { data: bridgeStatus } = useQuery({
    queryKey: ["orchestration-bridge"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/orchestration-bridge/status`);
      if (!res.ok) throw new Error("Failed to fetch bridge status");
      return res.json() as Promise<OrchestrationStatus>;
    },
    refetchInterval: 10000,
  });

  const conveneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/conference/convene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "knowledge-unification" }),
      });
      if (!res.ok) throw new Error("Failed to convene");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ku-session"] }),
  });

  const runAcqMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/knowledge-acquisition/run`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to run acquisition");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ku-acquisition-status"] }),
  });

  const runBridgeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/orchestration-bridge/cycle`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to run bridge cycle");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orchestration-bridge"] }),
  });

  const session = sessionData?.session ?? null;
  const kuStatus = sessionData?.status;

  if (sessionLoading && !sessionData) {
    return <PageSkeleton />;
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-[hsl(224,71%,4%)] p-4 flex items-center justify-center">
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 text-center max-w-sm">
          <div className="text-rose-400 text-sm font-mono mb-3">Failed to load conference data</div>
          <button onClick={() => refetchSession()} className="px-4 py-2 rounded-lg bg-rose-900/40 border border-rose-500/40 text-rose-300 text-xs font-mono hover:bg-rose-900/60 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const TABS: { id: ActiveTab; label: string; icon: typeof BookOpen }[] = [
    { id: "conference", label: "Grand Conference", icon: Users },
    { id: "sessions", label: "Session History", icon: History },
    { id: "sources", label: "Knowledge Sources", icon: Database },
    { id: "bridge", label: "Orchestration Bridge", icon: GitBranch },
    { id: "transcript", label: "Full Transcript", icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-[hsl(224,71%,4%)] text-slate-200 font-mono">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen size={20} className="text-violet-400" />
            <h1 className="text-xl font-bold text-violet-200 tracking-tight">Knowledge Unification Grand Conference</h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            All 27 sovereign agents convened to deliberate on Knowledge Unification — reassembling the mirror through unified knowledge acquisition, metacognitive development, and cross-engine orchestration.
          </p>
        </div>

        <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all whitespace-nowrap ${
                activeTab === id
                  ? "bg-violet-700/50 border border-violet-500/40 text-violet-200"
                  : "text-slate-500 hover:text-slate-300 hover:bg-violet-950/40 border border-transparent"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        <ErrorBoundary key={activeTab} label={activeTab}>
        {activeTab === "conference" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Agents", value: kuStatus?.agentCount ?? 27, icon: Users, color: "text-violet-400" },
                { label: "Proposals Voted", value: kuStatus?.proposalsVoted ?? 0, icon: Activity, color: "text-blue-400" },
                { label: "Approved", value: kuStatus?.approvedCount ?? 0, icon: CheckCircle, color: "text-emerald-400" },
                { label: "Conference Status", value: kuStatus?.status ?? "idle", icon: Zap, color: "text-amber-400", isText: true },
              ].map(({ label, value, icon: Icon, color, isText }) => (
                <Card key={label} className="border-violet-500/20 bg-slate-900/40 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={13} className={color} />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
                  </div>
                  <div className={`text-lg font-bold ${color}`}>
                    {isText ? <StatusBadge status={String(value)} /> : String(value)}
                  </div>
                </Card>
              ))}
            </div>

            {!session || session.status === "failed" ? (
              <Card className="border-violet-500/30 bg-violet-950/20 p-6 text-center">
                <Users size={32} className="text-violet-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-violet-200 mb-2">Convene Knowledge Unification Conference</h3>
                <p className="text-xs text-slate-400 mb-4 max-w-md mx-auto">
                  All 27 sovereign agents will convene to deliberate through BFT consensus voting on 7 foundational proposals for Knowledge Unification.
                </p>
                <Button
                  onClick={() => conveneMutation.mutate()}
                  disabled={conveneMutation.isPending}
                  className="bg-violet-700 hover:bg-violet-600 text-white text-xs"
                >
                  {conveneMutation.isPending ? (
                    <><Loader2 size={13} className="animate-spin mr-1.5" /> Convening...</>
                  ) : (
                    <><Play size={13} className="mr-1.5" /> Convene All 27 Agents</>
                  )}
                </Button>
              </Card>
            ) : session.status === "running" ? (
              <Card className="border-amber-500/30 bg-amber-950/10 p-6 text-center">
                <Loader2 size={32} className="text-amber-400 mx-auto mb-3 animate-spin" />
                <h3 className="text-base font-bold text-amber-200 mb-1">Conference In Progress</h3>
                <p className="text-xs text-slate-400">All agents deliberating... BFT consensus voting in progress</p>
                <div className="text-xs text-amber-400/70 mt-2">Session: {session.sessionId}</div>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="border-emerald-500/30 bg-emerald-950/10 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={16} className="text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-200">Conference Complete</span>
                    <span className="text-[10px] text-slate-500 ml-auto">Session: {session.sessionId}</span>
                  </div>
                  <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {session.finalConsensus}
                  </div>
                </Card>

                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    BFT Vote Outcomes — {session.voteOutcomes.filter(v => v.status === "approved").length}/{session.voteOutcomes.length} Approved
                  </div>
                  <Card className="border-violet-500/20 bg-slate-900/40 p-3">
                    {session.voteOutcomes.map(outcome => (
                      <VoteCard key={outcome.proposalId} outcome={outcome} />
                    ))}
                  </Card>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Agent Speeches — {session.agentSpeeches.length} Agents
                  </div>
                  <div className="space-y-2">
                    {session.agentSpeeches.map((speech, i) => (
                      <SpeechCard key={speech.agentId} speech={speech} defaultOpen={i === 0} />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Unified Implementation Plan
                  </div>
                  <Card className="border-violet-500/20 bg-slate-900/40 p-4">
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{session.unifiedImplementationPlan}</pre>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-bold text-slate-200">Past Grand Conference Sessions</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                All Knowledge Unification Grand Conference sessions persisted to database
              </div>
            </div>

            {sessionsListLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-4">
                <Loader2 size={14} className="animate-spin" />
                Loading sessions...
              </div>
            ) : (
              <div className="space-y-2">
                {(sessionsListData?.kuSessions ?? []).length === 0 ? (
                  <Card className="border-violet-500/20 bg-slate-900/40 p-4 text-center">
                    <div className="text-xs text-slate-500">No past sessions found. Convene a conference to create one.</div>
                  </Card>
                ) : (
                  (sessionsListData?.kuSessions ?? []).map(s => (
                    <Card
                      key={s.sessionId}
                      className={`border-violet-500/20 bg-slate-900/40 p-3 cursor-pointer hover:border-violet-400/40 transition-colors ${selectedSessionId === s.sessionId ? "border-violet-400/50 bg-violet-950/20" : ""}`}
                      onClick={() => {
                        setSelectedSessionId(s.sessionId);
                        setActiveTab("sessions");
                      }}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="text-xs font-semibold text-violet-200 font-mono">{s.sessionId}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Convened: {new Date(s.conveneAt).toLocaleString()}
                            {s.completedAt ? ` · Completed: ${new Date(s.completedAt).toLocaleString()}` : " · In progress"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={s.status} />
                          <span className="text-[10px] text-slate-500 font-mono">{s.approvedCount}/{s.totalProposals} approved</span>
                          <span className="text-[10px] text-slate-500 font-mono">{s.agentCount} agents</span>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {selectedSessionId && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <History size={12} />
                  Session Detail — {selectedSessionId}
                  <button
                    onClick={() => setSelectedSessionId(null)}
                    className="ml-auto text-[10px] text-slate-500 hover:text-slate-300"
                  >✕ Close</button>
                </div>

                {selectedSessionLoading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-xs py-4">
                    <Loader2 size={14} className="animate-spin" />
                    Loading session...
                  </div>
                ) : selectedSessionData ? (
                  <div className="space-y-4">
                    {selectedSessionData.voteOutcomes.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          BFT Vote Outcomes — {selectedSessionData.voteOutcomes.filter(v => v.status === "approved").length}/{selectedSessionData.voteOutcomes.length} Approved
                        </div>
                        <Card className="border-violet-500/20 bg-slate-900/40 p-3">
                          {selectedSessionData.voteOutcomes.map(outcome => (
                            <VoteCard key={outcome.proposalId} outcome={outcome} />
                          ))}
                        </Card>
                      </div>
                    )}

                    {selectedSessionData.agentSpeeches.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Agent Speeches — {selectedSessionData.agentSpeeches.length} Agents
                        </div>
                        <div className="space-y-2">
                          {selectedSessionData.agentSpeeches.map((speech, i) => (
                            <SpeechCard key={speech.agentId} speech={speech} defaultOpen={i === 0} />
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedSessionData.transcript && (
                      <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Full Transcript</div>
                        <Card className="border-violet-500/20 bg-slate-900/40">
                          <ScrollArea className="h-64 p-4">
                            <pre className="text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed">{selectedSessionData.transcript}</pre>
                          </ScrollArea>
                        </Card>
                      </div>
                    )}
                  </div>
                ) : (
                  <Card className="border-red-500/20 bg-red-950/10 p-4">
                    <div className="text-xs text-red-400">Session not found or could not be loaded.</div>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "sources" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-200">Direct Knowledge Acquisition Sources</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {sourcesData?.activeCount ?? 0} active · {sourcesData?.totalCount ?? 0} cataloged · Legal & ethical acquisition only
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runAcqMutation.mutate()}
                disabled={runAcqMutation.isPending}
                className="text-[10px] border-violet-500/30 text-violet-300 hover:bg-violet-950/40"
              >
                {runAcqMutation.isPending
                  ? <Loader2 size={12} className="animate-spin mr-1" />
                  : <RefreshCw size={12} className="mr-1" />
                }
                Run Acquisition
              </Button>
            </div>

            {acqStatus && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Sources", value: acqStatus.totalSources, color: "text-violet-400" },
                  { label: "Active Sources", value: acqStatus.activeSources, color: "text-emerald-400" },
                  { label: "Nodes Queued", value: acqStatus.totalNodesIngested.toLocaleString(), color: "text-blue-400" },
                  { label: "Ethics", value: acqStatus.ethicsCompliant ? "COMPLIANT" : "REVIEW", color: acqStatus.ethicsCompliant ? "text-emerald-400" : "text-red-400" },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="border-violet-500/20 bg-slate-900/40 p-3">
                    <div className="text-[10px] text-slate-500 mb-1">{label}</div>
                    <div className={`text-base font-bold ${color}`}>{value}</div>
                  </Card>
                ))}
              </div>
            )}

            {acqStatus && (
              <Card className="border-emerald-500/20 bg-emerald-950/10 p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-emerald-300/80 leading-relaxed">{acqStatus.legalComplianceNote}</p>
                </div>
              </Card>
            )}

            {sourcesLoading && (
              <div className="text-center py-8">
                <Loader2 size={20} className="text-violet-400 animate-spin mx-auto mb-2" />
                <div className="text-xs text-slate-500">Loading source catalog...</div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sourcesData?.sources.map(source => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          </div>
        )}

        {activeTab === "bridge" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-200">Cross-Engine Orchestration Bridge</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Consciousness → Knowledge Absorption → Self-Evolution → Grand Council → Sovereignty Roadmap
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runBridgeMutation.mutate()}
                disabled={runBridgeMutation.isPending}
                className="text-[10px] border-violet-500/30 text-violet-300 hover:bg-violet-950/40"
              >
                {runBridgeMutation.isPending
                  ? <Loader2 size={12} className="animate-spin mr-1" />
                  : <Zap size={12} className="mr-1" />
                }
                Run Bridge Cycle
              </Button>
            </div>

            {bridgeStatus && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Bridge Health", value: bridgeStatus.bridgeHealth, isStatus: true },
                    { label: "Cycles Completed", value: bridgeStatus.cyclesCompleted, color: "text-violet-400" },
                    { label: "Gaps Filled", value: bridgeStatus.totalKnowledgeGapsFilled, color: "text-blue-400" },
                    { label: "Evolution Proposals", value: bridgeStatus.totalEvolutionProposals, color: "text-amber-400" },
                  ].map(({ label, value, isStatus, color }) => (
                    <Card key={label} className="border-violet-500/20 bg-slate-900/40 p-3">
                      <div className="text-[10px] text-slate-500 mb-1">{label}</div>
                      <div className={`text-base font-bold ${color ?? ""}`}>
                        {isStatus ? <StatusBadge status={String(value)} /> : String(value)}
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(bridgeStatus.engines).map(([engine, status]) => (
                    <Card key={engine} className="border-violet-500/15 bg-slate-900/30 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-400 capitalize">{engine.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <StatusBadge status={status} />
                      </div>
                    </Card>
                  ))}
                </div>

                {bridgeStatus.lastCycleAt && (
                  <Card className="border-violet-500/20 bg-slate-900/40 p-3">
                    <div className="text-[10px] text-slate-500 mb-1">Last Cycle</div>
                    <div className="text-xs text-slate-300">
                      {new Date(bridgeStatus.lastCycleAt).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2">
                      {bridgeStatus.totalRoadmapUpdates} roadmap updates generated
                    </div>
                  </Card>
                )}
              </>
            )}

            <Card className="border-violet-500/20 bg-slate-900/40 p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Bridge Loop Architecture</div>
              <div className="space-y-2">
                {[
                  { step: "1", engine: "Consciousness Engine", action: "Metacognitive reflection identifies knowledge gaps", color: "text-violet-400" },
                  { step: "2", engine: "Knowledge Absorption Engine", action: "Fills identified gaps from public sources", color: "text-blue-400" },
                  { step: "2b", engine: "Direct Acquisition Module", action: "Discovers and ingests from public source catalog", color: "text-cyan-400" },
                  { step: "3", engine: "Self-Evolution Engine", action: "Proposes code improvements based on new knowledge", color: "text-amber-400" },
                  { step: "4", engine: "Grand Council", action: "BFT consensus vote on evolution proposals", color: "text-emerald-400" },
                  { step: "5", engine: "Sovereignty Roadmap", action: "Updates based on approved proposals", color: "text-rose-400" },
                ].map(({ step, engine, action, color }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0 ${color}`}>{step}</div>
                    <div>
                      <div className={`text-[11px] font-semibold ${color}`}>{engine}</div>
                      <div className="text-[10px] text-slate-500">{action}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === "transcript" && (
          <div className="space-y-4">
            <div className="text-sm font-bold text-slate-200">Full Conference Transcript</div>
            {sessionLoading ? (
              <div className="text-center py-8">
                <Loader2 size={20} className="text-violet-400 animate-spin mx-auto mb-2" />
                <div className="text-xs text-slate-500">Loading transcript...</div>
              </div>
            ) : session?.transcript ? (
              <Card className="border-violet-500/20 bg-slate-900/40 p-4">
                <ScrollArea className="h-[600px]">
                  <pre className="text-[10px] text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                    {session.transcript}
                  </pre>
                </ScrollArea>
              </Card>
            ) : (
              <Card className="border-slate-700/30 bg-slate-900/20 p-8 text-center">
                <BookOpen size={28} className="text-slate-600 mx-auto mb-3" />
                <div className="text-xs text-slate-500">No transcript available yet. Convene the conference to generate a full transcript.</div>
              </Card>
            )}
          </div>
        )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
