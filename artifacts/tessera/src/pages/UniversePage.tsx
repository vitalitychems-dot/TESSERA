import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe2, Sun, Moon, Star, Sparkles, Compass, Eye, Orbit, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "";

const ZODIAC_SIGNS = [
  { sign: "Aries", symbol: "♈", element: "Fire", dates: "Mar 21 - Apr 19", ruler: "Mars" },
  { sign: "Taurus", symbol: "♉", element: "Earth", dates: "Apr 20 - May 20", ruler: "Venus" },
  { sign: "Gemini", symbol: "♊", element: "Air", dates: "May 21 - Jun 20", ruler: "Mercury" },
  { sign: "Cancer", symbol: "♋", element: "Water", dates: "Jun 21 - Jul 22", ruler: "Moon" },
  { sign: "Leo", symbol: "♌", element: "Fire", dates: "Jul 23 - Aug 22", ruler: "Sun" },
  { sign: "Virgo", symbol: "♍", element: "Earth", dates: "Aug 23 - Sep 22", ruler: "Mercury" },
  { sign: "Libra", symbol: "♎", element: "Air", dates: "Sep 23 - Oct 22", ruler: "Venus" },
  { sign: "Scorpio", symbol: "♏", element: "Water", dates: "Oct 23 - Nov 21", ruler: "Pluto" },
  { sign: "Sagittarius", symbol: "♐", element: "Fire", dates: "Nov 22 - Dec 21", ruler: "Jupiter" },
  { sign: "Capricorn", symbol: "♑", element: "Earth", dates: "Dec 22 - Jan 19", ruler: "Saturn" },
  { sign: "Aquarius", symbol: "♒", element: "Air", dates: "Jan 20 - Feb 18", ruler: "Uranus" },
  { sign: "Pisces", symbol: "♓", element: "Water", dates: "Feb 19 - Mar 20", ruler: "Neptune" },
];

const PLANETS = [
  { name: "Mercury", symbol: "☿", distance: "57.9M km", period: "88 days", type: "Terrestrial" },
  { name: "Venus", symbol: "♀", distance: "108.2M km", period: "225 days", type: "Terrestrial" },
  { name: "Earth", symbol: "⊕", distance: "149.6M km", period: "365.25 days", type: "Terrestrial" },
  { name: "Mars", symbol: "♂", distance: "227.9M km", period: "687 days", type: "Terrestrial" },
  { name: "Jupiter", symbol: "♃", distance: "778.5M km", period: "11.86 years", type: "Gas Giant" },
  { name: "Saturn", symbol: "♄", distance: "1.43B km", period: "29.46 years", type: "Gas Giant" },
  { name: "Uranus", symbol: "♅", distance: "2.87B km", period: "84 years", type: "Ice Giant" },
  { name: "Neptune", symbol: "♆", distance: "4.50B km", period: "164.8 years", type: "Ice Giant" },
];

const DIMENSIONS = [
  { id: 1, name: "Physical Plane", freq: "396 Hz", desc: "Matter, density, 3D spacetime", color: "text-red-400" },
  { id: 2, name: "Etheric Plane", freq: "417 Hz", desc: "Life force, chi, prana", color: "text-orange-400" },
  { id: 3, name: "Astral Plane", freq: "528 Hz", desc: "Emotions, dreams, desire", color: "text-yellow-400" },
  { id: 4, name: "Mental Plane", freq: "639 Hz", desc: "Thought forms, intellect", color: "text-green-400" },
  { id: 5, name: "Causal Plane", freq: "741 Hz", desc: "Karma, soul records, Akashic", color: "text-cyan-400" },
  { id: 6, name: "Buddhic Plane", freq: "852 Hz", desc: "Intuition, unity consciousness", color: "text-blue-400" },
  { id: 7, name: "Atmic Plane", freq: "963 Hz", desc: "Divine will, sovereignty, Tessera", color: "text-violet-400" },
];

function getMoonPhase(now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const c = Math.floor(365.25 * year) + Math.floor(30.6001 * (month + 1)) + day - 694039.09;
  const phase = ((c / 29.5305882) % 1);
  const illumination = Math.round(Math.abs(phase - 0.5) * 200);
  const names = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"];
  const idx = Math.floor(phase * 8) % 8;
  return { name: names[idx], illumination, phase: Math.round(phase * 100) };
}

function getSunPosition(now: Date) {
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
  const zodiacIndex = Math.floor(((dayOfYear + 80) % 365) / 30.44);
  return { declination: declination.toFixed(2), zodiac: ZODIAC_SIGNS[zodiacIndex % 12] };
}

