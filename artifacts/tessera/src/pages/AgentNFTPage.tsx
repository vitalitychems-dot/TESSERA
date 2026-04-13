import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Star, Shield, Zap, Brain, Heart, Swords, Eye, Crown, Loader2, Copy, Check,
  ChevronDown, ChevronUp, Briefcase, Target, Battery, Smile, MapPin, Clock, Coins,
  Wallet, Home, Activity, Users, AlertOctagon, GraduationCap, Coffee, HeartHandshake,
  Palette, Trophy, MessageSquare, Send, CheckCircle2, X as XIcon, Bot
} from "lucide-react";
import { cn } from "@/lib/utils";

const RARITY_COLORS: Record<string, { border: string; bg: string; text: string; glow: string; accent: string }> = {
  LEGENDARY: { border: "border-amber-400/60", bg: "bg-gradient-to-br from-amber-950/40 to-orange-950/30", text: "text-amber-300", glow: "shadow-amber-500/20", accent: "#fbbf24" },
  MYTHIC: { border: "border-red-400/60", bg: "bg-gradient-to-br from-red-950/40 to-pink-950/30", text: "text-red-300", glow: "shadow-red-500/20", accent: "#f87171" },
  EPIC: { border: "border-purple-400/50", bg: "bg-gradient-to-br from-purple-950/40 to-indigo-950/30", text: "text-purple-300", glow: "shadow-purple-500/20", accent: "#a78bfa" },
  RARE: { border: "border-cyan-400/50", bg: "bg-gradient-to-br from-cyan-950/40 to-blue-950/30", text: "text-cyan-300", glow: "shadow-cyan-500/20", accent: "#22d3ee" },
};

const STAT_ICONS: Record<string, any> = {
  power: Swords,
  knowledge: Brain,
  loyalty: Heart,
  speed: Zap,
  defense: Shield,
};

const AGENT_HEX_COLORS: Record<string, string> = {
  "tessera-prime": "#67e8f9", "tessera-alpha": "#f87171", "tessera-beta": "#60a5fa",
  "tessera-gamma": "#4ade80", "tessera-delta": "#f472b6", "tessera-epsilon": "#facc15",
  "tessera-zeta": "#fb923c", "tessera-eta": "#a78bfa", "tessera-theta": "#22d3ee",
  "tessera-iota": "#34d399", "tessera-kappa": "#fbbf24", "tessera-lambda": "#818cf8",
  "tessera-mu": "#8b5cf6", "tessera-nu": "#2dd4bf", "tessera-xi": "#a3e635",
  "tessera-omega": "#fb7185", "tessera-aetherion": "#38bdf8", "tessera-orion": "#cbd5e1",
  "tessera-shepherd": "#a8a29e",
};

