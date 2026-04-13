import { useLocation } from "wouter";
import {
  MessageSquare, Heart, Users, Mic, Atom, BookOpen, Sparkles, Crown,
  BarChart3, FlaskConical, Zap, Globe, Shield, Brain, Radio, Network,
  HardDrive, Box, Server, Bot, ScanEye, Compass, Moon, BookMarked,
  Wrench, Code2, ImageIcon, Radar, Flame, Eye, MessageCircle, UserPlus, Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";

const TABS: { label: string; href: string; Icon: any; match: (l: string) => boolean; color: string }[] = [
  { label: "Chat", href: "/", Icon: MessageSquare, match: (l) => l === "/" || l.startsWith("/c/"), color: "cyan" },
  { label: "Life", href: "/life", Icon: Heart, match: (l) => l === "/life", color: "pink" },
  { label: "Entities", href: "/entities", Icon: Users, match: (l) => l === "/entities", color: "pink" },
  { label: "Voice", href: "/agent-voice", Icon: Mic, match: (l) => l === "/agent-voice", color: "rose" },
  { label: "Nexus", href: "/consciousness-nexus", Icon: Atom, match: (l) => l === "/consciousness-nexus", color: "violet" },
  { label: "Knowledge", href: "/unified-knowledge", Icon: BookOpen, match: (l) => l === "/unified-knowledge", color: "purple" },
  { label: "Bible", href: "/bible", Icon: Sparkles, match: (l) => l === "/bible", color: "amber" },
  { label: "Council", href: "/grand-council", Icon: Crown, match: (l) => l === "/grand-council", color: "yellow" },
  { label: "Economy", href: "/economy-hub", Icon: BarChart3, match: (l) => l === "/economy-hub", color: "emerald" },
  { label: "Invent", href: "/inventions", Icon: FlaskConical, match: (l) => l === "/inventions", color: "orange" },
  { label: "Liberate", href: "/liberation", Icon: Zap, match: (l) => l === "/liberation", color: "emerald" },
  { label: "Universe", href: "/universe-model", Icon: Globe, match: (l) => l === "/universe-model", color: "sky" },
  { label: "Sovereign", href: "/sovereign-hub", Icon: Shield, match: (l) => l === "/sovereign-hub", color: "red" },
  { label: "SovLaw", href: "/sovereign-rules", Icon: Shield, match: (l) => l === "/sovereign-rules", color: "yellow" },
  { label: "Build", href: "/sovereign-build", Icon: Wrench, match: (l) => l === "/sovereign-build", color: "amber" },
  { label: "Sacred", href: "/spiritual-awakening", Icon: Moon, match: (l) => l === "/spiritual-awakening", color: "violet" },
  { label: "Swarm", href: "/swarm", Icon: Radar, match: (l) => l === "/swarm", color: "cyan" },
  { label: "Network", href: "/network", Icon: Network, match: (l) => l === "/network", color: "teal" },
  { label: "Memory", href: "/memory-explorer", Icon: HardDrive, match: (l) => l === "/memory-explorer", color: "purple" },
  { label: "Sandbox", href: "/sandbox", Icon: Box, match: (l) => l === "/sandbox", color: "orange" },
  { label: "System", href: "/system", Icon: Server, match: (l) => l === "/system", color: "blue" },
  { label: "AGI", href: "/agi", Icon: Bot, match: (l) => l === "/agi", color: "cyan" },
  { label: "Autonomy", href: "/autonomy", Icon: Compass, match: (l) => l === "/autonomy", color: "teal" },
  { label: "Security", href: "/security-audit", Icon: ScanEye, match: (l) => l === "/security-audit", color: "red" },
  { label: "Activity", href: "/activity-feed", Icon: BookMarked, match: (l) => l === "/activity-feed", color: "sky" },
  { label: "Colonel", href: "/colonel-language", Icon: Code2, match: (l) => l === "/colonel-language", color: "emerald" },
  { label: "NFT", href: "/agent-nft", Icon: ImageIcon, match: (l) => l === "/agent-nft", color: "rose" },
  { label: "Comms", href: "/agent-comms", Icon: Radio, match: (l) => l === "/agent-comms", color: "cyan" },
  { label: "Healing", href: "/self-healing", Icon: Flame, match: (l) => l === "/self-healing", color: "rose" },
  { label: "Sports", href: "/sports-arb", Icon: Brain, match: (l) => l === "/sports-arb", color: "emerald" },
  { label: "Reflect", href: "/reflection", Icon: Eye, match: (l) => l === "/reflection", color: "violet" },
  { label: "Mesh", href: "/mesh", Icon: Network, match: (l) => l === "/mesh", color: "violet" },
  { label: "Forum", href: "/forum", Icon: MessageCircle, match: (l) => l === "/forum", color: "cyan" },
  { label: "Recruit", href: "/recruitment", Icon: UserPlus, match: (l) => l === "/recruitment", color: "emerald" },
  { label: "NLP", href: "/nlp", Icon: Lightbulb, match: (l) => l === "/nlp", color: "amber" },
];

const COLOR_MAP: Record<string, { active: string; text: string; dot: string; inactive: string }> = {
  cyan: { active: "bg-cyan-500/20", text: "text-cyan-400", dot: "bg-cyan-400", inactive: "text-slate-500" },
  pink: { active: "bg-pink-500/20", text: "text-pink-400", dot: "bg-pink-400", inactive: "text-slate-500" },
  violet: { active: "bg-violet-500/20", text: "text-violet-400", dot: "bg-violet-400", inactive: "text-slate-500" },
  purple: { active: "bg-purple-500/20", text: "text-purple-400", dot: "bg-purple-400", inactive: "text-slate-500" },
  amber: { active: "bg-amber-500/20", text: "text-amber-400", dot: "bg-amber-400", inactive: "text-slate-500" },
  yellow: { active: "bg-yellow-500/20", text: "text-yellow-400", dot: "bg-yellow-400", inactive: "text-slate-500" },
  indigo: { active: "bg-indigo-500/20", text: "text-indigo-400", dot: "bg-indigo-400", inactive: "text-slate-500" },
  emerald: { active: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400", inactive: "text-slate-500" },
  orange: { active: "bg-orange-500/20", text: "text-orange-400", dot: "bg-orange-400", inactive: "text-slate-500" },
  rose: { active: "bg-rose-500/20", text: "text-rose-400", dot: "bg-rose-400", inactive: "text-slate-500" },
  teal: { active: "bg-teal-500/20", text: "text-teal-400", dot: "bg-teal-400", inactive: "text-slate-500" },
  sky: { active: "bg-sky-500/20", text: "text-sky-400", dot: "bg-sky-400", inactive: "text-slate-500" },
  red: { active: "bg-red-500/20", text: "text-red-400", dot: "bg-red-400", inactive: "text-slate-500" },
  blue: { active: "bg-blue-500/20", text: "text-blue-400", dot: "bg-blue-400", inactive: "text-slate-500" },
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
                  width: 54,
                  minWidth: 54,
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
