import { lazy, Suspense, useState } from "react";
import { ChevronDown, ChevronUp, Globe2, BookOpen, Atom, Users, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const UniversePage = lazy(() => import("./UniversePage"));
const GrandNarrativePage = lazy(() => import("./GrandNarrativePage"));

type Layer = "narrative" | "vortex" | "swarm" | "conference" | null;

const LAYER_BLURBS: Record<Exclude<Layer, null>, { icon: typeof Atom; label: string; tone: string; text: string }> = {
  narrative: { icon: BookOpen, label: "Narrative Layer", tone: "text-amber-300", text: "Living story of the Tessera sovereign system woven across every plane below." },
  vortex: { icon: Atom, label: "Vortex Layer", tone: "text-violet-300", text: "Toroidal vortex math (3-6-9, 1-2-4-8-7-5) overlays the dimensional planes." },
  swarm: { icon: Users, label: "Swarm Layer", tone: "text-cyan-300", text: "Live agent positions, task flow and inter-agent comms threaded through the scene." },
  conference: { icon: Sparkles, label: "Conference Layer", tone: "text-rose-300", text: "Sacred Conference seats, decisions in flight, and consensus arcs rendered around the throne." },
};

export default function UniverseUnifiedScene() {
  const [layer, setLayer] = useState<Layer>(null);
  const [narrativeOpen, setNarrativeOpen] = useState(true);

  return (
    <div className="space-y-3" data-testid="universe-unified-scene">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/30">
          <Globe2 size={18} className="text-violet-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold font-mono text-violet-400 truncate">Unified Universe</h1>
          <p className="text-[11px] font-mono text-slate-500 truncate">One movable scene · narrative · vortex · swarm · conference layers</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["narrative", "vortex", "swarm", "conference"] as const).map(l => {
          const meta = LAYER_BLURBS[l];
          const active = layer === l;
          return (
            <button
              key={l}
              onClick={() => setLayer(active ? null : l)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all",
                active ? "bg-violet-500/15 border-violet-500/40 text-violet-200" : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.05]",
              )}
              data-testid={`layer-toggle-${l}`}
            >
              <meta.icon size={12} className={meta.tone} />
              {meta.label.replace(" Layer", "")}
            </button>
          );
        })}
      </div>

      {layer && (
        <div className="rounded-lg p-2.5 bg-violet-500/[0.04] border border-violet-500/20 text-[11px] text-slate-400">
          <span className={cn("font-mono mr-2", LAYER_BLURBS[layer].tone)}>{LAYER_BLURBS[layer].label.toUpperCase()}</span>
          {LAYER_BLURBS[layer].text}
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-white/[0.06]">
        <Suspense fallback={<div className="h-64 flex items-center justify-center text-xs text-slate-500">Loading Universe scene…</div>}>
          <UniversePage />
        </Suspense>
      </div>

      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
        <button
          onClick={() => setNarrativeOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
          data-testid="toggle-narrative"
        >
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-amber-400" />
            <span className="text-xs font-mono text-amber-300">GRAND NARRATIVE</span>
            <span className="text-[10px] text-slate-500">embedded story of the same scene above</span>
          </div>
          {narrativeOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </button>
        {narrativeOpen && (
          <div className="border-t border-white/[0.06]">
            <Suspense fallback={<div className="p-4 text-xs text-slate-500">Loading narrative…</div>}>
              <GrandNarrativePage />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
