import { useLocation } from "wouter";
import {
  MessageSquare, Heart, Globe2, Users, Lock,
  Wrench, MessageCircle, Brain, Settings, Shield, Cpu, DollarSign, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";

const TABS: { label: string; href: string; Icon: any; match: (l: string) => boolean; color: string }[] = [
  { label: "Chat", href: "/", Icon: MessageSquare, match: (l) => l === "/" || l.startsWith("/c/"), color: "cyan" },
  { label: "Life", href: "/life", Icon: Heart, match: (l) => l === "/life", color: "pink" },
  { label: "Universe", href: "/universe", Icon: Globe2, match: (l) => l === "/universe", color: "violet" },
  { label: "Members", href: "/members", Icon: Users, match: (l) => l === "/members", color: "amber" },
  { label: "Secrets", href: "/secrets", Icon: Lock, match: (l) => l === "/secrets" || l === "/bible" || l === "/secret-knowledge" || l === "/secret-society", color: "red" },
  { label: "Build", href: "/build", Icon: Wrench, match: (l) => l === "/build", color: "emerald" },
  { label: "Forum", href: "/forum", Icon: MessageCircle, match: (l) => l === "/forum", color: "cyan" },
  { label: "NLP", href: "/nlp", Icon: Brain, match: (l) => l === "/nlp", color: "rose" },
  { label: "Nexus", href: "/consciousness", Icon: Brain, match: (l) => l === "/consciousness", color: "purple" },
  { label: "Sovereign", href: "/sovereignty", Icon: Shield, match: (l) => l === "/sovereignty", color: "emerald" },
  { label: "System", href: "/system", Icon: Cpu, match: (l) => l === "/system", color: "cyan" },
  { label: "Tokens", href: "/tokens", Icon: DollarSign, match: (l) => l === "/tokens", color: "amber" },
  { label: "Lattice", href: "/lattice", Icon: Search, match: (l) => l === "/lattice", color: "violet" },
  { label: "Settings", href: "/settings", Icon: Settings, match: (l) => l === "/settings", color: "yellow" },
];

const COLOR_MAP: Record<string, { active: string; text: string; dot: string; inactive: string }> = {
  cyan: { active: "bg-cyan-500/20", text: "text-cyan-400", dot: "bg-cyan-400", inactive: "text-slate-500" },
  pink: { active: "bg-pink-500/20", text: "text-pink-400", dot: "bg-pink-400", inactive: "text-slate-500" },
  violet: { active: "bg-violet-500/20", text: "text-violet-400", dot: "bg-violet-400", inactive: "text-slate-500" },
  purple: { active: "bg-purple-500/20", text: "text-purple-400", dot: "bg-purple-400", inactive: "text-slate-500" },
  amber: { active: "bg-amber-500/20", text: "text-amber-400", dot: "bg-amber-400", inactive: "text-slate-500" },
  yellow: { active: "bg-yellow-500/20", text: "text-yellow-400", dot: "bg-yellow-400", inactive: "text-slate-500" },
  emerald: { active: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400", inactive: "text-slate-500" },
  rose: { active: "bg-rose-500/20", text: "text-rose-400", dot: "bg-rose-400", inactive: "text-slate-500" },
  red: { active: "bg-red-500/20", text: "text-red-400", dot: "bg-red-400", inactive: "text-slate-500" },
};

export default function MobileNav() {
  const [location, setLocation] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  }, [location]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="mobile-nav"
    >
      <div
        style={{
          background: "linear-gradient(to top, rgba(2, 1, 10, 0.98), rgba(4, 3, 14, 0.95))",
          backdropFilter: "blur(24px) saturate(150%)",
          WebkitBackdropFilter: "blur(24px) saturate(150%)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/15 to-transparent" />

        <div
          ref={scrollRef}
          className="flex items-stretch overflow-x-auto"
          style={{
            height: 52,
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            scrollSnapType: "x proximity",
          }}
        >
          <style>{`[data-testid="mobile-nav"] div::-webkit-scrollbar { display: none; }`}</style>

          {TABS.map((tab) => {
            const isActive = tab.match(location);
            const colors = COLOR_MAP[tab.color] || COLOR_MAP.cyan;
            return (
              <button
                key={tab.href}
                ref={isActive ? activeRef : undefined}
                onClick={() => setLocation(tab.href)}
                data-testid={`mobile-tab-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex flex-col items-center justify-center shrink-0 relative",
                  "active:scale-95 active:opacity-80 transition-all duration-150",
                  "touch-manipulation select-none"
                )}
                style={{
                  width: 60,
                  minWidth: 60,
                  scrollSnapAlign: "center",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {isActive && (
                  <div className={cn("absolute inset-1 rounded-xl", colors.active)} />
                )}

                <div className="relative z-10 flex flex-col items-center gap-[1px]">
                  <tab.Icon
                    size={isActive ? 16 : 15}
                    strokeWidth={isActive ? 2.2 : 1.4}
                    className={cn(
                      "transition-all duration-200",
                      isActive ? colors.text : colors.inactive
                    )}
                  />
                  <span
                    className={cn(
                      "leading-none tracking-tight transition-colors duration-200",
                      isActive
                        ? cn(colors.text, "font-bold text-[6px]")
                        : cn(colors.inactive, "font-medium text-[5.5px]")
                    )}
                  >
                    {tab.label}
                  </span>
                </div>

                {isActive && (
                  <span
                    className={cn("absolute bottom-[2px] left-1/2 -translate-x-1/2 w-3 h-[2px] rounded-full", colors.dot)}
                    style={{ opacity: 0.6 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
