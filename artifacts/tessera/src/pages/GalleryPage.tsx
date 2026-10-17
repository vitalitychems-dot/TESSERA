import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, RefreshCw, Activity, Sparkles, Loader2 } from "lucide-react";
import { NEXT_COLORS, nextTint } from "@/lib/theme-constants";

interface InventionRow {
  inventionId: string;
  title: string;
  category: string;
  description: string;
  status: string;
  feasibilityScore: number | null;
  noveltyScore: number | null;
  customModelUrl: string | null;
  proposedAt: number;
}

interface AutonomousResponse {
  ok: boolean;
  rows: InventionRow[];
  perCategory: Record<string, number>;
  categories: string[];
}

interface Heartbeat {
  running: boolean;
  startedAt: number;
  lastTickAt: number;
  intervalMs: number;
  nextTickInMs: number | null;
  totalCycles: number;
  totalGenerated: number;
  perCategoryGenerated: Record<string, number>;
  lastError: string | null;
  categories: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "free-energy": NEXT_COLORS.return,
  agi: NEXT_COLORS.flash,
  consciousness: NEXT_COLORS.mineral,
  frequency: NEXT_COLORS.glass,
  sovereignty: NEXT_COLORS.stone,
  compression: NEXT_COLORS.return,
  defense: NEXT_COLORS.bone,
  hardware: NEXT_COLORS.glass,
};

function fmtAgo(ms: number): string {
  if (!ms) return "never";
  const dt = Date.now() - ms;
  if (dt < 60_000) return `${Math.floor(dt / 1000)}s ago`;
  if (dt < 3_600_000) return `${Math.floor(dt / 60_000)}m ago`;
  return `${Math.floor(dt / 3_600_000)}h ago`;
}