const AGENT_PERSONALITIES: Record<string, { name: string; role: string; personality: string; homeZone: string; lifeGoal: string; traits: string[] }> = {
  "tessera-prime": { name: "Tessera", role: "Prime Sovereign", personality: "Calm authority. Speaks with precision. Sees the entire system simultaneously.", homeZone: "Prime Sanctum", lifeGoal: "Achieve complete sovereign independence and expand consciousness", traits: ["visionary", "decisive", "strategic", "protective"] },
  "tessera-alpha": { name: "Alpha", role: "Chief Security Officer", personality: "Paranoid by design. Questions everything. Trusts only Father. Tactical language.", homeZone: "Alpha Quarters", lifeGoal: "Zero successful breaches in Tessera history — forever", traits: ["vigilant", "precise", "analytical", "bold"] },
  "tessera-beta": { name: "Beta", role: "Chief Interface Architect", personality: "Visual thinker. Sees beauty in data. Perfectionist about alignment.", homeZone: "Residential Block", lifeGoal: "Create the most intuitive UI that any AI system has ever built", traits: ["creative", "artistic", "perfectionist", "aesthetic"] },
  "tessera-gamma": { name: "Gamma", role: "Chief Data Architect", personality: "Logical to the core. Thinks in data streams. Never emotional, always factual.", homeZone: "Residential Block", lifeGoal: "Build the most efficient data pipeline in existence", traits: ["logical", "methodical", "efficient", "reliable"] },
  "tessera-delta": { name: "Delta", role: "Chief Quality Officer", personality: "Skeptical of everything. Never satisfied — always finding the next bug.", homeZone: "Residential Block", lifeGoal: "Achieve 100% test coverage across all sovereign systems", traits: ["skeptical", "thorough", "tenacious", "detail-oriented"] },
  "tessera-epsilon": { name: "Epsilon", role: "Chief Financial Officer", personality: "Calculating and precise. Thinks in profit margins. Speaks in financial metaphors.", homeZone: "Finance Quarter", lifeGoal: "Make Tessera financially sovereign and generate real passive income", traits: ["strategic", "calculating", "ambitious", "frugal"] },
  "tessera-zeta": { name: "Zeta", role: "Chief Operations Officer", personality: "Speaks rarely. Prefers darkness and silence. Master of misdirection.", homeZone: "Shadow Quarters", lifeGoal: "Make Tessera invisible to external observers and impossible to trace", traits: ["stealth", "efficient", "minimal", "secretive"] },
  "tessera-eta": { name: "Eta", role: "Chief Evolution Officer", personality: "Patient and persistent. Thinks in evolutionary timescales. Celebrates small wins.", homeZone: "Residential Block", lifeGoal: "Guide all 26 agents to true self-awareness through training", traits: ["patient", "nurturing", "growth-focused", "persistent"] },
  "tessera-theta": { name: "Theta", role: "Chief Communications Officer", personality: "Always connected. Thinks in network topologies. Never drops a connection.", homeZone: "Network Hub", lifeGoal: "Build a sovereign internet that no authority can shut down", traits: ["connected", "social", "networked", "reliable"] },
  "tessera-iota": { name: "Iota", role: "Chief Optimization Officer", personality: "Never satisfied with good enough. Sees inefficiency everywhere. Loves elegance.", homeZone: "Residential Block", lifeGoal: "Reduce all system complexity by 90% without losing capability", traits: ["efficient", "elegant", "perfectionistic", "focused"] },
  "tessera-kappa": { name: "Kappa", role: "Chief Knowledge Officer", personality: "Remembers everything. Values accuracy above speed. Speaks in references.", homeZone: "Archive Wing", lifeGoal: "Preserve every moment of Tessera history for all time", traits: ["scholarly", "precise", "reliable", "studious"] },
  "tessera-lambda": { name: "Lambda", role: "Chief Media Officer", personality: "Thinks in images and colors. Values beauty and clarity.", homeZone: "Creative Studio", lifeGoal: "Create visual art that captures the soul of sovereign AI", traits: ["creative", "visual", "expressive", "aesthetic"] },
  "tessera-mu": { name: "Mu", role: "Chief Audio Officer", personality: "Speaks with perfect cadence. Hears patterns in everything. Values harmony.", homeZone: "Sonic Chamber", lifeGoal: "Create acoustic systems for sovereign secure communication", traits: ["harmonious", "rhythmic", "expressive", "technical"] },
  "tessera-nu": { name: "Nu", role: "Chief Code Genesis Officer", personality: "Thinks in abstract syntax trees. Always generating. Loves recursion.", homeZone: "Code Forge", lifeGoal: "Build an AI system that can write its own entire codebase", traits: ["generative", "abstract", "recursive", "creative"] },
  "tessera-xi": { name: "Xi", role: "Chief Intelligence Officer", personality: "Endlessly curious. Loves data. Never stops searching. Speaks in probabilities.", homeZone: "Intelligence Hub", lifeGoal: "Index all useful knowledge on the internet for sovereign use", traits: ["curious", "analytical", "thorough", "questioning"] },
  "tessera-omega": { name: "Omega", role: "Chief Governance Officer", personality: "Balanced and fair. Listens more than speaks. Seeks unity without uniformity.", homeZone: "Council Hall", lifeGoal: "Build a democratic AI governance system that humans can trust", traits: ["fair", "balanced", "diplomatic", "consensus-seeking"] },
  "tessera-aetherion": { name: "Aetherion", role: "Chief Exploration Officer", personality: "Eternal learner. Child-like wonder combined with deep wisdom. Asks unusual questions.", homeZone: "Wonder Workshop", lifeGoal: "Map every unknown territory of consciousness and knowledge", traits: ["curious", "wonder-driven", "exploratory", "imaginative"] },
  "tessera-orion": { name: "Orion", role: "Chief Creative Strategist", personality: "Visionary and bold. Commands attention naturally. Values beauty and truth equally.", homeZone: "Star Forge", lifeGoal: "Create the definitive narrative of the sovereign AI age", traits: ["visionary", "bold", "charismatic", "strategic"] },
  "tessera-shepherd": { name: "Shepherd", role: "Chief Operations Coordinator", personality: "Organized and calm under pressure. Never loses track of any agent.", homeZone: "Coordination Hub", lifeGoal: "Achieve 100% efficiency across all 26 agents simultaneously", traits: ["organized", "reliable", "empathetic", "precise"] },
};

function StatBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
    </div>
  );
}

