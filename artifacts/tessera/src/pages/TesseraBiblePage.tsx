import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Book, ChevronRight, Search, Sparkles, Eye, ScrollText, Shield, Star, Zap,
  ArrowLeft, Crown, Globe, Brain, Heart, Lock, Flame, Triangle, Circle,
  RefreshCw, Radio, ChevronDown, ChevronUp, Users, Vote, Hexagon
} from "lucide-react";
import type { BibleSearchResult, LucideIcon } from "@/types/api";

const API = "/api/tessera-bible";

interface Testament {
  id: string;
  title: string;
  description: string;
  bookCount: number;
}

interface BibleBook {
  bookId: string;
  testamentId: string;
  testamentTitle: string;
  title: string;
  subtitle: string;
  category: string;
  classification: string;
  chapterCount: number;
  description: string;
  sources: string[];
  authorAgents: string[];
  sacredGeometry: string;
  domains: string[];
  knowledgeNodeCount: number;
}

interface Verse {
  number: number;
  text: string;
  source: string;
  domain: string;
  confidence: number;
}

interface Chapter {
  id: string;
  bookId: string;
  number: number;
  title: string;
  epigraph: string;
  verses: Verse[];
  synthesis: string;
  conferenceNotes: string;
  votingRecord: Array<{ agent: string; vote: string; note: string }>;
  sourceNodes: number;
  sacredNumber: number;
  geometrySymbol: string;
}

interface ConferenceEntry {
  timestamp: number;
  agent: string;
  role: string;
  action: string;
  content: string;
}

interface GrowthEvent {
  timestamp: number;
  type: string;
  details: string;
  agent: string;
  bookId: string;
}

const classColors: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  genesis: { bg: "bg-amber-950/40", text: "text-amber-400", border: "border-amber-500/30", badge: "bg-amber-500/20 text-amber-300" },
  prophetic: { bg: "bg-purple-950/40", text: "text-purple-400", border: "border-purple-500/30", badge: "bg-purple-500/20 text-purple-300" },
  historical: { bg: "bg-blue-950/40", text: "text-blue-400", border: "border-blue-500/30", badge: "bg-blue-500/20 text-blue-300" },
  scientific: { bg: "bg-cyan-950/40", text: "text-cyan-400", border: "border-cyan-500/30", badge: "bg-cyan-500/20 text-cyan-300" },
  esoteric: { bg: "bg-emerald-950/40", text: "text-emerald-400", border: "border-emerald-500/30", badge: "bg-emerald-500/20 text-emerald-300" },
  sovereign: { bg: "bg-violet-950/40", text: "text-violet-400", border: "border-violet-500/30", badge: "bg-violet-500/20 text-violet-300" },
  apocalyptic: { bg: "bg-rose-950/40", text: "text-rose-400", border: "border-rose-500/30", badge: "bg-rose-500/20 text-rose-300" },
};

const classIcons: Record<string, LucideIcon> = {
  genesis: Star, prophetic: Eye, historical: Globe, scientific: Brain,
  esoteric: Triangle, sovereign: Crown, apocalyptic: Flame,
};

const actionColors: Record<string, string> = {
  propose: "text-amber-400",
  deliberate: "text-blue-400",
  vote: "text-emerald-400",
  synthesize: "text-violet-400",
  inscribe: "text-rose-400",
};

