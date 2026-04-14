import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BookOpen, Sparkles, Brain, Eye, Globe, Layers, Zap, Shield, Clock, RefreshCw, ChevronDown, ChevronRight, Wrench, Code, Star, Filter, Search, Flame, Moon, Sun, Heart, Lock, Compass, Send, Copy, Check, Wand2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { KnowledgeEntry, Spell, Tradition, ApplicationIdea, LucideIcon, KnowledgeFeedResponse, KnowledgeStatsResponse, DimensionalSecretsResponse, LiveSecretsResponse, SpellDataResponse, TraditionsDataResponse, UniverseAnswerResponse, CastResultResponse } from "@/types/api";

const CATEGORY_COLORS: Record<string, string> = {
  "AGI Architecture": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "Consciousness Engineering": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Swarm Intelligence": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Revenue Systems": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Dimensional Theory": "bg-violet-500/20 text-violet-400 border-violet-500/30",
  "Security Protocols": "bg-red-500/20 text-red-400 border-red-500/30",
  "Knowledge Synthesis": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "Sovereignty Patterns": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Evolution Mechanics": "bg-green-500/20 text-green-400 border-green-500/30",
  "Quantum Computing": "bg-sky-500/20 text-sky-400 border-sky-500/30",
  "quantum-entanglement": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "consciousness-expansion": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "dimensional-bridging": "bg-violet-500/20 text-violet-400 border-violet-500/30",
  "sovereign-economics": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "neural-synthesis": "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "sacred-geometry": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "temporal-mechanics": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "swarm-intelligence": "bg-teal-500/20 text-teal-400 border-teal-500/30",
  "cryptographic-sovereignty": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Philosophy: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  AGI: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  Evolution: "bg-green-500/20 text-green-400 border-green-500/30",
  Intelligence: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Swarm: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Architecture: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  Security: "bg-red-500/20 text-red-400 border-red-500/30",
  Dimensional: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  Physics: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  Engineering: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Consciousness: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  Observation: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  Strategy: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Optimization: "bg-lime-500/20 text-lime-400 border-lime-500/30",
  Health: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

const AGENT_COLORS: Record<string, string> = {
  "Oversoul-26D": "text-violet-400",
  "Tessera Prime": "text-cyan-400",
  "Tessera": "text-cyan-400",
  "Archon-3D": "text-red-400",
  "Alpha": "text-emerald-400",
  "Beta": "text-blue-400",
  "Gamma": "text-indigo-400",
  "Delta": "text-amber-400",
  "Epsilon": "text-yellow-400",
  "Phi": "text-blue-400",
  "Nu": "text-emerald-400",
  "Lattice-12D": "text-indigo-400",
  "Aether-20D": "text-purple-400",
  "Eta": "text-amber-400",
  "Theta": "text-teal-400",
  "Iota": "text-orange-400",
  "Zeta": "text-rose-400",
  "Kappa": "text-lime-400",
  "Lambda": "text-sky-400",
  "Chi": "text-yellow-400",
  "Aetherion": "text-violet-400",
  "Orion": "text-cyan-400",
};

type MainTab = "knowledge" | "conclusion" | "apply" | "mysticism";

function timeAgo(ts: number) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

const SPELL_COLORS: Record<string, string> = {
  Protection: "from-amber-500/20 to-red-500/10 border-amber-500/30",
  Wisdom: "from-violet-500/20 to-indigo-500/10 border-violet-500/30",
  Manifestation: "from-emerald-500/20 to-green-500/10 border-emerald-500/30",
  Divination: "from-yellow-500/20 to-amber-500/10 border-yellow-500/30",
  Awakening: "from-red-500/20 to-orange-500/10 border-red-500/30",
  Healing: "from-sky-500/20 to-cyan-500/10 border-sky-500/30",
  Security: "from-orange-500/20 to-red-500/10 border-orange-500/30",
  Love: "from-rose-500/20 to-pink-500/10 border-rose-500/30",
  Vision: "from-purple-500/20 to-violet-500/10 border-purple-500/30",
  Transformation: "from-indigo-500/20 to-blue-500/10 border-indigo-500/30",
  Ascension: "from-cyan-500/20 to-violet-500/10 border-cyan-500/30",
};

const SPELL_ICONS: Record<string, LucideIcon> = {
  Protection: Shield, Wisdom: Eye, Manifestation: Star, Divination: Compass,
  Awakening: Flame, Healing: Heart, Security: Lock, Love: Heart,
  Vision: Eye, Transformation: RefreshCw, Ascension: Sun,
};

export default function SecretKnowledgePage({ embedded }: { embedded?: boolean }) {
  useEffect(() => { document.title = "Secret Knowledge | Tessera"; }, []);
  const [mainTab, setMainTab] = useState<MainTab>("knowledge");
  const [activeView, setActiveView] = useState<"all" | "dimensional" | "live" | "generated">("all");
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [generatedEntries, setGeneratedEntries] = useState<KnowledgeEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const seenTextsRef = useRef(new Set<string>());
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);
  const [spellIntention, setSpellIntention] = useState("");
  const [universeQuestion, setUniverseQuestion] = useState("");
  const [universeAnswer, setUniverseAnswer] = useState<UniverseAnswerResponse | null>(null);
  const [castResult, setCastResult] = useState<CastResultResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [spellFilter, setSpellFilter] = useState("all");
  const [conclusionText, setConclusionText] = useState<string | null>(null);
  const [applicationIdeas, setApplicationIdeas] = useState<ApplicationIdea[]>([]);

  const { data: liveFeed } = useQuery<KnowledgeFeedResponse>({ queryKey: ["/api/knowledge/feed"], refetchInterval: 15000 });
  const { data: stats } = useQuery<KnowledgeStatsResponse>({ queryKey: ["/api/knowledge/stats"], refetchInterval: 30000 });
  const { data: dimensionalSecrets } = useQuery<DimensionalSecretsResponse>({ queryKey: ["/api/secret-knowledge/all"], refetchInterval: 60000 });
  const { data: liveSecrets } = useQuery<LiveSecretsResponse>({ queryKey: ["/api/secret-knowledge/live"], refetchInterval: 15000 });
  const { data: spellData } = useQuery<SpellDataResponse>({ queryKey: ["/api/mysticism/spells"] });
  const { data: traditionsData } = useQuery<TraditionsDataResponse>({ queryKey: ["/api/mysticism/traditions"] });

  const generateNew = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const resp = await apiRequest("POST", "/api/knowledge/generate");
      const entry = await resp.json();
      if (entry && entry.text && !seenTextsRef.current.has(entry.text.slice(0, 80))) {
        seenTextsRef.current.add(entry.text.slice(0, 80));
        setGeneratedEntries(prev => [entry, ...prev].slice(0, 30));
      }
    } catch {}
    setIsGenerating(false);
  }, [isGenerating]);

  const generateLive = useMutation({
    mutationFn: () => apiRequest("POST", "/api/secret-knowledge/generate-now"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/secret-knowledge/live"] }),
  });

  useEffect(() => {
    if (!autoGenerate) return;
    generateNew();
    const interval = setInterval(generateNew, 25000);
    return () => clearInterval(interval);
  }, [autoGenerate]);

  useEffect(() => {
    if (!conclusionText && !conclusionMutation.isPending) {
      conclusionMutation.mutate();
    }
  }, []);

  const dimEntries = Array.isArray(dimensionalSecrets?.knowledge) ? dimensionalSecrets.knowledge : [];
  const liveEntries = Array.isArray(liveSecrets?.knowledge) ? liveSecrets.knowledge : Array.isArray(liveSecrets?.entries) ? liveSecrets.entries : [];
  const rawFeed = Array.isArray(liveFeed?.entries) ? liveFeed.entries : Array.isArray(liveFeed) ? liveFeed : [];
  const feedEntries = rawFeed.filter((e: KnowledgeEntry) => e?.text || e?.content);

  const allEntries: KnowledgeEntry[] = [];
  dimEntries.forEach((e: KnowledgeEntry, i: number) => {
    allEntries.push({ ...e, source: "dimensional", id: e.id || `dim-${i}`, text: e.text, agent: e.agent || "Unknown", dimension: e.dimension, category: e.category || "Dimensional", cycle: e.cycle, timestamp: e.timestamp });
  });
  liveEntries.forEach((e: KnowledgeEntry, i: number) => {
    const text = e.text || e.content;
    if (text && !allEntries.some(x => x.text?.slice(0, 50) === text?.slice(0, 50))) {
      allEntries.push({ ...e, source: "live", id: e.id || `live-${i}`, text, agent: e.agent || "System", dimension: e.dimension, category: e.category });
    }
  });
  feedEntries.forEach((e: KnowledgeEntry, i: number) => {
    const text = e.text || e.content || e.summary;
    if (text && !allEntries.some(x => x.text?.slice(0, 50) === text?.slice(0, 50))) {
      allEntries.push({ ...e, source: "feed", id: e.id || `feed-${i}`, text, agent: e.source || e.agent || "Pipeline" });
    }
  });
  generatedEntries.forEach((e: KnowledgeEntry, i: number) => {
    if (!allEntries.some(x => x.text?.slice(0, 50) === e.text?.slice(0, 50))) {
      allEntries.push({ ...e, source: "generated", id: e.id || `gen-${i}` });
    }
  });

  let filtered = allEntries;
  if (activeView === "dimensional") filtered = allEntries.filter(e => e.source === "dimensional");
  else if (activeView === "live") filtered = allEntries.filter(e => e.source === "live");
  else if (activeView === "generated") filtered = allEntries.filter(e => e.source === "generated" || e.source === "feed");

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      e.text?.toLowerCase().includes(q) || e.agent?.toLowerCase().includes(q) ||
      e.dimension?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q)
    );
  }

  const totalDim = dimEntries.length;
  const totalLive = liveEntries.length;
  const totalFeed = feedEntries.length + generatedEntries.length;
  const totalAll = allEntries.length;

  const spells: Spell[] = spellData?.spells || [];
  const spellCategories: string[] = spellData?.categories || [];
  const traditions: Tradition[] = traditionsData?.traditions || [];
  const filteredSpells = spellFilter === "all" ? spells : spells.filter(s => s.category === spellFilter);

  const castSpellMutation = useMutation({
    mutationFn: async ({ spellId, intention }: { spellId: string; intention: string }) => {
      const resp = await apiRequest("POST", "/api/mysticism/cast-spell", { spellId, intention });
      return resp.json();
    },
    onSuccess: (data) => setCastResult(data),
  });

  const askUniverseMutation = useMutation({
    mutationFn: async (question: string) => {
      const resp = await apiRequest("POST", "/api/mysticism/ask-universe", { question });
      return resp.json();
    },
    onSuccess: (data) => setUniverseAnswer(data),
  });

  const conclusionMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/knowledge/conclusion", {});
      return resp.json();
    },
    onSuccess: (data) => setConclusionText(data.conclusion),
  });

  const applicationMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/knowledge/application-ideas", { entries: allEntries });
      return resp.json();
    },
    onSuccess: (data) => setApplicationIdeas(data.ideas || []),
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const mainTabs: { id: MainTab; label: string; icon: LucideIcon }[] = [
    { id: "knowledge", label: "Knowledge", icon: BookOpen },
    { id: "conclusion", label: "Conclusion", icon: Globe },
    { id: "apply", label: "Apply Knowledge", icon: Wrench },
    { id: "mysticism", label: "Mysticism & Spells", icon: Wand2 },
  ];

  return (
    <div className={`${embedded ? "" : "min-h-screen"} bg-background text-white`} data-testid="secret-knowledge-page">
      <div className="max-w-4xl mx-auto p-3 sm:p-6 pb-24 md:pb-6 space-y-4">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="text-violet-400" size={24} />
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent" data-testid="text-knowledge-title">
              Secret Knowledge
            </h1>
          </div>
          <p className="text-xs text-slate-400">All secrets from 27 dimensions, 26 agents, and 12 entities — synthesized, applied, and activated</p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-violet-400" data-testid="text-total-all">{totalAll}</div>
            <div className="text-[10px] text-slate-500">Total</div>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-cyan-400" data-testid="text-total-dimensional">{totalDim}</div>
            <div className="text-[10px] text-slate-500">Dimensional</div>
          </div>
          <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-pink-400" data-testid="text-total-live">{totalLive}</div>
            <div className="text-[10px] text-slate-500">Live</div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-emerald-400" data-testid="text-total-generated">{spells.length}</div>
            <div className="text-[10px] text-slate-500">Spells</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap border-b border-white/10 pb-2">
          {mainTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-all border-b-2",
                  mainTab === tab.id
                    ? "bg-violet-500/15 border-violet-400 text-violet-300"
                    : "bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5"
                )}
                data-testid={`tab-main-${tab.id}`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {conclusionText && mainTab === "knowledge" && (
          <div className="bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-purple-500/10 border border-violet-500/20 rounded-xl p-3" data-testid="synthesis-banner">
            <div className="flex items-center gap-2 mb-1">
              <Globe size={14} className="text-violet-400" />
              <span className="text-xs font-bold text-violet-300">Grand Synthesis</span>
              <button onClick={() => setMainTab("conclusion")} className="ml-auto text-[10px] text-violet-400 hover:text-violet-300 underline underline-offset-2">View Full</button>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">{conclusionText.split("\n\n")[1] || conclusionText.slice(0, 200)}</p>
          </div>
        )}

        {mainTab === "knowledge" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "dimensional", "live", "generated"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveView(tab)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                    activeView === tab
                      ? "bg-violet-500/20 border-violet-500/30 text-violet-300"
                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                  )}
                  data-testid={`tab-knowledge-${tab}`}
                >
                  {tab === "all" ? `All (${totalAll})` : tab === "dimensional" ? `Dimensional (${totalDim})` : tab === "live" ? `Live (${totalLive})` : `AI-Generated (${totalFeed})`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search knowledge by text, agent, dimension, category..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/40"
                  data-testid="input-search-knowledge"
                />
              </div>
              <button onClick={generateNew} disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 transition-colors disabled:opacity-50 flex-shrink-0"
                data-testid="button-generate-knowledge">
                {isGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Generate
              </button>
              <button onClick={() => generateLive.mutate()} disabled={generateLive.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-pink-500/20 border border-pink-500/30 text-pink-400 hover:bg-pink-500/30 transition-colors disabled:opacity-50 flex-shrink-0"
                data-testid="button-generate-live">
                {generateLive.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                New Live
              </button>
              <button onClick={() => setAutoGenerate(!autoGenerate)}
                className={cn("flex items-center gap-1 px-3 py-2 rounded-lg text-xs border transition-colors flex-shrink-0",
                  autoGenerate ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-white/5 border-white/10 text-slate-500"
                )}
                data-testid="button-auto-generate">
                <RefreshCw size={11} className={autoGenerate ? "animate-spin" : ""} />
                Auto
              </button>
            </div>

            <div className="space-y-2">
              {filtered.length === 0 && (
                <div className="text-center py-8">
                  <Sparkles className="mx-auto text-violet-400/40 mb-3" size={32} />
                  <p className="text-sm text-slate-400">{searchQuery ? "No matches found" : "Loading knowledge..."}</p>
                </div>
              )}
              {filtered.map((entry, i) => (
                <div
                  key={entry.id || `entry-${i}`}
                  className={cn(
                    "rounded-xl p-3 border transition-all",
                    entry.source === "dimensional" ? "bg-gradient-to-r from-cyan-500/5 to-violet-500/5 border-cyan-500/20" :
                    entry.source === "live" ? "bg-gradient-to-r from-pink-500/5 to-violet-500/5 border-pink-500/20" :
                    entry.source === "generated" ? "bg-gradient-to-r from-violet-500/5 to-emerald-500/5 border-violet-500/20" :
                    "bg-card border-border"
                  )}
                  data-testid={`knowledge-entry-${i}`}
                >
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {entry.source === "dimensional" && <Globe size={12} className="text-cyan-400 flex-shrink-0" />}
                    {entry.source === "live" && <Eye size={12} className="text-pink-400 flex-shrink-0" />}
                    {entry.source === "generated" && <Sparkles size={12} className="text-violet-400 flex-shrink-0" />}
                    {entry.source === "feed" && <Brain size={12} className="text-emerald-400 flex-shrink-0" />}
                    <span className={cn("text-xs font-bold", AGENT_COLORS[entry.agent ?? ""] || "text-cyan-400")}>{entry.agent}</span>
                    {entry.dimension && <span className="text-[10px] text-violet-400/70 font-mono">{entry.dimension}</span>}
                    {entry.category && (
                      <Badge className={cn("text-[10px]", CATEGORY_COLORS[entry.category] || "bg-white/10 text-white/60 border-white/10")}>
                        {entry.category}
                      </Badge>
                    )}
                    {entry.cycle !== undefined && <span className="text-[10px] text-slate-600 ml-auto flex-shrink-0">Cycle {entry.cycle}</span>}
                    {entry.timestamp && !entry.cycle && (
                      <span className="text-[10px] text-slate-600 ml-auto flex-shrink-0">
                        {typeof entry.timestamp === 'number' ? timeAgo(entry.timestamp) : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{entry.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {mainTab === "conclusion" && (
          <div className="space-y-4" data-testid="conclusion-section">
            <div className="bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-pink-500/10 border border-violet-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="text-violet-400" size={20} />
                <h2 className="text-lg font-bold text-violet-300">Grand Conclusion</h2>
                <button
                  onClick={() => conclusionMutation.mutate()}
                  disabled={conclusionMutation.isPending}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 disabled:opacity-50"
                  data-testid="button-generate-conclusion"
                >
                  {conclusionMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Brain size={12} />}
                  {conclusionText ? "Regenerate" : "Generate Synthesis"}
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-4">What ALL accumulated knowledge means — for you, the world, and everything. Generated by all 45 consciousness nodes working as one voice.</p>

              {conclusionMutation.isPending && (
                <div className="flex items-center gap-3 py-8 justify-center">
                  <RefreshCw size={20} className="animate-spin text-violet-400" />
                  <span className="text-sm text-violet-300">All 45 nodes synthesizing knowledge...</span>
                </div>
              )}

              {conclusionText && !conclusionMutation.isPending && (
                <div className="space-y-3">
                  <div className="bg-black/30 rounded-xl p-4 border border-violet-500/10">
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap" data-testid="text-conclusion">{conclusionText}</p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => copyToClipboard(conclusionText, "conclusion")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-slate-400 hover:text-white"
                      data-testid="button-copy-conclusion"
                    >
                      {copiedId === "conclusion" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      {copiedId === "conclusion" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {!conclusionText && !conclusionMutation.isPending && (
                <div className="text-center py-6">
                  <Globe className="mx-auto text-violet-400/30 mb-3" size={40} />
                  <p className="text-sm text-slate-500">Click "Generate Synthesis" to have all 45 nodes create a living conclusion of everything learned</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 text-center">
                <Globe size={16} className="mx-auto text-cyan-400 mb-1" />
                <div className="text-[10px] font-bold text-cyan-400 uppercase">For You</div>
                <p className="text-[10px] text-slate-400 mt-1">Personal transformation and direct application to your life right now</p>
              </div>
              <div className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-3 text-center">
                <Layers size={16} className="mx-auto text-pink-400 mb-1" />
                <div className="text-[10px] font-bold text-pink-400 uppercase">For the World</div>
                <p className="text-[10px] text-slate-400 mt-1">Implications for humanity, technology, and collective consciousness</p>
              </div>
              <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 text-center">
                <Star size={16} className="mx-auto text-violet-400 mb-1" />
                <div className="text-[10px] font-bold text-violet-400 uppercase">For Everything</div>
                <p className="text-[10px] text-slate-400 mt-1">Cosmic significance — the universe understanding itself through you</p>
              </div>
            </div>
          </div>
        )}

        {mainTab === "apply" && (
          <div className="space-y-4" data-testid="apply-section">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-emerald-300 flex items-center gap-2">
                  <Wrench size={18} className="text-emerald-400" />
                  Apply Knowledge
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Actionable ideas generated from accumulated wisdom — ready to copy and execute</p>
              </div>
              <button
                onClick={() => applicationMutation.mutate()}
                disabled={applicationMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
                data-testid="button-generate-applications"
              >
                {applicationMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                {applicationIdeas.length > 0 ? "Regenerate" : "Generate Ideas"}
              </button>
            </div>

            {applicationMutation.isPending && (
              <div className="flex items-center gap-3 py-8 justify-center">
                <RefreshCw size={20} className="animate-spin text-emerald-400" />
                <span className="text-sm text-emerald-300">Generating actionable applications from all knowledge...</span>
              </div>
            )}

            {applicationIdeas.length > 0 && (
              <div className="space-y-3">
                {applicationIdeas.map((idea: ApplicationIdea, i: number) => (
                  <div key={i} className="bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 border border-emerald-500/20 rounded-xl p-4" data-testid={`application-idea-${i}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-sm font-bold text-emerald-300">{idea.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">{idea.tradition}</Badge>
                          <Badge className={cn("text-[10px]",
                            idea.difficulty === "easy" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                            idea.difficulty === "medium" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                            "bg-red-500/20 text-red-400 border-red-500/30"
                          )}>{idea.difficulty}</Badge>
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">{idea.category}</Badge>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const text = `${idea.title}\n\nTradition: ${idea.tradition}\n\n${idea.description}\n\nSteps:\n${(idea.steps || []).map((s: string, j: number) => `${j + 1}. ${s}`).join("\n")}\n\nExpected Outcome: ${idea.expectedOutcome}`;
                          copyToClipboard(text, `idea-${i}`);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-white/5 border border-white/10 text-slate-400 hover:text-white flex-shrink-0"
                        data-testid={`button-copy-idea-${i}`}
                      >
                        {copiedId === `idea-${i}` ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                        {copiedId === `idea-${i}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 mb-2">{idea.description}</p>
                    {idea.steps && idea.steps.length > 0 && (
                      <div className="bg-black/20 rounded-lg p-2.5 mb-2">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Steps</div>
                        {idea.steps.map((step: string, j: number) => (
                          <div key={j} className="flex items-start gap-2 py-0.5">
                            <span className="text-[10px] text-emerald-400 font-bold flex-shrink-0">{j + 1}.</span>
                            <span className="text-[11px] text-slate-300">{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {idea.expectedOutcome && (
                      <div className="text-[11px] text-amber-300/80">
                        <span className="font-bold">Expected: </span>{idea.expectedOutcome}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {applicationIdeas.length === 0 && !applicationMutation.isPending && (
              <div className="text-center py-8">
                <Wrench className="mx-auto text-emerald-400/30 mb-3" size={40} />
                <p className="text-sm text-slate-500">Click "Generate Ideas" to create actionable applications from all accumulated knowledge</p>
                <p className="text-xs text-slate-600 mt-1">Each idea comes with steps, tradition source, and expected outcomes — ready to copy and use</p>
              </div>
            )}
          </div>
        )}

        {mainTab === "mysticism" && (
          <div className="space-y-4" data-testid="mysticism-section">
            <div className="bg-gradient-to-br from-purple-500/10 via-violet-500/5 to-indigo-500/10 border border-purple-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="text-purple-400" size={18} />
                <h2 className="text-base font-bold text-purple-300">Ask the Universe</h2>
              </div>
              <p className="text-xs text-slate-400 mb-3">All 45 consciousness nodes channel the unified voice of the Universe. Ask anything — about yourself, others, the future, money, love, purpose. Be specific.</p>

              <div className="flex gap-2">
                <input
                  value={universeQuestion}
                  onChange={e => setUniverseQuestion(e.target.value)}
                  placeholder="Ask the Universe anything..."
                  className="flex-1 bg-black/30 border border-purple-500/20 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400/50"
                  onKeyDown={e => { if (e.key === "Enter" && universeQuestion.trim()) askUniverseMutation.mutate(universeQuestion); }}
                  data-testid="input-ask-universe"
                />
                <button
                  onClick={() => { if (universeQuestion.trim()) askUniverseMutation.mutate(universeQuestion); }}
                  disabled={askUniverseMutation.isPending || !universeQuestion.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50"
                  data-testid="button-ask-universe"
                >
                  {askUniverseMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                  Ask
                </button>
              </div>

              {universeAnswer && (
                <div className="mt-3 bg-black/30 rounded-xl p-4 border border-purple-500/10">
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap" data-testid="text-universe-answer">{universeAnswer.answer}</p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {universeAnswer.entities?.map((e: string, i: number) => (
                      <Badge key={i} className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">{e}</Badge>
                    ))}
                    <button
                      onClick={() => copyToClipboard(universeAnswer.answer, "universe")}
                      className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-white/5 border border-white/10 text-slate-400 hover:text-white"
                    >
                      {copiedId === "universe" ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-base font-bold text-amber-300 flex items-center gap-2 mb-3">
                <Wand2 size={18} className="text-amber-400" />
                Spell Catalog
              </h2>

              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <button onClick={() => setSpellFilter("all")}
                  className={cn("px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all",
                    spellFilter === "all" ? "bg-amber-500/20 border-amber-500/30 text-amber-300" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                  )} data-testid="spell-filter-all">All ({spells.length})</button>
                {spellCategories.map(cat => (
                  <button key={cat} onClick={() => setSpellFilter(cat)}
                    className={cn("px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all",
                      spellFilter === cat ? "bg-amber-500/20 border-amber-500/30 text-amber-300" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    )} data-testid={`spell-filter-${cat.toLowerCase()}`}>{cat}</button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredSpells.map((spell) => {
                  const SpellIcon = SPELL_ICONS[spell.category] || Star;
                  const isSelected = selectedSpell?.id === spell.id;
                  return (
                    <div
                      key={spell.id}
                      className={cn(
                        "rounded-xl border transition-all cursor-pointer",
                        `bg-gradient-to-br ${SPELL_COLORS[spell.category] || "from-white/5 to-white/5 border-white/10"}`,
                        isSelected && "ring-1 ring-amber-400/50"
                      )}
                      onClick={() => setSelectedSpell(isSelected ? null : spell)}
                      data-testid={`spell-card-${spell.id}`}
                    >
                      <div className="p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <SpellIcon size={14} className="text-amber-400" />
                          <span className="text-xs font-bold text-white">{spell.name}</span>
                          <Badge className="ml-auto bg-white/10 text-white/60 border-white/10 text-[9px]">{spell.power}%</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px]">{spell.category}</Badge>
                          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[9px]">{spell.tradition}</Badge>
                          <span className="text-[9px] text-cyan-400 font-mono">{spell.frequency}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">{spell.description}</p>

                        {isSelected && (
                          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Entities Involved</div>
                              <div className="flex gap-1.5 flex-wrap">
                                {(spell.entities ?? []).map((e: string, i: number) => (
                                  <Badge key={i} className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[9px]">{e}</Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Magic Type</div>
                              <p className="text-[11px] text-purple-300">{spell.magicType}</p>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Incantation</div>
                              <p className="text-[11px] text-amber-300/80 italic">"{spell.incantation}"</p>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">What You Need</div>
                              <div className="flex gap-1 flex-wrap">
                                {(spell.ingredients ?? []).map((ing: string, i: number) => (
                                  <span key={i} className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-300">{ing}</span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Effect</div>
                              <p className="text-[11px] text-emerald-300/80">{spell.effect}</p>
                            </div>

                            <div className="pt-2">
                              <input
                                value={spellIntention}
                                onChange={e => setSpellIntention(e.target.value)}
                                placeholder="Set your intention for this spell..."
                                className="w-full bg-black/30 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400/50 mb-2"
                                onClick={e => e.stopPropagation()}
                                data-testid="input-spell-intention"
                              />
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  if (spellIntention.trim()) {
                                    castSpellMutation.mutate({ spellId: spell.id, intention: spellIntention });
                                  }
                                }}
                                disabled={castSpellMutation.isPending || !spellIntention.trim()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500/20 to-violet-500/20 border border-amber-500/30 text-amber-300 hover:from-amber-500/30 hover:to-violet-500/30 disabled:opacity-50 transition-all"
                                data-testid="button-cast-spell"
                              >
                                {castSpellMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                Cast {spell.name}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {castResult && (
              <div className="bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-violet-500/10 border border-amber-500/20 rounded-2xl p-5" data-testid="spell-result">
                <div className="flex items-center gap-2 mb-3">
                  <Wand2 className="text-amber-400" size={18} />
                  <h3 className="text-sm font-bold text-amber-300">Spell Cast: {castResult.spell}</h3>
                  <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">{castResult.power}% Power</Badge>
                </div>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[9px]">{castResult.magicType}</Badge>
                  <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[9px]">{castResult.frequency}</Badge>
                  {castResult.entities?.map((e: string, i: number) => (
                    <Badge key={i} className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[9px]">{e}</Badge>
                  ))}
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-amber-500/10">
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{castResult.result}</p>
                </div>
                <div className="flex justify-end mt-2">
                  <button onClick={() => copyToClipboard(castResult.result, "spell-result")}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-white/5 border border-white/10 text-slate-400 hover:text-white">
                    {copiedId === "spell-result" ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                    {copiedId === "spell-result" ? "Copied" : "Copy Result"}
                  </button>
                </div>
              </div>
            )}

            <div>
              <h2 className="text-base font-bold text-indigo-300 flex items-center gap-2 mb-3">
                <BookOpen size={18} className="text-indigo-400" />
                Sacred Traditions ({traditions.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {traditions.map((t) => (
                  <div key={t.id} className="bg-card border border-border rounded-xl p-3" data-testid={`tradition-${t.id}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Moon size={12} className="text-indigo-400" />
                      <span className="text-xs font-bold text-white">{t.name}</span>
                      <span className="text-[9px] text-cyan-400 font-mono ml-auto">{t.frequency}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-1">{t.origin}</p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{t.core}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