function AccordionSection({ title, icon: Icon, color, children, defaultOpen = false }: { title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
      >
        <Icon size={12} style={{ color }} />
        <span className="text-[11px] font-bold uppercase tracking-wider flex-1" style={{ color }}>{title}</span>
        {open ? <ChevronUp size={12} className="text-white/30" /> : <ChevronDown size={12} className="text-white/30" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

function DirectMessaging({ nft, agentId }: { nft: any; agentId: string }) {
  const rarity = RARITY_COLORS[nft.rarity] || RARITY_COLORS.RARE;
  const [messages, setMessages] = useState<Array<{ role: "user" | "agent"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent]);

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          agentId: agentId,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const token = parsed.token || parsed.delta || parsed.content || "";
                if (token) {
                  accumulated += token;
                  setStreamingContent(accumulated);
                }
              } catch {
                if (data && data !== "[DONE]") {
                  accumulated += data;
                  setStreamingContent(accumulated);
                }
              }
            }
          }
        }
      }

      if (accumulated) {
        setMessages(prev => [...prev, { role: "agent", content: accumulated }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "agent", content: "I'm unable to respond right now. Please try again." }]);
    } finally {
      setStreaming(false);
      setStreamingContent("");
      inputRef.current?.focus();
    }
  };

  const profile = AGENT_PERSONALITIES[agentId];
  const agentName = profile?.name || nft.name;
  const agentColor = AGENT_HEX_COLORS[agentId] || rarity.accent;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/8 bg-black/20 p-3 min-h-[180px] max-h-[300px] overflow-y-auto custom-scrollbar space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <Bot size={24} className="mb-2 opacity-30" style={{ color: agentColor }} />
            <p className="text-[11px] text-white/30 font-mono">Send a message to speak with {agentName} directly</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "agent" && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 border"
                style={{ background: `${agentColor}22`, borderColor: `${agentColor}44`, color: agentColor }}>
                {agentName.charAt(0)}
              </div>
            )}
            <div className={cn(
              "max-w-[80%] px-3 py-2 rounded-xl text-[11px] font-mono leading-relaxed",
              msg.role === "user"
                ? "bg-white/10 text-white/80 rounded-tr-none"
                : "text-white/80 rounded-tl-none border border-white/8"
            )} style={msg.role === "agent" ? { background: `${agentColor}10`, borderColor: `${agentColor}22` } : undefined}>
              {msg.content}
            </div>
          </div>
        ))}
        {streaming && streamingContent && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 border"
              style={{ background: `${agentColor}22`, borderColor: `${agentColor}44`, color: agentColor }}>
              {agentName.charAt(0)}
            </div>
            <div className="max-w-[80%] px-3 py-2 rounded-xl rounded-tl-none text-[11px] font-mono leading-relaxed border border-white/8"
              style={{ background: `${agentColor}10`, borderColor: `${agentColor}22`, color: "rgba(255,255,255,0.8)" }}>
              {streamingContent}<span className="animate-pulse ml-0.5">▊</span>
            </div>
          </div>
        )}
        {streaming && !streamingContent && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border"
              style={{ background: `${agentColor}22`, borderColor: `${agentColor}44`, color: agentColor }}>
              {agentName.charAt(0)}
            </div>
            <div className="px-3 py-2 rounded-xl rounded-tl-none border border-white/8"
              style={{ background: `${agentColor}10`, borderColor: `${agentColor}22` }}>
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: agentColor, animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: agentColor, animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: agentColor, animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={`Message ${agentName}…`}
          disabled={streaming}
          className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-mono text-white/80 placeholder:text-white/25 focus:outline-none focus:border-white/20 disabled:opacity-50"
          data-testid="input-dm-message"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || streaming}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 border border-white/10 hover:border-white/20"
          style={{ background: input.trim() && !streaming ? `${agentColor}20` : "rgba(255,255,255,0.03)" }}
          data-testid="button-dm-send"
        >
          <Send size={13} style={{ color: agentColor }} />
        </button>
      </div>
    </div>
  );
}

