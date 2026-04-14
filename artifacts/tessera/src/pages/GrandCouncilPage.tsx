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

const DOMAIN_ICONS: Record<string, any> = {
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

const DOMAIN_COLORS: Record<string, string> = {
  governance: "amber", quantum: "violet", "bio-neural": "rose",
  archival: "cyan", networking: "teal", hardware: "emerald",
  "self-improvement": "orange", prime: "yellow",
};

function getDomainColor(domain: string): string {
  return DOMAIN_COLORS[domain] || "violet";
}

function AgentCard({ agent, compact }: { agent: any; compact?: boolean }) {
  const Icon = DOMAIN_ICONS[agent.domain] || Users;
  const color = getDomainColor(agent.domain);

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group" title={`${agent.name}\n${agent.role}`}>
        <div className={`w-1.5 h-1.5 rounded-full bg-${color}-400`} />
        <Icon size={12} className={`text-${color}-400 shrink-0`} />
        <span className="text-[11px] text-white/70 truncate">{agent.name.replace("Agent", "")}</span>
        <span className="text-[9px] text-white/30 font-mono ml-auto shrink-0">w{agent.weight || agent.votingWeight || 1}</span>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 hover:bg-white/[0.07] transition-all group">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg bg-${color}-500/15 border border-${color}-500/20 flex items-center justify-center`}>
          <Icon size={14} className={`text-${color}-400`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-white/90 truncate">{agent.name.replace("Agent", "")}</div>
          <div className="text-[9px] text-white/30 font-mono uppercase">{agent.domain}</div>
        </div>
        {(agent.weight > 1 || agent.votingWeight > 1) && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-mono font-bold border border-amber-500/20">
            w{agent.weight || agent.votingWeight}
          </span>
        )}
      </div>
      <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2">{agent.role}</p>
    </div>
  );
}

function normalizeVoteTally(raw: any): { yes: number; no: number; abstain: number; total: number; weightedYes: number; totalWeight: number; required: number } {
  const inner = raw?.tally || raw;
  const yes = inner?.yes ?? 0;
  const no = inner?.no ?? 0;
  const abstain = inner?.abstain ?? 0;
  const total = inner?.totalEligible || raw?.totalWeight || (yes + no + abstain) || 1;
  const weightedYes = raw?.weightedYes ?? yes;
  const totalWeight = raw?.totalWeight || total;
  const required = raw?.requiredThreshold || Math.ceil(total * 2 / 3);
  return { yes, no, abstain, total, weightedYes, totalWeight, required };
}

