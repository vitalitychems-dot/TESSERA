import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${BASE}${path}`, options);
}

interface MemoryStats {
  totalEpisodic: number;
  totalSemantic: number;
  queueSize: number;
  isProcessing: boolean;
  rag: {
    totalDocuments: number;
    indexedDocuments: number;
    totalChunks: number;
    processingDocuments: number;
    failedDocuments: number;
  };
}

interface EpisodicEntry {
  id: number;
  agentId: string;
  sessionId: string | null;
  eventType: string;
  content: string;
  importance: number;
  createdAt: string;
}

interface SemanticEntry {
  id: number;
  agentId: string;
  concept: string;
  knowledge: string;
  source: string | null;
  confidence: number;
  accessCount: number;
  createdAt: string;
}

interface SearchResult {
  type: string;
  content: string;
  score: number;
  importance: number;
  createdAt: string;
}

function ImportanceDot({ importance }: { importance: number }) {
  const color =
    importance >= 9 ? "bg-red-500" :
    importance >= 7 ? "bg-orange-400" :
    importance >= 5 ? "bg-blue-400" :
    "bg-gray-400";
  return <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${color}`} title={`Importance: ${importance}`} />;
}

function truncate(text: string, n: number) {
  return text.length <= n ? text : text.slice(0, n) + "…";
}