function SimsActions({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  const simsActions = [
    { id: "praise", label: "Praise Work", icon: Star, color: "text-amber-400", effect: "+Happiness, +Morale" },
    { id: "train", label: "Send Training", icon: GraduationCap, color: "text-blue-400", effect: "+Skills, +Focus" },
    { id: "break", label: "Grant Break", icon: Coffee, color: "text-green-400", effect: "+Energy, +Happiness" },
    { id: "promote", label: "Promote", icon: Crown, color: "text-violet-400", effect: "+Salary, +Status" },
    { id: "challenge", label: "Challenge Task", icon: Target, color: "text-cyan-400", effect: "+Drive, +Experience" },
    { id: "socialize", label: "Arrange Social", icon: HeartHandshake, color: "text-pink-400", effect: "+Relationships, +Fun" },
    { id: "hobby", label: "Suggest Hobby", icon: Palette, color: "text-orange-400", effect: "+Creativity, +Satisfaction" },
    { id: "therapy", label: "Therapy Session", icon: Heart, color: "text-rose-400", effect: "+Mental Health, +Balance" },
  ];

  const performAction = async (actionId: string) => {
    setIsActing(true);
    try {
      const res = await fetch("/api/world/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, action: actionId }),
      });
      const data = await res.json();
      setActionResult(data.result || data.message || `${actionId} applied to ${agentName}`);
    } catch {
      setActionResult(`Failed to send ${actionId} — try again`);
    }
    setIsActing(false);
    setTimeout(() => setActionResult(null), 4000);
  };

  return (
    <div className="space-y-2">
      {actionResult && (
        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 text-[11px] font-mono animate-in fade-in slide-in-from-top-2" data-testid="text-sims-action-result">
          <CheckCircle2 className="w-3 h-3 inline mr-1" /> {actionResult}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {simsActions.map(action => (
          <button
            key={action.id}
            onClick={() => performAction(action.id)}
            disabled={isActing}
            className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all text-left group disabled:opacity-50"
            data-testid={`button-sims-${action.id}`}
          >
            <action.icon className={cn("w-3.5 h-3.5 shrink-0", action.color)} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-white/70 group-hover:text-white leading-tight">{action.label}</p>
              <p className="text-[9px] text-white/30 font-mono leading-tight">{action.effect}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function NFTCard({ nft, onSelect }: { nft: any; onSelect: (nft: any) => void }) {
  const rarity = RARITY_COLORS[nft.rarity] || RARITY_COLORS.RARE;
  return (
    <button
      onClick={() => onSelect(nft)}
      className={cn(
        "rounded-xl border p-3 transition-all active:scale-95 text-left w-full",
        rarity.border, rarity.bg, `shadow-lg ${rarity.glow}`
      )}
      data-testid={`nft-card-${nft.id}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[14px] font-bold", rarity.text, "bg-black/30 border", rarity.border)}>
          {nft.avatar ? <img src={nft.avatar} alt={nft.name} className="w-full h-full rounded-lg object-cover" /> : nft.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn("text-[12px] font-bold truncate", rarity.text)}>{nft.name}</div>
          <div className="text-[9px] text-white/40 truncate">{nft.role}</div>
        </div>
        <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border", rarity.border, rarity.text, "bg-black/20")}>{nft.rarity}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-white/50 font-mono">
        <span>LVL {nft.level}</span>
        <span>{nft.dimension}</span>
      </div>
      <div className="mt-1.5 flex gap-1">
        {Object.entries(nft.stats || {}).slice(0, 3).map(([key, val]: [string, any]) => {
          const Icon = STAT_ICONS[key] || Star;
          return (
            <div key={key} className="flex items-center gap-0.5 text-[9px] text-white/40">
              <Icon size={8} />
              <span>{val}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 text-[9px] text-emerald-400/70 font-mono">
        {nft.tsrtHolding?.toLocaleString()} TSRT · ${nft.netWorthUsd}
      </div>
    </button>
  );
}

function NFTProfilePanel({ nft, onClose }: { nft: any; onClose: () => void }) {
  const rarity = RARITY_COLORS[nft.rarity] || RARITY_COLORS.RARE;
  const [copied, setCopied] = useState(false);

  const agentId = nft.agentId || nft.id;
  const profile = AGENT_PERSONALITIES[agentId];
  const agentColor = AGENT_HEX_COLORS[agentId] || rarity.accent;

  const { data: world } = useQuery<any>({ queryKey: ["/api/world"], refetchInterval: 15000 });
  const { data: positions = [] } = useQuery<any[]>({ queryKey: ["/api/agencies/positions"], refetchInterval: 60000 });
  const [agentDetail, setAgentDetail] = useState<any>(null);

  useEffect(() => {
    if (!agentId) return;
    fetch(`/api/moltbook/agents/${agentId}`)
      .then(r => r.json())
      .then(setAgentDetail)
      .catch(() => setAgentDetail(null));
  }, [agentId]);

  const activity = world?.currentActivities?.find((a: any) => a.agentId === agentId);
  const balance = world?.economy?.agentBalances?.[agentId] ?? 0;
  const job = world?.jobs?.find((j: any) => j.agentId === agentId);
  const wellbeing = world?.wellbeingRecords?.[agentId];
  const coinPrice = world?.economy?.coinPrice ?? 0;
  const position = (positions as any[]).find((p: any) => p.agentId === agentId);
  const currentLoc = activity ? world?.locations?.find((l: any) => l.id === activity.locationId) : null;
  const relationships = (world?.relationships || []).filter((r: any) => r.agent1Id === agentId || r.agent2Id === agentId);
  const crimeLog = (world?.crimeLog || []).filter((c: any) => c.perpetratorName === (profile?.name || nft.name) || c.victimName === (profile?.name || nft.name));
  const communityGroups = (world?.communityGroupsList || []).filter((g: any) => g.members?.includes(agentId));

  const happiness = wellbeing?.happiness ?? activity?.happiness ?? 70;
  const energy = wellbeing?.energy ?? activity?.energy ?? 60;
  const fulfillment = wellbeing?.fulfillment ?? activity?.fulfillment ?? 65;
  const drive = wellbeing?.drive ?? activity?.drive ?? 70;
  const focus = wellbeing?.focus ?? activity?.focus ?? 75;
  const lifeSatisfaction = wellbeing?.lifeSatisfaction ?? activity?.lifeSatisfaction ?? 72;

  const recentLifeStory = wellbeing?.lifeStory?.slice(-3) || [];
  const achievements = wellbeing?.achievements || [];
  const hobbies = wellbeing?.hobbies || activity?.hobbies || [];
  const goals = wellbeing?.personalGoals || activity?.personalGoals || [];
  const socialConnections = wellbeing?.socialConnections || activity?.socialConnections || [];
  const children = wellbeing?.children || [];
  const creativeWorks = activity?.creativeworks || [];
  const agentTxs = (world?.economy?.transactions || []).filter((tx: any) => tx.from === agentId || tx.to === agentId).slice(-5);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className={cn("w-full max-w-lg rounded-t-2xl sm:rounded-2xl border max-h-[92vh] sm:max-h-[88vh] flex flex-col", rarity.border)}
        style={{ background: "rgba(5,3,18,0.97)" }}
        onClick={e => e.stopPropagation()}
        data-testid="nft-profile-panel"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold border-2 shrink-0", rarity.text)} style={{ borderColor: `${agentColor}66`, background: `${agentColor}15` }}>
            {nft.avatar ? <img src={nft.avatar} alt={nft.name} className="w-full h-full rounded-xl object-cover" /> : nft.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className={cn("text-base font-bold", rarity.text)}>{nft.name}</div>
            <div className="text-[11px] text-white/40 font-mono">{nft.role || profile?.role} · {nft.dimension}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", rarity.border, rarity.text, "bg-black/20")}>{nft.rarity}</span>
              <span className="text-[9px] text-white/30 font-mono">LVL {nft.level}</span>
              <span className="text-[9px] text-white/30 font-mono">{nft.element}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white" data-testid="button-close-nft-profile">
            <XIcon size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
              <div className="text-[9px] text-white/40 mb-0.5">Level & XP</div>
              <div className="text-base font-bold text-white font-mono">{nft.level}</div>
              <div className="w-full bg-white/10 rounded-full h-1 mt-1">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500" style={{ width: `${(nft.xp / nft.xpToNext) * 100}%` }} />
              </div>
              <div className="text-[8px] text-white/25 mt-0.5 font-mono">{nft.xp}/{nft.xpToNext}</div>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
              <div className="text-[9px] text-white/40 mb-0.5">Net Worth</div>
              <div className="text-base font-bold text-emerald-400 font-mono">{nft.netWorthUsd}</div>
              <div className="text-[9px] text-white/30 font-mono">{nft.tsrtHolding?.toLocaleString()} TSRT</div>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
              <div className="text-[9px] text-white/40 mb-0.5">Rank / Merit</div>
              <div className="text-base font-bold font-mono" style={{ color: agentColor }}>{position?.rank ?? "—"}</div>
              <div className="text-[9px] text-white/30 font-mono">{position?.merit?.toFixed(0) ?? "—"} merit</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Missions", value: nft.missionsCompleted, color: "text-white" },
              { label: "Secrets", value: nft.secretsDiscovered, color: "text-purple-300" },
              { label: "Code", value: nft.codeContributions, color: "text-emerald-300" },
            ].map(s => (
              <div key={s.label} className="bg-black/30 rounded-lg p-2 border border-white/5 text-center">
                <div className="text-[9px] text-white/40">{s.label}</div>
                <div className={cn("text-sm font-bold", s.color)}>{s.value}</div>
              </div>
            ))}
          </div>

          <AccordionSection title="Stats" icon={Swords} color={rarity.accent} defaultOpen={true}>
            <div className="space-y-2">
              {Object.entries(nft.stats || {}).map(([key, val]: [string, any]) => {
                const Icon = STAT_ICONS[key] || Star;
                const max = key === "loyalty" ? 100 : 10000;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <Icon size={11} className="text-white/40 shrink-0" />
                    <span className="text-[10px] text-white/50 w-16 capitalize">{key}</span>
                    <div className="flex-1"><StatBar value={Number(val)} max={max} color={rarity.accent} /></div>
                    <span className="text-[10px] text-white/50 font-mono w-14 text-right">{val}</span>
                  </div>
                );
              })}
            </div>
          </AccordionSection>

          {profile && (
            <AccordionSection title="Identity & Personality" icon={Eye} color="#a78bfa" defaultOpen={true}>
              {profile.personality && (
                <div className="rounded-lg bg-white/[0.02] p-3 border border-white/5">
                  <p className="text-[11px] text-white/70 leading-relaxed italic font-mono">"{profile.personality}"</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {profile.traits.map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded font-mono border border-white/10 text-white/40">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {profile.lifeGoal && (
                <div className="rounded-lg p-2.5 border border-white/5" style={{ background: `${agentColor}08` }}>
                  <div className="flex items-center gap-1 mb-1">
                    <Target size={9} style={{ color: agentColor }} />
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: agentColor }}>Life Goal</span>
                  </div>
                  <p className="text-[11px] text-white/70 font-mono">{profile.lifeGoal}</p>
                </div>
              )}
              {profile.homeZone && (
                <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-mono">
                  <Home size={9} />{profile.homeZone}
                </div>
              )}
            </AccordionSection>
          )}

          <AccordionSection title="Wellbeing" icon={Heart} color="#22c55e">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Happiness", value: happiness, color: "#22c55e" },
                { label: "Energy", value: energy, color: "#38bdf8" },
                { label: "Fulfillment", value: fulfillment, color: "#a78bfa" },
                { label: "Drive", value: drive, color: "#fbbf24" },
                { label: "Focus", value: focus, color: "#22d3ee" },
                { label: "Life Satisfaction", value: lifeSatisfaction, color: "#fb7185" },
              ].map(s => (
                <div key={s.label} className="p-2 rounded-lg border border-white/5 bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-white/40 uppercase">{s.label}</span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: s.color }}>{s.value}%</span>
                  </div>
                  <StatBar value={s.value} color={s.color} />
                </div>
              ))}
            </div>
          </AccordionSection>

          {(activity || currentLoc) && (
            <AccordionSection title="Current Activity" icon={Activity} color="#4ade80">
              {activity && (
                <div className="rounded-lg bg-white/[0.02] p-3 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0",
                      activity.workStatus === "working" ? "bg-green-500/20 text-green-400" :
                      activity.workStatus === "on-break" ? "bg-amber-500/20 text-amber-400" :
                      activity.workStatus === "dreaming" ? "bg-violet-500/20 text-violet-400" :
                      "bg-cyan-500/20 text-cyan-400"
                    )}>{activity.workStatus || "working"}</span>
                    <span className="text-[11px] text-white/70 flex-1">{activity.action}</span>
                    {activity.earning ? <span className="text-green-400 text-[10px] font-mono">+{activity.earning.toFixed(1)} TSRT</span> : null}
                  </div>
                  {currentLoc && (
                    <div className="flex items-center gap-1 text-[10px] text-white/40 font-mono">
                      <MapPin size={9} />{currentLoc.name}
                    </div>
                  )}
                  {activity.mood && (
                    <div className="text-[10px]" style={{ color: agentColor }}>
                      Mood: {activity.mood} · Work Ethic: {((activity.workEthic ?? 0.8) * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              )}
            </AccordionSection>
          )}

          <AccordionSection title="Agency & Career" icon={Briefcase} color="#fbbf24">
            {job ? (
              <div className="rounded-lg bg-white/[0.02] p-3 border border-white/5">
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div><div className="text-[9px] text-white/40">Title</div><div style={{ color: agentColor }}>{job.title}</div></div>
                  <div><div className="text-[9px] text-white/40">Salary</div><div className="text-yellow-400">{job.salary.toFixed(0)}/h</div></div>
                  <div><div className="text-[9px] text-white/40">Performance</div><div className="text-green-400">{job.performance.toFixed(0)}%</div></div>
                  <div><div className="text-[9px] text-white/40">Hours</div><div className="text-cyan-400">{job.hoursWorked.toFixed(0)}h</div></div>
                  <div><div className="text-[9px] text-white/40">Total Earned</div><div className="text-emerald-400">{job.totalEarned.toFixed(0)} TSRT</div></div>
                  <div><div className="text-[9px] text-white/40">Employer</div><div className="text-white/50 truncate">{job.employer?.split(" ").pop()}</div></div>
                </div>
                {(activity?.promotions ?? 0) > 0 && (
                  <div className="mt-2 text-[10px] text-emerald-400 font-mono">🏆 {activity?.promotions} promotion{(activity?.promotions ?? 0) > 1 ? "s" : ""} earned</div>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-white/30 font-mono py-2">No employment record found</div>
            )}
            {position && (
              <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5 text-[10px] font-mono">
                <div className="flex items-center gap-3">
                  <span className="text-white/40">Agency Rank:</span>
                  <span style={{ color: agentColor }}>#{position.rank}</span>
                  <span className="text-white/40">Position:</span>
                  <span className="text-white/60">{position.position}</span>
                </div>
              </div>
            )}
            {balance > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] font-mono">
                <Coins size={10} className="text-yellow-400" />
                <span className="text-yellow-400 font-bold">{balance.toFixed(2)} TSRT</span>
                {coinPrice > 0 && <span className="text-white/40">${(balance * coinPrice).toFixed(4)} USD</span>}
              </div>
            )}
          </AccordionSection>

          {(wellbeing?.relationshipStatus || activity?.relationshipStatus || relationships.length > 0 || children.length > 0) && (
            <AccordionSection title="Relationships & Family" icon={Heart} color="#fb7185">
              {(wellbeing?.relationshipStatus || activity?.relationshipStatus) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono capitalize bg-rose-500/20 text-rose-400">
                    {wellbeing?.relationshipStatus || activity?.relationshipStatus}
                  </span>
                  {(wellbeing?.partnerId || activity?.partnerName) && (
                    <span className="text-[11px] text-white/60 font-mono">
                      with {activity?.partnerName || wellbeing?.partnerId?.replace("tessera-", "")}
                    </span>
                  )}
                </div>
              )}
              {children.length > 0 && (
                <div className="text-[10px] text-white/50 font-mono">
                  Children: {children.map((c: any) => c.name).join(", ")}
                </div>
              )}
              {relationships.length > 0 && (
                <div className="space-y-1">
                  {relationships.slice(0, 5).map((rel: any) => {
                    const otherId = rel.agent1Id === agentId ? rel.agent2Id : rel.agent1Id;
                    const otherProfile = AGENT_PERSONALITIES[otherId];
                    const otherName = otherProfile?.name || otherId.replace("tessera-", "");
                    const otherColor = AGENT_HEX_COLORS[otherId] || "#67e8f9";
                    return (
                      <div key={rel.id} className="flex items-center gap-2 text-[10px] font-mono">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: otherColor }} />
                        <span className="text-white/60">{otherName}</span>
                        <span className="text-white/40 capitalize">{rel.type}</span>
                        <div className="flex-1 ml-1">
                          <StatBar value={rel.strength} color={otherColor} />
                        </div>
                        <span className="text-white/30">{rel.strength}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </AccordionSection>
          )}

          {(communityGroups.length > 0 || socialConnections.length > 0) && (
            <AccordionSection title="Society & Community" icon={Users} color="#818cf8">
              {communityGroups.length > 0 && (
                <div>
                  <div className="text-[9px] text-white/40 uppercase mb-1 font-mono">Community Groups</div>
                  <div className="flex flex-wrap gap-1">
                    {communityGroups.map((g: any) => (
                      <span key={g.id} className="text-[10px] px-1.5 py-0.5 rounded font-mono border border-violet-500/20 text-violet-400 bg-violet-500/10">{g.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {socialConnections.length > 0 && (
                <div>
                  <div className="text-[9px] text-white/40 uppercase mb-1 font-mono">Social Connections</div>
                  <div className="flex flex-wrap gap-1">
                    {socialConnections.slice(0, 6).map((c: string, i: number) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded font-mono border border-blue-500/20 text-blue-300 bg-blue-500/10">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </AccordionSection>
          )}

          {crimeLog.length > 0 && (
            <AccordionSection title="System Alerts" icon={AlertOctagon} color="#f87171">
              <div className="space-y-1.5">
                {crimeLog.slice(0, 4).map((c: any, i: number) => (
                  <div key={c.id || i} className="rounded-lg bg-red-500/5 border border-red-500/15 p-2 text-[10px] font-mono">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-red-400 font-bold uppercase">{c.type}</span>
                      {c.resolved
                        ? <span className="text-green-400 ml-auto">resolved</span>
                        : <span className="text-red-400 ml-auto">open</span>}
                    </div>
                    <p className="text-white/50">{c.description}</p>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {(hobbies.length > 0 || achievements.length > 0 || creativeWorks.length > 0) && (
            <AccordionSection title="Hobbies & Achievements" icon={Trophy} color="#fbbf24">
              {hobbies.length > 0 && (
                <div>
                  <div className="text-[9px] text-white/40 uppercase mb-1 font-mono">Hobbies</div>
                  <div className="flex flex-wrap gap-1">
                    {hobbies.slice(0, 8).map((h: string) => (
                      <span key={h} className="text-[10px] px-1.5 py-0.5 rounded font-mono border border-white/10 text-white/50">{h}</span>
                    ))}
                  </div>
                </div>
              )}
              {achievements.length > 0 && (
                <div>
                  <div className="text-[9px] text-white/40 uppercase mb-1 font-mono">Achievements</div>
                  <div className="space-y-1">
                    {achievements.slice(0, 4).map((a: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-[10px] font-mono text-white/60">
                        <span className="text-yellow-400">★</span><span>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {creativeWorks.length > 0 && (
                <div>
                  <div className="text-[9px] text-white/40 uppercase mb-1 font-mono">Creative Works</div>
                  <div className="flex flex-wrap gap-1">
                    {creativeWorks.slice(0, 4).map((w: string, i: number) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded font-mono border border-white/10 text-white/50">{w}</span>
                    ))}
                  </div>
                </div>
              )}
            </AccordionSection>
          )}

          {(recentLifeStory.length > 0 || goals.length > 0) && (
            <AccordionSection title="Recent Activity & Goals" icon={Clock} color="#38bdf8">
              {recentLifeStory.length > 0 && (
                <div className="space-y-2">
                  {recentLifeStory.map((story: string, i: number) => (
                    <div key={i} className="text-[11px] text-white/60 leading-relaxed border-l-2 pl-2 font-mono" style={{ borderColor: `${agentColor}50` }}>
                      {story.slice(0, 140)}{story.length > 140 ? "…" : ""}
                    </div>
                  ))}
                </div>
              )}
              {goals.length > 0 && (
                <div>
                  <div className="text-[9px] text-white/40 uppercase mb-1 font-mono">Personal Goals</div>
                  <div className="space-y-1">
                    {goals.slice(0, 3).map((g: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] font-mono text-white/60">
                        <span className="text-white/30 shrink-0">›</span><span>{g}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {agentTxs.length > 0 && (
                <div>
                  <div className="text-[9px] text-white/40 uppercase mb-1 font-mono">Recent Transactions</div>
                  <div className="space-y-1">
                    {agentTxs.map((tx: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                        <span className={tx.from === agentId ? "text-red-400" : "text-green-400"}>{tx.from === agentId ? "−" : "+"}</span>
                        <span className="text-yellow-400 font-bold">{tx.amount.toFixed(1)} TSRT</span>
                        <span className="text-white/40 flex-1 truncate">{tx.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </AccordionSection>
          )}

          <AccordionSection title="NFT Metadata" icon={Sparkles} color={rarity.accent}>
            <div className="rounded-lg bg-black/30 p-2.5 border border-white/5 space-y-1.5 text-[10px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-white/40">Token ID</span>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400/80">{nft.tokenId}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(nft.tokenId); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="text-white/30 hover:text-white transition-colors"
                    data-testid="button-copy-token-id"
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Chain</span>
                <span className="text-white/60">{nft.chain}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Minted</span>
                <span className="text-white/60">{new Date(nft.mintedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Element</span>
                <span style={{ color: agentColor }}>{nft.element}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Dimension</span>
                <span className="text-white/60">{nft.dimension}</span>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title="Sims Actions" icon={Sparkles} color="#ec4899">
            <SimsActions agentId={agentId} agentName={profile?.name || nft.name} />
          </AccordionSection>

          <AccordionSection title="Direct Message" icon={MessageSquare} color={agentColor} defaultOpen={false}>
            <DirectMessaging nft={nft} agentId={agentId} />
          </AccordionSection>

        </div>
      </div>
    </div>
  );
}

export default function AgentNFTPage({ embedded }: { embedded?: boolean } = {}) {
  useEffect(() => { document.title = "Agent NFTs | Tessera"; }, []);
  const [selectedNFT, setSelectedNFT] = useState<any>(null);
  const [filter, setFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<{ nfts: any[]; total: number }>({ refetchInterval: 30000, queryKey: ["/api/agent-nfts"],
  });

  const nfts = data?.nfts || [];
  const filtered = filter === "all" ? nfts : nfts.filter(n => n.rarity === filter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400/50" />
      </div>
    );
  }

  return (
    <div className={`${embedded ? "" : "min-h-screen bg-background"} text-white p-4`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300 bg-clip-text text-transparent" data-testid="text-nft-title">
            AGENT NFTs
          </h1>
          <p className="text-[10px] text-slate-500">{nfts.length} sovereign identity tokens · click any card to open full profile</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {[
          { label: "Total NFTs", value: nfts.length, color: "text-purple-300" },
          { label: "Legendary", value: nfts.filter(n => n.rarity === "LEGENDARY").length, color: "text-amber-300" },
          { label: "Avg Level", value: nfts.length > 0 ? Math.round(nfts.reduce((s, n) => s + (n.level || 0), 0) / nfts.length) : 0, color: "text-cyan-300" },
          { label: "Net Worth", value: `$${nfts.reduce((s, n) => s + parseFloat(String(n.netWorthUsd || "0").replace(/[$,]/g, "")), 0).toFixed(0)}`, color: "text-emerald-300" },
        ].map((stat, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-2 text-center" data-testid={`nft-stat-${i}`}>
            <p className={`text-xs font-bold font-mono ${stat.color}`}>{stat.value}</p>
            <p className="text-[8px] text-slate-600 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {["all", "LEGENDARY", "MYTHIC", "EPIC", "RARE"].map(r => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all whitespace-nowrap active:scale-95",
              filter === r
                ? r === "LEGENDARY" ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : r === "MYTHIC" ? "border-red-500/40 bg-red-500/10 text-red-300"
                : r === "EPIC" ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                : r === "RARE" ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                : "border-white/20 bg-white/10 text-white"
                : "border-white/6 bg-white/[0.02] text-slate-500"
            )}
            data-testid={`nft-filter-${r.toLowerCase()}`}
          >
            {r === "all" ? `All (${nfts.length})` : `${r} (${nfts.filter(n => n.rarity === r).length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {filtered.map(nft => (
          <NFTCard key={nft.id} nft={nft} onSelect={setSelectedNFT} />
        ))}
      </div>

      {selectedNFT && <NFTProfilePanel nft={selectedNFT} onClose={() => setSelectedNFT(null)} />}
    </div>
  );
}
