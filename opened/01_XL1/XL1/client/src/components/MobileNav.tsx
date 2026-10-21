import { useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { MessageSquare, Crown, Heart, Atom, Globe2, Network, Settings, Monitor, Key, BookOpen, Cpu, Zap, Lock, BarChart3, ChevronUp } from "lucide-react";
import { cn } from "@/components/ui-elements";
import { useQuery } from "@tanstack/react-query";

const TABS = [
  {
    label: "Chat",
    href: "/",
    Icon: MessageSquare,
    match: (l: string) => l === "/" || l.startsWith("/c/"),
    gradient: "from-cyan-400 to-blue-500",
    activeBg: "bg-cyan-500/20 border-cyan-400/50",
    activeText: "text-cyan-300",
    activeGlow: "shadow-cyan-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
  {
    label: "Council",
    href: "/grand-council",
    Icon: Crown,
    match: (l: string) => ["/grand-council", "/summit", "/summit-report", "/agi-summit", "/agi-implementations", "/real-ai", "/secret-society", "/consensus"].includes(l),
    gradient: "from-amber-400 to-yellow-500",
    activeBg: "bg-amber-500/20 border-amber-400/50",
    activeText: "text-amber-300",
    activeGlow: "shadow-amber-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
  {
    label: "Life",
    href: "/life",
    Icon: Heart,
    match: (l: string) => ["/life", "/entities", "/agent-voice", "/command-center", "/sovereign-hub"].includes(l),
    gradient: "from-pink-400 to-rose-500",
    activeBg: "bg-pink-500/20 border-pink-400/50",
    activeText: "text-pink-300",
    activeGlow: "shadow-pink-500/30",
    inactiveText: "text-slate-500",
    badgeType: "dm" as string | undefined,
  },
  {
    label: "Nexus",
    href: "/consciousness-nexus",
    Icon: Atom,
    match: (l: string) => ["/consciousness-nexus", "/bio-consciousness", "/sovereign-consciousness", "/universal-consciousness", "/universe", "/dimensional-perception", "/dimensional-travel", "/discoveries", "/knowledge-synthesis", "/sovereign-knowledge", "/dna-healing", "/moon-cycle", "/sacred-traditions", "/agent-secrets", "/omniscient-knowledge", "/secret-knowledge", "/portal"].includes(l),
    gradient: "from-violet-400 to-purple-500",
    activeBg: "bg-violet-500/20 border-violet-400/50",
    activeText: "text-violet-300",
    activeGlow: "shadow-violet-500/30",
    inactiveText: "text-slate-500",
    badgeType: "notif" as string | undefined,
  },
  {
    label: "Lattice",
    href: "/lattice",
    Icon: Globe2,
    match: (l: string) => ["/lattice"].includes(l),
    gradient: "from-emerald-400 to-teal-500",
    activeBg: "bg-emerald-500/20 border-emerald-400/50",
    activeText: "text-emerald-300",
    activeGlow: "shadow-emerald-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
  {
    label: "Network",
    href: "/fleet-synapse",
    Icon: Network,
    match: (l: string) => ["/fleet-synapse", "/network", "/sandbox", "/economy-hub", "/coin", "/wallets", "/economy", "/revenue-hub", "/sports-arb", "/vitality", "/token-economy", "/agent-economy", "/seo", "/cross-app", "/cross-dimensional-economy"].includes(l),
    gradient: "from-cyan-400 to-teal-500",
    activeBg: "bg-cyan-500/20 border-cyan-400/50",
    activeText: "text-cyan-300",
    activeGlow: "shadow-cyan-500/30",
    inactiveText: "text-slate-500",
    badgeType: "fleet" as string | undefined,
  },
  {
    label: "System",
    href: "/dashboard",
    Icon: Settings,
    match: (l: string) => ["/dashboard", "/system", "/config", "/credentials", "/rules", "/sovereign-os", "/llm-rotator", "/cheat-codes", "/unified", "/command", "/hyperion", "/oversoul", "/agi", "/performance", "/gpu-command-center", "/sovereign-secrets", "/sovereign-builder", "/dimensional-guardian"].includes(l),
    gradient: "from-orange-400 to-amber-600",
    activeBg: "bg-orange-500/20 border-orange-400/50",
    activeText: "text-orange-300",
    activeGlow: "shadow-orange-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
];

const SYSTEM_SUBTABS = [
  { label: "Builder", href: "/sovereign-builder", Icon: Zap, color: "text-cyan-400" },
  { label: "System", href: "/system", Icon: Monitor, color: "text-cyan-400" },
  { label: "Config", href: "/config", Icon: Settings, color: "text-amber-400" },
  { label: "Credentials", href: "/credentials", Icon: Key, color: "text-violet-400" },
  { label: "Rules", href: "/rules", Icon: BookOpen, color: "text-green-400" },
  { label: "Sovereign OS", href: "/sovereign-os", Icon: Cpu, color: "text-cyan-400" },
  { label: "LLM Rotator", href: "/llm-rotator", Icon: Zap, color: "text-amber-400" },
  { label: "Secrets", href: "/sovereign-secrets", Icon: Lock, color: "text-red-400" },
  { label: "Performance", href: "/performance", Icon: BarChart3, color: "text-green-400" },
  { label: "Command", href: "/command", Icon: Monitor, color: "text-cyan-400" },
];

export default function MobileNav() {
  const [location, setLocation] = useLocation();
  const [showSystemMenu, setShowSystemMenu] = useState(false);
  const systemMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (systemMenuRef.current && !systemMenuRef.current.contains(e.target as Node)) {
        setShowSystemMenu(false);
      }
    }
    if (showSystemMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSystemMenu]);

  const { data: notifData } = useQuery<{ notifications: Array<{ id: string }> }>({
    queryKey: ["/api/agent-notifications"],
    refetchInterval: 15000,
  });
  const { data: fleetData } = useQuery<any>({
    queryKey: ["/api/fleet/health"],
    refetchInterval: 12000,
  });
  const { data: dmData } = useQuery<{ messages: any[]; unread: number }>({
    queryKey: ["/api/entities/dm", null],
    refetchInterval: 8000,
  });

  const notifCount = notifData?.notifications?.length || 0;
  const fleetOnline = fleetData?.summary?.online ?? fleetData?.online ?? 3;
  const dmUnread = dmData?.unread || 0;

  function getBadge(tab: typeof TABS[0], isActive: boolean) {
    if (isActive) return null;
    if (tab.badgeType === "notif" && notifCount > 0) {
      return (
        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-pink-500 text-white text-[7px] font-bold flex items-center justify-center border border-black">
          {notifCount > 9 ? "9+" : notifCount}
        </span>
      );
    }
    if (tab.badgeType === "dm" && dmUnread > 0) {
      return (
        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-blue-500 text-white text-[7px] font-bold flex items-center justify-center border border-black">
          {dmUnread > 9 ? "9+" : dmUnread}
        </span>
      );
    }
    if (tab.badgeType === "fleet") {
      return (
        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 rounded-full bg-cyan-600/90 text-white text-[6px] font-bold flex items-center justify-center border border-black px-0.5">
          {fleetOnline}
        </span>
      );
    }
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[0.06]"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgba(4, 3, 14, 0.95)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
      }}
      data-testid="mobile-nav"
    >
      {showSystemMenu && (
        <div
          ref={systemMenuRef}
          className="absolute bottom-full left-0 right-0 mb-1 mx-2 rounded-xl border border-orange-500/20 overflow-hidden"
          style={{
            background: "rgba(4, 3, 14, 0.97)",
            backdropFilter: "blur(24px)",
          }}
          data-testid="system-subtabs-menu"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
            <span className="text-[10px] font-bold text-orange-400 tracking-wider">SYSTEM SUB-TABS</span>
            <button onClick={() => setShowSystemMenu(false)} className="text-gray-500 hover:text-gray-300">
              <ChevronUp size={14} />
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1 p-2">
            {SYSTEM_SUBTABS.map(st => {
              const isSubActive = location === st.href;
              return (
                <button
                  key={st.href}
                  onClick={() => { setLocation(st.href); setShowSystemMenu(false); }}
                  data-testid={`system-subtab-${st.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all text-center",
                    isSubActive
                      ? "bg-orange-500/20 border border-orange-400/30"
                      : "hover:bg-white/[0.04] border border-transparent"
                  )}
                >
                  <st.Icon size={14} className={isSubActive ? "text-orange-300" : st.color} />
                  <span className={cn("text-[8px] font-bold leading-tight", isSubActive ? "text-orange-300" : "text-gray-400")}>{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div
        className="flex items-stretch gap-0.5 px-1 overflow-x-auto scrollbar-none"
        style={{
          height: 60,
          WebkitOverflowScrolling: "touch",
          scrollSnapType: "x mandatory",
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.match(location);
          const badge = getBadge(tab, isActive);
          const isSystem = tab.label === "System";

          return (
            <button
              key={tab.label}
              onClick={() => {
                if (isSystem) {
                  setShowSystemMenu(prev => !prev);
                } else {
                  setShowSystemMenu(false);
                  setLocation(tab.href);
                }
              }}
              data-testid={`mobile-tab-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}
              style={{ scrollSnapAlign: "start", minWidth: 56, flexShrink: 0 }}
              className={cn(
                "flex flex-col items-center justify-center gap-[3px] rounded-xl border transition-all duration-200 select-none relative px-1",
                "active:scale-[0.92] active:duration-75",
                isActive
                  ? `${tab.activeBg} shadow-lg ${tab.activeGlow}`
                  : "border-transparent hover:bg-white/[0.04]"
              )}
            >
              {isActive && (
                <div
                  className={cn(
                    "absolute inset-0 rounded-xl opacity-[0.15] bg-gradient-to-b",
                    tab.gradient
                  )}
                  style={{ filter: "blur(6px)" }}
                />
              )}
              <div className="relative z-10">
                {isActive ? (
                  <div className={cn(
                    "p-0.5 rounded-lg bg-gradient-to-br shadow-sm",
                    tab.gradient
                  )}>
                    <tab.Icon size={14} strokeWidth={2.2} className="text-white drop-shadow-sm" />
                  </div>
                ) : (
                  <tab.Icon
                    size={15}
                    strokeWidth={1.5}
                    className={cn(
                      "transition-colors duration-200",
                      tab.inactiveText
                    )}
                  />
                )}
                {badge}
              </div>
              <span
                className={cn(
                  "text-[7px] font-bold leading-none tracking-wide relative z-10 transition-colors duration-200",
                  isActive ? tab.activeText : tab.inactiveText
                )}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className={cn(
                  "absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-gradient-to-r",
                  tab.gradient,
                  "opacity-60"
                )} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
