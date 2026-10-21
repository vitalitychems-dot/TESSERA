import { useLocation } from "wouter";
import { MessageSquare, BookOpen, Users, BarChart3, Network } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    label: "Chat",
    href: "/",
    Icon: MessageSquare,
    match: (l: string) => l === "/" || l.startsWith("/c/"),
    activeBg: "bg-violet-500/20 border-violet-400/50",
    activeText: "text-violet-300",
    inactiveText: "text-slate-500",
  },
  {
    label: "Knowledge",
    href: "/sacred-knowledge",
    Icon: BookOpen,
    match: (l: string) => ["/sacred-knowledge", "/unified-knowledge", "/secret-society", "/colonel-language", "/bible"].includes(l),
    activeBg: "bg-purple-500/20 border-purple-400/50",
    activeText: "text-purple-300",
    inactiveText: "text-slate-500",
  },
  {
    label: "Council",
    href: "/grand-council",
    Icon: Users,
    match: (l: string) => ["/grand-council", "/forum", "/conclusions", "/conference"].includes(l),
    activeBg: "bg-yellow-500/20 border-yellow-400/50",
    activeText: "text-yellow-300",
    inactiveText: "text-slate-500",
  },
  {
    label: "Economy",
    href: "/economy-hub",
    Icon: BarChart3,
    match: (l: string) => ["/economy-hub", "/economy", "/sports-arb"].includes(l),
    activeBg: "bg-orange-500/20 border-orange-400/50",
    activeText: "text-orange-300",
    inactiveText: "text-slate-500",
  },
  {
    label: "Network",
    href: "/network",
    Icon: Network,
    match: (l: string) => ["/network", "/lattice", "/sandbox", "/sovereign-hub", "/agent-comms"].includes(l),
    activeBg: "bg-cyan-500/20 border-cyan-400/50",
    activeText: "text-cyan-300",
    inactiveText: "text-slate-500",
  },
];

export default function MobileNav() {
  const [location, setLocation] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgba(4, 3, 14, 0.97)",
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
        borderTop: "1px solid rgba(139, 92, 246, 0.08)",
      }}
      data-testid="mobile-nav"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/15 to-transparent" />
      <div
        className="flex items-stretch gap-0.5 px-1.5 overflow-x-auto scrollbar-none"
        style={{ height: 62, WebkitOverflowScrolling: "touch" }}
      >
        {TABS.map((tab) => {
          const isActive = tab.match(location);

          return (
            <button
              key={tab.label}
              onClick={() => setLocation(tab.href)}
              data-testid={`mobile-tab-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}
              style={{ minWidth: 56, flexShrink: 0 }}
              className={cn(
                "flex flex-col items-center justify-center gap-[3px] rounded-xl border transition-all duration-200 select-none relative px-1",
                "active:scale-[0.92] active:duration-75",
                isActive
                  ? `${tab.activeBg} shadow-lg`
                  : "border-transparent hover:bg-white/[0.04]"
              )}
            >
              <tab.Icon
                size={isActive ? 14 : 15}
                strokeWidth={isActive ? 2.2 : 1.5}
                className={cn("transition-colors duration-200", isActive ? tab.activeText : tab.inactiveText)}
              />
              <span
                className={cn(
                  "text-[7px] font-bold leading-none tracking-wide transition-colors duration-200",
                  isActive ? tab.activeText : tab.inactiveText
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
