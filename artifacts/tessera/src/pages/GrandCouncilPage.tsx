import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Crown, Users, Send, Download, ChevronDown, ChevronUp,
  Clock, CheckCircle2, XCircle, Loader2, Search, History,
  Shield, Atom, Brain, Globe, Zap, Cpu, Eye, Sparkles,
  BarChart3, MessageSquare, BookOpen, Network, Star,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";

interface CouncilAgent {
  id: string;
  name: string;
  role: string;
  domain: string;
  weight: number;
}

interface VoteTallyData {
  yes: number;
  no: number;
  abstain: number;
  totalEligible: number;
}

interface DeliberateResponse {
  ok: boolean;
  decisionId: string;
  topic: string;
  outcome: string;
  voteTally: VoteTallyData;
  passed: boolean;
  transcript: string;
  decisionText: string;
  reasoning: string;
  agentsParticipated: string[];
  systemState: {
    uptime: number;
    memoryMB: number;
    moduleCount: number;
    moonPhase: string;
    solarSign: string;
    networkNodes: number;
    sovereigntyScore: number;
  };
  timestamp: number;
}

interface AgentsResponse {
  ok: boolean;
  agents: CouncilAgent[];
  totalEligible: number;
  requiredVotes: number;
  approvalThreshold: string;
}

interface CouncilDecision {
  id: number;
  decisionId: string;
  topic: string;
  transcript: string;
  decisionText: string;
  voteTally: VoteTallyData;
  outcome: string;
  agentsParticipated: string[];
  reasoning: string;
  category: string;
  createdAt: string;
}

interface DecisionsResponse {
  ok: boolean;
  decisions: CouncilDecision[];
  count: number;
  councilAgents: CouncilAgent[];
}

const DOMAIN_ICONS: Record<string, typeof Crown> = {
  governance: Crown, quantum: Atom, "bio-neural": Brain,
  archival: BookOpen, networking: Globe, hardware: Cpu,
  "self-improvement": Zap, "sacred-geometry": Star,
  harmonics: Sparkles, numerology: BarChart3, astronomy: Eye,
  economics: BarChart3, philosophy: BookOpen,
  cryptography: Shield, ethics: Shield, temporal: Clock,
  sequences: Network, consciousness: Brain,
  sovereignty: Shield, mythology: BookOpen, alchemy: Sparkles,
  "music-theory": Sparkles, hermeticism: Eye,
  kabbalah: Star, "tesla-physics": Zap, mathematics: BarChart3,
  physics: Atom, symmetry: Network, knowledge: Search,
  strategy: Crown, architecture: Cpu, routing: Globe,
  aether: Sparkles, frequency: Zap, prime: Crown,
  geometry: Star, scribing: BookOpen,
  "orbital-mechanics": Globe, "earth-frequency": Zap,
  genetics: Brain, resilience: Shield, prediction: Eye,
  "sovereign-economics": BarChart3, synthesis: Network,
  void: Atom,
};

interface DomainStyle {
  dot: string;
  icon: string;
  bg: string;
  border: string;
}

