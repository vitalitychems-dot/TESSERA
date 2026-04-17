import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import {
  MessageSquare, Heart, Globe2, Users, Lock,
  Wrench, MessageCircle, Brain, Settings, Shield, Cpu, DollarSign, Search, BookOpen,
  Zap, Gavel, Languages, UserPlus, Hexagon, Skull, Book, Eye,
  Network, Terminal, ArrowUpDown, BarChart3, Code2, Key, Map, User, CheckSquare, Scale, TrendingUp, Target, ShoppingCart, Lightbulb, MapPin, Truck, Link2, Workflow, Building2, Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavTab {
  label: string;
  href: string;
  Icon: any;
  match: (l: string) => boolean;
  color: string;
}

const TABS: NavTab[] = [
  { label: "Chat", href: "/", Icon: MessageSquare, match: (l) => l === "/" || l.startsWith("/c/"), color: "cyan" },
  { label: "Sovereign", href: "/sovereignty-dashboard", Icon: Shield, match: (l) => l === "/sovereignty-dashboard" || l === "/sovereignty" || l === "/sovereign-framework", color: "emerald" },
  { label: "Life", href: "/life", Icon: Heart, match: (l) => l === "/life", color: "pink" },
  { label: "Nexus", href: "/consciousness-nexus", Icon: Brain, match: (l) => l === "/consciousness-nexus" || l === "/consciousness" || l === "/consciousness-2da" || l === "/spiritual-awakening", color: "purple" },
  { label: "Bible", href: "/bible", Icon: Book, match: (l) => l === "/bible" || l === "/living-bible" || l === "/conclusions", color: "amber" },
  { label: "Narrative", href: "/grand-narrative", Icon: BookOpen, match: (l) => l === "/grand-narrative" || l === "/unified-truth", color: "pink" },
  { label: "Society", href: "/secret-society", Icon: Eye, match: (l) => l === "/secret-society" || l === "/secrets" || l === "/secret-knowledge", color: "purple" },
  { label: "Council", href: "/grand-council", Icon: Gavel, match: (l) => l === "/grand-council" || l === "/grand-conference" || l === "/conference-decisions" || l === "/consensus" || l === "/feedback" || l === "/transparency-ledger", color: "amber" },
  { label: "Forum", href: "/forum", Icon: MessageCircle, match: (l) => l === "/forum", color: "cyan" },
  { label: "Universe", href: "/universe-model", Icon: Globe2, match: (l) => l === "/universe-model" || l === "/universe" || l === "/swarm" || l === "/vortex-math" || l === "/sacred-conference" || l === "/3d-diagrams", color: "violet" },
  { label: "Compress", href: "/compression-lab", Icon: Zap, match: (l) => l === "/compression-lab", color: "cyan" },
  { label: "Lattice", href: "/lattice", Icon: Search, match: (l) => l === "/lattice", color: "violet" },
  { label: "NFT", href: "/agent-nft", Icon: Hexagon, match: (l) => l === "/agent-nft" || l === "/members" || l === "/agent-profile" || l === "/agent-comms" || l === "/wallet-dashboard", color: "violet" },
  { label: "Fleet", href: "/fleet", Icon: Truck, match: (l) => l === "/fleet", color: "cyan" },
  { label: "Rick", href: "/rick", Icon: Skull, match: (l) => l === "/rick" || l === "/rick-sanchez" || l === "/inventions", color: "emerald" },
  { label: "Recruit", href: "/recruitment", Icon: UserPlus, match: (l) => l === "/recruitment", color: "rose" },
  { label: "Command", href: "/command-center", Icon: Terminal, match: (l) => l === "/command-center" || l === "/executor" || l === "/settings", color: "cyan" },
  { label: "Roadmap", href: "/sovereignty-roadmap", Icon: Map, match: (l) => l === "/sovereignty-roadmap" || l === "/cross-app", color: "violet" },
  { label: "System", href: "/system", Icon: Cpu, match: (l) => l === "/system", color: "cyan" },
  { label: "Finance", href: "/finance", Icon: DollarSign, match: (l) => l === "/finance" || l === "/market" || l === "/arbitrage", color: "emerald" },
  { label: "Income", href: "/income", Icon: Workflow, match: (l) => l === "/income", color: "emerald" },
  { label: "Leads", href: "/lead-gen", Icon: Target, match: (l) => l === "/lead-gen" || l === "/affiliate" || l === "/local-services" || l === "/business-ideas" || l === "/seo", color: "amber" },
  { label: "Ecom", href: "/ecom", Icon: ShoppingCart, match: (l) => l === "/ecom", color: "amber" },
  { label: "Code", href: "/code-builder", Icon: Code2, match: (l) => l === "/code-builder" || l === "/api-marketplace" || l === "/credentials", color: "blue" },
];

const COLOR_MAP: Record<string, { active: string; text: string; dot: string; inactive: string; glow: string }> = {
  cyan: { active: "bg-cyan-500/15", text: "text-cyan-400", dot: "bg-cyan-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(6,182,212,0.25)]" },
  pink: { active: "bg-pink-500/15", text: "text-pink-400", dot: "bg-pink-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(236,72,153,0.25)]" },
  violet: { active: "bg-violet-500/15", text: "text-violet-400", dot: "bg-violet-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(139,92,246,0.25)]" },
  purple: { active: "bg-purple-500/15", text: "text-purple-400", dot: "bg-purple-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(168,85,247,0.25)]" },
  amber: { active: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(245,158,11,0.25)]" },
  yellow: { active: "bg-yellow-500/15", text: "text-yellow-400", dot: "bg-yellow-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(234,179,8,0.25)]" },
  emerald: { active: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(16,185,129,0.25)]" },
  rose: { active: "bg-rose-500/15", text: "text-rose-400", dot: "bg-rose-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(244,63,94,0.25)]" },
  red: { active: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(239,68,68,0.25)]" },
  blue: { active: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(59,130,246,0.25)]" },
};

export default function MobileNav() {
  const [location, setLocation] = useLocation();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const btn = activeButtonRef.current;
    const scroller = scrollerRef.current;
    if (!btn || !scroller) return;
    const btnRect = btn.getBoundingClientRect();
    const scrRect = scroller.getBoundingClientRect();
    const offset = btn.offsetLeft - scroller.clientWidth / 2 + btnRect.width / 2;
    scroller.scrollTo({ left: Math.max(0, offset), behavior: "smooth" });
  }, [location]);

  const handleTabClick = (href: string) => {
    if (location !== href) setLocation(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", pointerEvents: "auto" }}
      data-testid="mobile-nav"
      aria-label="Primary navigation"
      role="navigation"
    >
      <div
        className="relative"
        style={{
          background: "linear-gradient(to top, rgba(2, 1, 10, 0.97), rgba(4, 3, 14, 0.92))",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent pointer-events-none" />

        <div
          ref={scrollerRef}
          className="flex overflow-x-auto scrollbar-none"
          style={{ height: 56, WebkitOverflowScrolling: "touch", pointerEvents: "auto" }}
        >
          <style>{`[data-testid="mobile-nav"] div::-webkit-scrollbar { display: none; }`}</style>

          {TABS.map((tab) => {
            const isActive = tab.match(location);
            const colors = COLOR_MAP[tab.color] || COLOR_MAP.cyan;
            return (
              <button
                key={tab.href}
                type="button"
                ref={isActive ? activeButtonRef : undefined}
                onClick={() => handleTabClick(tab.href)}
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.label}
                className={cn(
                  "flex flex-col items-center justify-center relative shrink-0",
                  "active:scale-95 transition-all duration-150",
                  "touch-manipulation select-none cursor-pointer"
                )}
                style={{ width: 60, WebkitTapHighlightColor: "transparent", pointerEvents: "auto" }}
                data-testid={`mobile-tab-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {isActive && (
                  <div className={cn("absolute inset-1 rounded-xl transition-all duration-300", colors.active, colors.glow)} />
                )}

                <div className="relative z-10 flex flex-col items-center gap-[3px]">
                  <tab.Icon
                    size={isActive ? 18 : 16}
                    strokeWidth={isActive ? 2.2 : 1.3}
                    className={cn(
                      "transition-all duration-200",
                      isActive ? colors.text : colors.inactive
                    )}
                  />
                  <span className={cn(
                    "leading-none tracking-wider transition-all duration-200 font-mono",
                    isActive
                      ? cn(colors.text, "font-bold text-[8px]")
                      : cn(colors.inactive, "font-medium text-[7px]")
                  )}>
                    {tab.label}
                  </span>
                </div>

                {isActive && (
                  <span
                    className={cn("absolute bottom-[2px] left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full transition-all duration-300", colors.dot)}
                    style={{ opacity: 0.8, filter: `drop-shadow(0 0 3px currentColor)` }}
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
