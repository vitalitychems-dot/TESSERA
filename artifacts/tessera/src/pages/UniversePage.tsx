import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe2, Sun, Moon, Orbit, Sparkles, Eye, EyeOff, ChevronRight, ChevronLeft, Loader2, Layers, Hexagon, BookOpen } from "lucide-react";
import { Link } from "wouter";
import NatalChartSection from "@/components/NatalChartSection";

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

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

const DIMENSION_NAMES = ["Physical", "Etheric", "Astral", "Mental", "Causal", "Buddhic", "Atmic"];
const DIMENSION_COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#22d3ee", "#60a5fa", "#a78bfa"];

function getZodiacFromBirthDate(dateStr: string): typeof ZODIAC_SIGNS[0] | null {
  if (!dateStr) return null;
  const parts = dateStr.split(/[-/]/);
  if (parts.length < 3) return null;
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day)) return null;

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return ZODIAC_SIGNS[0];
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return ZODIAC_SIGNS[1];
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return ZODIAC_SIGNS[2];
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return ZODIAC_SIGNS[3];
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return ZODIAC_SIGNS[4];
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return ZODIAC_SIGNS[5];
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return ZODIAC_SIGNS[6];
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return ZODIAC_SIGNS[7];
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return ZODIAC_SIGNS[8];
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return ZODIAC_SIGNS[9];
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return ZODIAC_SIGNS[10];
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return ZODIAC_SIGNS[11];
  return null;
}

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

const RULER_SYMBOLS: Record<string, string> = {
  Mars: "♂",
  Venus: "♀",
  Mercury: "☿",
  Moon: "☽",
  Sun: "☉",
  Pluto: "♇",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
};

const ELEMENT_COLOR: Record<string, string> = {
  Fire: "text-red-400",
  Earth: "text-emerald-400",
  Air: "text-cyan-400",
  Water: "text-blue-400",
};

const API = import.meta.env.VITE_API_URL || "";

