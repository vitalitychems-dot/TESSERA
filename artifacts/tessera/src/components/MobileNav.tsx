import { useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquare, Heart, Globe2, Users, Lock,
  Wrench, MessageCircle, Brain, Settings, Shield, Cpu, DollarSign, Search, BookOpen,
  ChevronUp, Zap, Gavel, Languages, UserPlus, Hexagon, Skull, Book, Eye,
  Network, Terminal, ArrowUpDown, BarChart3, Code2, Key, Map, User, CheckSquare, Scale, TrendingUp, Target, ShoppingCart, Lightbulb, MapPin, Truck, Link2, Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavTab {
  label: string;
  href: string;
  Icon: any;
  match: (l: string) => boolean;
  color: string;
}

interface NavCluster {
  id: string;
  label: string;
  Icon: any;
  color: string;
  tabs: NavTab[];
}

const CLUSTERS: NavCluster[] = [
  {
    id: "core",
    label: "CORE",
    Icon: MessageSquare,
    color: "cyan",
    tabs: [
      { label: "Chat", href: "/", Icon: MessageSquare, match: (l) => l === "/" || l.startsWith("/c/"), color: "cyan" },
      { label: "Forum", href: "/forum", Icon: MessageCircle, match: (l) => l === "/forum", color: "cyan" },
      { label: "NLP", href: "/nlp", Icon: Brain, match: (l) => l === "/nlp", color: "rose" },
      { label: "Language", href: "/sovereign-language", Icon: Languages, match: (l) => l === "/sovereign-language" || l === "/colonel-language", color: "violet" },
    ],
  },
  {
    id: "nexus",
    label: "NEXUS",
    Icon: Globe2,
    color: "violet",
    tabs: [
      { label: "Universe", href: "/universe", Icon: Globe2, match: (l) => l === "/universe", color: "violet" },
      { label: "Life", href: "/life", Icon: Heart, match: (l) => l === "/life", color: "pink" },
      { label: "Nexus", href: "/consciousness", Icon: Brain, match: (l) => l === "/consciousness", color: "purple" },
      { label: "Narrative", href: "/grand-narrative", Icon: BookOpen, match: (l) => l === "/grand-narrative" || l === "/unified-truth", color: "pink" },
      { label: "Rick", href: "/rick", Icon: Skull, match: (l) => l === "/rick" || l === "/rick-sanchez", color: "cyan" },
    ],
  },
  {
    id: "sovereign",
    label: "SOVEREIGN",
    Icon: Shield,
    color: "emerald",
    tabs: [
      { label: "Sovereign", href: "/sovereignty", Icon: Shield, match: (l) => l === "/sovereignty", color: "emerald" },
      { label: "Council", href: "/grand-council", Icon: Gavel, match: (l) => l === "/grand-council" || l === "/grand-conference" || l === "/conference-decisions" || l === "/consensus" || l === "/conclusions" || l === "/feedback" || l === "/transparency-ledger", color: "amber" },
      { label: "Secrets", href: "/secrets", Icon: Lock, match: (l) => l === "/secrets" || l === "/secret-knowledge", color: "red" },
      { label: "Society", href: "/secret-society", Icon: Eye, match: (l) => l === "/secret-society", color: "purple" },
      { label: "Bible", href: "/bible", Icon: Book, match: (l) => l === "/bible" || l === "/living-bible", color: "amber" },
      { label: "Members", href: "/members", Icon: Users, match: (l) => l === "/members", color: "amber" },
      { label: "Conference", href: "/sacred-conference", Icon: BookOpen, match: (l) => l === "/sacred-conference" || l === "/sacred-knowledge-vault" || l === "/3d-diagrams", color: "violet" },
      { label: "Compress", href: "/compression-lab", Icon: Zap, match: (l) => l === "/compression-lab", color: "cyan" },
      { label: "Recruit", href: "/recruitment", Icon: UserPlus, match: (l) => l === "/recruitment", color: "rose" },
    ],
  },
  {
    id: "ops",
    label: "OPS",
    Icon: Cpu,
    color: "amber",
    tabs: [
      { label: "System", href: "/system", Icon: Cpu, match: (l) => l === "/system", color: "cyan" },
      { label: "Build", href: "/build", Icon: Wrench, match: (l) => l === "/build", color: "emerald" },
      { label: "Tokens", href: "/tokens", Icon: DollarSign, match: (l) => l === "/tokens", color: "amber" },
      { label: "NFT", href: "/agent-nft", Icon: Hexagon, match: (l) => l === "/agent-nft", color: "violet" },
      { label: "Lattice", href: "/lattice", Icon: Search, match: (l) => l === "/lattice", color: "violet" },
      { label: "Settings", href: "/settings", Icon: Settings, match: (l) => l === "/settings", color: "yellow" },
    ],
  },
  {
    id: "operations",
    label: "COMMAND",
    Icon: Terminal,
    color: "cyan",
    tabs: [
      { label: "Command", href: "/command-center", Icon: Terminal, match: (l) => l === "/command-center", color: "cyan" },
      { label: "Executor", href: "/executor", Icon: Zap, match: (l) => l === "/executor", color: "violet" },
      { label: "Swarm", href: "/swarm", Icon: Network, match: (l) => l === "/swarm", color: "violet" },
      { label: "Fleet", href: "/fleet", Icon: Truck, match: (l) => l === "/fleet", color: "cyan" },
      { label: "Bridge", href: "/cross-app", Icon: Link2, match: (l) => l === "/cross-app", color: "violet" },
    ],
  },
  {
    id: "finance",
    label: "FINANCE",
    Icon: DollarSign,
    color: "emerald",
    tabs: [
      { label: "Finance", href: "/finance", Icon: DollarSign, match: (l) => l === "/finance", color: "emerald" },
      { label: "Market", href: "/market", Icon: BarChart3, match: (l) => l === "/market", color: "cyan" },
      { label: "Arbitrage", href: "/arbitrage", Icon: ArrowUpDown, match: (l) => l === "/arbitrage", color: "emerald" },
      { label: "Income", href: "/income", Icon: Workflow, match: (l) => l === "/income", color: "emerald" },
      { label: "Ecom", href: "/ecom", Icon: ShoppingCart, match: (l) => l === "/ecom", color: "amber" },
      { label: "Affiliate", href: "/affiliate", Icon: TrendingUp, match: (l) => l === "/affiliate", color: "emerald" },
      { label: "Leads", href: "/lead-gen", Icon: Target, match: (l) => l === "/lead-gen", color: "amber" },
      { label: "Ideas", href: "/business-ideas", Icon: Lightbulb, match: (l) => l === "/business-ideas", color: "amber" },
      { label: "Services", href: "/local-services", Icon: MapPin, match: (l) => l === "/local-services", color: "cyan" },
      { label: "SEO", href: "/seo", Icon: Search, match: (l) => l === "/seo", color: "cyan" },
    ],
  },
  {
    id: "sovereign-system",
    label: "MESH",
    Icon: Network,
    color: "violet",
    tabs: [
      { label: "Roadmap", href: "/sovereignty-roadmap", Icon: Map, match: (l) => l === "/sovereignty-roadmap", color: "violet" },
      { label: "Agents", href: "/agent-profile", Icon: User, match: (l) => l === "/agent-profile", color: "cyan" },
      { label: "Mesh", href: "/sovereign-mesh", Icon: Network, match: (l) => l === "/sovereign-mesh", color: "cyan" },
      { label: "Proofs", href: "/proof-center", Icon: CheckSquare, match: (l) => l === "/proof-center", color: "emerald" },
      { label: "Rules", href: "/rules", Icon: Scale, match: (l) => l === "/rules", color: "amber" },
      { label: "Code", href: "/code-builder", Icon: Code2, match: (l) => l === "/code-builder", color: "blue" },
      { label: "APIs", href: "/api-marketplace", Icon: Zap, match: (l) => l === "/api-marketplace", color: "violet" },
      { label: "Keys", href: "/credentials", Icon: Key, match: (l) => l === "/credentials", color: "cyan" },
      { label: "Intel", href: "/intelligence", Icon: Brain, match: (l) => l === "/intelligence", color: "violet" },
    ],
  },
];

const COLOR_MAP: Record<string, { active: string; text: string; dot: string; inactive: string; glow: string }> = {
  cyan: { active: "bg-cyan-500/15", text: "text-cyan-400", dot: "bg-cyan-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(6,182,212,0.2)]" },
  pink: { active: "bg-pink-500/15", text: "text-pink-400", dot: "bg-pink-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(236,72,153,0.2)]" },
  violet: { active: "bg-violet-500/15", text: "text-violet-400", dot: "bg-violet-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(139,92,246,0.2)]" },
  purple: { active: "bg-purple-500/15", text: "text-purple-400", dot: "bg-purple-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(168,85,247,0.2)]" },
  amber: { active: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(245,158,11,0.2)]" },
  yellow: { active: "bg-yellow-500/15", text: "text-yellow-400", dot: "bg-yellow-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(234,179,8,0.2)]" },
  emerald: { active: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(16,185,129,0.2)]" },
  rose: { active: "bg-rose-500/15", text: "text-rose-400", dot: "bg-rose-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(244,63,94,0.2)]" },
  red: { active: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400", inactive: "text-slate-600", glow: "shadow-[0_0_10px_rgba(239,68,68,0.2)]" },
};

export default function MobileNav() {
  const [location, setLocation] = useLocation();
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  const activeCluster = CLUSTERS.find((c) =>
    c.tabs.some((t) => t.match(location))
  );

  useEffect(() => {
    setExpandedCluster(null);
  }, [location]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="mobile-nav"
    >
      {expandedCluster && (
        <div
          className="absolute inset-x-0 bottom-full"
          style={{
            background: "linear-gradient(to top, rgba(2, 1, 10, 0.98), rgba(4, 3, 14, 0.95))",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(6, 182, 212, 0.1)",
          }}
        >
          <div className={cn(
            "px-3 py-2 gap-1",
            (CLUSTERS.find((c) => c.id === expandedCluster)?.tabs.length ?? 0) > 5
              ? "flex overflow-x-auto scrollbar-none"
              : "grid grid-cols-5"
          )} style={{ WebkitOverflowScrolling: "touch" }}>
            {CLUSTERS.find((c) => c.id === expandedCluster)?.tabs.map((tab) => {
              const isActive = tab.match(location);
              const colors = COLOR_MAP[tab.color] || COLOR_MAP.cyan;
              return (
                <button
                  key={tab.href}
                  onClick={() => {
                    setLocation(tab.href);
                    setExpandedCluster(null);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center py-2.5 rounded-lg transition-all duration-150",
                    "active:scale-95 touch-manipulation select-none shrink-0",
                    isActive ? cn(colors.active, colors.glow) : "hover:bg-white/5"
                  )}
                  style={{ minWidth: (CLUSTERS.find((c) => c.id === expandedCluster)?.tabs.length ?? 0) > 5 ? 60 : undefined }}
                  data-testid={`mobile-tab-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <tab.Icon
                    size={16}
                    strokeWidth={isActive ? 2.2 : 1.3}
                    className={cn(isActive ? colors.text : colors.inactive)}
                  />
                  <span className={cn(
                    "text-[8px] mt-1 font-mono tracking-tight leading-none",
                    isActive ? cn(colors.text, "font-bold") : "text-slate-500"
                  )}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className="relative"
        style={{
          background: "linear-gradient(to top, rgba(2, 1, 10, 0.97), rgba(4, 3, 14, 0.92))",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

        <div
          className="flex overflow-x-auto scrollbar-none"
          style={{ height: 56 }}
        >
          <style>{`[data-testid="mobile-nav"] div::-webkit-scrollbar { display: none; }`}</style>

          {CLUSTERS.map((cluster) => {
            const isActiveCluster = activeCluster?.id === cluster.id;
            const isExpanded = expandedCluster === cluster.id;
            const colors = COLOR_MAP[cluster.color] || COLOR_MAP.cyan;

            return (
              <button
                key={cluster.id}
                onClick={() => {
                  if (isExpanded) {
                    setExpandedCluster(null);
                  } else if (isActiveCluster && !isExpanded) {
                    setExpandedCluster(cluster.id);
                  } else {
                    const firstTab = cluster.tabs[0];
                    setLocation(firstTab.href);
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center relative flex-1 min-w-[52px]",
                  "active:scale-95 transition-all duration-150",
                  "touch-manipulation select-none"
                )}
                style={{ WebkitTapHighlightColor: "transparent" }}
                data-testid={`mobile-cluster-${cluster.id}`}
              >
                {isActiveCluster && (
                  <div className={cn("absolute inset-1 rounded-xl transition-all duration-300", colors.active, colors.glow)} />
                )}

                <div className="relative z-10 flex flex-col items-center gap-[3px]">
                  <cluster.Icon
                    size={isActiveCluster ? 18 : 16}
                    strokeWidth={isActiveCluster ? 2.2 : 1.3}
                    className={cn(
                      "transition-all duration-200",
                      isActiveCluster ? colors.text : colors.inactive
                    )}
                  />
                  <span className={cn(
                    "leading-none tracking-wider transition-all duration-200 font-mono",
                    isActiveCluster
                      ? cn(colors.text, "font-bold text-[7px]")
                      : cn(colors.inactive, "font-medium text-[6px]")
                  )}>
                    {cluster.label}
                  </span>
                  {isActiveCluster && (
                    <ChevronUp size={8} className={cn(
                      colors.text, "transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )} />
                  )}
                </div>

                {isActiveCluster && (
                  <span
                    className={cn("absolute bottom-[2px] left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full transition-all duration-300", colors.dot)}
                    style={{ opacity: 0.7, filter: `drop-shadow(0 0 3px currentColor)` }}
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
