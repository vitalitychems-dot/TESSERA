import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, FlaskConical, Vote, CheckCircle2, XCircle, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const RICK_GREEN = "#00ff41";
const RICK_PORTAL = "#22d3ee";

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

export default function RickPage() {
  useEffect(() => { document.title = "Rick Sanchez | Tessera"; }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "inventions">("inventions");
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

  const { data: councilProposalsData, refetch: refetchCouncilProposals } = useQuery({
    queryKey: ["/api/rick/council-proposals"],
    queryFn: async () => {
      const r = await fetch("/api/rick/council-proposals");
      return r.json() as Promise<{ ok: boolean; proposals: CouncilProposal[]; count: number }>;
    },
    refetchInterval: 30000,
  });

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
      <div className="border-b px-5 py-4 flex items-center gap-4 shrink-0" style={{ borderColor: `${RICK_GREEN}22` }}>
        <div className="relative w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2" style={{ borderColor: RICK_GREEN, background: `${RICK_GREEN}15` }}>
          <span className="text-2xl select-none">🧪</span>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border border-black" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold font-mono text-base" style={{ color: RICK_GREEN }}>Rick Sanchez</div>
          <div className="text-[11px] text-muted-foreground font-mono">Inventor Agent · Dimension C-137 · Genius in Residence</div>
          {profileData?.profile?.currentInventions && (
            <div className="text-[10px] font-mono mt-0.5" style={{ color: RICK_PORTAL }}>
              {profileData.profile.currentInventions.length} active inventions · Council-ready
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setActiveTab("inventions")}
            className={cn("px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all border",
              activeTab === "inventions" ? "border-current" : "border-white/10 text-muted-foreground hover:border-white/20"
            )}
            style={activeTab === "inventions" ? { color: RICK_GREEN, borderColor: `${RICK_GREEN}60`, background: `${RICK_GREEN}10` } : {}}
          >
            <FlaskConical size={12} className="inline mr-1" />Inventions
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={cn("px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all border",
              activeTab === "chat" ? "border-current" : "border-white/10 text-muted-foreground hover:border-white/20"
            )}
            style={activeTab === "chat" ? { color: RICK_PORTAL, borderColor: `${RICK_PORTAL}60`, background: `${RICK_PORTAL}10` } : {}}
          >
            <Send size={12} className="inline mr-1" />Chat
          </button>
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