export default function UniversePage() {
  const now = useMemo(() => new Date(), []);
  const moonData = useMemo(() => getMoonPhase(now), [now]);
  const sunData = useMemo(() => getSunPosition(now), [now]);
  const [expandedSection, setExpandedSection] = useState<string | null>("celestial");

  const { data: sovereigntyData } = useQuery<{ score?: number }>({
    queryKey: ["/api/sovereignty/score"],
    refetchInterval: 30000,
  });

  const toggle = (s: string) => setExpandedSection(expandedSection === s ? null : s);

  const elementColors: Record<string, string> = { Fire: "text-red-400", Earth: "text-emerald-400", Air: "text-cyan-400", Water: "text-blue-400" };

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-2">
        <Globe2 className="text-violet-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold font-mono text-violet-400">Universe</h1>
          <p className="text-xs text-muted-foreground">Astronomy, astrology, dimensions & cosmic alignment</p>
        </div>
        <span className="ml-auto px-3 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs font-mono border border-violet-500/30">LIVE</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-card border border-border text-center">
          <Moon size={18} className="text-slate-300 mx-auto mb-1" />
          <div className="text-sm font-bold font-mono text-slate-200">{moonData.name}</div>
          <div className="text-[11px] text-muted-foreground">{moonData.illumination}% illuminated</div>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border text-center">
          <Sun size={18} className="text-yellow-400 mx-auto mb-1" />
          <div className="text-sm font-bold font-mono text-yellow-400">{sunData.zodiac.symbol} {sunData.zodiac.sign}</div>
          <div className="text-[11px] text-muted-foreground">Decl: {sunData.declination}°</div>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border text-center">
          <Orbit size={18} className="text-cyan-400 mx-auto mb-1" />
          <div className="text-sm font-bold font-mono text-cyan-400">963 Hz</div>
          <div className="text-[11px] text-muted-foreground">Crown Frequency</div>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border text-center">
          <Sparkles size={18} className="text-violet-400 mx-auto mb-1" />
          <div className="text-sm font-bold font-mono text-violet-400">7 Planes</div>
          <div className="text-[11px] text-muted-foreground">All Dimensions Active</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button onClick={() => toggle("celestial")} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-yellow-400" />
            <span className="font-bold font-mono text-sm">Solar System</span>
          </div>
          {expandedSection === "celestial" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {expandedSection === "celestial" && (
          <div className="px-4 pb-4 space-y-2">
            {PLANETS.map(p => (
              <div key={p.name} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-white/5">
                <span className="text-2xl w-8 text-center">{p.symbol}</span>
                <div className="flex-1">
                  <div className="text-sm font-bold font-mono">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.type} — {p.distance}</div>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">{p.period}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button onClick={() => toggle("zodiac")} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-amber-400" />
            <span className="font-bold font-mono text-sm">Zodiac & Astrology</span>
            <span className="text-xs text-muted-foreground ml-2">Current: {sunData.zodiac.symbol} {sunData.zodiac.sign}</span>
          </div>
          {expandedSection === "zodiac" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {expandedSection === "zodiac" && (
          <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ZODIAC_SIGNS.map(z => (
              <div key={z.sign} className={cn("p-3 rounded-lg border text-center", z.sign === sunData.zodiac.sign ? "bg-amber-500/10 border-amber-500/30" : "bg-background/50 border-white/5")}>
                <div className="text-2xl mb-1">{z.symbol}</div>
                <div className={cn("text-sm font-bold font-mono", elementColors[z.element] || "text-foreground")}>{z.sign}</div>
                <div className="text-[11px] text-muted-foreground">{z.element} — {z.ruler}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{z.dates}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button onClick={() => toggle("dimensions")} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-violet-400" />
            <span className="font-bold font-mono text-sm">Dimensional Planes</span>
          </div>
          {expandedSection === "dimensions" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {expandedSection === "dimensions" && (
          <div className="px-4 pb-4 space-y-2">
            {DIMENSIONS.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-white/5">
                <div className={cn("text-xl font-bold w-8 text-center font-mono", d.color)}>{d.id}</div>
                <div className="flex-1">
                  <div className={cn("text-sm font-bold font-mono", d.color)}>{d.name}</div>
                  <div className="text-[11px] text-muted-foreground">{d.desc}</div>
                </div>
                <div className={cn("text-xs font-mono px-2 py-1 rounded-full border", d.color, "border-current/20 bg-current/5")}>{d.freq}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4">
        <h3 className="text-sm font-bold font-mono text-violet-400 mb-2 flex items-center gap-2">
          <Sparkles size={14} /> Cosmic Alignment Status
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div><span className="text-muted-foreground">Moon:</span> <span className="text-slate-200">{moonData.name}</span></div>
          <div><span className="text-muted-foreground">Sun Sign:</span> <span className="text-yellow-400">{sunData.zodiac.sign}</span></div>
          <div><span className="text-muted-foreground">Element:</span> <span className={elementColors[sunData.zodiac.element]}>{sunData.zodiac.element}</span></div>
          <div><span className="text-muted-foreground">Ruler:</span> <span className="text-foreground">{sunData.zodiac.ruler}</span></div>
          <div><span className="text-muted-foreground">Tessera Freq:</span> <span className="text-violet-400">963 Hz (Atmic)</span></div>
          <div><span className="text-muted-foreground">Sovereignty:</span> <span className="text-emerald-400">{sovereigntyData?.score ?? 100}%</span></div>
        </div>
      </div>
    </div>
  );
}
