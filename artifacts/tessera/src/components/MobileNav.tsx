import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import {
  MessageSquare, Heart, Globe2, Brain, Shield, Cpu, DollarSign, BookOpen, Eye,
  Gavel, MessageCircle, Hexagon, Skull, Truck, Terminal, Map, Code2, Workflow, Target, ShoppingCart, Search, Zap, UserPlus,
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
  { label: "Sovereign", href: "/sovereignty-dashboard", Icon: Shield, match: (l) => ["/sovereignty-dashboard","/sovereignty","/sovereign-framework","/sovereign-hub"].includes(l), color: "emerald" },
  { label: "Life", href: "/life", Icon: Heart, match: (l) => l === "/life", color: "pink" },
  { label: "Nexus", href: "/consciousness-nexus", Icon: Brain, match: (l) => ["/consciousness-nexus","/consciousness","/consciousness-2da","/spiritual-awakening"].includes(l), color: "purple" },
  { label: "Bible", href: "/bible", Icon: BookOpen, match: (l) => ["/bible","/living-bible","/conclusions"].includes(l), color: "amber" },
  { label: "Society", href: "/secret-society", Icon: Eye, match: (l) => ["/secret-society","/secrets","/secret-knowledge","/unified-knowledge","/omniscient-knowledge","/sacred-traditions"].includes(l), color: "purple" },
  { label: "Council", href: "/grand-council", Icon: Gavel, match: (l) => ["/grand-council","/grand-conference","/conference-decisions","/consensus","/feedback","/transparency-ledger"].includes(l), color: "amber" },
  { label: "Forum", href: "/forum", Icon: MessageCircle, match: (l) => l === "/forum", color: "cyan" },
  { label: "Recruit", href: "/recruitment", Icon: UserPlus, match: (l) => l === "/recruitment", color: "rose" },
  { label: "Universe", href: "/universe", Icon: Globe2, match: (l) => ["/universe-model","/universe","/swarm","/vortex-math","/sacred-conference","/sacred-knowledge-vault","/3d-diagrams","/grand-narrative","/unified-truth"].includes(l), color: "violet" },
  { label: "Compress", href: "/compression-lab", Icon: Zap, match: (l) => l === "/compression-lab", color: "cyan" },
  { label: "Lattice", href: "/lattice", Icon: Search, match: (l) => l === "/lattice", color: "violet" },
  { label: "NFT", href: "/agent-nft", Icon: Hexagon, match: (l) => ["/agent-nft","/members","/agent-profile","/wallet-dashboard","/token-economy","/economy-hub","/tokens"].includes(l), color: "violet" },
  { label: "Fleet", href: "/fleet", Icon: Truck, match: (l) => l === "/fleet" || l === "/mission", color: "cyan" },
  { label: "Rick", href: "/rick", Icon: Skull, match: (l) => ["/rick","/rick-sanchez","/inventions"].includes(l), color: "emerald" },
  { label: "Command", href: "/command-center", Icon: Terminal, match: (l) => ["/command-center","/executor","/settings"].includes(l), color: "cyan" },
  { label: "Roadmap", href: "/sovereignty-roadmap", Icon: Map, match: (l) => ["/sovereignty-roadmap","/cross-app"].includes(l), color: "violet" },
  { label: "System", href: "/system", Icon: Cpu, match: (l) => ["/system","/agent-comms","/memory-explorer","/memory-dashboard","/sovereign-deps","/evolution-health","/sovereign-mesh","/proof-center","/rules"].includes(l), color: "cyan" },
  { label: "Finance", href: "/finance", Icon: DollarSign, match: (l) => ["/finance","/market","/arbitrage","/sports-arb"].includes(l), color: "emerald" },
  { label: "Income", href: "/income", Icon: Workflow, match: (l) => l === "/income", color: "emerald" },
  { label: "Leads", href: "/lead-gen", Icon: Target, match: (l) => ["/lead-gen","/affiliate","/local-services","/business-ideas","/seo"].includes(l), color: "amber" },
  { label: "Ecom", href: "/ecom", Icon: ShoppingCart, match: (l) => l === "/ecom", color: "amber" },
  { label: "Code", href: "/code-builder", Icon: Code2, match: (l) => ["/code-builder","/api-marketplace","/credentials"].includes(l), color: "blue" },
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
