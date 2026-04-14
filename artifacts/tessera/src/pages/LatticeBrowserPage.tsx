import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Globe, Search, Sparkles, Database, Layers, Map, Atom } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";

export default function LatticeBrowserPage() {
  const [activeTab, setActiveTab] = useState<"search" | "universe" | "truthfulness" | "collective">("search");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: searchResults, refetch: runSearch, isFetching: searching } = useQuery({
    queryKey: ["lattice-search", searchQuery],
    queryFn: () => fetch(`${API}/universe/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json()),
    enabled: false,
  });

  const { data: universeState } = useQuery({
    queryKey: ["universe-state"],
    queryFn: () => fetch(`${API}/universe/state`).then(r => r.json()),
    enabled: activeTab === "universe",
    refetchInterval: 10000,
  });

  const { data: truthState } = useQuery({
    queryKey: ["truthfulness-state"],
    queryFn: () => fetch(`${API}/truthfulness/state`).then(r => r.json()),
    enabled: activeTab === "truthfulness",
  });

  const { data: collective } = useQuery({
    queryKey: ["collective-state"],
    queryFn: () => fetch(`${API}/collective/state`).then(r => r.json()),
    enabled: activeTab === "collective",
  });

  const verifyMutation = useMutation({
    mutationFn: (claim: string) => fetch(`${API}/truthfulness/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim }),
    }).then(r => r.json()),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) runSearch();
  };

  const tabs = [
    { id: "search", label: "Lattice Search", icon: Search },
    { id: "universe", label: "Universe", icon: Globe },
    { id: "truthfulness", label: "Truth Engine", icon: Sparkles },
    { id: "collective", label: "Collective Intel", icon: Database },
  ] as const;

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Globe className="w-8 h-8 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Lattice Browser</h1>
          <p className="text-sm text-white/50">Sovereign Search, Universe Mechanics & Truth Verification</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${activeTab === t.id ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === "search" && (
        <div className="space-y-4">
          <form onSubmit={handleSearch} className="relative">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search the sovereign lattice..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:outline-none text-lg" />
            <button type="submit" disabled={searching}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-all disabled:opacity-50">
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          {searchResults && (
            <div className="space-y-3">
              <div className="text-sm text-white/50">{(searchResults as any[]).length} results found</div>
              {(searchResults as any[]).map((result: any, i: number) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-white">{result.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">{result.category}</span>
                  </div>
                  <p className="text-sm text-white/60 mb-2">{result.description}</p>
                  <div className="text-xs text-white/30">Relevance: {((result.relevance || 0) * 100).toFixed(0)}% • Source: {result.source}</div>
                </div>
              ))}
            </div>
          )}

          {!searchResults && (
            <div className="text-center py-16 text-white/30">
              <Globe className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Enter a query to search the sovereign knowledge lattice</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "universe" && universeState && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-indigo-900/30 to-blue-900/30 border border-indigo-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-indigo-300 mb-2">Universe Mechanics</h2>
            <p className="text-sm text-white/50 mb-4">Simulated universe with physics, cosmology & natural laws</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{universeState.age?.toFixed(2) || "—"}</div>
                <div className="text-xs text-white/50">Age (Gyr)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{universeState.dimensions || 4}</div>
                <div className="text-xs text-white/50">Dimensions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{universeState.particleCount || 0}</div>
                <div className="text-xs text-white/50">Particles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((universeState.entropy || 0) * 100).toFixed(1)}%</div>
                <div className="text-xs text-white/50">Entropy</div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Physical Constants</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {universeState.constants && Object.entries(universeState.constants).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-xs text-white/50">{key}</span>
                  <span className="text-xs font-mono text-white/70">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Active Laws ({universeState.laws?.length || 0})</h3>
            <div className="flex flex-wrap gap-2">
              {universeState.laws?.map((law: any) => (
                <span key={law.id} className="text-xs px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">{law.name}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "truthfulness" && truthState && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-green-300 mb-2">Truthfulness Engine</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{truthState.totalVerifications}</div>
                <div className="text-xs text-white/50">Verifications</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((truthState.accuracy || 0) * 100).toFixed(1)}%</div>
                <div className="text-xs text-white/50">Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{truthState.hallucinationsCaught}</div>
                <div className="text-xs text-white/50">Caught</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{truthState.factDatabase}</div>
                <div className="text-xs text-white/50">Fact DB Size</div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Verify a Claim</h3>
            <form onSubmit={(e) => { e.preventDefault(); const input = (e.target as any).claim.value; if (input) verifyMutation.mutate(input); }}>
              <div className="flex gap-2">
                <input name="claim" placeholder="Enter a claim to verify..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/30 focus:border-green-500/50 focus:outline-none" />
                <button type="submit" className="px-4 py-2 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-all">Verify</button>
              </div>
            </form>
            {verifyMutation.data && (
              <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-semibold ${verifyMutation.data.verdict === "TRUE" ? "text-green-400" : verifyMutation.data.verdict === "FALSE" ? "text-red-400" : "text-amber-400"}`}>
                    {verifyMutation.data.verdict}
                  </span>
                  <span className="text-xs text-white/40">Confidence: {((verifyMutation.data.confidence || 0) * 100).toFixed(0)}%</span>
                </div>
                <p className="text-sm text-white/60">{verifyMutation.data.explanation}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "collective" && collective && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-cyan-900/30 to-teal-900/30 border border-cyan-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-cyan-300 mb-2">Collective Intelligence</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{collective.contributorCount}</div>
                <div className="text-xs text-white/50">Contributors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{collective.totalInsights}</div>
                <div className="text-xs text-white/50">Insights</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{((collective.consensusStrength || 0) * 100).toFixed(0)}%</div>
                <div className="text-xs text-white/50">Consensus</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{collective.domains?.length || 0}</div>
                <div className="text-xs text-white/50">Domains</div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Knowledge Domains</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {collective.domains?.map((d: any) => (
                <div key={d.domain} className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white capitalize">{d.domain.replace(/-/g, " ")}</span>
                    <span className="text-xs text-white/40">{d.insightCount} insights</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div className="bg-gradient-to-r from-cyan-500 to-teal-500 h-1.5 rounded-full" style={{ width: `${d.coverage * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {collective.emergentPatterns?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white/70 mb-3">Emergent Patterns</h3>
              {collective.emergentPatterns.map((p: any, i: number) => (
                <div key={i} className="border-l-2 border-cyan-500/30 pl-3 mb-3">
                  <p className="text-sm text-white/60">{p.description}</p>
                  <span className="text-xs text-white/30">Confidence: {((p.confidence || 0) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