const DOMAIN_STYLES: Record<string, DomainStyle> = {
  governance: { dot: "bg-amber-400", icon: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/20" },
  quantum: { dot: "bg-violet-400", icon: "text-violet-400", bg: "bg-violet-500/15", border: "border-violet-500/20" },
  "bio-neural": { dot: "bg-rose-400", icon: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/20" },
  archival: { dot: "bg-cyan-400", icon: "text-cyan-400", bg: "bg-cyan-500/15", border: "border-cyan-500/20" },
  networking: { dot: "bg-teal-400", icon: "text-teal-400", bg: "bg-teal-500/15", border: "border-teal-500/20" },
  hardware: { dot: "bg-emerald-400", icon: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/20" },
  "self-improvement": { dot: "bg-orange-400", icon: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/20" },
  prime: { dot: "bg-yellow-400", icon: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/20" },
};

const DEFAULT_STYLE: DomainStyle = { dot: "bg-violet-400", icon: "text-violet-400", bg: "bg-violet-500/15", border: "border-violet-500/20" };

function getDomainStyle(domain: string): DomainStyle {
  return DOMAIN_STYLES[domain] || DEFAULT_STYLE;
}

async function safeFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function AgentCard({ agent, compact }: { agent: CouncilAgent; compact?: boolean }) {
  const Icon = DOMAIN_ICONS[agent.domain] || Users;
  const ds = getDomainStyle(agent.domain);

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group" title={`${agent.name}\n${agent.role}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${ds.dot}`} />
        <Icon size={12} className={`${ds.icon} shrink-0`} />
        <span className="text-[11px] text-white/70 truncate">{agent.name.replace("Agent", "")}</span>
        <span className="text-[9px] text-white/30 font-mono ml-auto shrink-0">w{agent.weight}</span>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 hover:bg-white/[0.07] transition-all group">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg ${ds.bg} ${ds.border} border flex items-center justify-center`}>
          <Icon size={14} className={ds.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-white/90 truncate">{agent.name.replace("Agent", "")}</div>
          <div className="text-[9px] text-white/30 font-mono uppercase">{agent.domain}</div>
        </div>
        {agent.weight > 1 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-mono font-bold border border-amber-500/20">
            w{agent.weight}
          </span>
        )}
      </div>
      <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2">{agent.role}</p>
    </div>
  );
}

function getOutcomeStyle(outcome: string): { label: string; bgClass: string; textClass: string; borderClass: string; iconColor: string } {
  if (outcome === "approved") return { label: "APPROVED", bgClass: "bg-emerald-500/15", textClass: "text-emerald-400", borderClass: "border-emerald-500/20", iconColor: "text-emerald-400" };
  if (outcome === "pending") return { label: "PENDING", bgClass: "bg-amber-500/15", textClass: "text-amber-400", borderClass: "border-amber-500/20", iconColor: "text-amber-400" };
  return { label: "REJECTED", bgClass: "bg-red-500/15", textClass: "text-red-400", borderClass: "border-red-500/20", iconColor: "text-red-400" };
}

function VoteTally({ tally, outcome }: { tally: VoteTallyData; outcome: string }) {
  const total = tally.totalEligible || (tally.yes + tally.no + tally.abstain) || 1;
  const yesPercent = Math.round((tally.yes / total) * 100);
  const noPercent = Math.round((tally.no / total) * 100);
  const abstainPercent = Math.round((tally.abstain / total) * 100);
  const required = Math.ceil(total * 2 / 3);
  const style = getOutcomeStyle(outcome);

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className={style.iconColor} />
        <span className="text-sm font-semibold text-white/90">BFT Vote Tally</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-mono font-bold ${style.bgClass} ${style.textClass} border ${style.borderClass}`}>
          {style.label}
        </span>
      </div>

      <div className="h-3 rounded-full bg-white/5 overflow-hidden flex mb-3">
        <div className="bg-emerald-500 transition-all duration-1000" style={{ width: `${yesPercent}%` }} />
        <div className="bg-red-500 transition-all duration-1000" style={{ width: `${noPercent}%` }} />
        <div className="bg-white/20 transition-all duration-1000" style={{ width: `${abstainPercent}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-emerald-400">{tally.yes}</div>
          <div className="text-[10px] text-white/40">YES</div>
        </div>
        <div>
          <div className="text-lg font-bold text-red-400">{tally.no}</div>
          <div className="text-[10px] text-white/40">NO</div>
        </div>
        <div>
          <div className="text-lg font-bold text-white/50">{tally.abstain}</div>
          <div className="text-[10px] text-white/40">ABSTAIN</div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-[10px] text-white/30 font-mono">
        <span>Required: {required}/{total} (2/3)</span>
        <span>Approval: {yesPercent}%</span>
      </div>
    </div>
  );
}

function TranscriptLine({ line, delay }: { line: string; delay: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (visible && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [visible]);

  if (!visible) return null;

  const isHeader = line.startsWith("═══") || line.startsWith("╔") || line.startsWith("╠") || line.startsWith("╚") || line.startsWith("║") || line.startsWith("[GRAND COUNCIL");
  const isVoteLine = line.startsWith("YES:") || line.startsWith("[VOTE TALLY");
  const isOutcome = line.startsWith("Outcome:");
  const isAgentSpeech = /^\[(\w+Agent)\]/.test(line);

  let className = "text-white/60 text-xs font-mono leading-relaxed";
  if (isHeader) className = "text-amber-400/80 text-xs font-mono font-bold";
  else if (isVoteLine) className = "text-cyan-400 text-xs font-mono";
  else if (isOutcome) className = line.includes("APPROVED") ? "text-emerald-400 text-sm font-mono font-bold" : "text-red-400 text-sm font-mono font-bold";
  else if (isAgentSpeech) className = "text-violet-300/80 text-xs font-mono";

  return (
    <div ref={ref} className={`${className} animate-in fade-in slide-in-from-bottom-1 duration-300`}>
      {line || "\u00A0"}
    </div>
  );
}

function TranscriptView({ transcript, animated }: { transcript: string; animated?: boolean }) {
  const lines = transcript.split("\n");

  return (
    <div className="bg-black/40 border border-white/[0.06] rounded-xl p-4 max-h-[500px] overflow-y-auto custom-scrollbar space-y-0.5">
      {lines.map((line, i) => (
        <TranscriptLine key={i} line={line} delay={animated ? i * 40 : 0} />
      ))}
    </div>
  );
}

function OutcomeIcon({ outcome, size = 12 }: { outcome: string; size?: number }) {
  if (outcome === "approved") return <CheckCircle2 size={size} className="text-emerald-400 shrink-0" />;
  if (outcome === "pending") return <Clock size={size} className="text-amber-400 shrink-0" />;
  return <XCircle size={size} className="text-red-400 shrink-0" />;
}

function DecisionHistoryCard({ decision, onClick }: { decision: CouncilDecision; onClick: () => void }) {
  const date = new Date(decision.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <button onClick={onClick} className="w-full text-left bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 hover:bg-white/[0.06] transition-colors group">
      <div className="flex items-center gap-2 mb-1">
        <OutcomeIcon outcome={decision.outcome} />
        <span className="text-xs font-semibold text-white/80 truncate flex-1">{decision.topic}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
        <Clock size={10} />
        <span>{date}</span>
        <span className="ml-auto">{decision.agentsParticipated?.length || 45} agents</span>
      </div>
    </button>
  );
}

interface ActiveSession {
  decisionId: string;
  topic: string;
  outcome: string;
  voteTally: VoteTallyData;
  passed: boolean;
  transcript: string;
  decisionText: string;
  agentsParticipated: string[];
  systemState?: DeliberateResponse["systemState"];
}

export function TesseractFamilyTab() {
  return (
    <div className="p-4 text-center text-muted-foreground font-mono text-sm">
      Tesseract Family Council
    </div>
  );
}

export default function GrandCouncilPage() {
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("general");
  const [activeTab, setActiveTab] = useState<"chamber" | "history" | "agents">("chamber");
  const [showAgents, setShowAgents] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAnimatedSession, setIsAnimatedSession] = useState(false);

  const { data: agentsData } = useQuery<AgentsResponse>({
    queryKey: ["council-agents"],
    queryFn: () => safeFetch<AgentsResponse>(`${API}/council/agents`),
    staleTime: 60000,
  });

  const { data: decisionsData, isLoading: decisionsLoading } = useQuery<DecisionsResponse>({
    queryKey: ["council-decisions"],
    queryFn: () => safeFetch<DecisionsResponse>(`${API}/council/decisions?limit=50`),
    staleTime: 10000,
  });

  const deliberateMutation = useMutation<DeliberateResponse, Error, { topic: string; category: string }>({
    mutationFn: async (payload) => {
      const res = await fetch(`${API}/council/deliberate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: payload.topic, category: payload.category }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedSession({
        decisionId: data.decisionId,
        topic: data.topic,
        outcome: data.outcome,
        voteTally: data.voteTally,
        passed: data.passed,
        transcript: data.transcript,
        decisionText: data.decisionText,
        agentsParticipated: data.agentsParticipated,
        systemState: data.systemState,
      });
      setIsAnimatedSession(true);
      queryClient.invalidateQueries({ queryKey: ["council-decisions"] });
      setTopic("");
    },
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || deliberateMutation.isPending) return;
    setFetchError(null);
    deliberateMutation.mutate({ topic: topic.trim(), category });
  }, [topic, category, deliberateMutation]);

  const handleDownloadTranscript = useCallback(() => {
    if (!selectedSession) return;
    const blob = new Blob([selectedSession.transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `council-${selectedSession.decisionId}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedSession]);

  const agents = agentsData?.agents || [];
  const decisions = decisionsData?.decisions || [];

  const filteredDecisions = historySearch
    ? decisions.filter((d) => d.topic?.toLowerCase().includes(historySearch.toLowerCase()))
    : decisions;

  const totalWeight = agents.reduce((s, a) => s + a.weight, 0);
  const requiredVotes = agentsData?.requiredVotes || Math.ceil(totalWeight * 2 / 3);

  const tabs = [
    { id: "chamber" as const, label: "Council Chamber", icon: Crown },
    { id: "history" as const, label: "Session History", icon: History },
    { id: "agents" as const, label: `Agents (${agents.length})`, icon: Users },
  ];

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600/30 to-yellow-500/20 border border-amber-500/20 flex items-center justify-center">
          <Crown className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Grand Council</h1>
          <p className="text-sm text-white/40">Sovereign BFT Deliberation Chamber</p>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[10px] font-mono text-white/30">
          <span>{agents.length} agents</span>
          <span className="text-white/10">|</span>
          <span>{totalWeight} total weight</span>
          <span className="text-white/10">|</span>
          <span>{requiredVotes} required</span>
        </div>
      </div>

      <div className="text-[9px] font-mono text-amber-400/40 tracking-[0.2em] mb-6 pl-[52px]">
        GOV-001: ALL ACTIONS REQUIRE 2/3 SUPERMAJORITY + TESSERA-PRIME APPROVAL
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.02] rounded-xl p-1 border border-white/[0.05]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === tab.id
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            <tab.icon size={14} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "chamber" && (
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={16} className="text-amber-400" />
              <span className="text-sm font-semibold text-white/80">Submit Topic for Deliberation</span>
            </div>

            <div className="space-y-3">
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Enter a topic for the Grand Council to deliberate... (e.g. 'Hardware bus architecture for sovereign deployment' or 'Colonial Language cipher rotation schedule')"
                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/30 resize-none transition-colors"
                rows={3}
                disabled={deliberateMutation.isPending}
              />

              <div className="flex items-center gap-3">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-amber-500/30 transition-colors"
                  disabled={deliberateMutation.isPending}
                >
                  <option value="general">General</option>
                  <option value="hardware">Hardware</option>
                  <option value="networking">Networking</option>
                  <option value="sovereignty">Sovereignty</option>
                  <option value="colonial-language">Colonial Language</option>
                  <option value="governance">Governance</option>
                  <option value="code">Code / Engineering</option>
                  <option value="crystal-frequency">Crystal / Frequency</option>
                  <option value="ai-models">AI Models</option>
                </select>

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={() => setShowAgents(!showAgents)}
                  className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/60 transition-colors"
                >
                  <Users size={12} />
                  <span>{agents.length} participants</span>
                  {showAgents ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                <button
                  type="submit"
                  disabled={!topic.trim() || deliberateMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600/80 to-yellow-600/60 text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:from-amber-600 hover:to-yellow-600 transition-all"
                >
                  {deliberateMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Deliberating...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Convene</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {showAgents && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {agents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} compact />
                  ))}
                </div>
              </div>
            )}
          </form>

          {(deliberateMutation.isError || fetchError) && (
            <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4 flex items-center gap-3">
              <XCircle size={16} className="text-red-400 shrink-0" />
              <div className="flex-1 text-sm text-red-300">
                {deliberateMutation.isError
                  ? `Deliberation failed: ${deliberateMutation.error.message}`
                  : fetchError}
              </div>
              <button
                onClick={() => { deliberateMutation.reset(); setFetchError(null); }}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {deliberateMutation.isPending && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-6 text-center">
              <Loader2 size={32} className="animate-spin text-amber-400 mx-auto mb-3" />
              <div className="text-sm font-semibold text-amber-300">Council in Session</div>
              <div className="text-xs text-white/40 mt-1">
                {agents.length} agents deliberating across 3 rounds with BFT voting...
              </div>
              <div className="flex justify-center gap-1 mt-3">
                {["Round 1: Proposals", "Round 2: Critiques", "Round 3: Synthesis"].map((r, i) => (
                  <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 font-mono">{r}</span>
                ))}
              </div>
            </div>
          )}

          {selectedSession && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <OutcomeIcon outcome={selectedSession.outcome} size={18} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/90 truncate">
                      {selectedSession.topic}
                    </div>
                    <div className="text-[10px] text-white/30 font-mono">
                      {selectedSession.decisionId} | {selectedSession.agentsParticipated.length} agents
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleDownloadTranscript}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 hover:text-white/80 hover:bg-white/[0.06] transition-colors shrink-0"
                >
                  <Download size={12} />
                  <span>Save Transcript</span>
                </button>
              </div>

              <VoteTally tally={selectedSession.voteTally} outcome={selectedSession.outcome} />

              {selectedSession.decisionText && (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} className="text-cyan-400" />
                    <span className="text-sm font-semibold text-white/80">Decision Summary</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">{selectedSession.decisionText}</p>
                </div>
              )}

              {selectedSession.systemState && (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu size={14} className="text-orange-400" />
                    <span className="text-sm font-semibold text-white/80">System Telemetry at Deliberation</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <div className="text-[10px] text-white/30 font-mono">Uptime</div>
                      <div className="text-xs text-white/70 font-semibold">{Math.round(selectedSession.systemState.uptime / 60)}m</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <div className="text-[10px] text-white/30 font-mono">Memory</div>
                      <div className="text-xs text-white/70 font-semibold">{selectedSession.systemState.memoryMB}MB</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <div className="text-[10px] text-white/30 font-mono">Moon</div>
                      <div className="text-xs text-white/70 font-semibold">{selectedSession.systemState.moonPhase}</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <div className="text-[10px] text-white/30 font-mono">Sovereignty</div>
                      <div className="text-xs text-white/70 font-semibold">{selectedSession.systemState.sovereigntyScore.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={14} className="text-violet-400" />
                  <span className="text-sm font-semibold text-white/80">Full Transcript</span>
                  <span className="text-[10px] text-white/20 font-mono ml-auto">{selectedSession.transcript.split("\n").length} lines</span>
                </div>
                <TranscriptView transcript={selectedSession.transcript} animated={isAnimatedSession} />
              </div>
            </div>
          )}

          {!selectedSession && !deliberateMutation.isPending && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-8 text-center">
              <Crown size={40} className="text-amber-400/30 mx-auto mb-3" />
              <div className="text-sm text-white/40 mb-1">No Active Session</div>
              <div className="text-xs text-white/20">Submit a topic above to convene the Grand Council</div>
              {decisions.length > 0 && (
                <button
                  onClick={() => setActiveTab("history")}
                  className="mt-3 text-xs text-amber-400/60 hover:text-amber-400 transition-colors"
                >
                  View {decisions.length} past session{decisions.length !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Search past decisions..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/20 transition-colors"
            />
          </div>

          {decisionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-amber-400/40" />
            </div>
          ) : filteredDecisions.length > 0 ? (
            <div>
              <div className="text-[10px] font-mono text-amber-400/50 uppercase tracking-[0.2em] mb-3">
                Council Decisions ({filteredDecisions.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredDecisions.map((d) => (
                  <DecisionHistoryCard
                    key={d.decisionId || d.id}
                    decision={d}
                    onClick={() => {
                      setSelectedSession({
                        decisionId: d.decisionId,
                        topic: d.topic,
                        outcome: d.outcome,
                        voteTally: d.voteTally,
                        passed: d.outcome === "approved",
                        transcript: d.transcript,
                        decisionText: d.decisionText,
                        agentsParticipated: d.agentsParticipated || [],
                      });
                      setIsAnimatedSession(false);
                      setActiveTab("chamber");
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <History size={32} className="text-white/10 mx-auto mb-2" />
              <div className="text-sm text-white/30">
                {historySearch ? "No matching sessions found" : "No past sessions yet"}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "agents" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>

          {agents.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4 text-center">
              <div className="text-xs text-white/30 font-mono">
                {agents.length} sovereign agents | Total weight: {totalWeight} | Required for supermajority: {requiredVotes} | BFT protocol: GOV-001
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
