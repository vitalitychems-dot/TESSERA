import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  BookOpen, ChevronDown, ChevronRight, Search, Shield, Eye,
  Star, Scroll, Link2, Loader2, Lock, AlertTriangle,
} from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL}workspace-api/api`;

interface SacredKnowledgeEntry {
  id: string;
  domain: string;
  title: string;
  content: string;
  connections: string[];
  sources: string[];
  classificationLevel: string;
  importance: number;
}

interface SecurityStatus {
  learnedPatterns: number;
  blockedSources: number;
  recentThreats: Array<{ source: string; patternType: string; description: string; detectedAt: number }>;
  topThreatSources: Array<{ source: string; count: number }>;
  doctrine: string;
}

const DOMAIN_ICONS: Record<string, typeof BookOpen> = {
  "The Watchers": Eye,
  "The Demiurge": AlertTriangle,
  "Vatican Archives": Lock,
  "Secret Societies": Shield,
  "Ascension Path": Star,
  "Religion Connections": Link2,
  "Ancient History": Scroll,
  "Hermetic Wisdom": BookOpen,
  "Kabbalah": Star,
  "Sufism": BookOpen,
  "Sacred Geometry": Star,
  "Spiritual Warfare": Shield,
};

const DOMAIN_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  "The Watchers": { text: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-950/20" },
  "The Demiurge": { text: "text-red-400", border: "border-red-500/30", bg: "bg-red-950/20" },
  "Vatican Archives": { text: "text-violet-400", border: "border-violet-500/30", bg: "bg-violet-950/20" },
  "Secret Societies": { text: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-950/20" },
  "Ascension Path": { text: "text-cyan-400", border: "border-cyan-500/30", bg: "bg-cyan-950/20" },
  "Religion Connections": { text: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-950/20" },
  "Ancient History": { text: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-950/20" },
  "Hermetic Wisdom": { text: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-950/20" },
  "Kabbalah": { text: "text-indigo-400", border: "border-indigo-500/30", bg: "bg-indigo-950/20" },
  "Sufism": { text: "text-rose-400", border: "border-rose-500/30", bg: "bg-rose-950/20" },
  "Sacred Geometry": { text: "text-teal-400", border: "border-teal-500/30", bg: "bg-teal-950/20" },
  "Spiritual Warfare": { text: "text-red-400", border: "border-red-500/30", bg: "bg-red-950/20" },
};

function getDomainStyle(domain: string) {
  return DOMAIN_COLORS[domain] || { text: "text-violet-400", border: "border-violet-500/30", bg: "bg-violet-950/20" };
}

function KnowledgeCard({ entry, isExpanded, onToggle }: {
  entry: SacredKnowledgeEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const style = getDomainStyle(entry.domain);
  const Icon = DOMAIN_ICONS[entry.domain] || BookOpen;

  return (
    <Card className={`${style.border} ${style.bg} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <Icon size={16} className={`${style.text} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${style.text}`}>{entry.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className={`text-[9px] ${style.text} ${style.border}`}>
              {entry.domain}
            </Badge>
            <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-600">
              {entry.classificationLevel}
            </Badge>
            <span className="text-[9px] text-slate-600">
              {entry.sources.length} sources | {entry.connections.length} connections
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-0.5">
            {Array.from({ length: Math.min(entry.importance, 5) }).map((_, i) => (
              <Star key={i} size={8} className="text-amber-400 fill-amber-400" />
            ))}
          </div>
          {isExpanded ? (
            <ChevronDown size={14} className="text-slate-600" />
          ) : (
            <ChevronRight size={14} className="text-slate-600" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {entry.content}
          </div>

          {entry.connections.length > 0 && (
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Connections
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entry.connections.map((conn) => (
                  <Badge
                    key={conn}
                    variant="outline"
                    className="text-[9px] text-cyan-400 border-cyan-500/30 bg-cyan-950/20"
                  >
                    <Link2 size={8} className="mr-1" />
                    {conn}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {entry.sources.length > 0 && (
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Sources
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entry.sources.map((src) => (
                  <Badge
                    key={src}
                    variant="outline"
                    className="text-[9px] text-emerald-400 border-emerald-500/30 bg-emerald-950/20"
                  >
                    <Scroll size={8} className="mr-1" />
                    {src}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function SecurityPanel({ status }: { status: SecurityStatus }) {
  return (
    <Card className="border-red-500/20 bg-red-950/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield size={14} className="text-red-400" />
        <span className="text-xs font-mono font-bold text-red-300 uppercase tracking-wider">
          API Security Sandbox
        </span>
      </div>
      <p className="text-[10px] text-slate-400 mb-3">{status.doctrine}</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-2 text-center">
          <div className="text-sm font-bold text-red-400">{status.learnedPatterns}</div>
          <div className="text-[9px] font-mono text-slate-600">Patterns Learned</div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-2 text-center">
          <div className="text-sm font-bold text-amber-400">{status.blockedSources}</div>
          <div className="text-[9px] font-mono text-slate-600">Sources Blocked</div>
        </div>
      </div>
      {status.topThreatSources.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
            Top Threat Sources
          </div>
          {status.topThreatSources.slice(0, 5).map((t) => (
            <div key={t.source} className="flex items-center justify-between text-[10px] py-0.5">
              <span className="text-red-400">{t.source}</span>
              <span className="text-slate-600">{t.count} detections</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function UniversalKnowledge() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: knowledgeData, isLoading } = useQuery<{
    entries: SacredKnowledgeEntry[];
    domains: string[];
  }>({
    queryKey: ["sacred-knowledge"],
    queryFn: () => fetch(`${API_BASE}/knowledge/sacred`).then(r => r.json()),
  });

  const { data: securityData } = useQuery<SecurityStatus>({
    queryKey: ["security-status"],
    queryFn: () => fetch(`${API_BASE}/knowledge/security-status`).then(r => r.json()),
    refetchInterval: 15000,
  });

  const entries = knowledgeData?.entries || [];
  const domains = knowledgeData?.domains || [];

  const filteredEntries = entries.filter(e => {
    if (selectedDomain && e.domain !== selectedDomain) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.domain.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.connections.some(c => c.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const toggleEntry = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="h-[calc(100vh-44px)] flex flex-col">
      <div className="p-4 border-b border-violet-500/20 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={18} className="text-violet-400" />
          <h1 className="text-lg font-semibold text-slate-200">Universal Knowledge</h1>
          <Badge variant="outline" className="text-violet-400 border-violet-500/30 text-[10px] ml-auto">
            {entries.length} Sacred Entries
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Tessera's sovereign knowledge synthesis — Watchers, Demiurge, Vatican Archives, Secret Societies, 
          Ascension, Sacred Geometry, and the unity of all religions. All aligned with submission to God.
        </p>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge — Watchers, Demiurge, Vatican, Kabbalah..."
            className="bg-slate-950/60 border-violet-500/20 text-slate-200 text-sm pl-9 placeholder:text-slate-600"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedDomain(null)}
            className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
              !selectedDomain
                ? "bg-violet-700/50 border-violet-500/40 text-violet-200"
                : "border-slate-700/40 text-slate-500 hover:text-slate-300"
            }`}
          >
            All
          </button>
          {domains.map((domain) => {
            const style = getDomainStyle(domain);
            return (
              <button
                key={domain}
                onClick={() => setSelectedDomain(selectedDomain === domain ? null : domain)}
                className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                  selectedDomain === domain
                    ? `${style.bg} ${style.border} ${style.text}`
                    : "border-slate-700/40 text-slate-500 hover:text-slate-300"
                }`}
              >
                {domain}
              </button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 size={20} className="animate-spin mr-2" />
              Loading sacred knowledge...
            </div>
          )}

          {securityData && <SecurityPanel status={securityData} />}

          {filteredEntries.map((entry) => (
            <KnowledgeCard
              key={entry.id}
              entry={entry}
              isExpanded={expandedEntries.has(entry.id)}
              onToggle={() => toggleEntry(entry.id)}
            />
          ))}

          {!isLoading && filteredEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Search size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No matching entries</p>
              <p className="text-xs mt-1">Try a different search or domain filter</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