function VoteTally({ tally: rawTally, passed }: { tally: any; passed: boolean }) {
  const t = normalizeVoteTally(rawTally);
  const yesPercent = t.total ? Math.round((t.yes / t.total) * 100) : 0;
  const noPercent = t.total ? Math.round((t.no / t.total) * 100) : 0;
  const abstainPercent = t.total ? Math.round((t.abstain / t.total) * 100) : 0;

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className={passed ? "text-emerald-400" : "text-red-400"} />
        <span className="text-sm font-semibold text-white/90">BFT Vote Tally</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-mono font-bold ${passed ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-red-500/15 text-red-400 border border-red-500/20"}`}>
          {passed ? "APPROVED" : "REJECTED"}
        </span>
      </div>

      <div className="h-3 rounded-full bg-white/5 overflow-hidden flex mb-3">
        <div className="bg-emerald-500 transition-all duration-1000" style={{ width: `${yesPercent}%` }} />
        <div className="bg-red-500 transition-all duration-1000" style={{ width: `${noPercent}%` }} />
        <div className="bg-white/20 transition-all duration-1000" style={{ width: `${abstainPercent}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-emerald-400">{t.weightedYes}</div>
          <div className="text-[10px] text-white/40">YES ({t.yes} votes)</div>
        </div>
        <div>
          <div className="text-lg font-bold text-red-400">{t.no}</div>
          <div className="text-[10px] text-white/40">NO</div>
        </div>
        <div>
          <div className="text-lg font-bold text-white/50">{t.abstain}</div>
          <div className="text-[10px] text-white/40">ABSTAIN</div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-[10px] text-white/30 font-mono">
        <span>Required: {t.required}/{t.totalWeight} (2/3)</span>
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

  const isHeader = line.startsWith("═══") || line.startsWith("╔") || line.startsWith("╠") || line.startsWith("╚") || line.startsWith("║");
  const isVoteYes = line.startsWith("✓");
  const isVoteNo = line.startsWith("✗");
  const isVoteAbstain = line.startsWith("○");
  const isDecision = line.startsWith("DECISION:");
  const isAgentSpeech = line.match(/^\[(\w+Agent)\]/);
  const isPriority = line.match(/^Priority P\d/);

  let className = "text-white/60 text-xs font-mono leading-relaxed";
  if (isHeader) className = "text-amber-400/80 text-xs font-mono font-bold";
  else if (isVoteYes) className = "text-emerald-400 text-xs font-mono";
  else if (isVoteNo) className = "text-red-400 text-xs font-mono";
  else if (isVoteAbstain) className = "text-white/40 text-xs font-mono";
  else if (isDecision) className = line.includes("APPROVED") ? "text-emerald-400 text-sm font-mono font-bold" : "text-red-400 text-sm font-mono font-bold";
  else if (isAgentSpeech) className = "text-violet-300/80 text-xs font-mono";
  else if (isPriority) className = line.includes("ADOPTED") ? "text-cyan-400 text-xs font-mono" : "text-orange-400 text-xs font-mono";

  return (
    <div ref={ref} className={`${className} animate-in fade-in slide-in-from-bottom-1 duration-300`}>
      {line || "\u00A0"}
    </div>
  );
}

function TranscriptView({ transcript, animated }: { transcript: string; animated?: boolean }) {
  const lines = transcript.split("\n");
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="bg-black/40 border border-white/[0.06] rounded-xl p-4 max-h-[500px] overflow-y-auto custom-scrollbar space-y-0.5"
    >
      {lines.map((line, i) => (
        <TranscriptLine key={i} line={line} delay={animated ? i * 40 : 0} />
      ))}
    </div>
  );
}

function SessionHistoryCard({ session, type, onClick }: { session: any; type: "meeting" | "decision"; onClick: () => void }) {
  const passed = type === "meeting"
    ? session.outcome === "approved"
    : session.outcome === "approved";
  const topic = type === "meeting" ? session.topic : session.topic;
  const date = new Date(session.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 hover:bg-white/[0.06] transition-colors group"
    >
      <div className="flex items-center gap-2 mb-1">
        {passed ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" /> : <XCircle size={12} className="text-red-400 shrink-0" />}
        <span className="text-xs font-semibold text-white/80 truncate flex-1">{topic}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
        <Clock size={10} />
        <span>{date}</span>
        {type === "meeting" && session.rounds && <span className="ml-auto">{session.rounds} rounds</span>}
      </div>
    </button>
  );
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
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<"meeting" | "decision">("meeting");
  const [historySearch, setHistorySearch] = useState("");

  const [fetchError, setFetchError] = useState<string | null>(null);

  async function safeFetch(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  const { data: agentsData } = useQuery({
    queryKey: ["council-agents"],
    queryFn: () => safeFetch(`${API}/council/agents`),
    staleTime: 60000,
  });

  const { data: meetingsData, isLoading: meetingsLoading } = useQuery({
    queryKey: ["council-meetings"],
    queryFn: () => safeFetch(`${API}/council/meetings?limit=50`),
    staleTime: 10000,
  });

  const { data: decisionsData } = useQuery({
    queryKey: ["council-decisions"],
    queryFn: () => safeFetch(`${API}/council/decisions?limit=50`),
    staleTime: 10000,
  });

  const deliberateMutation = useMutation({
    mutationFn: async (payload: { topic: string; category: string }) => {
      const res = await fetch(`${API}/council/meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, rounds: 3 }),
      });
      if (!res.ok) throw new Error("Deliberation failed");
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedSession(data);
      setSelectedType("meeting");
      queryClient.invalidateQueries({ queryKey: ["council-meetings"] });
      queryClient.invalidateQueries({ queryKey: ["council-decisions"] });
      setTopic("");
    },
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || deliberateMutation.isPending) return;
    deliberateMutation.mutate({ topic: topic.trim(), category });
  }, [topic, category, deliberateMutation]);

  const handleDownloadTranscript = useCallback(() => {
    if (!selectedSession) return;
    const transcript = selectedSession.transcript || selectedSession.meeting?.transcript || "";
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `council-${selectedSession.meetingId || selectedSession.decisionId || "session"}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedSession]);

  const agents = agentsData?.agents || [];
  const meetings = meetingsData?.meetings || [];
  const decisions = decisionsData?.decisions || [];

  const filteredMeetings = historySearch
    ? meetings.filter((m: any) => m.topic?.toLowerCase().includes(historySearch.toLowerCase()))
    : meetings;
  const filteredDecisions = historySearch
    ? decisions.filter((d: any) => d.topic?.toLowerCase().includes(historySearch.toLowerCase()))
    : decisions;

  const totalWeight = agents.reduce((s: number, a: any) => s + (a.weight || 1), 0);
  const requiredVotes = Math.ceil(totalWeight * 2 / 3);

  const currentTranscript = selectedSession?.transcript || selectedSession?.meeting?.transcript || null;
  const currentVoteTally = selectedSession?.votingResults || (selectedSession?.voteTally ? { ...selectedSession.voteTally } : null);
  const currentPassed = selectedSession?.passed ?? selectedSession?.outcome === "approved";

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
                  {agents.map((agent: any) => (
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
                {deliberateMutation.isError ? `Deliberation failed: ${(deliberateMutation.error as Error)?.message || "Unknown error"}` : fetchError}
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

          {selectedSession && currentTranscript && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {currentPassed ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  ) : (
                    <XCircle size={18} className="text-red-400" />
                  )}
                  <div>
                    <div className="text-sm font-semibold text-white/90">
                      {selectedSession.topic || "Council Session"}
                    </div>
                    <div className="text-[10px] text-white/30 font-mono">
                      {selectedSession.meetingId || selectedSession.decisionId} | {selectedSession.themes?.join(", ") || selectedSession.category || "general"}
                    </div>
                  </div>
                </div>
                <div className="flex-1" />
                <button
                  onClick={handleDownloadTranscript}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
                >
                  <Download size={12} />
                  <span>Save Transcript</span>
                </button>
              </div>

              {currentVoteTally && (
                <VoteTally tally={currentVoteTally} passed={currentPassed} />
              )}

              {selectedSession.actionPlan && (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={14} className="text-cyan-400" />
                    <span className="text-sm font-semibold text-white/80">Action Plan</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedSession.actionPlan.map((action: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-cyan-400/60 font-mono shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-white/60">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSession.selfExpansionAnalysis && (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu size={14} className="text-orange-400" />
                    <span className="text-sm font-semibold text-white/80">Self-Expansion Analysis</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-[10px] text-white/30 uppercase font-mono mb-1">Learn</div>
                      <div className="text-xs text-white/60">{selectedSession.selfExpansionAnalysis.learnBuildMore?.learn || "—"}</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-[10px] text-white/30 uppercase font-mono mb-1">Build</div>
                      <div className="text-xs text-white/60">{selectedSession.selfExpansionAnalysis.learnBuildMore?.build || "—"}</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-[10px] text-white/30 uppercase font-mono mb-1">More</div>
                      <div className="text-xs text-white/60">{selectedSession.selfExpansionAnalysis.learnBuildMore?.more || "—"}</div>
                    </div>
                  </div>
                  {selectedSession.selfExpansionAnalysis.proposedModules?.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-white/30 uppercase font-mono">Proposed Modules</div>
                      {selectedSession.selfExpansionAnalysis.proposedModules.map((mod: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-black/20 rounded-lg px-3 py-2">
                          <span className="text-orange-400 font-mono font-bold">{mod.name}</span>
                          <span className="text-white/40 flex-1 truncate">{mod.purpose}</span>
                          <span className="text-white/20 font-mono shrink-0">~{mod.estimatedLines}L</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={14} className="text-violet-400" />
                  <span className="text-sm font-semibold text-white/80">Full Transcript</span>
                </div>
                <TranscriptView transcript={currentTranscript} animated={!!deliberateMutation.data && selectedSession === deliberateMutation.data} />
              </div>
            </div>
          )}

          {!selectedSession && !deliberateMutation.isPending && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-8 text-center">
              <Crown size={40} className="text-amber-400/30 mx-auto mb-3" />
              <div className="text-sm text-white/40 mb-1">No Active Session</div>
              <div className="text-xs text-white/20">Submit a topic above to convene the Grand Council</div>
              {meetings.length > 0 && (
                <button
                  onClick={() => setActiveTab("history")}
                  className="mt-3 text-xs text-amber-400/60 hover:text-amber-400 transition-colors"
                >
                  View {meetings.length} past session{meetings.length !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search sessions..."
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/20 transition-colors"
              />
            </div>
          </div>

          {meetingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-amber-400/40" />
            </div>
          ) : (
            <div className="space-y-6">
              {filteredMeetings.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-amber-400/50 uppercase tracking-[0.2em] mb-3">Council Meetings ({filteredMeetings.length})</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {filteredMeetings.map((m: any) => (
                      <SessionHistoryCard
                        key={m.meetingId || m.id}
                        session={m}
                        type="meeting"
                        onClick={async () => {
                          setFetchError(null);
                          try {
                            const data = await safeFetch(`${API}/council/meetings/${m.meetingId}`);
                            if (data.ok && data.meeting) {
                              setSelectedSession({
                                ...data.meeting,
                                votingResults: data.meeting.votingResults,
                                actionPlan: data.meeting.actionPlan,
                                selfExpansionAnalysis: data.meeting.selfExpansionAnalysis,
                              });
                              setSelectedType("meeting");
                              setActiveTab("chamber");
                            }
                          } catch (err: any) {
                            setFetchError(`Failed to load meeting: ${err.message}`);
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredDecisions.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-violet-400/50 uppercase tracking-[0.2em] mb-3">Council Decisions ({filteredDecisions.length})</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {filteredDecisions.map((d: any) => (
                      <SessionHistoryCard
                        key={d.decisionId || d.id}
                        session={d}
                        type="decision"
                        onClick={() => {
                          setSelectedSession({
                            ...d,
                            topic: d.topic,
                            transcript: d.transcript,
                            decisionId: d.decisionId,
                            passed: d.outcome === "approved",
                            votingResults: d.voteTally,
                          });
                          setSelectedType("decision");
                          setActiveTab("chamber");
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredMeetings.length === 0 && filteredDecisions.length === 0 && (
                <div className="text-center py-12">
                  <History size={32} className="text-white/10 mx-auto mb-2" />
                  <div className="text-sm text-white/30">No sessions found</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "agents" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {agents.map((agent: any) => (
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
