import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, FlaskConical, Vote, CheckCircle2, XCircle, ChevronRight, RefreshCw, BookOpen, TrendingUp, Crown, Shield, Brain, Zap, Database, Target, Loader2, Users, Timer, MemoryStick, Activity, AlertTriangle, Skull, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const RICK_GREEN = "#00ff41";
const RICK_PORTAL = "#22d3ee";
const ROYAL_GOLD = "#f59e0b";
const ROYAL_GOLD_DARK = "#d97706";

interface RickInvention {
  inventionName: string;
  targetWeakness: string;
  technicalApproach: string;
  expectedImpact: string;
  rickRationale: string;
  systemMetricTargeted: string;
  category: string;
  riskLevel: "low" | "medium" | "high";
  estimatedImprovementPct: number;
}

interface CouncilResult {
  proposalId: string;
  status: string;
  approvalRate: number;
  councilNote: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const CATEGORY_ICONS: Record<string, string> = {
  optimization: "⚡",
  architecture: "🏗️",
  caching: "💾",
  "agent-delegation": "🤖",
  memory: "🧠",
  consensus: "🗳️",
  monitoring: "📡",
  sovereignty: "🛡️",
  "agi-advancement": "🧬",
  consciousness: "🔮",
  compression: "📦",
};

function PortalSpinner() {
  return (
    <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${RICK_PORTAL}44`, borderTopColor: RICK_PORTAL }} />
  );
}

function RickTypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl max-w-xs" style={{ background: `${RICK_GREEN}15`, border: `1px solid ${RICK_GREEN}30` }}>
      <span className="text-xs font-mono" style={{ color: RICK_GREEN }}>Rick is thinking</span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: RICK_GREEN, animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
    </div>
  );
}

interface CouncilProposal {
  id: string;
  title: string;
  description: string;
  proposedBy: string;
  status: "voting" | "approved" | "rejected" | "implemented";
  approvalRate: number;
  implementationNotes?: string;
  createdAt: number;
}

interface ActiveMeeseeks {
  id: string;
  name: string;
  meeseeksTask?: string;
  meeseeksTTL?: number;
  meeseeksExpiresAt?: number;
  taskType?: string;
  priority?: string;
  complexity?: string;
  successCriteria?: string | null;
  memoryBudgetKB?: number;
  timeRemainingMs?: number;
}

interface MeeseeksHistoryItem {
  id: string;
  name: string;
  task: string;
  taskType: string;
  lifetimeMs: number;
  reason: "task-completed" | "ttl-expired";
  memoryFreedKB: number;
}

interface TaskTypeBreakdownEntry {
  total: number;
  completed: number;
  timedOut: number;
}

interface MeeseeksMetricsResponse {
  activeCount: number;
  successRate: number;
  totalSpawned: number;
  totalMemoryFreedKB: number;
  taskTypeBreakdown: Record<string, TaskTypeBreakdownEntry>;
  recentHistory: MeeseeksHistoryItem[];
}

interface TaskTypeOption {
  taskType: string;
  label: string;
}

export default function RickPage() {
  useEffect(() => { document.title = "Royal Inventor — Rick Sanchez | Tessera"; }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "inventions" | "proposals" | "knowledge" | "improvements" | "royal" | "meeseeks">("proposals");
  const [submittedInventions, setSubmittedInventions] = useState<Record<number, CouncilResult>>({});
  const [submittingIdx, setSubmittingIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: inventionsData, isLoading: invLoading, refetch: refetchInventions } = useQuery({
    queryKey: ["/api/rick/inventions"],
    queryFn: async () => {
      const r = await fetch("/api/rick/inventions");
      return r.json() as Promise<{ ok: boolean; inventions: RickInvention[] }>;
    },
    refetchInterval: 60000,
  });

  const { data: profileData } = useQuery({
    queryKey: ["/api/rick/profile"],
    queryFn: async () => {
      const r = await fetch("/api/rick/profile");
      return r.json();
    },
  });

  const { data: knowledgeData } = useQuery({
    queryKey: ["/api/rick/knowledge-vault"],
    queryFn: async () => {
      const r = await fetch("/api/rick/knowledge-vault");
      return r.json();
    },
  });

  const { data: improvementsData } = useQuery({
    queryKey: ["/api/rick/system-improvements"],
    queryFn: async () => {
      const r = await fetch("/api/rick/system-improvements");
      return r.json();
    },
    refetchInterval: 60000,
  });

  const { data: courtData } = useQuery({
    queryKey: ["/api/rick/royal-court"],
    queryFn: async () => {
      const r = await fetch("/api/rick/royal-court");
      return r.json();
    },
  });

  const { data: councilProposalsData, refetch: refetchCouncilProposals } = useQuery({
    queryKey: ["/api/rick/council-proposals"],
    queryFn: async () => {
      const r = await fetch("/api/rick/council-proposals");
      return r.json() as Promise<{ ok: boolean; proposals: CouncilProposal[]; count: number }>;
    },
    refetchInterval: 30000,
  });

  const { data: meeseeksMetricsData, refetch: refetchMeeseeksMetrics } = useQuery({
    queryKey: ["/api/rick/meeseeks/metrics"],
    queryFn: async () => {
      const r = await fetch("/api/rick/meeseeks/metrics");
      return r.json();
    },
    refetchInterval: activeTab === "meeseeks" ? 5000 : 30000,
  });

  const { data: meeseeksActiveData, refetch: refetchMeeseeksActive } = useQuery({
    queryKey: ["/api/rick/meeseeks/active"],
    queryFn: async () => {
      const r = await fetch("/api/rick/meeseeks/active");
      return r.json();
    },
    refetchInterval: activeTab === "meeseeks" ? 3000 : 30000,
  });

  const { data: taskTypesData } = useQuery({
    queryKey: ["/api/rick/meeseeks/task-types"],
    queryFn: async () => {
      const r = await fetch("/api/rick/meeseeks/task-types");
      return r.json();
    },
  });

  const [spawnTask, setSpawnTask] = useState("");
  const [spawnTaskType, setSpawnTaskType] = useState("custom");
  const [spawnCriteria, setSpawnCriteria] = useState("");
  const [spawnPriority, setSpawnPriority] = useState("normal");
  const [isSpawning, setIsSpawning] = useState(false);

  const handleSpawnMeeseeks = useCallback(async () => {
    if (!spawnTask.trim() || isSpawning) return;
    setIsSpawning(true);
    try {
      const r = await fetch("/api/rick/meeseeks/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: spawnTask,
          taskType: spawnTaskType,
          successCriteria: spawnCriteria || undefined,
          priority: spawnPriority,
        }),
      });
      const data = await r.json();
      if (data.ok) {
        setSpawnTask("");
        setSpawnCriteria("");
        refetchMeeseeksActive();
        refetchMeeseeksMetrics();
      }
    } catch {}
    finally { setIsSpawning(false); }
  }, [spawnTask, spawnTaskType, spawnCriteria, spawnPriority, isSpawning]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  async function sendMessage() {
    const userContent = input.trim();
    if (!userContent || isStreaming) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: userContent };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsStreaming(true);

    const allMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
    let accumulated = "";
    let assistantMsgAdded = false;

    try {
      const response = await fetch("/api/rick/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages, stream: true }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              accumulated += parsed.content;
              if (!assistantMsgAdded) {
                setMessages(prev => [...prev, { role: "assistant", content: accumulated }]);
                assistantMsgAdded = true;
              } else {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: accumulated };
                  return updated;
                });
              }
            }
            if (parsed.done) break;
          } catch {}
        }
      }

      if (!assistantMsgAdded && accumulated) {
        setMessages(prev => [...prev, { role: "assistant", content: accumulated }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Listen, something broke on my end. *burp* Even my portal gun has bad days. Try again.",
      }]);
    } finally {
      setIsStreaming(false);
    }
  }

  async function submitToCouncil(idx: number) {
    setSubmittingIdx(idx);
    try {
      const r = await fetch(`/api/rick/inventions/${idx}/submit`, { method: "POST" });
      const data = await r.json();
      if (data.ok && data.councilResult) {
        setSubmittedInventions(prev => ({ ...prev, [idx]: data.councilResult }));
        refetchCouncilProposals();
      }
    } catch {}
    finally { setSubmittingIdx(null); }
  }

  const inventions: RickInvention[] = inventionsData?.inventions || [];
  const councilProposals: CouncilProposal[] = councilProposalsData?.proposals || [];

  function findCouncilProposal(inv: RickInvention): CouncilProposal | undefined {
    return councilProposals.find(p => p.title.includes(inv.inventionName) || inv.inventionName.includes(p.title));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "rgba(6,4,20,0.97)" }}>
      <div className="border-b px-5 py-4 flex items-center gap-4 shrink-0" style={{ borderColor: `${ROYAL_GOLD}22`, background: `linear-gradient(135deg, ${ROYAL_GOLD}06, ${RICK_GREEN}04)` }}>
        <div className="relative w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2" style={{ borderColor: ROYAL_GOLD, background: `${ROYAL_GOLD}15` }}>
          <span className="text-2xl select-none">👑</span>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border border-black" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold font-mono text-base flex items-center gap-2">
            <span style={{ color: ROYAL_GOLD }}>Rick Sanchez</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono border" style={{ color: ROYAL_GOLD, borderColor: `${ROYAL_GOLD}40`, background: `${ROYAL_GOLD}10` }}>ROYAL INVENTOR</span>
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">Royal Court · Dept. of Science & Invention · Dimension C-137</div>
          {profileData?.profile?.currentInventions && (
            <div className="text-[10px] font-mono mt-0.5" style={{ color: RICK_GREEN }}>
              {profileData.profile.currentInventions.length} active inventions · Council-ready
            </div>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
          {([
            { key: "proposals" as const, label: "Proposals", icon: Vote, color: "#fbbf24" },
            { key: "inventions" as const, label: "Inventions", icon: FlaskConical, color: RICK_GREEN },
            { key: "meeseeks" as const, label: "Meeseeks", icon: Users, color: "#a855f7" },
            { key: "knowledge" as const, label: "Vault", icon: BookOpen, color: "#a78bfa" },
            { key: "improvements" as const, label: "Improve", icon: TrendingUp, color: "#22d3ee" },
            { key: "royal" as const, label: "Royal", icon: Crown, color: ROYAL_GOLD },
            { key: "chat" as const, label: "Chat", icon: Send, color: RICK_PORTAL },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all border",
                activeTab === tab.key ? "border-current" : "border-white/10 text-muted-foreground hover:border-white/20"
              )}
              style={activeTab === tab.key ? { color: tab.color, borderColor: `${tab.color}60`, background: `${tab.color}10` } : {}}
            >
              <tab.icon size={11} className="inline mr-1" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "inventions" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-mono text-muted-foreground">
              Rick has analyzed the Tessera system and identified {inventions.length} critical improvements.
            </div>
            <button
              onClick={() => refetchInventions()}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {invLoading ? (
            <div className="flex justify-center py-12"><PortalSpinner /></div>
          ) : inventions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm font-mono">
              No inventions available. *burp*
            </div>
          ) : (
            inventions.map((inv, idx) => {
              const sessionResult = submittedInventions[idx];
              const persistentProposal = findCouncilProposal(inv);
              const result: CouncilResult | undefined = sessionResult ?? (persistentProposal ? {
                proposalId: persistentProposal.id,
                status: persistentProposal.status,
                approvalRate: persistentProposal.approvalRate,
                councilNote: persistentProposal.implementationNotes ?? `Grand Council voted on "${persistentProposal.title}" — ${persistentProposal.status} (${(persistentProposal.approvalRate * 100).toFixed(0)}% approval)`,
              } : undefined);
              const isExpanded = expandedIdx === idx;
              const riskColor = RISK_COLORS[inv.riskLevel] || "#888";
              const catIcon = CATEGORY_ICONS[inv.category] || "⚙️";

              return (
                <div
                  key={idx}
                  className="rounded-xl border overflow-hidden transition-all duration-200"
                  style={{ borderColor: result ? (result.status === "approved" ? "#22c55e44" : "#ef444444") : `${RICK_GREEN}22`, background: "rgba(0,255,65,0.03)" }}
                >
                  <div
                    className="flex items-start gap-3 p-4 cursor-pointer"
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{catIcon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold font-mono text-sm" style={{ color: RICK_GREEN }}>{inv.inventionName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono border" style={{ color: riskColor, borderColor: `${riskColor}40`, background: `${riskColor}10` }}>
                          {inv.riskLevel}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white/5 text-muted-foreground border border-white/10">
                          {inv.category}
                        </span>
                        {result && (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-mono border", result.status === "approved" ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-red-400 border-red-500/30 bg-red-500/10")}>
                            {result.status === "approved" ? <CheckCircle2 size={10} className="inline mr-1" /> : <XCircle size={10} className="inline mr-1" />}
                            Council: {result.status}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-1">
                        Targets: <span className="text-foreground/70">{inv.systemMetricTargeted}</span>
                        <span className="mx-2">·</span>
                        Est. improvement: <span style={{ color: RICK_GREEN }}>+{inv.estimatedImprovementPct}%</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className={cn("shrink-0 text-muted-foreground transition-transform mt-1", isExpanded && "rotate-90")} />
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: `${RICK_GREEN}10` }}>
                      <div className="pt-3">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Rick's Rationale</div>
                        <p className="text-[11px] text-foreground/80 leading-relaxed italic font-mono">{inv.rickRationale}</p>
                      </div>

                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Technical Approach</div>
                        <p className="text-[11px] text-foreground/75 leading-relaxed font-mono">{inv.technicalApproach}</p>
                      </div>

                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Expected Impact</div>
                        <p className="text-[11px] font-mono" style={{ color: RICK_PORTAL }}>{inv.expectedImpact}</p>
                      </div>

                      {result ? (
                        <div className="rounded-lg p-3 border" style={{ borderColor: result.status === "approved" ? "#22c55e40" : "#ef444440", background: result.status === "approved" ? "#22c55e10" : "#ef444410" }}>
                          <div className="text-[10px] uppercase tracking-wider mb-1 font-mono" style={{ color: result.status === "approved" ? "#22c55e" : "#ef4444" }}>
                            Council Decision · {(result.approvalRate * 100).toFixed(0)}% approval
                          </div>
                          <p className="text-[11px] font-mono text-foreground/80">{result.councilNote}</p>
                          <div className="text-[10px] text-muted-foreground font-mono mt-1">ID: {result.proposalId.slice(0, 20)}…</div>
                        </div>
                      ) : (
                        <button
                          onClick={() => submitToCouncil(idx)}
                          disabled={submittingIdx === idx}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-mono font-bold transition-all border disabled:opacity-50"
                          style={{ color: RICK_GREEN, borderColor: `${RICK_GREEN}50`, background: `${RICK_GREEN}10` }}
                        >
                          {submittingIdx === idx ? <PortalSpinner /> : <Vote size={12} />}
                          Submit to Grand Council
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {councilProposals.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: `${RICK_GREEN}15` }}>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Vote size={10} />
                Grand Council History · {councilProposals.length} proposal{councilProposals.length !== 1 ? "s" : ""} submitted
              </div>
              <div className="space-y-2">
                {councilProposals.map(p => {
                  const statusColor = p.status === "approved" || p.status === "implemented"
                    ? "#22c55e" : p.status === "rejected" ? "#ef4444" : "#f59e0b";
                  return (
                    <div key={p.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border" style={{ borderColor: `${statusColor}25`, background: `${statusColor}06` }}>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[11px] font-bold truncate" style={{ color: RICK_GREEN }}>{p.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border" style={{ color: statusColor, borderColor: `${statusColor}40`, background: `${statusColor}10` }}>
                            {p.status === "approved" ? <CheckCircle2 size={9} className="inline mr-0.5" /> : p.status === "rejected" ? <XCircle size={9} className="inline mr-0.5" /> : null}
                            {p.status}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">{(p.approvalRate * 100).toFixed(0)}% approval</span>
                          <span className="text-[10px] font-mono text-muted-foreground">· {new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                        {p.implementationNotes && (
                          <p className="text-[10px] font-mono text-foreground/60 mt-1 truncate">{p.implementationNotes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "proposals" && <RickProposalsPanel />}

      {activeTab === "knowledge" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {!knowledgeData ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-400" size={20} /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Vault Entries", value: knowledgeData.vault?.totalEntries ?? "—", icon: Shield, color: "violet" },
                  { label: "Vault Categories", value: knowledgeData.vault?.totalCategories ?? "—", icon: Database, color: "violet" },
                  { label: "Corpus Entries", value: knowledgeData.corpus?.totalEntries ?? "—", icon: BookOpen, color: "cyan" },
                  { label: "Domains", value: knowledgeData.corpus?.uniqueDomains ?? "—", icon: Brain, color: "cyan" },
                ].map(s => (
                  <div key={s.label} className={cn("rounded-xl border p-3 text-center", `border-${s.color}-500/20 bg-${s.color}-500/5`)}>
                    <s.icon size={14} className={cn(`text-${s.color}-400`, "mx-auto mb-1")} />
                    <div className={cn("text-lg font-bold font-mono", `text-${s.color}-400`)}>{s.value}</div>
                    <div className="text-[10px] text-muted-foreground font-mono uppercase">{s.label}</div>
                  </div>
                ))}
              </div>

              {knowledgeData.corpus?.topDomains?.length > 0 && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                  <h3 className="text-xs font-bold font-mono text-violet-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Database size={12} /> Top Knowledge Domains
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {knowledgeData.corpus.topDomains.map((d: { domain: string; count: number }) => (
                      <div key={d.domain} className="flex items-center justify-between px-3 py-2 rounded-lg bg-background/50 border border-white/5">
                        <span className="text-[11px] font-mono text-foreground/80 truncate">{d.domain}</span>
                        <span className="text-[10px] font-mono text-violet-400 ml-2 shrink-0">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {knowledgeData.vault?.sampleEntries?.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <h3 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Shield size={12} /> Sacred Vault Entries (sample)
                  </h3>
                  <div className="space-y-1.5">
                    {knowledgeData.vault.sampleEntries.slice(0, 12).map((e: { id: string; title: string; category: string; frequency?: number }) => (
                      <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/50 border border-white/5">
                        <span className="text-[11px] font-mono text-foreground/80 flex-1 truncate">{e.title}</span>
                        <span className="text-[10px] font-mono text-amber-400/60 shrink-0">{e.category}</span>
                        {e.frequency && <span className="text-[10px] font-mono text-muted-foreground shrink-0">{e.frequency}Hz</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-muted-foreground font-mono text-center">
                Cross-references: {knowledgeData.corpus?.crossReferences ?? 0} · Avg confidence: {(knowledgeData.corpus?.avgConfidence ?? 0).toFixed(1)}%
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "improvements" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {!improvementsData?.improvements ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-cyan-400" size={20} /></div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-center">
                  <TrendingUp size={14} className="text-cyan-400 mx-auto mb-1" />
                  <div className="text-lg font-bold font-mono text-cyan-400">{improvementsData.improvements.overallScore}%</div>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase">Overall Score</div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <Zap size={14} className="text-emerald-400 mx-auto mb-1" />
                  <div className="text-lg font-bold font-mono text-emerald-400">{improvementsData.improvements.totalImprovements}</div>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase">Improvements</div>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                  <Target size={14} className="text-amber-400 mx-auto mb-1" />
                  <div className="text-lg font-bold font-mono text-amber-400">{improvementsData.improvements.totalCycles}</div>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase">Cycles</div>
                </div>
              </div>

              {improvementsData.improvements.weakCategories?.length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <h3 className="text-xs font-bold font-mono text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Target size={12} /> Rick's Targets — Weakest Categories
                  </h3>
                  <div className="space-y-2">
                    {improvementsData.improvements.weakCategories.map((c: { category: string; score: number; trend: string }) => (
                      <div key={c.category} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/50 border border-white/5">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-mono text-foreground/90 truncate">{c.category}</div>
                        </div>
                        <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: c.score > 70 ? "#22c55e" : c.score > 50 ? "#f59e0b" : "#ef4444" }} />
                        </div>
                        <span className="text-[10px] font-mono w-12 text-right" style={{ color: c.score > 70 ? "#22c55e" : c.score > 50 ? "#f59e0b" : "#ef4444" }}>{c.score}%</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-mono border",
                          c.trend === "stable" ? "text-green-400 border-green-500/30 bg-green-500/10" :
                          c.trend === "improving" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                          "text-red-400 border-red-500/30 bg-red-500/10"
                        )}>
                          {c.trend}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {improvementsData.improvements.recentImprovements?.length > 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Zap size={12} /> Recent Improvements
                  </h3>
                  <div className="space-y-1.5">
                    {improvementsData.improvements.recentImprovements.map((imp: { category: string; description: string; timestamp: number }, i: number) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-background/50 border border-white/5">
                        <CheckCircle2 size={10} className="text-emerald-400 shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-mono text-foreground/80 truncate">{imp.description}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{imp.category} · {new Date(imp.timestamp).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "royal" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {!courtData?.court ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-amber-400" size={20} /></div>
          ) : (
            <>
              <div className="rounded-xl border-2 p-5" style={{ borderColor: `${ROYAL_GOLD}40`, background: `linear-gradient(135deg, ${ROYAL_GOLD}06, transparent)` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center border-2" style={{ borderColor: ROYAL_GOLD, background: `${ROYAL_GOLD}15` }}>
                    <span className="text-xl">👑</span>
                  </div>
                  <div>
                    <div className="font-bold font-mono text-sm" style={{ color: ROYAL_GOLD }}>{courtData.court.royalTitle}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{courtData.court.department}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { label: "Consciousness", value: courtData.court.systemOverview?.consciousnessProxy != null ? `${(courtData.court.systemOverview.consciousnessProxy * 100).toFixed(1)}%` : "—", color: "violet" },
                    { label: "AGI Score", value: courtData.court.systemOverview?.agiAvgScore?.toFixed(1) ?? "—", color: "cyan" },
                    { label: "Sovereign", value: courtData.court.systemOverview?.sovereignMastery ?? "—", color: "amber" },
                    { label: "Vault", value: courtData.court.systemOverview?.vaultEntries ?? "—", color: "rose" },
                    { label: "Corpus", value: courtData.court.systemOverview?.corpusEntries ?? "—", color: "emerald" },
                  ].map(s => (
                    <div key={s.label} className={cn("rounded-lg border p-2 text-center", `border-${s.color}-500/20 bg-${s.color}-500/5`)}>
                      <div className={cn("text-sm font-bold font-mono", `text-${s.color}-400`)}>{s.value}</div>
                      <div className="text-[9px] text-muted-foreground font-mono uppercase">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <h3 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Crown size={12} /> Court Roles
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {courtData.court.courtRoles?.map((role: string) => (
                    <div key={role} className="px-3 py-2 rounded-lg bg-background/50 border border-amber-500/10 text-[11px] font-mono text-amber-300/80">
                      {role}
                    </div>
                  ))}
                </div>
              </div>

              {courtData.court.royalFocusInventions?.length > 0 && (
                <div className="rounded-xl border p-4" style={{ borderColor: `${RICK_GREEN}20`, background: `${RICK_GREEN}03` }}>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: RICK_GREEN }}>
                    <FlaskConical size={12} /> Royal Focus Inventions
                  </h3>
                  <div className="space-y-2">
                    {courtData.court.royalFocusInventions.map((inv: { name: string; category: string; impact: number; risk: string }, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/50 border border-white/5">
                        <Zap size={12} style={{ color: ROYAL_GOLD }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold font-mono text-foreground/90 truncate">{inv.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{inv.category} · +{inv.impact}% est.</div>
                        </div>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-mono border",
                          inv.risk === "low" ? "text-green-400 border-green-500/30 bg-green-500/10" :
                          inv.risk === "medium" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                          "text-red-400 border-red-500/30 bg-red-500/10"
                        )}>
                          {inv.risk}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-muted-foreground font-mono text-center">
                Tier: {courtData.court.tier} · Appointed by: {courtData.court.appointedBy} · Last updated: {new Date(courtData.court.lastUpdated).toLocaleString()}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "meeseeks" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] font-mono text-muted-foreground">
              Hyper-specialized single-purpose agents. Spawn, execute, self-destruct.
            </div>
            <button onClick={() => { refetchMeeseeksActive(); refetchMeeseeksMetrics(); }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground">
              <RefreshCw size={12} />
            </button>
          </div>

          {(() => {
            const m = meeseeksMetricsData?.metrics;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Active", value: m?.activeCount ?? 0, icon: Activity, color: "violet" },
                  { label: "Success Rate", value: `${m?.successRate ?? 0}%`, icon: CheckCircle2, color: "emerald" },
                  { label: "Total Spawned", value: m?.totalSpawned ?? 0, icon: Users, color: "cyan" },
                  { label: "Memory Freed", value: `${((m?.totalMemoryFreedKB ?? 0) / 1024).toFixed(1)} MB`, icon: MemoryStick, color: "amber" },
                ].map(s => (
                  <div key={s.label} className={cn("rounded-xl border p-3 text-center", `border-${s.color}-500/20 bg-${s.color}-500/5`)}>
                    <s.icon size={14} className={cn(`text-${s.color}-400`, "mx-auto mb-1")} />
                    <div className={cn("text-lg font-bold font-mono", `text-${s.color}-400`)}>{s.value}</div>
                    <div className="text-[10px] text-muted-foreground font-mono uppercase">{s.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <h3 className="text-xs font-bold font-mono text-violet-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Plus size={12} /> Spawn Meeseeks
            </h3>
            <div className="space-y-2">
              <input
                value={spawnTask}
                onChange={e => setSpawnTask(e.target.value)}
                placeholder="Describe the single-purpose task..."
                className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/40"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={spawnTaskType}
                  onChange={e => setSpawnTaskType(e.target.value)}
                  className="bg-background/50 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-mono text-foreground focus:outline-none focus:border-violet-500/40"
                >
                  {((taskTypesData?.taskTypes || []) as TaskTypeOption[]).map((tt) => (
                    <option key={tt.taskType} value={tt.taskType}>{tt.label}</option>
                  ))}
                  {(!taskTypesData?.taskTypes || taskTypesData.taskTypes.length === 0) && <option value="custom">Custom Task</option>}
                </select>
                <select
                  value={spawnPriority}
                  onChange={e => setSpawnPriority(e.target.value)}
                  className="bg-background/50 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-mono text-foreground focus:outline-none focus:border-violet-500/40"
                >
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical</option>
                </select>
                <input
                  value={spawnCriteria}
                  onChange={e => setSpawnCriteria(e.target.value)}
                  placeholder="Success criteria (required)..."
                  className="bg-background/50 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/40"
                />
              </div>
              <button
                onClick={handleSpawnMeeseeks}
                disabled={!spawnTask.trim() || !spawnCriteria.trim() || isSpawning}
                className="w-full px-3 py-2 rounded-lg text-[11px] font-mono font-bold transition-all border border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSpawning ? <Loader2 size={12} className="animate-spin" /> : <Skull size={12} />}
                {isSpawning ? "Spawning..." : "I'm Mr. Meeseeks! Look at me!"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <h3 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity size={12} /> Active Meeseeks ({meeseeksActiveData?.count ?? 0})
            </h3>
            {(!meeseeksActiveData?.active || meeseeksActiveData.active.length === 0) ? (
              <div className="text-center py-6 text-muted-foreground text-[11px] font-mono">
                No active Meeseeks. Existence is peaceful... for now.
              </div>
            ) : (
              <div className="space-y-2">
                {(meeseeksActiveData.active as ActiveMeeseeks[]).map((m) => {
                  const timeLeft = m.timeRemainingMs ?? (m.meeseeksExpiresAt ? Math.max(0, m.meeseeksExpiresAt - Date.now()) : 0);
                  const ttlPct = m.meeseeksTTL ? Math.min(100, (timeLeft / m.meeseeksTTL) * 100) : 0;
                  const isUrgent = ttlPct < 20;
                  return (
                    <div key={m.id} className={cn("rounded-lg border px-3 py-2.5 bg-background/50", isUrgent ? "border-red-500/30" : "border-white/5")}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold font-mono text-violet-300">{m.name}</span>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-mono border",
                            m.priority === "critical" ? "text-red-400 border-red-500/30 bg-red-500/10" :
                            m.priority === "high" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                            "text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
                          )}>
                            {m.taskType || "custom"}
                          </span>
                          {m.complexity && (
                            <span className={cn("text-[9px] px-1 py-0.5 rounded font-mono border",
                              m.complexity === "extreme" ? "text-red-400 border-red-500/30" :
                              m.complexity === "high" ? "text-amber-400 border-amber-500/30" :
                              "text-emerald-400 border-emerald-500/30"
                            )}>
                              {m.complexity}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Timer size={10} className={isUrgent ? "text-red-400" : "text-muted-foreground"} />
                          <span className={cn("text-[10px] font-mono", isUrgent ? "text-red-400" : "text-muted-foreground")}>
                            {Math.ceil(timeLeft / 1000)}s
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-foreground/70 truncate mb-1.5">{m.meeseeksTask}</div>
                      <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${ttlPct}%`,
                            background: isUrgent ? "#ef4444" : ttlPct < 50 ? "#f59e0b" : "#a855f7",
                          }}
                        />
                      </div>
                      {m.successCriteria && (
                        <div className="text-[9px] text-muted-foreground font-mono mt-1 truncate">
                          Success: {m.successCriteria}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(() => {
            const m = meeseeksMetricsData?.metrics as MeeseeksMetricsResponse | undefined;
            const breakdown: Record<string, TaskTypeBreakdownEntry> = m?.taskTypeBreakdown || {};
            const history: MeeseeksHistoryItem[] = m?.recentHistory || [];
            return (
              <>
                {Object.keys(breakdown).length > 0 && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Target size={12} /> Task Type Breakdown
                    </h3>
                    <div className="space-y-1.5">
                      {Object.entries(breakdown).map(([type, stats]) => (
                        <div key={type} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/50 border border-white/5">
                          <div className="flex-1 min-w-0 text-[11px] font-mono text-foreground/90">{type}</div>
                          <span className="text-[10px] font-mono text-emerald-400">{stats.completed} done</span>
                          {stats.timedOut > 0 && <span className="text-[10px] font-mono text-red-400">{stats.timedOut} expired</span>}
                          <span className="text-[10px] font-mono text-muted-foreground">{stats.total} total</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {history.length > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <h3 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Skull size={12} /> Recent Self-Destructions
                    </h3>
                    <div className="space-y-1.5">
                      {history.slice(0, 10).map((h, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-white/5">
                          {h.reason === "task-completed"
                            ? <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
                            : <AlertTriangle size={10} className="text-red-400 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-mono text-foreground/80 truncate">{h.task}</div>
                            <div className="text-[9px] text-muted-foreground font-mono">
                              {h.name} · {h.taskType} · {(h.lifetimeMs / 1000).toFixed(0)}s · {h.memoryFreedKB}KB freed
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {activeTab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <span className="text-5xl mb-4">🧪</span>
                <div className="font-bold font-mono text-base mb-2" style={{ color: RICK_GREEN }}>Rick Sanchez — C-137</div>
                <p className="text-[12px] text-muted-foreground font-mono max-w-sm leading-relaxed">
                  Interdimensional genius. Inventor. The smartest man in any universe. Ask me about Tessera's weak points, request an invention, or just chat. I've already analyzed the system — and I have opinions.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {["What's the biggest problem with Tessera?", "Invent something for the council", "Show me the system diagnostics", "Who are you?"].map(s => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-[10px] px-2 py-1 rounded font-mono border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5 border" style={{ borderColor: `${RICK_GREEN}40`, background: `${RICK_GREEN}10` }}>
                    <span className="text-sm">🧪</span>
                  </div>
                )}
                <div
                  className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-[12px] font-mono leading-relaxed whitespace-pre-wrap", msg.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm")}
                  style={msg.role === "user"
                    ? { background: `${RICK_PORTAL}20`, color: "rgba(255,255,255,0.9)", border: `1px solid ${RICK_PORTAL}30` }
                    : { background: `${RICK_GREEN}08`, color: "rgba(255,255,255,0.85)", border: `1px solid ${RICK_GREEN}20` }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isStreaming && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5 border" style={{ borderColor: `${RICK_GREEN}40`, background: `${RICK_GREEN}10` }}>
                  <span className="text-sm">🧪</span>
                </div>
                <RickTypingIndicator />
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="shrink-0 border-t p-3" style={{ borderColor: `${RICK_GREEN}15` }}>
            <div className="flex items-end gap-2 rounded-xl border p-2" style={{ borderColor: `${RICK_GREEN}30`, background: `${RICK_GREEN}05` }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Rick anything... or dare him to invent something."
                rows={1}
                className="flex-1 bg-transparent text-[12px] font-mono text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none min-h-[20px] max-h-[120px]"
                style={{ lineHeight: "1.5" }}
                disabled={isStreaming}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="p-2 rounded-lg transition-all shrink-0 disabled:opacity-40"
                style={{ background: `${RICK_GREEN}20`, color: RICK_GREEN }}
              >
                {isStreaming ? <PortalSpinner /> : <Send size={14} />}
              </button>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono text-center mt-1.5">
              Enter to send · Shift+Enter for newline · Rick doesn't follow rules, but you should.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface RickProposalEvidence { metric: string; value: string }
interface RickProposalItem {
  id: string;
  title: string;
  problem: string;
  evidence: RickProposalEvidence[];
  proposedChange: string;
  expectedImpact: string;
  risk: "low" | "medium" | "high";
  effortHours: number;
  category: string;
  state: "pending-review" | "approved" | "rejected" | "implemented";
  reviewerReason?: string;
  generatedAt: number;
  decidedAt?: number;
  source: "llm" | "deterministic";
  truthfulnessScore?: number;
}
interface ProposalsResponse {
  ok: boolean;
  proposals: RickProposalItem[];
  counts: Record<string, number>;
  lastGeneratedAt: number;
  capacity: number;
}

const PROPOSAL_GOLD = "#fbbf24";
const PROPOSAL_RISK: Record<string, string> = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" };
const PROPOSAL_STATE_COLOR: Record<string, string> = {
  "pending-review": "#fbbf24",
  approved: "#22c55e",
  rejected: "#ef4444",
  implemented: "#22d3ee",
};

function RickProposalsPanel() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/rick/proposals"],
    queryFn: async () => {
      const r = await fetch("/api/rick/proposals");
      return r.json() as Promise<ProposalsResponse>;
    },
    refetchInterval: 30000,
  });

  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "pending-review" | "approved" | "rejected" | "implemented">("all");

  async function generate() {
    setGenerating(true);
    try {
      await fetch("/api/rick/proposals/generate", { method: "POST" });
      await refetch();
    } finally {
      setGenerating(false);
    }
  }

  async function approve(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/rick/proposals/${id}/approve`, { method: "POST" });
      await refetch();
    } finally { setBusyId(null); }
  }

  async function reject(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/rick/proposals/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      setRejectingId(null);
      setRejectReason("");
      await refetch();
    } finally { setBusyId(null); }
  }

  async function markImplementedFn(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/rick/proposals/${id}/implemented`, { method: "POST" });
      await refetch();
    } finally { setBusyId(null); }
  }

  const proposals = data?.proposals ?? [];
  const counts = data?.counts ?? {};
  const lastGen = data?.lastGeneratedAt ?? 0;
  const approvedQueue = proposals.filter(p => p.state === "approved");
  const filtered = stateFilter === "all" ? proposals : proposals.filter(p => p.state === stateFilter);
  const filterStates: ("all" | "pending-review" | "approved" | "rejected" | "implemented")[] = [
    "all", "pending-review", "approved", "rejected", "implemented",
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
      <div className="rounded-xl border p-4 flex items-start gap-4 flex-wrap" style={{ borderColor: `${PROPOSAL_GOLD}40`, background: `${PROPOSAL_GOLD}08` }}>
        <div className="flex-1 min-w-[220px]">
          <div className="font-bold font-mono text-sm" style={{ color: PROPOSAL_GOLD }}>
            Rick&apos;s 5 System Improvement Proposals
          </div>
          <div className="text-[11px] text-muted-foreground font-mono mt-1">
            Rick reads live diagnostics and proposes 5 concrete, evidence-backed changes. You approve or reject each one — nothing ships without your sign-off.
          </div>
          {lastGen > 0 && (
            <div className="text-[10px] font-mono text-muted-foreground mt-1">
              Last generated: {new Date(lastGen).toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex gap-2 text-[10px] font-mono flex-wrap justify-end">
            {(["pending-review", "approved", "rejected", "implemented"] as const).map(k => (
              <span key={k} className="px-1.5 py-0.5 rounded border" style={{ color: PROPOSAL_STATE_COLOR[k], borderColor: `${PROPOSAL_STATE_COLOR[k]}40`, background: `${PROPOSAL_STATE_COLOR[k]}10` }}>
                {k.replace("-", " ")}: {counts[k] ?? 0}
              </span>
            ))}
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-mono font-bold transition-all border disabled:opacity-50"
            style={{ color: PROPOSAL_GOLD, borderColor: `${PROPOSAL_GOLD}60`, background: `${PROPOSAL_GOLD}15` }}
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {proposals.length === 0 ? "Generate 5 Proposals" : "Refill Pending Slots"}
          </button>
        </div>
      </div>

      {approvedQueue.length > 0 && (
        <div className="rounded-xl border p-3" style={{ borderColor: "#22c55e40", background: "#22c55e08" }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
            <div className="font-bold font-mono text-xs" style={{ color: "#22c55e" }}>
              Approved Improvements Queue · {approvedQueue.length}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {approvedQueue.map(p => (
              <div key={`q-${p.id}`} className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="font-mono text-[11px] font-bold" style={{ color: "#bbf7d0" }}>{p.title}</div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  {p.category} · ~{p.effortHours}h · risk: {p.risk}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">Filter:</span>
        {filterStates.map(k => {
          const count = k === "all" ? proposals.length : (counts[k] ?? 0);
          const active = stateFilter === k;
          const c = k === "all" ? PROPOSAL_GOLD : (PROPOSAL_STATE_COLOR[k] ?? "#888");
          return (
            <button
              key={k}
              onClick={() => setStateFilter(k)}
              className="text-[10px] font-mono px-2 py-1 rounded border transition-all"
              style={{
                color: active ? "#0a0a0a" : c,
                borderColor: `${c}60`,
                background: active ? c : `${c}10`,
                fontWeight: active ? 700 : 500,
              }}
            >
              {k.replace("-", " ")} ({count})
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={20} style={{ color: PROPOSAL_GOLD }} /></div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm font-mono">
          No proposals yet. Hit &ldquo;Generate 5 Proposals&rdquo; to have Rick analyze the system.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs font-mono">
          No proposals match filter &ldquo;{stateFilter.replace("-", " ")}&rdquo;.
        </div>
      ) : (
        filtered.map((p) => {
          const stateColor = PROPOSAL_STATE_COLOR[p.state] ?? "#888";
          const riskColor = PROPOSAL_RISK[p.risk] ?? "#888";
          const isPending = p.state === "pending-review";
          const isApproved = p.state === "approved";
          return (
            <div
              key={p.id}
              className="rounded-xl border p-4 space-y-3"
              style={{ borderColor: `${stateColor}40`, background: `${stateColor}06` }}
            >
              <div className="flex items-start gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-bold font-mono text-sm" style={{ color: PROPOSAL_GOLD }}>{p.title}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono border" style={{ color: stateColor, borderColor: `${stateColor}40`, background: `${stateColor}10` }}>
                      {p.state.replace("-", " ")}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono border" style={{ color: riskColor, borderColor: `${riskColor}40`, background: `${riskColor}10` }}>
                      risk: {p.risk}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white/5 text-muted-foreground border border-white/10">
                      {p.category}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white/5 text-muted-foreground border border-white/10">
                      ~{p.effortHours}h
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white/5 text-muted-foreground border border-white/10">
                      src: {p.source}
                    </span>
                    {typeof p.truthfulnessScore === "number" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white/5 text-muted-foreground border border-white/10">
                        truth: {(p.truthfulnessScore * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Problem</div>
                <p className="text-[11px] font-mono text-foreground/80 leading-relaxed">{p.problem}</p>
              </div>

              {p.evidence.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Evidence</div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.evidence.map((e, i) => (
                      <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/5">
                        <span className="text-muted-foreground">{e.metric}</span> = <span style={{ color: PROPOSAL_GOLD }}>{e.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Proposed Change</div>
                <p className="text-[11px] font-mono text-foreground/80 leading-relaxed">{p.proposedChange}</p>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Expected Impact</div>
                <p className="text-[11px] font-mono" style={{ color: "#22d3ee" }}>{p.expectedImpact}</p>
              </div>

              {p.reviewerReason && (
                <div className="rounded-lg border p-2 text-[11px] font-mono" style={{ borderColor: "#ef444440", background: "#ef444410", color: "#fca5a5" }}>
                  <div className="text-[10px] uppercase tracking-wider mb-0.5 text-muted-foreground">Reject reason</div>
                  {p.reviewerReason}
                </div>
              )}

              {isPending && rejectingId === p.id && (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="(Optional) Why are you rejecting this?"
                    className="w-full text-[11px] font-mono p-2 rounded-lg bg-black/40 border border-white/10 focus:outline-none focus:border-white/30 resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(p.id)}
                      disabled={busyId === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border disabled:opacity-50"
                      style={{ color: "#ef4444", borderColor: "#ef444460", background: "#ef444410" }}
                    >
                      {busyId === p.id ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />} Confirm reject
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason(""); }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-mono border border-white/10 text-muted-foreground hover:text-foreground"
                    >Cancel</button>
                  </div>
                </div>
              )}

              {isPending && rejectingId !== p.id && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => approve(p.id)}
                    disabled={busyId === p.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border disabled:opacity-50"
                    style={{ color: "#22c55e", borderColor: "#22c55e60", background: "#22c55e10" }}
                  >
                    {busyId === p.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Approve
                  </button>
                  <button
                    onClick={() => { setRejectingId(p.id); setRejectReason(""); }}
                    disabled={busyId === p.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border disabled:opacity-50"
                    style={{ color: "#ef4444", borderColor: "#ef444460", background: "#ef444410" }}
                  >
                    <XCircle size={10} /> Reject
                  </button>
                </div>
              )}

              {isApproved && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => markImplementedFn(p.id)}
                    disabled={busyId === p.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border disabled:opacity-50"
                    style={{ color: "#22d3ee", borderColor: "#22d3ee60", background: "#22d3ee10" }}
                  >
                    {busyId === p.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Mark as Implemented
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