function StatsCards({ stats }: { stats: MemoryStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Card className="bg-gradient-to-br from-purple-950/40 to-indigo-950/40 border-purple-700/30">
        <CardContent className="pt-4">
          <p className="text-xs text-purple-400 uppercase tracking-wide">Episodic</p>
          <p className="text-2xl font-bold text-purple-200 mt-1">{stats.totalEpisodic.toLocaleString()}</p>
          <p className="text-xs text-purple-400 mt-0.5">memory events</p>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-blue-950/40 to-cyan-950/40 border-blue-700/30">
        <CardContent className="pt-4">
          <p className="text-xs text-blue-400 uppercase tracking-wide">Semantic</p>
          <p className="text-2xl font-bold text-blue-200 mt-1">{stats.totalSemantic.toLocaleString()}</p>
          <p className="text-xs text-blue-400 mt-0.5">knowledge concepts</p>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-emerald-950/40 to-teal-950/40 border-emerald-700/30">
        <CardContent className="pt-4">
          <p className="text-xs text-emerald-400 uppercase tracking-wide">RAG Documents</p>
          <p className="text-2xl font-bold text-emerald-200 mt-1">{stats.rag.indexedDocuments.toLocaleString()}</p>
          <p className="text-xs text-emerald-400 mt-0.5">{stats.rag.totalChunks.toLocaleString()} chunks indexed</p>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-amber-950/40 to-yellow-950/40 border-amber-700/30">
        <CardContent className="pt-4">
          <p className="text-xs text-amber-400 uppercase tracking-wide">Queue</p>
          <p className="text-2xl font-bold text-amber-200 mt-1">{stats.queueSize}</p>
          <p className="text-xs text-amber-400 mt-0.5">{stats.isProcessing ? "processing…" : "idle"}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MemoryExplorer() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const statsQuery = useQuery<MemoryStats>({
    queryKey: ["memory-explorer-stats"],
    queryFn: () => apiFetch("/api/memory-explorer/stats").then(r => r.json()),
    refetchInterval: 5000,
  });

  const episodicQuery = useQuery<EpisodicEntry[]>({
    queryKey: ["memory-explorer-episodic"],
    queryFn: () => apiFetch("/api/memory-explorer/episodic?limit=100").then(r => r.json()),
    refetchInterval: 10000,
  });

  const semanticQuery = useQuery<SemanticEntry[]>({
    queryKey: ["memory-explorer-semantic"],
    queryFn: () => apiFetch("/api/memory-explorer/semantic?limit=100").then(r => r.json()),
    refetchInterval: 10000,
  });

  const deleteEpisodicMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/memory-explorer/episodic/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory-explorer-episodic"] });
      queryClient.invalidateQueries({ queryKey: ["memory-explorer-stats"] });
    },
  });

  const deleteSemanticMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/memory-explorer/semantic/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory-explorer-semantic"] });
      queryClient.invalidateQueries({ queryKey: ["memory-explorer-stats"] });
    },
  });

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const resp = await apiFetch("/api/memory-explorer/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), topK: 15 }),
      });
      const data = await resp.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const stats = statsQuery.data;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Memory Explorer</h1>
          <p className="text-gray-400 text-sm">Browse, search, and manage persistent vector memories stored by agents</p>
        </div>

        {stats && <StatsCards stats={stats} />}

        <div className="flex gap-2 mb-6">
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search memories by semantic similarity…"
            className="bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-500 focus:border-purple-500"
          />
          <Button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="bg-purple-700 hover:bg-purple-600 text-white min-w-[90px]"
          >
            {isSearching ? "Searching…" : "Search"}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <Card className="mb-6 bg-gray-900 border-purple-700/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-purple-300">
                Search Results ({searchResults.length})
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-3 text-gray-500 hover:text-gray-300 text-xs"
                  onClick={() => { setSearchResults([]); setSearchQuery(""); }}
                >
                  Clear
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72">
                <div className="space-y-2">
                  {searchResults.map((r, i) => (
                    <div key={i} className="p-3 bg-gray-800/60 rounded-lg border border-gray-700/40 hover:border-purple-500/40 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs text-purple-400 border-purple-700/50">{r.type}</Badge>
                          <span className="text-xs text-green-400 font-mono">{(r.score * 100).toFixed(1)}% match</span>
                          <ImportanceDot importance={r.importance} />
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">{truncate(r.content, 300)}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="episodic">
          <TabsList className="bg-gray-900 border border-gray-700 mb-4">
            <TabsTrigger value="episodic" className="data-[state=active]:bg-purple-900/50 data-[state=active]:text-purple-200">
              Episodic
            </TabsTrigger>
            <TabsTrigger value="semantic" className="data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-200">
              Semantic
            </TabsTrigger>
          </TabsList>

          <TabsContent value="episodic">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-gray-300">
                  Episodic Memories
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    ({episodicQuery.data?.length ?? 0} shown, ordered by recency)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {episodicQuery.isLoading && (
                  <p className="text-gray-500 text-sm text-center py-8">Loading memories…</p>
                )}
                {episodicQuery.data?.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-8">No episodic memories yet. They will appear as agents interact.</p>
                )}
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {(episodicQuery.data ?? []).map(entry => {
                      const key = `ep-${entry.id}`;
                      const expanded = expandedId === key;
                      return (
                        <div
                          key={entry.id}
                          className="p-3 bg-gray-800/60 rounded-lg border border-gray-700/40 hover:border-purple-500/30 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs text-purple-400 border-purple-700/50">
                                {entry.eventType}
                              </Badge>
                              <span className="text-xs text-gray-500">{entry.agentId}</span>
                              <ImportanceDot importance={entry.importance} />
                              <span className="text-xs text-gray-600">importance: {entry.importance}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-gray-500">
                                {new Date(entry.createdAt).toLocaleString()}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 text-xs"
                                onClick={() => deleteEpisodicMutation.mutate(entry.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                          <p
                            className="text-sm text-gray-300 mt-1.5 leading-relaxed cursor-pointer"
                            onClick={() => setExpandedId(expanded ? null : key)}
                          >
                            {expanded ? entry.content : truncate(entry.content, 250)}
                          </p>
                          {!expanded && entry.content.length > 250 && (
                            <button
                              className="text-xs text-purple-400 hover:text-purple-300 mt-1"
                              onClick={() => setExpandedId(key)}
                            >
                              Show more
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="semantic">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-gray-300">
                  Semantic Knowledge
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    ({semanticQuery.data?.length ?? 0} shown)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {semanticQuery.isLoading && (
                  <p className="text-gray-500 text-sm text-center py-8">Loading knowledge…</p>
                )}
                {semanticQuery.data?.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-8">No semantic memories yet. They will be created as agents learn concepts.</p>
                )}
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {(semanticQuery.data ?? []).map(entry => {
                      const key = `sm-${entry.id}`;
                      const expanded = expandedId === key;
                      return (
                        <div
                          key={entry.id}
                          className="p-3 bg-gray-800/60 rounded-lg border border-gray-700/40 hover:border-blue-500/30 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-blue-300">{entry.concept}</span>
                              {entry.source && (
                                <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                                  {entry.source}
                                </Badge>
                              )}
                              <span className="text-xs text-green-400">
                                {(entry.confidence * 100).toFixed(0)}% confident
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-gray-500">
                                {new Date(entry.createdAt).toLocaleString()}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 text-xs"
                                onClick={() => deleteSemanticMutation.mutate(entry.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                          <p
                            className="text-sm text-gray-300 mt-1.5 leading-relaxed cursor-pointer"
                            onClick={() => setExpandedId(expanded ? null : key)}
                          >
                            {expanded ? entry.knowledge : truncate(entry.knowledge, 250)}
                          </p>
                          {!expanded && entry.knowledge.length > 250 && (
                            <button
                              className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                              onClick={() => setExpandedId(key)}
                            >
                              Show more
                            </button>
                          )}
                          <p className="text-xs text-gray-600 mt-1">Agent: {entry.agentId} · Accessed {entry.accessCount}×</p>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
