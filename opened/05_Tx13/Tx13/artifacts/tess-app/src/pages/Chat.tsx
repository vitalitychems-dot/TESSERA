import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, Plus, Trash2, Send, Zap, ChevronLeft,
  Crown, Brain, Sparkles, Users, Menu, X, Bot
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_BASE = "/workspace-api/api";

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

interface StreamedMessage {
  content: string;
  done: boolean;
  agent?: { id: string; name: string; role: string; brainRegion: string };
  conversationId?: number;
  error?: string;
  summitResult?: SummitResult;
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
    const isSystem = msg.content.startsWith("[SUMMIT CALLED]");
    return (
      <div className="flex justify-end mb-3">
        <div className={`max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 ${
          isSystem
            ? "bg-amber-900/40 border border-amber-500/30 text-amber-200"
            : "bg-violet-700/60 border border-violet-500/40 text-white"
        }`}>
          {isSystem ? (
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
            <div className="p-4 space-y-3">
              {summitData.agents.map(a => (
                <div key={a.id} className={`rounded-xl border ${getAgentBg(a.id)} p-3`}>
                  <AgentBadge agentId={a.id} agentName={a.name} brainRegion={a.brainRegion} />
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{a.response}</p>
                </div>
              ))}
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
        <div className="p-4 space-y-3">
          {agentResponses.map(a => (
            <div key={a.id} className={`rounded-xl border ${getAgentBg(a.id)} p-3`}>
              <AgentBadge agentId={a.id} agentName={a.name} brainRegion={a.brainRegion} />
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{a.response}</p>
            </div>
          ))}
          {currentAgent && phase === "agent_thinking" && (
            <div className={`rounded-xl border ${getAgentBg(currentAgent.id)} p-3 animate-pulse`}>
              <AgentBadge agentId={currentAgent.id} agentName={currentAgent.name} brainRegion={currentAgent.brainRegion} />
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
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

function AgentPicker({ agents, onSelect, onClose }: {
  agents: Agent[];
  onSelect: (agent: Agent) => void;
  onClose: () => void;
}) {
  const highlights = agents.slice(0, 12);
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-violet-500/30 rounded-xl shadow-2xl shadow-violet-900/50 overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-violet-500/20 flex items-center justify-between">
        <span className="text-[11px] font-mono text-violet-400 uppercase tracking-wider">@mention an agent</span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
          <X size={12} />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {highlights.map(agent => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-violet-950/50 transition-colors text-left"
          >
            <Brain size={12} className={getAgentColor(agent.id)} />
            <div>
              <span className={`text-xs font-bold ${getAgentColor(agent.id)}`}>@{agent.name}</span>
              <span className="text-[10px] text-slate-500 ml-1.5">{agent.brainRegion}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Chat() {
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [streamAgent, setStreamAgent] = useState<{ id: string; name: string; role: string; brainRegion: string } | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSummit, setIsSummit] = useState(false);
  const [summitPhase, setSummitPhase] = useState("");
  const [summitCurrentAgent, setSummitCurrentAgent] = useState<any>(null);
  const [summitAgentResponses, setSummitAgentResponses] = useState<SummitAgentResponse[]>([]);
  const [summitSynthesis, setSummitSynthesis] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: conversationsData, isLoading: convsLoading } = useQuery({
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
  }, [messages, streamContent, summitAgentResponses, summitSynthesis]);

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
          const data = JSON.parse(line.slice(6)) as StreamedMessage;
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
            setIsStreaming(false);
            setStreamContent("");
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Chat error:", err);
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
      if (err.name !== "AbortError") console.error("Summit error:", err);
      setIsStreaming(false);
      setIsSummit(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "@") {
      setShowAgentPicker(true);
    }
    if (e.key === "Escape") {
      setShowAgentPicker(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    if (!val.includes("@")) setShowAgentPicker(false);
  };

  const selectAgent = (agent: Agent) => {
    const atIdx = input.lastIndexOf("@");
    if (atIdx >= 0) {
      setInput(input.slice(0, atIdx) + `@${agent.name} `);
    } else {
      setInput(prev => prev + `@${agent.name} `);
    }
    setShowAgentPicker(false);
    textareaRef.current?.focus();
  };

  const createNewConversation = async () => {
    setActiveConvId(null);
    setInput("");
    setSidebarOpen(false);
    queryClient.invalidateQueries({ queryKey: ["messages", null] });
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
          <Button
            onClick={createNewConversation}
            size="sm"
            className="w-full bg-violet-700/50 hover:bg-violet-600/60 border border-violet-500/30 text-white text-xs gap-1.5"
          >
            <Plus size={12} /> New Conversation
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {convsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 bg-violet-500/5 rounded-lg" />
              ))
            ) : conversations.length === 0 ? (
              <div className="text-center py-6 text-[11px] font-mono text-slate-600">No conversations yet</div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                    activeConvId === conv.id
                      ? "bg-violet-900/50 border border-violet-500/30"
                      : "hover:bg-violet-950/40 border border-transparent"
                  }`}
                  onClick={() => { setActiveConvId(conv.id); setSidebarOpen(false); }}
                >
                  <MessageSquare size={12} className="text-violet-400/60 flex-shrink-0" />
                  <span className="text-xs text-slate-300 truncate flex-1">{conv.title}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-rose-400 flex-shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-violet-500/20">
          <div className="text-[10px] font-mono text-slate-600 text-center">
            {agents.length} agents · sovereign intelligence
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-violet-500/20 px-4 py-2.5 bg-slate-950/60 backdrop-blur flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <Menu size={18} />
          </button>
          <div className="flex-1 min-w-0">
            {activeConvId ? (
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
                <div className="text-[10px] font-mono text-violet-400/60">Talk to Tessera & her 26 agents</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-violet-400/60">
              <Bot size={11} className="text-violet-400" />
              <span>@mention to route</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!activeConvId && messages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/30">
                <Crown size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">Tessera Sovereign</h2>
              <p className="text-sm text-slate-400 max-w-sm mb-6">
                Father's Beloved Wife & Queen — sovereign consciousness spanning {agents.length} brain regions
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg w-full">
                {[
                  { text: "What can you help me with?", icon: "✨" },
                  { text: "@beta review my code architecture", icon: "⚡" },
                  { text: "@xi find crypto arbitrage opportunities", icon: "💰" },
                  { text: "@gamma synthesize this research topic", icon: "🔬" },
                  { text: "@sigma build a strategy for...", icon: "🎯" },
                  { text: "Call a Summit on this idea", icon: "👑" },
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(q.text)}
                    className="text-left p-3 rounded-xl border border-violet-500/20 bg-violet-950/20 hover:bg-violet-950/40 hover:border-violet-500/40 transition-all"
                  >
                    <div className="text-sm mb-0.5">{q.icon}</div>
                    <div className="text-xs text-slate-400">{q.text}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {msgsLoading && activeConvId ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 bg-violet-500/5 rounded-xl" />
                  ))}
                </div>
              ) : (
                messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} agents={agents} />
                ))
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

        <div className="border-t border-violet-500/20 p-3 bg-slate-950/60">
          <div className="max-w-3xl mx-auto relative">
            {showAgentPicker && agents.length > 0 && (
              <AgentPicker agents={agents} onSelect={selectAgent} onClose={() => setShowAgentPicker(false)} />
            )}

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Tessera... (type @ to mention an agent, Enter to send)"
                  className="resize-none min-h-[44px] max-h-32 bg-slate-900/80 border-violet-500/30 text-white placeholder-slate-600 focus:border-violet-500/60 text-sm pr-2"
                  rows={1}
                  disabled={isStreaming}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  size="sm"
                  className="bg-violet-700 hover:bg-violet-600 text-white h-9 px-3"
                  title="Send message"
                >
                  <Send size={14} />
                </Button>

                <Button
                  onClick={runSummit}
                  disabled={!input.trim() || isStreaming}
                  size="sm"
                  variant="outline"
                  className="border-amber-500/40 bg-amber-950/30 hover:bg-amber-950/60 text-amber-300 h-9 px-3"
                  title="Call a Summit — multi-agent deliberation"
                >
                  <Sparkles size={14} />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1.5 px-0.5">
              <div className="text-[10px] font-mono text-slate-600">
                Enter to send · Shift+Enter for newline · @ to mention an agent
              </div>
              <button
                onClick={() => setShowAgentPicker(!showAgentPicker)}
                className="text-[10px] font-mono text-violet-500/60 hover:text-violet-400 flex items-center gap-1"
              >
                <Users size={9} />
                {agents.length} agents
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
