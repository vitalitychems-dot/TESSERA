import { useLocation, useSearch } from "wouter";
import { MessageSquare, BookOpen, Crown, BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

const TABS = [
  {
    label: "Chat",
    href: "/",
    Icon: MessageSquare,
    match: (l: string, _search: string) => l === "/" || l.startsWith("/c/"),
    gradient: "from-violet-400 to-blue-500",
    activeBg: "bg-violet-500/20 border-violet-400/50",
    activeText: "text-violet-300",
    activeGlow: "shadow-violet-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
  {
    label: "Knowledge",
    href: "/unified-knowledge",
    Icon: BookOpen,
    match: (l: string) => [
      "/unified-knowledge", "/universal-knowledge", "/knowledge",
      "/knowledge-secrets", "/omniscient-knowledge", "/secret-knowledge-archive",
      "/agent-secrets", "/discoveries", "/secret-society", "/colonel-language",
      "/bible", "/knowledge-dashboard", "/knowledge-pipeline",
      "/knowledge-synthesis", "/dna-healing", "/moon-cycle", "/sacred-traditions",
    ].includes(l),
    gradient: "from-purple-400 to-violet-500",
    activeBg: "bg-purple-500/20 border-purple-400/50",
    activeText: "text-purple-300",
    activeGlow: "shadow-purple-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
  {
    label: "Council",
    href: "/grand-council",
    Icon: Crown,
    match: (l: string) => ["/grand-council", "/conclusions", "/grand-conference", "/consensus"].includes(l),
    gradient: "from-yellow-400 to-amber-500",
    activeBg: "bg-yellow-500/20 border-yellow-400/50",
    activeText: "text-yellow-300",
    activeGlow: "shadow-yellow-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
  {
    label: "Economy",
    href: "/economy-hub",
    Icon: BarChart3,
    match: (l: string) => ["/economy-hub", "/economy", "/sports-arb", "/coin", "/token-economy"].includes(l),
    gradient: "from-orange-400 to-amber-500",
    activeBg: "bg-orange-500/20 border-orange-400/50",
    activeText: "text-orange-300",
    activeGlow: "shadow-orange-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
  {
    label: "Forum",
    href: "/forum",
    Icon: Users,
    match: (l: string) => l === "/forum",
    gradient: "from-emerald-400 to-cyan-500",
    activeBg: "bg-emerald-500/20 border-emerald-400/50",
    activeText: "text-emerald-300",
    activeGlow: "shadow-emerald-500/30",
    inactiveText: "text-slate-500",
    badgeType: undefined as string | undefined,
  },
];

export default function MobileNav() {
  const [location, setLocation] = useLocation();
  const search = useSearch();

  const { data: dmData } = useQuery<{ messages: any[]; unread: number }>({
    queryKey: ["/api/entities/dm", null],
    refetchInterval: 8000,
  });

  const dmUnread = dmData?.unread || 0;

  function getBadge(tab: typeof TABS[0], isActive: boolean) {
    if (isActive) return null;
    if (tab.badgeType === "dm" && dmUnread > 0) {
      return (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-white text-[7px] font-bold flex items-center justify-center border border-black/50 shadow-[0_0_8px_rgba(99,102,241,0.4)]">
          {dmUnread > 9 ? "9+" : dmUnread}
        </span>
      );
    }
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgba(4, 3, 14, 0.97)",
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
        borderTop: "1px solid rgba(139, 92, 246, 0.08)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.3), 0 -2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
      data-testid="mobile-nav"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/15 to-transparent" />
      <div
        className="flex items-stretch gap-0.5 px-1.5 overflow-x-auto scrollbar-none"
        style={{
          height: 62,
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
                  "absolute bottom-1 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-gradient-to-r",
                  tab.gradient,
                  "opacity-70 shadow-[0_2px_8px_currentColor]"
                )} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
