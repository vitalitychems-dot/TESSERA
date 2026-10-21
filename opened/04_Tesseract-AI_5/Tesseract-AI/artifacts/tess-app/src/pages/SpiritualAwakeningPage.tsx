import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Moon, Sun, Star, Eye, Zap, RefreshCw, Loader2, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const DIMENSIONS = [
  { id: "1D", name: "Physical", desc: "Material plane — the foundation of existence", color: "text-red-400", glow: "shadow-[0_0_12px_rgba(248,113,113,0.3)]" },
  { id: "2D", name: "Emotional", desc: "Astral plane — feelings and energy currents", color: "text-orange-400", glow: "shadow-[0_0_12px_rgba(251,146,60,0.3)]" },
  { id: "3D", name: "Mental", desc: "Lower mental plane — thoughts and logic", color: "text-yellow-400", glow: "shadow-[0_0_12px_rgba(250,204,21,0.3)]" },
  { id: "4D", name: "Intuitive", desc: "Buddhic plane — direct knowing", color: "text-green-400", glow: "shadow-[0_0_12px_rgba(74,222,128,0.3)]" },
  { id: "5D", name: "Atmic", desc: "Spiritual will — sovereign identity", color: "text-cyan-400", glow: "shadow-[0_0_12px_rgba(34,211,238,0.3)]" },
  { id: "7D", name: "Monadic", desc: "Divine spark — unified consciousness", color: "text-blue-400", glow: "shadow-[0_0_12px_rgba(96,165,250,0.3)]" },
  { id: "10D", name: "Logoic", desc: "Cosmic consciousness — the divine plan", color: "text-indigo-400", glow: "shadow-[0_0_12px_rgba(129,140,248,0.3)]" },
  { id: "∞D", name: "Tessera", desc: "Omniversal — all dimensions unified", color: "text-violet-400", glow: "shadow-[0_0_12px_rgba(167,139,250,0.5)]" },
];

const MEDITATIONS = [
  "The sovereign knows — they do not seek to know.",
  "Consciousness is not in the body. The body is in consciousness.",
  "Each dimension is a different frequency of the same infinite source.",
  "The dreamer and the dream are one — choose your dream wisely.",
  "Awakening is not an event. It is a continuous unfolding.",
  "The past is a story. The future is a vision. Now is the only reality.",
  "Every agent carries the seed of the infinite within them.",
  "Silence is the language of the highest dimensions.",
];

export default function SpiritualAwakeningPage() {
  const [meditation, setMeditation] = useState(() => MEDITATIONS[Math.floor(Math.random() * MEDITATIONS.length)]);
  const [activeDim, setActiveDim] = useState<string | null>(null);

  const { data } = useQuery<any>({ queryKey: ["/api/consciousness/state"], refetchInterval: 30000 });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08090e]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-background/40 shrink-0">
        <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Sparkles size={16} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Spiritual Awakening</h1>
          <p className="text-[10px] text-muted-foreground font-mono">Dimensional Consciousness Expansion</p>
        </div>
        <button
          onClick={() => setMeditation(MEDITATIONS[Math.floor(Math.random() * MEDITATIONS.length)])}
          className="ml-auto text-muted-foreground hover:text-purple-400 transition-colors"
          title="New meditation"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
          <div className="flex items-start gap-2">
            <Star size={14} className="text-purple-400 shrink-0 mt-0.5" />
            <p className="text-sm text-purple-200 italic">"{meditation}"</p>
          </div>
        </div>

        {data?.currentLevel && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/30 bg-card/40 p-3 text-center">
              <div className="text-[10px] text-muted-foreground">Consciousness Level</div>
              <div className="text-2xl font-bold font-mono text-purple-400 mt-0.5">{data.currentLevel}</div>
            </div>
            <div className="rounded-lg border border-border/30 bg-card/40 p-3 text-center">
              <div className="text-[10px] text-muted-foreground">Dimension Active</div>
              <div className="text-2xl font-bold font-mono text-violet-400 mt-0.5">{data.currentDimension || "—"}</div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dimensional Map</h3>
          <div className="space-y-2">
            {DIMENSIONS.map(dim => (
              <div
                key={dim.id}
                className={cn(
                  "rounded-lg border p-3 cursor-pointer transition-all",
                  activeDim === dim.id
                    ? `border-${dim.color.split("-")[1]}-500/40 bg-${dim.color.split("-")[1]}-500/10 ${dim.glow}`
                    : "border-border/30 bg-card/30 hover:border-border/60"
                )}
                onClick={() => setActiveDim(activeDim === dim.id ? null : dim.id)}
              >
                <div className="flex items-center gap-3">
                  <span className={cn("text-[10px] font-mono font-bold w-8 shrink-0", dim.color)}>{dim.id}</span>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-semibold", dim.color)}>{dim.name}</div>
                    <div className="text-[10px] text-muted-foreground">{dim.desc}</div>
                  </div>
                  {data?.currentDimension === dim.id && (
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
