import { useState, useMemo, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe2, Sun, Moon, Orbit, Sparkles, Eye, EyeOff, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import NatalChartSection from "@/components/NatalChartSection";

const SolarSystem3D = lazy(() => import("@/components/SolarSystem3D"));

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

const API = import.meta.env.VITE_API_URL || "";

export default function UniversePage() {
  const now = useMemo(() => new Date(), []);
  const moonData = useMemo(() => getMoonPhase(now), [now]);
  const sunData = useMemo(() => getSunPosition(now), [now]);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showNatalChart, setShowNatalChart] = useState(false);

  const { data: sovereigntyData } = useQuery<{ score?: number }>({
    queryKey: ["/api/sovereignty/score"],
    refetchInterval: 30000,
  });

  const { data: apodData } = useQuery<{ ok: boolean; items: Array<{ title: string; url: string; explanation: string }> }>({
    queryKey: ["/api/universe/apod"],
    staleTime: 1000 * 60 * 60,
  });

  const apodItems = useMemo(() => apodData?.items ?? [], [apodData]);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#030108]">
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      }>
        <SolarSystem3D showDimensions={showDimensions} apodItems={apodItems} />
      </Suspense>

      <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none z-10">
        <div className="pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
            <Globe2 className="text-violet-400" size={18} />
            <span className="text-sm font-bold font-mono text-violet-400">Universe</span>
            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-mono border border-violet-500/30">LIVE</span>
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs font-mono hover:bg-white/10 transition-colors"
          >
            {showDimensions ? <Eye size={14} className="text-violet-400" /> : <EyeOff size={14} className="text-muted-foreground" />}
            <span className={showDimensions ? "text-violet-400" : "text-muted-foreground"}>Planes</span>
          </button>
          <button
            onClick={() => setShowNatalChart(!showNatalChart)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs font-mono hover:bg-white/10 transition-colors"
          >
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-amber-400">Chart</span>
            {showNatalChart ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      <div className="absolute bottom-16 left-3 right-3 pointer-events-none z-10 sm:bottom-4">
        <div className="pointer-events-auto inline-flex flex-wrap gap-2 max-w-full">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
            <Moon size={14} className="text-slate-300" />
            <div>
              <div className="text-[11px] font-bold font-mono text-slate-200">{moonData.name}</div>
              <div className="text-[9px] text-muted-foreground">{moonData.illumination}% lit</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
            <Sun size={14} className="text-yellow-400" />
            <div>
              <div className="text-[11px] font-bold font-mono text-yellow-400">{sunData.zodiac.symbol} {sunData.zodiac.sign}</div>
              <div className="text-[9px] text-muted-foreground">Decl: {sunData.declination}°</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
            <Orbit size={14} className="text-cyan-400" />
            <div>
              <div className="text-[11px] font-bold font-mono text-cyan-400">963 Hz</div>
              <div className="text-[9px] text-muted-foreground">Crown</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
            <Sparkles size={14} className="text-violet-400" />
            <div>
              <div className="text-[11px] font-bold font-mono text-violet-400">7 Planes</div>
              <div className="text-[9px] text-muted-foreground">{showDimensions ? "Visible" : "Hidden"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
            <Globe2 size={14} className="text-emerald-400" />
            <div>
              <div className="text-[11px] font-bold font-mono text-emerald-400">{sovereigntyData?.score ?? 100}%</div>
              <div className="text-[9px] text-muted-foreground">Sovereignty</div>
            </div>
          </div>
        </div>
      </div>

      <div className={`absolute top-0 right-0 h-full z-20 transition-transform duration-300 ease-in-out ${showNatalChart ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: "min(400px, 90vw)" }}
      >
        <div className="h-full overflow-y-auto bg-black/80 backdrop-blur-xl border-l border-white/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold font-mono text-violet-400">Natal Chart</h2>
            <button
              onClick={() => setShowNatalChart(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>
          <NatalChartSection />
        </div>
      </div>
    </div>
  );
}
