import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, Search, ArrowLeft, ArrowRight, RefreshCw, Shield, ShieldCheck, Users, Lock, ExternalLink, Network, Home, Server, Radio, Activity, Database, Star, TrendingUp, MessageSquare, Loader2, Filter, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "search", label: "Search", icon: Search },
  { id: "browser", label: "Browser", icon: Globe },
  { id: "members", label: "Members", icon: Users },
  { id: "gateways", label: "Gateways", icon: Radio },
  { id: "vitals", label: "Vitals", icon: Activity },
];

interface SearchResult {
  title: string;
  url: string;
  domain: string;
  description: string;
  category: string;
  relevance: number;
}

function SearchTab({ stats }: { stats: any }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = useCallback(async (q?: string) => {
    const searchQ = q || query;
    if (!searchQ.trim()) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/lattice/search?q=${encodeURIComponent(searchQ.trim())}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }, [query]);

  const { data: sites } = useQuery<any>({ queryKey: ["/api/lattice/sites"], refetchInterval: 30000 });
  const latticeSites = sites?.sites || sites || [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border/30">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
              placeholder="Search the Lattice sovereign internet..."
              className="w-full bg-black/40 border border-cyan-500/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <button
            onClick={() => doSearch()}
            disabled={searching || !query.trim()}
            className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-300 text-sm hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : "Search"}
          </button>
        </div>
        {!hasSearched && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {["marketplace", "security", "art", "research", "trading", "governance"].map(s => (
              <button key={s} onClick={() => { setQuery(s); doSearch(s); }}
                className="px-2.5 py-1 rounded-full text-[11px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {searching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          </div>
        ) : hasSearched && results.length === 0 ? (
          <div className="text-center py-12 text-white/30">
            <Globe size={32} className="mx-auto mb-2" />
            <p className="text-sm">No results found</p>
          </div>
        ) : hasSearched ? (
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 hover:border-cyan-500/20 transition-colors">
                <div className="text-sm font-semibold text-cyan-300">{r.title}</div>
                <div className="text-[10px] font-mono text-white/30 mt-0.5">tess://{r.domain}</div>
                {r.description && <p className="text-xs text-white/50 mt-1">{r.description}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <h3 className="text-xs font-semibold text-white/40 mb-3">LATTICE SITES ({stats?.totalSites || latticeSites.length})</h3>
            <div className="space-y-2">
              {latticeSites.slice(0, 10).map((site: any, i: number) => (
                <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="text-sm font-semibold text-cyan-300">{site.title || site.domain}</div>
                  <div className="text-[10px] font-mono text-white/30 mt-0.5">tess://{site.domain}</div>
                  {site.category && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mt-1 inline-block">{site.category}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BrowserTab() {
  const [url, setUrl] = useState("");
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const navigate = async (domain: string) => {
    const cleanUri = domain.replace(/^tess:\/\//, "").replace(/^https?:\/\//, "");
    setLoading(true);
    try {
      const res = await fetch(`/api/lattice/browse/${encodeURIComponent(cleanUri)}?format=json`);
      const data = await res.json();
      setContent(data);
      setUrl(`tess://${cleanUri}`);
    } catch {
      setContent({ error: "Failed to load site" });
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/30 flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2">
          <Globe size={12} className="text-cyan-400 shrink-0" />
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") navigate(url); }}
            placeholder="tess://domain.sovereign"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
          />
        </div>
        <button onClick={() => navigate(url)} disabled={loading || !url.trim()}
          className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-300 text-sm hover:bg-cyan-500/30 disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : "Go"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : content ? (
          <div className="space-y-3">
            {content.error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-red-400 text-sm">{content.error}</div>
            ) : (
              <div className="rounded-lg border border-border/30 bg-card/40 p-4">
                <h2 className="text-sm font-semibold text-cyan-300 mb-2">{content.title || url}</h2>
                {content.description && <p className="text-xs text-white/60">{content.description}</p>}
                {content.content && <p className="text-xs text-white/50 mt-2 whitespace-pre-wrap">{content.content}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-white/30">
            <Globe size={32} className="mx-auto mb-2" />
            <p className="text-sm">Enter a tess:// address to browse the Lattice</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MembersTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/ecosystem/security/watch"], refetchInterval: 15000 });
  const members = data?.members || [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border/30 flex items-center gap-2">
        <Users size={14} className="text-cyan-400" />
        <span className="text-sm font-semibold">Lattice Members</span>
        {members.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/20">{members.length}</span>}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-white/30"><Users size={32} className="mx-auto mb-2" /><p className="text-sm">No members data</p></div>
        ) : (
          <div className="space-y-2">
            {members.map((m: any, i: number) => (
              <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full shrink-0", m.status === "active" ? "bg-green-400" : "bg-muted-foreground/40")} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{m.name || m.id}</div>
                  <div className="text-[10px] text-white/40">{m.role || m.type || ""}</div>
                </div>
                {m.trustScore != null && <span className="text-[10px] font-mono text-cyan-300 shrink-0">{m.trustScore}%</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GatewaysTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/sovereign-search/gateways"], refetchInterval: 15000 });
  const gateways = data?.gateways || [];

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-white/40">Lattice Gateways</h3>
      {gateways.map((gw: any, i: number) => (
        <div key={i} className="rounded-lg border border-border/30 bg-card/40 p-3">
          <div className="flex items-center gap-2">
            <Radio size={12} className="text-cyan-400" />
            <span className="text-sm font-semibold">{gw.name || gw.id}</span>
            <span className={cn("ml-auto text-[10px] font-mono", gw.status === "online" ? "text-green-400" : "text-muted-foreground")}>{gw.status || "unknown"}</span>
          </div>
          {gw.url && <div className="text-[10px] text-white/30 font-mono mt-0.5">{gw.url}</div>}
        </div>
      ))}
      {gateways.length === 0 && (
        <div className="text-center py-8 text-white/30"><Radio size={32} className="mx-auto mb-2" /><p className="text-sm">Loading gateways...</p></div>
      )}
    </div>
  );
}

function VitalsTab() {
  const { data } = useQuery<any>({ queryKey: ["/api/lattice/stats"], refetchInterval: 30000 });

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-xs font-semibold text-white/40">Lattice Vitals</h3>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Sites", value: data?.totalSites ?? "—", icon: Globe, color: "text-cyan-400" },
          { label: "Active Peers", value: data?.activePeers ?? "—", icon: Network, color: "text-emerald-400" },
          { label: "Searches/Day", value: data?.searchesDay ?? "—", icon: Search, color: "text-violet-400" },
          { label: "Cache Hit %", value: data?.cacheHitRate ? `${data.cacheHitRate}%` : "—", icon: Database, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-lg border border-border/30 bg-card/40 p-3">
            <div className="flex items-center gap-2 mb-1"><Icon size={12} className={color} /><span className="text-[10px] text-white/40">{label}</span></div>
            <div className={cn("text-lg font-bold font-mono", color)}>{String(value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LatticeBrowserPage() {
  const [tab, setTab] = useState("search");
  const { data: stats } = useQuery<any>({ queryKey: ["/api/lattice/stats"], refetchInterval: 30000 });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black text-white">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-black/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-1">
          <Globe className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-bold text-cyan-400 tracking-wide">LATTICE</span>
        </div>
        <div className="flex gap-0.5 ml-2 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-all whitespace-nowrap",
                tab === t.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[10px] text-white/30 shrink-0">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-green-500" />
            <span>SECURED</span>
          </div>
          <div className="flex items-center gap-1">
            <Network className="w-3 h-3 text-violet-500" />
            <span>{stats?.totalSites || "—"} SITES</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "search" && <SearchTab stats={stats} />}
        {tab === "browser" && <BrowserTab />}
        {tab === "members" && <MembersTab />}
        {tab === "gateways" && <GatewaysTab />}
        {tab === "vitals" && <VitalsTab />}
      </div>
    </div>
  );
}
