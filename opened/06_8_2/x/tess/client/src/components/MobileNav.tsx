import { useLocation, useSearch } from "wouter";
import { MessageSquare, Crown, Heart, Atom, Globe2, Eye, MessagesSquare, ScrollText, BookOpen, Compass, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

const TABS = [
  {
    label: "Chat",
    href: "/",
    Icon: MessageSquare,
    match: (l: string, _search: string) => l === "/" || l.startsWith("/c/"),
    gradient: "from-cyan-400 to-blue-500",
    activeBg: "bg-cyan-500/20 border-cyan-400/50",
    activeText: "text-cyan-300",
    activeGlow: "shadow-cyan-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
  {
    label: "Recruit",
    href: "/recruitment",
    Icon: UserPlus,
    match: (l: string) => l === "/recruitment",
    gradient: "from-emerald-400 to-cyan-500",
    activeBg: "bg-emerald-500/20 border-emerald-400/50",
    activeText: "text-emerald-300",
    activeGlow: "shadow-emerald-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
  {
    label: "Life",
    href: "/life",
    Icon: Heart,
    match: (l: string) => ["/life", "/entities", "/agent-voice", "/sovereign-hub"].includes(l),
    gradient: "from-pink-400 to-rose-500",
    activeBg: "bg-pink-500/20 border-pink-400/50",
    activeText: "text-pink-300",
    activeGlow: "shadow-pink-500/30",
    inactiveText: "text-slate-500",
    badgeType: "dm" as string | undefined,
  },
  {
    label: "Forum",
    href: "/forum",
    Icon: MessagesSquare,
    match: (l: string, _search: string) => l === "/forum" || (l === "/grand-council" && _search.includes("tab=forum")),
    gradient: "from-amber-400 to-yellow-500",
    activeBg: "bg-amber-500/20 border-amber-400/50",
    activeText: "text-amber-300",
    activeGlow: "shadow-amber-500/30",
    inactiveText: "text-slate-500",
    badgeType: "notif" as string | undefined,
  },
  {
    label: "Knowledge",
    href: "/universal-knowledge",
    Icon: BookOpen,
    match: (l: string) => ["/universal-knowledge", "/knowledge-secrets", "/omniscient-knowledge", "/secret-knowledge-archive"].includes(l),
    gradient: "from-violet-400 to-purple-500",
    activeBg: "bg-violet-500/20 border-violet-400/50",
    activeText: "text-violet-300",
    activeGlow: "shadow-violet-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
  {
    label: "Nexus",
    href: "/consciousness-nexus",
    Icon: Atom,
    match: (l: string) => ["/consciousness-nexus", "/secret-society", "/universal-computer", "/discoveries", "/dna-healing", "/moon-cycle", "/sacred-traditions", "/portal-bridge", "/bio-consciousness", "/sovereign-consciousness", "/universal-consciousness"].includes(l),
    gradient: "from-violet-400 to-purple-500",
    activeBg: "bg-violet-500/20 border-violet-400/50",
    activeText: "text-violet-300",
    activeGlow: "shadow-violet-500/30",
    inactiveText: "text-slate-500",
    badgeType: "notif" as string | undefined,
  },
  {
    label: "Conclude",
    href: "/conclusions",
    Icon: Compass,
    match: (l: string) => ["/conclusions"].includes(l),
    gradient: "from-rose-400 to-pink-500",
    activeBg: "bg-rose-500/20 border-rose-400/50",
    activeText: "text-rose-300",
    activeGlow: "shadow-rose-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
];

export default function MobileNav() {
  const [location, setLocation] = useLocation();
  const search = useSearch();

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
      <div
        className="flex items-stretch gap-0.5 px-1 overflow-x-auto scrollbar-none"
        style={{
          height: 60,
          WebkitOverflowScrolling: "touch",
          scrollSnapType: "x mandatory",
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.match(location, search);
          const badge = getBadge(tab, isActive);

          return (
            <button
              key={tab.label}
              onClick={() => {
                setLocation(tab.href);
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