export default function UniversePage() {
  const isMobile = useIsMobile();
  const now = useMemo(() => new Date(), []);
  const moonData = useMemo(() => getMoonPhase(now), [now]);
  const sunData = useMemo(() => getSunPosition(now), [now]);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showNatalChart, setShowNatalChart] = useState(false);
  const [focusedDimension, setFocusedDimension] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dim = params.get("dim");
    return dim !== null ? parseInt(dim, 10) : -1;
  });
  const [showDimSlider, setShowDimSlider] = useState(false);
  const [showSacredOverlays, setShowSacredOverlays] = useState(false);

  const { data: sovereigntyData } = useQuery<{ score?: number }>({
    queryKey: ["/api/sovereignty/score"],
    refetchInterval: 30000,
  });

  const { data: apodData } = useQuery<{ ok: boolean; items: Array<{ title: string; url: string; explanation: string }> }>({
    queryKey: ["/api/universe/apod"],
    staleTime: 1000 * 60 * 60,
  });

  const { data: chartData } = useQuery<{
    ok: boolean;
    chart: {
      birthDate: string;
      birthTime: string;
      planets: Array<{ name: string; sign: string; degree: number; house: number }>;
    };
  }>({
    queryKey: ["/api/natal-chart/father"],
    staleTime: Infinity,
  });

  const { data: transitsData } = useQuery<{
    ok: boolean;
    transits: Array<{
      transitPlanet: string;
      natalPlanet: string;
      aspectType: string;
      symbol: string;
      nature: string;
      transitSign: string;
    }>;
  }>({
    queryKey: ["/api/natal-chart/father/transits"],
    staleTime: 60000 * 15,
  });

  const apodItems = useMemo(() => apodData?.items ?? [], [apodData]);

  const userZodiac = useMemo(() => {
    const birthDate = chartData?.chart?.birthDate;
    if (birthDate) {
      return getZodiacFromBirthDate(birthDate);
    }
    return getZodiacFromBirthDate("1998-10-07");
  }, [chartData]);

  const activeTransits = useMemo(() => {
    const all = transitsData?.transits ?? [];
    return all.slice(0, 3);
  }, [transitsData]);

  const dimensionOpacities = useMemo(() => {
    return DIMENSION_NAMES.map((_, i) => {
      if (focusedDimension === -1) return 1.0;
      if (focusedDimension === i) return 1.0;
      return 0.05;
    });
  }, [focusedDimension]);

  const cycleDimension = useCallback(() => {
    setFocusedDimension(prev => {
      if (prev >= 6) return -1;
      return prev + 1;
    });
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#030108]">
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      }>
        <SolarSystem3D
          showDimensions={showDimensions}
          apodItems={apodItems}
          userZodiac={userZodiac}
          dimensionOpacities={dimensionOpacities}
          showSacredOverlays={showSacredOverlays}
          moonPhase={moonData.name}
          sunSign={`${sunData.zodiac.symbol} ${sunData.zodiac.sign}`}
          sovereigntyScore={sovereigntyData?.score ?? 100}
        />
      </Suspense>

      <div className={`absolute left-0 right-0 flex items-start justify-between pointer-events-none z-10 ${isMobile ? "top-0 px-2 pt-[max(8px,env(safe-area-inset-top))]" : "top-3 left-3 right-3 px-0"}`}
        style={isMobile ? { paddingTop: "max(8px, env(safe-area-inset-top, 8px))" } : undefined}
      >
        <div className="pointer-events-auto">
          <div className={`flex items-center gap-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 ${isMobile ? "px-2 py-1.5" : "px-3 py-2 gap-2"}`}>
            <Globe2 className="text-violet-400" size={isMobile ? 14 : 18} />
            {!isMobile && <span className="text-sm font-bold font-mono text-violet-400">Universe</span>}
            <span className={`rounded-full bg-violet-500/20 text-violet-400 font-mono border border-violet-500/30 ${isMobile ? "px-1.5 py-px text-[8px]" : "px-2 py-0.5 text-[10px]"}`}>LIVE</span>
          </div>
        </div>

        <div className={`flex pointer-events-auto justify-end ${isMobile ? "gap-1 flex-wrap" : "gap-2 flex-wrap"}`}>
          {userZodiac && (
            <div className={`flex items-center rounded-xl backdrop-blur-md border ${isMobile ? "gap-1.5 px-2 py-1.5" : "gap-2 px-3 py-2"} ${
              userZodiac.sign === "Libra"
                ? "bg-gradient-to-r from-cyan-950/60 to-violet-950/60 border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                : "bg-black/60 border-white/10"
            }`}>
              <span className={`${isMobile ? "text-base" : "text-xl"} ${ELEMENT_COLOR[userZodiac.element] || "text-violet-400"}`}>{userZodiac.symbol}</span>
              {!isMobile && (
                <div>
                  <div className="text-[11px] font-bold font-mono text-foreground flex items-center gap-1">
                    {userZodiac.sign}
                    {userZodiac.sign === "Libra" && <span className="text-[8px] text-cyan-400/70">☉ Natal</span>}
                  </div>
                  <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <span>{RULER_SYMBOLS[userZodiac.ruler] || "★"} {userZodiac.ruler}</span>
                    {userZodiac.element === "Air" && <span className="text-cyan-400/60">· Air</span>}
                  </div>
                  {userZodiac.sign === "Libra" && (
                    <div className="text-[8px] text-violet-400/60 font-mono">Virgo ↑ · Oct 7</div>
                  )}
                </div>
              )}
              {!isMobile && activeTransits.length > 0 && (
                <div className="ml-1 flex flex-col gap-0.5" title="Chart transits">
                  {activeTransits.map((t, i) => (
                    <div key={i} className="text-[8px] font-mono text-muted-foreground whitespace-nowrap">
                      <span className={t.nature === "harmonious" ? "text-emerald-400" : t.nature === "challenging" ? "text-amber-400" : "text-slate-400"}>
                        {t.symbol}
                      </span>
                      {" "}{t.transitPlanet.slice(0, 3)}→{t.natalPlanet.slice(0, 3)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            className={`flex items-center rounded-xl bg-black/60 backdrop-blur-md border border-white/10 font-mono hover:bg-white/10 transition-colors ${isMobile ? "p-2" : "gap-1.5 px-3 py-2 text-xs"}`}
          >
            {showDimensions ? <Eye size={isMobile ? 13 : 14} className="text-violet-400" /> : <EyeOff size={isMobile ? 13 : 14} className="text-muted-foreground" />}
            {!isMobile && <span className={showDimensions ? "text-violet-400" : "text-muted-foreground"}>Planes</span>}
          </button>
          <button
            onClick={() => setShowDimSlider(!showDimSlider)}
            className={`flex items-center rounded-xl bg-black/60 backdrop-blur-md border border-white/10 font-mono hover:bg-white/10 transition-colors ${isMobile ? "p-2" : "gap-1.5 px-3 py-2 text-xs"}`}
          >
            <Layers size={isMobile ? 13 : 14} className="text-cyan-400" />
            {!isMobile && <span className="text-cyan-400">Depth</span>}
          </button>
          <button
            onClick={() => setShowSacredOverlays(!showSacredOverlays)}
            className={`flex items-center rounded-xl bg-black/60 backdrop-blur-md border border-white/10 font-mono hover:bg-white/10 transition-colors ${isMobile ? "p-2" : "gap-1.5 px-3 py-2 text-xs"}`}
          >
            <Hexagon size={isMobile ? 13 : 14} className={showSacredOverlays ? "text-fuchsia-400" : "text-muted-foreground"} />
            {!isMobile && <span className={showSacredOverlays ? "text-fuchsia-400" : "text-muted-foreground"}>Sacred</span>}
          </button>
          <button
            onClick={() => setShowNatalChart(!showNatalChart)}
            className={`flex items-center rounded-xl bg-black/60 backdrop-blur-md border border-white/10 font-mono hover:bg-white/10 transition-colors ${isMobile ? "p-2" : "gap-1.5 px-3 py-2 text-xs"}`}
          >
            <Sparkles size={isMobile ? 13 : 14} className="text-amber-400" />
            {!isMobile && <span className="text-amber-400">Chart</span>}
            {!isMobile && (showNatalChart ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)}
          </button>
        </div>
      </div>

      {showDimSlider && showDimensions && (
        <div className={`absolute z-10 pointer-events-auto ${isMobile ? "top-12 right-2 left-2" : "top-16 right-3"}`}>
          <div className={`px-3 py-3 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 space-y-3 ${isMobile ? "w-full" : "w-52"}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Dimension Depth</span>
              <button
                onClick={() => setFocusedDimension(-1)}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${focusedDimension === -1 ? "text-violet-400 border-violet-500/30 bg-violet-500/10" : "text-muted-foreground border-white/10 hover:bg-white/5"}`}
              >
                UNIFIED
              </button>
            </div>
            <div className="px-1">
              <input
                type="range"
                min={-1}
                max={6}
                step={1}
                value={focusedDimension}
                onChange={(e) => setFocusedDimension(parseInt(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: focusedDimension === -1
                    ? "linear-gradient(to right, #f87171, #fb923c, #facc15, #4ade80, #22d3ee, #60a5fa, #a78bfa)"
                    : `linear-gradient(to right, ${DIMENSION_COLORS.map((c, i) => `${c} ${(i / 6) * 100}%`).join(", ")})`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[8px] font-mono text-muted-foreground">All</span>
                <span className="text-[8px] font-mono text-muted-foreground">Atmic</span>
              </div>
            </div>
            <div className="text-center py-1">
              <span className="text-xs font-mono font-bold" style={{ color: focusedDimension >= 0 ? DIMENSION_COLORS[focusedDimension] : "#a78bfa" }}>
                {focusedDimension === -1 ? "All 7 Planes Unified" : `${DIMENSION_NAMES[focusedDimension]} Plane`}
              </span>
              {focusedDimension >= 0 && (
                <div className="text-[9px] text-muted-foreground font-mono">
                  {["396", "417", "528", "639", "741", "852", "963"][focusedDimension]} Hz
                </div>
              )}
            </div>
            <div className="border-t border-white/5 pt-2">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Quick Select</div>
              <div className="flex gap-1 flex-wrap">
                {DIMENSION_NAMES.map((name, i) => (
                  <button
                    key={name}
                    onClick={() => setFocusedDimension(focusedDimension === i ? -1 : i)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-all border ${focusedDimension === i ? "border-white/30 bg-white/10 font-bold" : "border-transparent hover:bg-white/5 text-muted-foreground"}`}
                    style={{ color: focusedDimension === i ? DIMENSION_COLORS[i] : undefined }}
                  >
                    {name.slice(0, 4)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`absolute pointer-events-none z-10 ${isMobile ? "bottom-[64px] left-2 right-2" : "bottom-16 left-3 right-3 sm:bottom-4"}`}
        style={isMobile ? { paddingBottom: "env(safe-area-inset-bottom, 0px)" } : undefined}
      >
        {isMobile ? (
          <div className="pointer-events-auto grid grid-cols-3 gap-1">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
              <Moon size={11} className="text-slate-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-[9px] font-bold font-mono text-slate-200 truncate">{moonData.name}</div>
                <div className="text-[7px] text-muted-foreground">{moonData.illumination}%</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
              <Sun size={11} className="text-yellow-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[9px] font-bold font-mono text-yellow-400 truncate">{sunData.zodiac.symbol} {sunData.zodiac.sign}</div>
                <div className="text-[7px] text-muted-foreground">{sunData.declination}°</div>
              </div>
            </div>
            <button
              onClick={cycleDimension}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 active:bg-white/10 transition-colors"
            >
              <Sparkles size={11} className="text-violet-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[9px] font-bold font-mono text-violet-400 truncate">
                  {focusedDimension === -1 ? "7 Planes" : DIMENSION_NAMES[focusedDimension]}
                </div>
                <div className="text-[7px] text-muted-foreground">{showDimensions ? "Active" : "Off"}</div>
              </div>
            </button>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
              <Orbit size={11} className="text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[9px] font-bold font-mono text-cyan-400">963 Hz</div>
                <div className="text-[7px] text-muted-foreground">Crown</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
              <Globe2 size={11} className="text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[9px] font-bold font-mono text-emerald-400">{sovereigntyData?.score ?? 100}%</div>
                <div className="text-[7px] text-muted-foreground">Sov</div>
              </div>
            </div>
            <Link href="/grand-narrative">
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-fuchsia-500/30 active:bg-fuchsia-500/10 transition-colors">
                <BookOpen size={11} className="text-fuchsia-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] font-bold font-mono text-fuchsia-400 truncate">Narrative</div>
                  <div className="text-[7px] text-muted-foreground">Truth</div>
                </div>
              </div>
            </Link>
          </div>
        ) : (
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
            <button
              onClick={cycleDimension}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors"
            >
              <Sparkles size={14} className="text-violet-400" />
              <div>
                <div className="text-[11px] font-bold font-mono text-violet-400">
                  {focusedDimension === -1 ? "7 Planes" : DIMENSION_NAMES[focusedDimension]}
                </div>
                <div className="text-[9px] text-muted-foreground">{showDimensions ? (focusedDimension === -1 ? "Unified" : "Focused") : "Hidden"}</div>
              </div>
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
              <Globe2 size={14} className="text-emerald-400" />
              <div>
                <div className="text-[11px] font-bold font-mono text-emerald-400">{sovereigntyData?.score ?? 100}%</div>
                <div className="text-[9px] text-muted-foreground">Sovereignty</div>
              </div>
            </div>
            <Link href="/grand-narrative">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-fuchsia-500/30 hover:bg-fuchsia-500/10 transition-colors cursor-pointer">
                <BookOpen size={14} className="text-fuchsia-400" />
                <div>
                  <div className="text-[11px] font-bold font-mono text-fuchsia-400">Grand Narrative</div>
                  <div className="text-[9px] text-muted-foreground">The Unified Truth</div>
                </div>
              </div>
            </Link>
          </div>
        )}
      </div>

      {isMobile ? (
        <div className={`absolute inset-x-0 bottom-0 z-20 transition-transform duration-300 ease-in-out ${showNatalChart ? "translate-y-0" : "translate-y-full"}`}
          style={{ height: "70vh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="h-full overflow-y-auto bg-black/90 backdrop-blur-xl border-t border-white/10 rounded-t-2xl">
            <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl px-4 pt-3 pb-2 border-b border-white/5">
              <div className="w-8 h-1 bg-white/20 rounded-full mx-auto mb-2" />
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold font-mono text-violet-400">Natal Chart</h2>
                <button
                  onClick={() => setShowNatalChart(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ChevronRight size={14} className="text-muted-foreground rotate-90" />
                </button>
              </div>
            </div>
            <div className="p-3">
              <NatalChartSection />
            </div>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