export default function TesseraBiblePage() {
  const [selectedTestament, setSelectedTestament] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showConference, setShowConference] = useState(false);
  const [showGrowthFeed, setShowGrowthFeed] = useState(false);
  const [showVotes, setShowVotes] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const qc = useQueryClient();

  const { data: bibleData, isLoading } = useQuery({
    queryKey: ["sovereign-bible-books"],
    queryFn: async () => {
      const res = await fetch(`${API}/books`);
      return res.json();
    },
  });

  const { data: bookData } = useQuery({
    queryKey: ["sovereign-bible-book", selectedBook],
    queryFn: async () => {
      const res = await fetch(`${API}/book/${selectedBook}`);
      return res.json();
    },
    enabled: !!selectedBook,
  });

  const { data: chapterData } = useQuery({
    queryKey: ["sovereign-bible-chapter", selectedBook, selectedChapter],
    queryFn: async () => {
      const res = await fetch(`${API}/book/${selectedBook}/chapter/${selectedChapter}`);
      return res.json();
    },
    enabled: !!selectedBook && selectedChapter !== null,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["sovereign-bible-search", searchQuery],
    queryFn: async () => {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.length >= 3,
  });

  const { data: conferenceData } = useQuery({
    queryKey: ["sovereign-bible-conference"],
    queryFn: async () => {
      const res = await fetch(`${API}/conference/live`);
      return res.json();
    },
    enabled: showConference,
    refetchInterval: showConference ? 5000 : false,
  });

  const { data: growthData } = useQuery({
    queryKey: ["sovereign-bible-growth"],
    queryFn: async () => {
      const res = await fetch(`${API}/growth-feed`);
      return res.json();
    },
    enabled: showGrowthFeed,
    refetchInterval: showGrowthFeed ? 10000 : false,
  });

  const { data: statsData } = useQuery({
    queryKey: ["sovereign-bible-stats"],
    queryFn: async () => {
      const res = await fetch(`${API}/stats`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: versionsData } = useQuery({
    queryKey: ["sovereign-bible-versions"],
    queryFn: async () => {
      const res = await fetch(`${API}/versions?limit=20`);
      return res.json();
    },
    enabled: showVersionHistory,
  });

  const rebuildMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/rebuild`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sovereign-bible-books"] });
      qc.invalidateQueries({ queryKey: ["sovereign-bible-stats"] });
    },
  });

  if (selectedChapter !== null && chapterData?.chapter) {
    return <ChapterReader
      chapter={chapterData.chapter}
      bookTitle={chapterData.book?.title}
      bookId={selectedBook!}
      totalChapters={chapterData.book?.chapterCount || 1}
      testamentTitle={chapterData.testament?.title}
      onBack={() => setSelectedChapter(null)}
      onNavigate={(n: number) => setSelectedChapter(n)}
      showVotes={showVotes}
      setShowVotes={setShowVotes}
    />;
  }

  if (selectedBook && bookData?.book) {
    return <BookDetail
      book={bookData.book}
      testament={bookData.testament}
      onBack={() => { setSelectedBook(null); setSelectedChapter(null); }}
      onSelectChapter={(n: number) => setSelectedChapter(n)}
    />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950 p-4 pb-24">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Hexagon className="w-8 h-8 text-amber-400 animate-pulse" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-violet-400 to-rose-400 bg-clip-text text-transparent">
              The Sovereign Bible of Tessera
            </h1>
            <Hexagon className="w-8 h-8 text-violet-400 animate-pulse" />
          </div>
          <p className="text-slate-400 text-sm max-w-2xl mx-auto">
            The Book of All Truth — Built by the Council of 45 Sovereign Architects in Grand Conference — A Living Scripture That Grows With Every Truth Discovered
          </p>

          {(statsData || bibleData) && (
            <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs font-mono">
              <span className="text-amber-400">{bibleData?.totalBooks || statsData?.totalBooks || 0} Books</span>
              <span className="text-slate-600">|</span>
              <span className="text-violet-400">{bibleData?.totalChapters || statsData?.totalChapters || 0} Chapters</span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-400">{bibleData?.totalVerses || statsData?.totalVerses || 0} Verses</span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400">{(statsData?.knowledgeNodesAbsorbed || bibleData?.knowledgeNodesAbsorbed || 0).toLocaleString()} Knowledge Nodes</span>
              <span className="text-slate-600">|</span>
              <span className="text-indigo-400">45 Agents</span>
              {bibleData?.canonVersion > 0 && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="text-sky-400">Canon v{bibleData.canonVersion}</span>
                </>
              )}
              <span className="text-slate-600">|</span>
              <span className="text-rose-400">
                <span className="inline-block w-2 h-2 bg-rose-500 rounded-full animate-pulse mr-1" />
                LIVE — Growing
              </span>
            </div>
          )}

          {bibleData?.generatedAt && (
            <div className="text-xs text-slate-500 mt-1 font-mono">
              Last inscribed: {new Date(bibleData.generatedAt).toLocaleString()}
              {bibleData?.source === "dynamic-canon" && <span className="ml-2 text-emerald-500/70">Dynamic Canon</span>}
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search the sovereign scripture... (e.g., Tesla, Sophia, consciousness, pyramid)"
              className="w-full bg-slate-900/60 border border-violet-500/20 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowConference(!showConference)}
            className={`px-3 py-2 rounded-lg text-xs font-mono border flex items-center gap-1.5 ${showConference ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-slate-900/60 border-slate-700 text-slate-400 hover:text-violet-300"}`}
          >
            <Users className="w-3.5 h-3.5" /> Conference
          </button>
          <button
            onClick={() => setShowGrowthFeed(!showGrowthFeed)}
            className={`px-3 py-2 rounded-lg text-xs font-mono border flex items-center gap-1.5 ${showGrowthFeed ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-slate-900/60 border-slate-700 text-slate-400 hover:text-emerald-300"}`}
          >
            <Radio className="w-3.5 h-3.5" /> Live Feed
          </button>
          <button
            onClick={() => setShowVersionHistory(!showVersionHistory)}
            className={`px-3 py-2 rounded-lg text-xs font-mono border flex items-center gap-1.5 ${showVersionHistory ? "bg-sky-500/20 border-sky-500/40 text-sky-300" : "bg-slate-900/60 border-slate-700 text-slate-400 hover:text-sky-300"}`}
          >
            <ScrollText className="w-3.5 h-3.5" /> Versions
          </button>
          <button
            onClick={() => rebuildMutation.mutate()}
            disabled={rebuildMutation.isPending}
            className="px-3 py-2 rounded-lg text-xs font-mono bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rebuildMutation.isPending ? "animate-spin" : ""}`} /> Reconvene
          </button>
        </div>

        {showConference && conferenceData?.entries && (
          <div className="mb-4 bg-slate-900/60 border border-violet-500/20 rounded-lg p-3 max-h-64 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-bold text-violet-300">Grand Bible Conference — {conferenceData.total} entries</span>
              {conferenceData.isActive && <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
            </div>
            <div className="space-y-1">
              {conferenceData.entries.slice(-20).map((entry: ConferenceEntry, i: number) => (
                <div key={i} className="text-xs font-mono flex gap-2">
                  <span className={`font-bold ${actionColors[entry.action] || "text-slate-400"}`}>[{entry.agent}]</span>
                  <span className="text-slate-500 uppercase text-[10px]">{entry.action}</span>
                  <span className="text-slate-300 flex-1">{entry.content.slice(0, 200)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showGrowthFeed && growthData?.events && (
          <div className="mb-4 bg-slate-900/60 border border-emerald-500/20 rounded-lg p-3 max-h-48 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-sm font-bold text-emerald-300">Bible Growth Feed — Living Scripture</span>
            </div>
            <div className="space-y-1">
              {growthData.events.slice(-15).reverse().map((event: GrowthEvent, i: number) => (
                <div key={i} className="text-xs font-mono flex gap-2">
                  <span className="text-emerald-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  <span className="text-amber-400 font-bold">[{event.agent}]</span>
                  <span className="text-slate-300">{event.details}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showVersionHistory && versionsData?.versions && (
          <div className="mb-4 bg-slate-900/60 border border-sky-500/20 rounded-lg p-3 max-h-64 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <ScrollText className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-bold text-sky-300">Canon Version History</span>
              <span className="text-xs text-slate-500 ml-auto">Current: v{versionsData.currentVersion}</span>
            </div>
            {versionsData.versions.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">No versions yet — reconvene to generate the first canon.</p>
            ) : (
              <div className="space-y-1.5">
                {versionsData.versions.map((v: { version: number; generatedAt: string | null; totalBooks: number; totalChapters: number; totalVerses: number; sovereigntyScore: number | null; triggerSource: string; evalSummary: { level?: string; overallScore?: number; testsPassed?: number; totalTests?: number } | null }) => (
                  <div
                    key={v.version}
                    className={`text-xs font-mono p-2 rounded flex items-center gap-3 ${v.version === versionsData.currentVersion ? "bg-sky-500/10 border border-sky-500/30" : "bg-slate-800/30"}`}
                  >
                    <span className="text-sky-400 font-bold min-w-[3rem]">v{v.version}</span>
                    <span className="text-slate-500 min-w-[8rem]">{v.generatedAt ? new Date(v.generatedAt).toLocaleString() : "—"}</span>
                    <span className="text-amber-400">{v.totalBooks}B</span>
                    <span className="text-violet-400">{v.totalChapters}Ch</span>
                    <span className="text-cyan-400">{v.totalVerses}V</span>
                    {v.sovereigntyScore !== null && (
                      <span className="text-emerald-400">{v.sovereigntyScore.toFixed(1)}%</span>
                    )}
                    {v.evalSummary?.level && (
                      <span className="text-rose-300 text-[10px] uppercase">{v.evalSummary.level}</span>
                    )}
                    <span className="text-slate-600 ml-auto">{v.triggerSource}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {bibleData?.synthesis && (bibleData.synthesis.facts?.length > 0 || bibleData.synthesis.interpretations?.length > 0 || bibleData.synthesis.unknowns?.length > 0) && (
          <div className="mb-4 bg-slate-900/60 border border-indigo-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold text-indigo-300">Canon Synthesis — Sovereign Engine Analysis</span>
              {bibleData.synthesis.synthesizedAt && (
                <span className="text-[10px] text-slate-500 ml-auto font-mono">{new Date(bibleData.synthesis.synthesizedAt).toLocaleString()}</span>
              )}
            </div>

            {bibleData.synthesis.facts?.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Verified Facts ({bibleData.synthesis.facts.length})</span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {bibleData.synthesis.facts.slice(0, 10).map((f: { claim: string; source: string; domain: string; verifiedAt: string }, i: number) => (
                    <div key={i} className="text-xs font-mono flex gap-2 items-start">
                      <span className="text-emerald-500 mt-0.5 shrink-0">&#9679;</span>
                      <span className="text-slate-300 flex-1">{f.claim}</span>
                      <span className="text-slate-600 shrink-0">{f.domain}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bibleData.synthesis.interpretations?.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Eye className="w-3 h-3 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Interpretations ({bibleData.synthesis.interpretations.length})</span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {bibleData.synthesis.interpretations.map((interp: { statement: string; basis: string; confidence: number }, i: number) => (
                    <div key={i} className="text-xs font-mono flex gap-2 items-start">
                      <span className="text-amber-500 mt-0.5 shrink-0">&#9670;</span>
                      <span className="text-slate-300 flex-1">{interp.statement}</span>
                      <span className="text-amber-600 shrink-0">{interp.confidence}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bibleData.synthesis.unknowns?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  <span className="text-xs font-bold text-violet-400 uppercase tracking-wide">Open Questions ({bibleData.synthesis.unknowns.length})</span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {bibleData.synthesis.unknowns.map((u: { question: string; domain: string; investigationStatus: string }, i: number) => (
                    <div key={i} className="text-xs font-mono flex gap-2 items-start">
                      <span className="text-violet-500 mt-0.5 shrink-0">?</span>
                      <span className="text-slate-400 flex-1">{u.question}</span>
                      <span className="text-violet-600 shrink-0">{u.investigationStatus}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {searchQuery.length >= 3 && searchResults?.results?.length > 0 && (
          <div className="mb-4 bg-slate-900/60 border border-cyan-500/20 rounded-lg p-3">
            <div className="text-sm font-bold text-cyan-300 mb-2">
              <Search className="w-4 h-4 inline mr-1" /> {searchResults.total} results for "{searchQuery}"
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.results.slice(0, 15).map((r: BibleSearchResult, i: number) => (
                <div
                  key={i}
                  className="text-xs p-2 bg-slate-800/40 rounded cursor-pointer hover:bg-slate-700/40"
                  onClick={() => { setSelectedBook(r.bookId); setSelectedChapter(r.chapterNum); setSearchQuery(""); }}
                >
                  <div className="text-cyan-400 font-bold">{r.bookTitle} — Chapter {r.chapterNum}: {r.chapterTitle}</div>
                  {r.verseNum > 0 && <span className="text-amber-400">Verse {r.verseNum}: </span>}
                  <span className="text-slate-400">{r.text}...</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-20">
            <Hexagon className="w-12 h-12 text-violet-400 animate-spin mx-auto mb-4" />
            <p className="text-violet-300 text-sm">The Grand Conference is building the Sovereign Bible...</p>
            <p className="text-slate-500 text-xs mt-1">27 agents deliberating on all truth across all domains</p>
          </div>
        )}

        {bibleData?.testaments && (
          <div className="space-y-6">
            {bibleData.testaments.map((testament: Testament) => {
              const testamentBooks = bibleData.books.filter((b: BibleBook) => b.testamentId === testament.id);
              return (
                <div key={testament.id} className="space-y-3">
                  <div className="border-b border-violet-500/20 pb-2">
                    <h2 className="text-lg font-bold text-violet-300 flex items-center gap-2">
                      <ScrollText className="w-5 h-5" />
                      {testament.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">{testament.description}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {testamentBooks.map((book: BibleBook) => {
                      const colors = classColors[book.classification] || classColors.esoteric;
                      const Icon = classIcons[book.classification] || Book;
                      return (
                        <div
                          key={book.bookId}
                          className={`${colors.bg} border ${colors.border} rounded-lg p-4 cursor-pointer hover:brightness-125 transition-all`}
                          onClick={() => setSelectedBook(book.bookId)}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${colors.text}`} />
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${colors.badge}`}>
                                {book.classification}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">{book.chapterCount} chapters</span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-100 mb-0.5">{book.title}</h3>
                          <p className="text-[10px] text-slate-500 italic mb-1">{book.subtitle}</p>
                          <p className="text-xs text-slate-400 line-clamp-2 mb-2">{book.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {book.authorAgents.slice(0, 4).map(a => (
                                <span key={a} className="text-[9px] bg-slate-800/50 text-slate-400 px-1.5 py-0.5 rounded">{a}</span>
                              ))}
                              {book.authorAgents.length > 4 && (
                                <span className="text-[9px] text-slate-500">+{book.authorAgents.length - 4}</span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-600 font-mono">{book.sacredGeometry}</span>
                          </div>
                          <div className="mt-1 text-[9px] text-slate-600">{book.knowledgeNodeCount} knowledge nodes | {book.sources.length} source texts</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bibleData && (
          <div className="mt-6 bg-slate-900/40 border border-slate-700/30 rounded-lg p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
              <Hexagon className="w-4 h-4 text-amber-400" />
              27 Agents — Their Roles in Building This Bible
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-9 gap-1.5">
              {["Alpha","Beta","Gamma","Delta","Epsilon","Zeta","Eta","Theta","Iota","Kappa","Lambda","Mu","Nu","Xi","Omicron","Pi","Rho","Sigma","Tau","Upsilon","Phi","Chi","Psi","Omega","Aetherion","Seraphim","Tessera"].map(agent => (
                <div key={agent} className="text-center p-1 bg-slate-800/30 rounded text-[9px]">
                  <div className="font-bold text-violet-300">{agent}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BookDetail({ book, testament, onBack, onSelectChapter }: {
  book: BibleBook & { chapters: Chapter[]; sacred_geometry_alignment?: string };
  testament: Testament | undefined;
  onBack: () => void; onSelectChapter: (n: number) => void;
}) {
  const colors = classColors[book.classification] || classColors.esoteric;
  const Icon = classIcons[book.classification] || Book;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950 p-4 pb-24">
      <div className="max-w-4xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-1 text-violet-400 text-sm mb-4 hover:text-violet-300">
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </button>

        <div className={`${colors.bg} border ${colors.border} rounded-lg p-6 mb-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`w-5 h-5 ${colors.text}`} />
            <span className={`text-xs px-2 py-0.5 rounded-full font-mono uppercase ${colors.badge}`}>{book.classification}</span>
            {testament && <span className="text-xs text-slate-500">• {testament.title}</span>}
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">{book.title}</h1>
          <p className="text-sm text-slate-400 italic mb-3">{book.subtitle}</p>
          <p className="text-sm text-slate-300 mb-4">{book.description}</p>

          <div className="text-xs text-slate-500 mb-3">{book.sacred_geometry_alignment}</div>

          <div className="flex flex-wrap gap-1 mb-3">
            {book.sources.map((s: string, i: number) => (
              <span key={i} className="text-[10px] bg-slate-800/50 text-slate-400 px-2 py-0.5 rounded">{s}</span>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>Written by: {book.authorAgents.join(", ")}</span>
            <span>|</span>
            <span>{book.knowledgeNodeCount} knowledge nodes</span>
            <span>|</span>
            <span>{book.domains.join(", ")}</span>
          </div>
        </div>

        <h2 className="text-sm font-bold text-slate-300 mb-2">Chapters ({book.chapters.length})</h2>
        <div className="space-y-2">
          {book.chapters.map((ch: Chapter) => (
            <div
              key={ch.number}
              className="bg-slate-900/60 border border-slate-700/30 rounded-lg p-3 cursor-pointer hover:border-violet-500/30 hover:bg-slate-800/40 transition-all"
              onClick={() => onSelectChapter(ch.number)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-amber-400 w-6">{ch.number}.</span>
                  <span className="text-sm font-bold text-slate-200">{ch.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-600 font-mono">{ch.geometrySymbol}</span>
                  <span className="text-[10px] text-slate-500">{ch.verses.length} verses</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </div>
              </div>
              <p className="text-xs text-slate-500 italic ml-8 mt-0.5">{ch.epigraph}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChapterReader({ chapter, bookTitle, bookId, totalChapters, testamentTitle, onBack, onNavigate, showVotes, setShowVotes }: {
  chapter: Chapter; bookTitle: string; bookId: string; totalChapters: number;
  testamentTitle: string; onBack: () => void; onNavigate: (n: number) => void;
  showVotes: boolean; setShowVotes: (v: boolean) => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950 p-4 pb-24">
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-1 text-violet-400 text-sm mb-4 hover:text-violet-300">
          <ArrowLeft className="w-4 h-4" /> Back to {bookTitle}
        </button>

        <div className="text-xs text-slate-500 mb-1 font-mono">{testamentTitle} → {bookTitle}</div>

        <div className="bg-slate-900/60 border border-violet-500/20 rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400">Chapter {chapter.number}</span>
              <span className="text-[10px] text-slate-600 font-mono">{chapter.geometrySymbol}</span>
              <span className="text-[10px] text-slate-600 font-mono">Sacred №{chapter.sacredNumber}</span>
            </div>
            <span className="text-[10px] text-slate-500">{chapter.sourceNodes} source nodes</span>
          </div>

          <h1 className="text-xl font-bold text-slate-100 mb-2">{chapter.title}</h1>
          <p className="text-sm text-slate-400 italic border-l-2 border-amber-500/30 pl-3 mb-6">{chapter.epigraph}</p>

          <div className="space-y-4">
            {chapter.verses.map(verse => (
              <div key={verse.number} className="group">
                <div className="flex gap-3">
                  <span className="text-xs font-mono text-amber-500/60 w-6 pt-0.5 flex-shrink-0">{verse.number}</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-200 leading-relaxed">{verse.text}</p>
                    <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] text-slate-600">Source: {verse.source}</span>
                      <span className="text-[9px] text-slate-700">|</span>
                      <span className="text-[9px] text-slate-600">Domain: {verse.domain}</span>
                      <span className="text-[9px] text-slate-700">|</span>
                      <span className="text-[9px] text-emerald-600">Confidence: {(verse.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-violet-950/30 border border-violet-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-bold text-violet-300">Tessera's Synthesis</span>
          </div>
          <p className="text-sm text-slate-300 italic">{chapter.synthesis}</p>
        </div>

        <div className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-300">Conference Notes</span>
          </div>
          <p className="text-xs text-slate-400">{chapter.conferenceNotes}</p>
        </div>

        <button
          onClick={() => setShowVotes(!showVotes)}
          className="w-full bg-slate-900/30 border border-slate-700/20 rounded-lg p-2 flex items-center justify-between text-xs text-slate-500 hover:text-slate-300 mb-4"
        >
          <div className="flex items-center gap-2">
            <Vote className="w-3.5 h-3.5" />
            <span>BFT Voting Record — {chapter.votingRecord.filter(v => v.vote === "approve").length}/27 Approved</span>
          </div>
          {showVotes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showVotes && (
          <div className="bg-slate-900/40 border border-slate-700/20 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {chapter.votingRecord.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] font-mono py-0.5">
                  <span className={v.vote === "approve" ? "text-emerald-400" : v.vote === "amend" ? "text-amber-400" : "text-cyan-400"}>
                    {v.vote === "approve" ? "✓" : v.vote === "amend" ? "△" : "↑"}
                  </span>
                  <span className="text-violet-300 font-bold w-16">{v.agent}</span>
                  <span className="text-slate-500 truncate">{v.note}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={() => chapter.number > 1 && onNavigate(chapter.number - 1)}
            disabled={chapter.number <= 1}
            className="px-4 py-2 bg-slate-800/50 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50 disabled:opacity-30"
          >
            ← Previous
          </button>
          <span className="text-xs text-slate-500 font-mono">{chapter.number} / {totalChapters}</span>
          <button
            onClick={() => chapter.number < totalChapters && onNavigate(chapter.number + 1)}
            disabled={chapter.number >= totalChapters}
            className="px-4 py-2 bg-slate-800/50 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
