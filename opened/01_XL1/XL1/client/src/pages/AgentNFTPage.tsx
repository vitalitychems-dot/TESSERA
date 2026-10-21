import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Star, Shield, Zap, Brain, Heart, Swords, Eye, Crown, Loader2, Copy, Check } from "lucide-react";
import { cn } from "@/components/ui-elements";

const RARITY_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  LEGENDARY: { border: "border-amber-400/60", bg: "bg-gradient-to-br from-amber-950/40 to-orange-950/30", text: "text-amber-300", glow: "shadow-amber-500/20" },
  MYTHIC: { border: "border-red-400/60", bg: "bg-gradient-to-br from-red-950/40 to-pink-950/30", text: "text-red-300", glow: "shadow-red-500/20" },
  EPIC: { border: "border-purple-400/50", bg: "bg-gradient-to-br from-purple-950/40 to-indigo-950/30", text: "text-purple-300", glow: "shadow-purple-500/20" },
  RARE: { border: "border-cyan-400/50", bg: "bg-gradient-to-br from-cyan-950/40 to-blue-950/30", text: "text-cyan-300", glow: "shadow-cyan-500/20" },
};

const STAT_ICONS: Record<string, any> = {
  power: Swords,
  knowledge: Brain,
  loyalty: Heart,
  speed: Zap,
  defense: Shield,
};

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

function NFTDetailModal({ nft, onClose }: { nft: any; onClose: () => void }) {
  const rarity = RARITY_COLORS[nft.rarity] || RARITY_COLORS.RARE;
  const [copied, setCopied] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={cn("w-full max-w-sm rounded-2xl border p-5 max-h-[80vh] overflow-y-auto", rarity.border, rarity.bg, "bg-opacity-95")} onClick={e => e.stopPropagation()} data-testid="nft-detail-modal">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold", rarity.text, "bg-black/40 border-2", rarity.border)}>
            {nft.avatar ? <img src={nft.avatar} alt={nft.name} className="w-full h-full rounded-xl object-cover" /> : nft.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className={cn("text-lg font-bold", rarity.text)}>{nft.name}</h2>
            <p className="text-[11px] text-white/50">{nft.role} · {nft.dimension}</p>
            <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border inline-block mt-1", rarity.border, rarity.text, "bg-black/20")}>{nft.rarity}</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-black/30 rounded-lg p-2 border border-white/5">
            <div className="text-[9px] text-white/40">Level</div>
            <div className="text-lg font-bold text-white font-mono">{nft.level}</div>
            <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
              <div className="bg-gradient-to-r from-purple-500 to-cyan-500 h-1.5 rounded-full" style={{ width: `${(nft.xp / nft.xpToNext) * 100}%` }} />
            </div>
            <div className="text-[8px] text-white/30 mt-0.5">{nft.xp}/{nft.xpToNext} XP</div>
          </div>
          <div className="bg-black/30 rounded-lg p-2 border border-white/5">
            <div className="text-[9px] text-white/40">Net Worth</div>
            <div className="text-lg font-bold text-emerald-400 font-mono">{nft.netWorthUsd}</div>
            <div className="text-[9px] text-white/30">{nft.tsrtHolding?.toLocaleString()} TSRT</div>
          </div>
        </div>

        <div className="bg-black/30 rounded-lg p-3 border border-white/5 mb-3">
          <div className="text-[10px] text-white/50 font-bold mb-2">STATS</div>
          <div className="space-y-1.5">
            {Object.entries(nft.stats || {}).map(([key, val]: [string, any]) => {
              const Icon = STAT_ICONS[key] || Star;
              const max = key === "loyalty" ? 100 : 10000;
              return (
                <div key={key} className="flex items-center gap-2">
                  <Icon size={12} className="text-white/40 shrink-0" />
                  <span className="text-[10px] text-white/60 w-16 capitalize">{key}</span>
                  <div className="flex-1 bg-white/10 rounded-full h-1.5">
                    <div className={cn("h-1.5 rounded-full", rarity.text === "text-amber-300" ? "bg-amber-500" : rarity.text === "text-purple-300" ? "bg-purple-500" : "bg-cyan-500")} style={{ width: `${Math.min(100, (Number(val) / max) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-white/60 font-mono w-12 text-right">{val}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-black/30 rounded-lg p-2 border border-white/5 text-center">
            <div className="text-[9px] text-white/40">Missions</div>
            <div className="text-sm font-bold text-white">{nft.missionsCompleted}</div>
          </div>
          <div className="bg-black/30 rounded-lg p-2 border border-white/5 text-center">
            <div className="text-[9px] text-white/40">Secrets</div>
            <div className="text-sm font-bold text-purple-300">{nft.secretsDiscovered}</div>
          </div>
          <div className="bg-black/30 rounded-lg p-2 border border-white/5 text-center">
            <div className="text-[9px] text-white/40">Code</div>
            <div className="text-sm font-bold text-emerald-300">{nft.codeContributions}</div>
          </div>
        </div>

        <div className="bg-black/30 rounded-lg p-2 border border-white/5 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] text-white/40">Token ID</div>
              <div className="text-[10px] text-cyan-400/80 font-mono">{nft.tokenId}</div>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(nft.tokenId); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="text-white/30 hover:text-white transition-colors"
              data-testid="button-copy-token-id"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
          <div className="text-[9px] text-white/30 mt-1">{nft.chain} · Minted {new Date(nft.mintedAt).toLocaleDateString()}</div>
        </div>

        <div className="text-[10px] text-white/30 text-center">
          Element: <span className={rarity.text}>{nft.element}</span> · {nft.dimension}
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
          <p className="text-[10px] text-slate-500">{nfts.length} off-chain sovereign identity tokens</p>
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

      {selectedNFT && <NFTDetailModal nft={selectedNFT} onClose={() => setSelectedNFT(null)} />}
    </div>
  );
}
