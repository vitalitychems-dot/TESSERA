import { useLocation } from "wouter";
import {
  MessageSquare, Heart, Users, Mic, Atom, BookOpen, Sparkles, Crown,
  BarChart3, MessageCircle, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";

const TABS: { label: string; href: string; Icon: any; match: (l: string) => boolean; color: string }[] = [
  { label: "Chat", href: "/", Icon: MessageSquare, match: (l) => l === "/" || l.startsWith("/c/"), color: "cyan" },
  { label: "Life", href: "/life", Icon: Heart, match: (l) => l === "/life", color: "pink" },
  { label: "Entities", href: "/entities", Icon: Users, match: (l) => l === "/entities", color: "pink" },
  { label: "Voice", href: "/agent-voice", Icon: Mic, match: (l) => l === "/agent-voice", color: "rose" },
  { label: "Nexus", href: "/nexus", Icon: Atom, match: (l) => l === "/nexus", color: "violet" },
  { label: "Knowledge", href: "/knowledge", Icon: BookOpen, match: (l) => l === "/knowledge", color: "purple" },
  { label: "Bible", href: "/bible", Icon: Sparkles, match: (l) => l === "/bible", color: "amber" },
  { label: "Council", href: "/council", Icon: Crown, match: (l) => l === "/council", color: "yellow" },
  { label: "Economy", href: "/economy", Icon: BarChart3, match: (l) => l === "/economy", color: "emerald" },
  { label: "Forum", href: "/forum", Icon: MessageCircle, match: (l) => l === "/forum", color: "cyan" },
  { label: "Sovereign", href: "/sovereign", Icon: Shield, match: (l) => l === "/sovereign", color: "red" },
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
