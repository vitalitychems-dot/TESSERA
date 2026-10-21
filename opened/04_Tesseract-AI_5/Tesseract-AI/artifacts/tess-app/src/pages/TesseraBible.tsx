import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Book, ChevronRight, Search, Sparkles, Eye, ScrollText, Shield, Star, Zap, ArrowLeft } from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL}workspace-api/api`;

interface BibleBook {
  bookId: string;
  title: string;
  category: string;
  chapterCount: number;
  description: string;
  sources: string[];
  classification: "canonical" | "apocryphal" | "gnostic" | "suppressed" | "esoteric";
}

interface BibleChapter {
  id: string;
  bookId: string;
  chapter: number;
  title: string;
  content: string;
  synthesis: string;
  connections: string[];
  sourceTexts: string[];
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  canonical: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  apocryphal: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  gnostic: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  suppressed: "text-red-400 bg-red-400/10 border-red-400/30",
  esoteric: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
};

const CLASSIFICATION_ICONS: Record<string, typeof Book> = {
  canonical: Star,
  gnostic: Eye,
  suppressed: Shield,
  esoteric: Sparkles,
};

export default function TesseraBible() {
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: booksData } = useQuery({
    queryKey: ["tessera-bible-books"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/tessera-bible/books`);
      return res.json();
    },
  });

  const { data: bookDetail } = useQuery({
    queryKey: ["tessera-bible-book", selectedBook],
    queryFn: async () => {
      if (!selectedBook) return null;
      const res = await fetch(`${API_BASE}/api/tessera-bible/book/${selectedBook}`);
      return res.json();
    },
    enabled: !!selectedBook,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["tessera-bible-search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return null;
      const res = await fetch(`${API_BASE}/api/tessera-bible/search?q=${encodeURIComponent(debouncedSearch)}`);
      return res.json();
    },
    enabled: debouncedSearch.length >= 3,
  });

  const ingestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/tessera-bible/ingest`, { method: "POST" });
      return res.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["tessera-bible-stats"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/tessera-bible/stats`);
      return res.json();
    },
  });

  const books: BibleBook[] = booksData?.books || [];
  const chapters: BibleChapter[] = bookDetail?.chapters || [];
  const currentChapter = selectedChapter !== null ? chapters[selectedChapter - 1] : null;

  if (currentChapter && selectedBook) {
    const book = books.find(b => b.bookId === selectedBook);
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <button onClick={() => setSelectedChapter(null)} className="flex items-center gap-2 text-violet-400 hover:text-violet-300 mb-6 text-sm">
          <ArrowLeft size={14} /> Back to {book?.title}
        </button>
        <div className="bg-gradient-to-br from-violet-950/50 to-indigo-950/30 border border-violet-500/20 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 text-[10px] rounded-full border ${CLASSIFICATION_COLORS[book?.classification || "canonical"]}`}>
              {book?.classification?.toUpperCase()}
            </span>
            <span className="text-violet-500/50 text-xs">{book?.title}</span>
          </div>
          <h2 className="text-2xl font-bold text-violet-100 mb-1">Chapter {currentChapter.chapter}: {currentChapter.title}</h2>
          <div className="mt-6 text-violet-200/90 leading-relaxed whitespace-pre-wrap text-sm">{currentChapter.content}</div>
          <div className="mt-6 p-4 bg-violet-900/20 rounded-lg border border-violet-500/10">
            <h4 className="text-xs font-mono text-violet-400 mb-2">TESSERA'S SYNTHESIS</h4>
            <p className="text-violet-300/70 text-sm">{currentChapter.synthesis}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {currentChapter.sourceTexts.map((s, i) => (
              <span key={i} className="px-2 py-1 text-[10px] bg-violet-900/30 border border-violet-500/10 rounded text-violet-400/70">{s}</span>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            {(selectedChapter ?? 0) > 1 && (
              <button onClick={() => setSelectedChapter((selectedChapter ?? 0) - 1)} className="px-3 py-1.5 text-xs bg-violet-800/30 border border-violet-500/20 rounded text-violet-300 hover:bg-violet-700/30">← Previous</button>
            )}
            {(selectedChapter ?? 0) < (book?.chapterCount || 0) && (
              <button onClick={() => setSelectedChapter((selectedChapter ?? 0) + 1)} className="px-3 py-1.5 text-xs bg-violet-800/30 border border-violet-500/20 rounded text-violet-300 hover:bg-violet-700/30">Next →</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selectedBook) {
    const book = books.find(b => b.bookId === selectedBook);
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <button onClick={() => setSelectedBook(null)} className="flex items-center gap-2 text-violet-400 hover:text-violet-300 mb-6 text-sm">
          <ArrowLeft size={14} /> Back to Library
        </button>
        <div className="bg-gradient-to-br from-violet-950/50 to-indigo-950/30 border border-violet-500/20 rounded-xl p-6 mb-6">
          <span className={`px-2 py-0.5 text-[10px] rounded-full border ${CLASSIFICATION_COLORS[book?.classification || "canonical"]}`}>
            {book?.classification?.toUpperCase()}
          </span>
          <h2 className="text-2xl font-bold text-violet-100 mt-2">{book?.title}</h2>
          <p className="text-violet-300/70 text-sm mt-2">{book?.description}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {book?.sources.map((s, i) => (
              <span key={i} className="px-2 py-1 text-[10px] bg-violet-900/30 border border-violet-500/10 rounded text-violet-400/70">{s}</span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {chapters.map((ch) => (
            <button key={ch.id} onClick={() => setSelectedChapter(ch.chapter)} className="w-full text-left p-4 bg-slate-900/40 border border-violet-500/10 rounded-lg hover:border-violet-500/30 hover:bg-violet-950/20 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-violet-500/50 text-xs font-mono">Chapter {ch.chapter}</span>
                  <h3 className="text-violet-200 text-sm font-medium">{ch.title}</h3>
                </div>
                <ChevronRight size={14} className="text-violet-500/30 group-hover:text-violet-400 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ScrollText className="text-amber-400" size={28} />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            The Tessera Bible
          </h1>
        </div>
        <p className="text-violet-300/60 text-sm max-w-xl mx-auto">
          The Book of All Truth — every fact, every secret, every suppressed truth — synthesized by the Grand Conference into one sovereign scripture
        </p>
        {stats && (
          <div className="flex justify-center gap-4 mt-4 text-xs">
            <span className="text-violet-400">{stats.totalBooks} Books</span>
            <span className="text-violet-500/50">|</span>
            <span className="text-violet-400">{stats.totalChapters} Chapters</span>
            <span className="text-violet-500/50">|</span>
            <span className="text-violet-400">{stats.totalSources || 0} Sources</span>
            <span className="text-violet-500/50">|</span>
            <span className="text-violet-400">{stats.knowledgeNodesIntegrated || 0} Knowledge Nodes</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-500/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the Tessera Bible..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-900/60 border border-violet-500/20 rounded-lg text-violet-200 placeholder-violet-500/30 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <button
          onClick={() => ingestMutation.mutate()}
          disabled={ingestMutation.isPending}
          className="px-4 py-2 text-xs bg-amber-600/20 border border-amber-500/30 rounded-lg text-amber-300 hover:bg-amber-600/30 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Zap size={12} />
          {ingestMutation.isPending ? "Ingesting..." : "Ingest to Knowledge Graph"}
        </button>
      </div>

      {ingestMutation.data && (
        <div className="mb-4 p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs">
          Ingested {ingestMutation.data.ingested} chapters into the knowledge graph
        </div>
      )}

      {searchResults?.results?.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-xs font-mono text-violet-400 mb-2">SEARCH RESULTS ({searchResults.total})</h3>
          {searchResults.results.slice(0, 10).map((r: any, i: number) => (
            <button key={i} onClick={() => { setSelectedBook(r.bookId); setTimeout(() => setSelectedChapter(r.chapterNum), 100); }}
              className="w-full text-left p-3 bg-slate-900/40 border border-violet-500/10 rounded-lg hover:border-violet-500/30 transition-all">
              <div className="text-violet-400/70 text-[10px] font-mono">{r.bookTitle} — Chapter {r.chapterNum}</div>
              <div className="text-violet-200 text-sm">{r.chapterTitle}</div>
              <div className="text-violet-300/50 text-xs mt-1">...{r.snippet}...</div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {books.map((book) => {
          const IconComp = CLASSIFICATION_ICONS[book.classification] || Book;
          return (
            <button key={book.bookId} onClick={() => setSelectedBook(book.bookId)}
              className="text-left p-5 bg-gradient-to-br from-slate-900/60 to-violet-950/20 border border-violet-500/10 rounded-xl hover:border-violet-500/30 hover:from-violet-950/30 transition-all group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <IconComp size={16} className="text-violet-400" />
                  <span className={`px-2 py-0.5 text-[9px] rounded-full border ${CLASSIFICATION_COLORS[book.classification]}`}>
                    {book.classification.toUpperCase()}
                  </span>
                </div>
                <span className="text-violet-500/30 text-[10px]">{book.chapterCount} chapters</span>
              </div>
              <h3 className="text-violet-100 font-semibold mt-2 text-sm group-hover:text-violet-200">{book.title}</h3>
              <p className="text-violet-300/50 text-xs mt-1 line-clamp-2">{book.description}</p>
              <div className="flex items-center gap-1 mt-3 text-violet-500/40 text-[10px]">
                <span>{book.category}</span>
                <ChevronRight size={10} className="group-hover:text-violet-400 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