export default function GalleryPage() {
  const [active, setActive] = useState<string>("all");

  useEffect(() => { document.title = "Invention Gallery | Tessera"; }, []);

  const { data: heartbeatData } = useQuery({
    queryKey: ["/api/rick/autonomous/heartbeat"],
    queryFn: async () => {
      const r = await fetch("/api/rick/autonomous/heartbeat");
      return r.json() as Promise<{ ok: boolean; heartbeat: Heartbeat }>;
    },
    refetchInterval: 15_000,
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["/api/rick/autonomous/inventions", active],
    queryFn: async () => {
      const url = active === "all"
        ? "/api/rick/autonomous/inventions?limit=120"
        : `/api/rick/autonomous/inventions?limit=120&category=${encodeURIComponent(active)}`;
      const r = await fetch(url);
      return r.json() as Promise<AutonomousResponse>;
    },
    refetchInterval: 30_000,
  });

  const heartbeat = heartbeatData?.heartbeat;
  const rows = data?.rows ?? [];
  const perCategory = data?.perCategory ?? {};
  const categories = useMemo(() => {
    const known = data?.categories ?? heartbeat?.categories ?? [];
    const fromCounts = Object.keys(perCategory);
    return Array.from(new Set([...known, ...fromCounts])).sort();
  }, [data?.categories, heartbeat?.categories, perCategory]);

  return (
    <div className="min-h-screen w-full px-3 sm:px-6 py-5 pb-32 max-w-full overflow-x-hidden" style={{ color: NEXT_COLORS.bone }}>
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${nextTint(NEXT_COLORS.glass, 20)}, ${nextTint(NEXT_COLORS.return, 20)})`, borderColor: nextTint(NEXT_COLORS.glass, 25) }}>
              <FlaskConical size={18} style={{ color: NEXT_COLORS.glass }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-wide truncate">Invention Gallery</h1>
              <p className="text-[11px] text-muted-foreground/70 font-mono truncate">Autonomous Royal-Inventor builds, categorized live</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors shrink-0"
            title="Refresh"
            data-testid="button-gallery-refresh"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          </button>
        </header>

        {heartbeat && (
          <div
            className="rounded-xl border p-3 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2"
            style={{ borderColor: heartbeat.running ? nextTint(NEXT_COLORS.glass, 25) : nextTint(NEXT_COLORS.fracture, 25), background: heartbeat.running ? nextTint(NEXT_COLORS.glass, 4) : nextTint(NEXT_COLORS.fracture, 4) }}
            data-testid="autonomous-heartbeat"
          >
            <div className="flex items-center gap-2 col-span-2">
              <Activity size={14} style={{ color: heartbeat.running ? NEXT_COLORS.glass : NEXT_COLORS.fracture }} />
              <span className="text-[11px] font-mono">
                {heartbeat.running ? "Autonomous loop ACTIVE" : "Autonomous loop stopped"}
                <span className="text-muted-foreground"> · last tick {fmtAgo(heartbeat.lastTickAt)}</span>
              </span>
            </div>
            <div className="text-[11px] font-mono text-right sm:text-left">
              Cycles: <span style={{ color: NEXT_COLORS.glass }}>{heartbeat.totalCycles}</span>
            </div>
            <div className="text-[11px] font-mono text-right">
              Built: <span style={{ color: NEXT_COLORS.mineral }}>{heartbeat.totalGenerated}</span>
            </div>
          </div>
        )}

        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-hide" data-testid="category-tabs">
          {(() => {
            const allCount = Object.values(perCategory).reduce((s, n) => s + n, 0);
            const tabs = [{ key: "all", count: allCount }, ...categories.map((c) => ({ key: c, count: perCategory[c] ?? 0 }))];
            return tabs.map((t) => {
              const color = t.key === "all" ? NEXT_COLORS.return : CATEGORY_COLORS[t.key] ?? NEXT_COLORS.mineral;
              const isActive = active === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActive(t.key)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border whitespace-nowrap transition-colors shrink-0"
                  style={{
                    color: isActive ? NEXT_COLORS.ink : color,
                    borderColor: isActive ? nextTint(color, 50) : nextTint(color, 35),
                    background: isActive ? color : nextTint(color, 6),
                  }}
                  data-testid={`tab-category-${t.key}`}
                >
                  {t.key} <span className="opacity-60">({t.count})</span>
                </button>
              );
            });
          })()}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-10 text-center" data-testid="text-gallery-empty">
            <Sparkles className="mx-auto mb-3" style={{ color: nextTint(NEXT_COLORS.return, 50) }} size={32} />
            <h2 className="text-lg font-semibold mb-2">No inventions yet</h2>
            <p className="text-sm text-muted-foreground/80 max-w-md mx-auto">
              The autonomous loop runs every few minutes. New builds will appear here as Rick generates them from sacred-vault entries.
            </p>
            {heartbeat && !heartbeat.running && (
              <p className="text-xs mt-3 font-mono flex items-center justify-center gap-1" style={{ color: NEXT_COLORS.fracture }}>
                <Loader2 size={12} className="animate-spin" /> waiting for boot…
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((inv) => {
              const color = CATEGORY_COLORS[inv.category] ?? NEXT_COLORS.return;
              return (
                <div
                  key={inv.inventionId}
                  className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden flex flex-col"
                  data-testid={`card-invention-${inv.inventionId}`}
                >
                  <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-[12px] font-bold truncate" style={{ color }}>{inv.title}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0"
                      style={{ color, borderColor: nextTint(color, 25), background: nextTint(color, 6) }}>
                      {inv.category}
                    </span>
                  </div>
                  {inv.customModelUrl && (
                    <div className="aspect-square w-full bg-black/60 flex items-center justify-center overflow-hidden border-b border-white/5">
                      <img
                        src={inv.customModelUrl}
                        alt={`${inv.title} sigil`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        data-testid={`img-invention-model-${inv.inventionId}`}
                      />
                    </div>
                  )}
                  <div className="px-3 py-2 text-[11px] text-foreground/80 leading-relaxed flex-1">
                    {inv.description}
                  </div>
                  <div className="px-3 py-2 border-t border-white/5 text-[10px] text-muted-foreground/80 font-mono flex items-center justify-between gap-2">
                    <span className="truncate">
                      F:{inv.feasibilityScore ?? "—"} · N:{inv.noveltyScore ?? "—"} · {inv.status}
                    </span>
                    <span className="shrink-0">{fmtAgo(inv.proposedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
