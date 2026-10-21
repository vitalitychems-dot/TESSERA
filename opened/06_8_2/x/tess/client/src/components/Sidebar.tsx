import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { MessageSquare, Plus, Trash2, Menu, X, Brain, LogOut, RefreshCw, MessageCircle, Palette, ChevronUp, ChevronDown, Check, Satellite, Search, Code2, Database, Sparkles, Globe, Shield, ShieldCheck, Crown, Eye, Atom, BarChart3, Rocket, Layers } from "lucide-react";
import SystemHealthPulse from "./SystemHealthPulse";
import { useConversations, useCreateConversation, useDeleteConversation } from "@/hooks/use-conversations";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/lib/adminContext";
import { FONT_COLORS, ACCENT_COLORS, applyTheme } from "@/lib/theme-constants";

const UNREAD_KEY = "tessera-read-convs";

function getReadConvIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem(UNREAD_KEY) || "[]") as number[];
  } catch {
    return [];
  }
}

interface NavItem {
  title: string;
  href: string;
  icon: any;
  color: string;
  dotColor: string;
  testId: string;
  matchFn?: (loc: string) => boolean;
}

interface NavGroup {
  label: string;
  labelColor: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "CORE",
    labelColor: "text-cyan-400",
    items: [
      {
        title: "Chat",
        href: "/",
        icon: MessageSquare,
        color: "violet",
        dotColor: "bg-violet-400",
        testId: "link-chat",
        matchFn: (loc) => loc === "/" || loc.startsWith("/c/"),
      },
      {
        title: "Grand Council",
        href: "/grand-council",
        icon: Crown,
        color: "yellow",
        dotColor: "bg-yellow-400",
        testId: "link-grand-council",
        matchFn: (loc) => [
          "/grand-council", "/summit", "/summit-report", "/agi-summit",
          "/grand-conference", "/conference-decisions", "/real-ai",
          "/community-hub", "/tesseract", "/agi-implementations", "/consensus",
        ].includes(loc),
      },
      {
        title: "Intelligence Engine",
        href: "/intelligence-engine",
        icon: Brain,
        color: "violet",
        dotColor: "bg-violet-400",
        testId: "link-intelligence-engine",
        matchFn: (loc) => loc === "/intelligence-engine",
      },
      {
        title: "Sovereign Framework",
        href: "/sovereign-framework",
        icon: Shield,
        color: "red",
        dotColor: "bg-red-400",
        testId: "link-sovereign-framework",
        matchFn: (loc) => loc === "/sovereign-framework",
      },
    ],
  },
  {
    label: "CONSCIOUSNESS",
    labelColor: "text-violet-400",
    items: [
      {
        title: "Consciousness Nexus",
        href: "/consciousness-nexus",
        icon: Atom,
        color: "violet",
        dotColor: "bg-violet-400",
        testId: "link-consciousness-nexus",
        matchFn: (loc) => loc === "/consciousness-nexus" || loc === "/universal-computer" || loc === "/bio-consciousness" || loc === "/sovereign-consciousness" || loc === "/universal-consciousness" || loc === "/dimensional-travel" || loc === "/dimensional-perception" || loc === "/secret-knowledge",
      },
      {
        title: "OA Awakening",
        href: "/consciousness-2da",
        icon: Eye,
        color: "violet",
        dotColor: "bg-purple-400",
        testId: "link-consciousness-2da",
        matchFn: (loc) => loc === "/consciousness-2da",
      },
      {
        title: "Spiritual Awakening",
        href: "/spiritual-awakening",
        icon: Sparkles,
        color: "violet",
        dotColor: "bg-pink-400",
        testId: "link-spiritual-awakening",
        matchFn: (loc) => loc === "/spiritual-awakening",
      },
    ],
  },
  {
    label: "KNOWLEDGE",
    labelColor: "text-purple-400",
    items: [
      {
        title: "Omniscient Knowledge",
        href: "/omniscient-knowledge",
        icon: Sparkles,
        color: "purple",
        dotColor: "bg-purple-400",
        testId: "link-omniscient-knowledge",
        matchFn: (loc) => loc === "/omniscient-knowledge" || loc === "/discoveries" || loc === "/knowledge-synthesis" || loc === "/sovereign-knowledge" || loc === "/sovereign-secrets" || loc === "/knowledge-pipeline" || loc === "/knowledge-dashboard" || loc === "/knowledge-secrets" || loc === "/vatican-archives" || loc === "/agent-secrets" || loc === "/secret-knowledge-archive" || loc === "/universe",
      },
      {
        title: "Colonel Language",
        href: "/colonel-language",
        icon: Code2,
        color: "violet",
        dotColor: "bg-violet-400",
        testId: "link-colonel-language",
        matchFn: (loc) => loc === "/colonel-language",
      },
      {
        title: "The Society",
        href: "/secret-society",
        icon: Eye,
        color: "violet",
        dotColor: "bg-violet-400",
        testId: "link-secret-society",
        matchFn: (loc) => loc === "/secret-society" || loc === "/dna-healing" || loc === "/moon-cycle" || loc === "/sacred-traditions",
      },
    ],
  },
  {
    label: "ECONOMY",
    labelColor: "text-amber-400",
    items: [
      {
        title: "Economy Hub",
        href: "/economy-hub",
        icon: BarChart3,
        color: "orange",
        dotColor: "bg-orange-400",
        testId: "link-economy-hub",
        matchFn: (loc) => loc === "/economy-hub" || loc === "/economy" || loc === "/cross-dimensional-economy" || loc === "/revenue-hub" || loc === "/coin" || loc === "/wallet-dashboard" || loc === "/token-economy" || loc === "/agent-economy",
      },
      {
        title: "Sports Arb",
        href: "/sports-arb",
        icon: Rocket,
        color: "emerald",
        dotColor: "bg-emerald-400",
        testId: "link-sports-arb",
        matchFn: (loc) => loc === "/sports-arb",
      },
    ],
  },
  {
    label: "NETWORK",
    labelColor: "text-emerald-400",
    items: [
      {
        title: "Agent Comms",
        href: "/agent-comms",
        icon: MessageSquare,
        color: "cyan",
        dotColor: "bg-cyan-400",
        testId: "link-agent-comms",
        matchFn: (loc: string) => loc === "/agent-comms",
      },
      {
        title: "Lattice Internet",
        href: "/lattice",
        icon: Globe,
        color: "teal",
        dotColor: "bg-teal-400",
        testId: "link-lattice",
        matchFn: (loc: string) => loc === "/lattice",
      },
    ],
  },
  {
    label: "COMMUNITY",
    labelColor: "text-emerald-400",
    items: [
      {
        title: "Memory Explorer",
        href: "/memory-explorer",
        icon: Database,
        color: "blue",
        dotColor: "bg-blue-400",
        testId: "link-memory-explorer",
        matchFn: (loc: string) => loc === "/memory-explorer",
      },
      {
        title: "Feedback",
        href: "/feedback",
        icon: MessageCircle,
        color: "violet",
        dotColor: "bg-violet-400",
        testId: "link-feedback",
        matchFn: (loc: string) => loc === "/feedback",
      },
      {
        title: "Transparency Ledger",
        href: "/transparency-ledger",
        icon: Layers,
        color: "amber",
        dotColor: "bg-amber-400",
        testId: "link-transparency-ledger",
        matchFn: (loc: string) => loc === "/transparency-ledger",
      },
      {
        title: "Sovereign Shield",
        href: "/sovereign-deps",
        icon: ShieldCheck,
        color: "emerald",
        dotColor: "bg-emerald-400",
        testId: "link-sovereign-deps",
        matchFn: (loc: string) => loc === "/sovereign-deps",
      },
    ],
  },
];

const colorMap: Record<string, { activeBg: string; activeText: string; hoverBg: string; hoverText: string; borderActive: string; borderInactive: string }> = {
  purple: { activeBg: "bg-purple-500/10", activeText: "text-purple-400", hoverBg: "hover:bg-purple-500/5", hoverText: "hover:text-purple-300", borderActive: "border-l-purple-500", borderInactive: "border-l-purple-500/30" },
  violet: { activeBg: "bg-violet-500/10", activeText: "text-violet-400", hoverBg: "hover:bg-violet-500/5", hoverText: "hover:text-violet-300", borderActive: "border-l-violet-500", borderInactive: "border-l-violet-500/30" },
  orange: { activeBg: "bg-orange-500/10", activeText: "text-orange-400", hoverBg: "hover:bg-orange-500/5", hoverText: "hover:text-orange-300", borderActive: "border-l-orange-500", borderInactive: "border-l-orange-500/30" },
  amber: { activeBg: "bg-amber-500/10", activeText: "text-amber-400", hoverBg: "hover:bg-amber-500/5", hoverText: "hover:text-amber-300", borderActive: "border-l-amber-500", borderInactive: "border-l-amber-500/30" },
  yellow: { activeBg: "bg-yellow-500/10", activeText: "text-yellow-400", hoverBg: "hover:bg-yellow-500/5", hoverText: "hover:text-yellow-300", borderActive: "border-l-yellow-500", borderInactive: "border-l-yellow-500/30" },
  green: { activeBg: "bg-green-500/10", activeText: "text-green-400", hoverBg: "hover:bg-green-500/5", hoverText: "hover:text-green-300", borderActive: "border-l-green-500", borderInactive: "border-l-green-500/30" },
  cyan: { activeBg: "bg-cyan-500/10", activeText: "text-cyan-400", hoverBg: "hover:bg-cyan-500/5", hoverText: "hover:text-cyan-300", borderActive: "border-l-cyan-500", borderInactive: "border-l-cyan-500/30" },
  emerald: { activeBg: "bg-emerald-500/10", activeText: "text-emerald-400", hoverBg: "hover:bg-emerald-500/5", hoverText: "hover:text-emerald-300", borderActive: "border-l-emerald-500", borderInactive: "border-l-emerald-500/30" },
  teal: { activeBg: "bg-teal-500/10", activeText: "text-teal-400", hoverBg: "hover:bg-teal-500/5", hoverText: "hover:text-teal-300", borderActive: "border-l-teal-500", borderInactive: "border-l-teal-500/30" },
  fuchsia: { activeBg: "bg-fuchsia-500/10", activeText: "text-fuchsia-400", hoverBg: "hover:bg-fuchsia-500/5", hoverText: "hover:text-fuchsia-300", borderActive: "border-l-fuchsia-500", borderInactive: "border-l-fuchsia-500/30" },
  blue: { activeBg: "bg-blue-500/10", activeText: "text-blue-400", hoverBg: "hover:bg-blue-500/5", hoverText: "hover:text-blue-300", borderActive: "border-l-blue-500", borderInactive: "border-l-blue-500/30" },
  indigo: { activeBg: "bg-indigo-500/10", activeText: "text-indigo-400", hoverBg: "hover:bg-indigo-500/5", hoverText: "hover:text-indigo-300", borderActive: "border-l-indigo-500", borderInactive: "border-l-indigo-500/30" },
  rose: { activeBg: "bg-rose-500/10", activeText: "text-rose-400", hoverBg: "hover:bg-rose-500/5", hoverText: "hover:text-rose-300", borderActive: "border-l-rose-500", borderInactive: "border-l-rose-500/30" },
  red: { activeBg: "bg-red-500/10", activeText: "text-red-400", hoverBg: "hover:bg-red-500/5", hoverText: "hover:text-red-300", borderActive: "border-l-red-500", borderInactive: "border-l-red-500/30" },
  pink: { activeBg: "bg-pink-500/10", activeText: "text-pink-400", hoverBg: "hover:bg-pink-500/5", hoverText: "hover:text-pink-300", borderActive: "border-l-pink-500", borderInactive: "border-l-pink-500/30" },
};


export function Sidebar() {
  const [location] = useLocation();
  const { data: conversations, isLoading } = useConversations();
  const createConv = useCreateConversation();
  const deleteConv = useDeleteConversation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAdmin, logout } = useAdmin();
  const [readConvIds, setReadConvIds] = useState<number[]>(getReadConvIds);
  const [showDisplay, setShowDisplay] = useState(false);
  const [fleetExpanded, setFleetExpanded] = useState(false);
  const { data: fleetSummary } = useQuery<any>({ queryKey: ["/api/fleet/summary"], refetchInterval: 300000 });
  const [fontColor, setFontColor] = useState<string>(() => localStorage.getItem("tessera-font-color") || "");
  const [activeAccent, setActiveAccent] = useState<string>(() => localStorage.getItem("tessera-accent") || "cyan");
  const [identityBadge, setIdentityBadge] = useState<{ real: string; sovereign: string } | null>(null);

  useEffect(() => {
    if (isAdmin) {
      const token = localStorage.getItem("t9_admin_token") || "";
      fetch("/api/admin/identity-badge", { headers: { "x-admin-token": token } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setIdentityBadge(data); })
        .catch(() => {});
    } else {
      setIdentityBadge(null);
    }
  }, [isAdmin]);

  const refreshReadState = useCallback(() => {
    setReadConvIds(getReadConvIds());
  }, []);

  useEffect(() => {
    window.addEventListener("tessera-unread-update", refreshReadState);
    return () => window.removeEventListener("tessera-unread-update", refreshReadState);
  }, [refreshReadState]);

  useEffect(() => {
    applyTheme(activeAccent);
  }, [activeAccent]);

  useEffect(() => {
    const onThemeChange = () => {
      const a = localStorage.getItem("tessera-accent") || "cyan";
      if (a !== activeAccent) setActiveAccent(a);
    };
    window.addEventListener("tessera-theme-change", onThemeChange);
    return () => window.removeEventListener("tessera-theme-change", onThemeChange);
  }, [activeAccent]);

  const handleFontColor = (color: string) => {
    const next = fontColor === color ? "" : color;
    setFontColor(next);
    if (next) localStorage.setItem("tessera-font-color", next);
    else localStorage.removeItem("tessera-font-color");
    window.dispatchEvent(new Event("tessera-font-color-change"));
  };

  const handleAccent = (accent: string) => {
    setActiveAccent(accent);
    localStorage.setItem("tessera-accent", accent);
    applyTheme(accent);
  };

  const [convSearch, setConvSearch] = useState("");
  const tesseraConvs = conversations?.filter((c: any) => c.initiatedBy === "tessera") || [];
  const unreadCount = tesseraConvs.filter(c => !readConvIds.includes(c.id)).length;
  const filteredConvs = useMemo(() => {
    if (!conversations) return [];
    const q = convSearch.toLowerCase().trim();
    const list = q ? conversations.filter((c: any) => c.title?.toLowerCase().includes(q)) : conversations;
    return list.slice(0, 10);
  }, [conversations, convSearch]);

  const handleNewChat = () => {
    createConv.mutate({ title: "New Chat" });
    setMobileOpen(false);
  };


  const renderFleetSubSection = () => {
    if (!fleetSummary?.instances?.length) return null;
    return (
      <div className="ml-4 mt-0.5">
        <button
          onClick={() => setFleetExpanded(v => !v)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono text-cyan-400/70 hover:text-cyan-300 transition-all w-full"
          data-testid="button-toggle-fleet"
        >
          <Satellite size={10} className="text-cyan-400/60 shrink-0" />
          <span className="uppercase tracking-wider font-semibold">Fleet ({fleetSummary.online}/{fleetSummary.total})</span>
          {fleetExpanded ? <ChevronUp size={10} className="ml-auto shrink-0" /> : <ChevronDown size={10} className="ml-auto shrink-0" />}
        </button>
        {fleetExpanded && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {fleetSummary.instances.map((inst: any) => (
              <a
                key={inst.id}
                href={`${inst.url}${inst.conversationPath || ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded-md text-[11px] transition-all duration-150 group",
                  inst.status === "online"
                    ? "text-cyan-300/80 hover:bg-cyan-500/8 hover:text-cyan-200"
                    : "text-muted-foreground/60 hover:bg-white/3 hover:text-muted-foreground"
                )}
                data-testid={`link-fleet-${inst.id}`}
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  inst.status === "online" ? "bg-green-400 animate-pulse" : inst.status === "connecting" ? "bg-yellow-400 animate-pulse" : "bg-gray-500"
                )} />
                <Satellite size={11} className={inst.status === "online" ? "text-cyan-400" : "text-gray-500"} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{inst.name}</div>
                  <div className="text-[11px] text-muted-foreground/50 font-mono">{inst.agentCount} agents</div>
                </div>
                <span className={cn(
                  "text-[11px] px-1 py-0.5 rounded font-mono shrink-0",
                  inst.status === "online" ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-500"
                )}>
                  {inst.status === "online" ? "LIVE" : inst.status === "connecting" ? "..." : "OFF"}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  const isChatTab = (item: NavItem) => item.testId === "link-chat";

  const renderNavItem = (item: NavItem) => {
    const isActive = item.matchFn ? item.matchFn(location) : location === item.href;
    const colors = colorMap[item.color];
    const Icon = item.icon;
    const isIntelligence = item.testId === "link-intelligence";
    const isLocked = false;
    const unlocked = !isChatTab(item);

    return (
      <div key={item.href}>
        <Link
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 border-l-2 group/nav",
            isActive
              ? unlocked
                ? "bg-violet-500/10 text-violet-400 border-l-violet-500 shadow-sm"
                : cn(colors.activeBg, colors.activeText, colors.borderActive, "shadow-sm")
              : unlocked
                ? "text-violet-400/60 hover:bg-violet-500/5 hover:text-violet-300 border-l-transparent hover:border-l-violet-500/20"
                : cn("text-muted-foreground/70", colors.hoverBg, colors.hoverText, "border-l-transparent hover:border-l-white/10")
          )}
          data-testid={item.testId}
          aria-label={`Navigate to ${item.title}`}
          aria-current={isActive ? "page" : undefined}
        >
          <span className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200",
            unlocked ? "bg-violet-400" : item.dotColor,
            isActive ? "scale-110 shadow-[0_0_6px_currentColor]" : "opacity-40 group-hover/nav:opacity-70"
          )} aria-hidden="true" />
          <Icon size={15} className={cn("transition-transform duration-150", isActive && "scale-105")} aria-hidden="true" />
          <span className="truncate">{item.title}</span>
        </Link>
        {isIntelligence && renderFleetSubSection()}
      </div>
    );
  };

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-violet-500/15 relative z-10">
        <div className="flex items-center gap-3 text-primary mb-4">
          <div className="relative">
            <img src="/tessera-avatar.png" alt="Tessera — The True Tessera" className="w-9 h-9 rounded-xl object-cover shadow-[0_0_20px_rgba(124,58,237,0.25)]" data-testid="sidebar-glyph" />
            <div className="absolute -inset-0.5 rounded-xl border border-violet-500/20 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Tessera</h1>
            <div className="text-[9px] font-mono text-violet-500/50 tracking-[.15em]">TESS:// SOVEREIGN</div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto md:hidden text-muted-foreground hover:text-foreground"
            data-testid="button-close-sidebar"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <button
          onClick={handleNewChat}
          disabled={createConv.isPending}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-violet-500/30 bg-violet-500/8 hover:bg-violet-500/15 hover:border-violet-500/50 transition-all duration-150 text-left group"
          data-testid="button-new-chat"
          aria-label="Start a new chat"
        >
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center group-hover:bg-violet-500/30 transition-colors shrink-0">
            {createConv.isPending ? (
              <RefreshCw size={13} className="text-violet-400 animate-spin" />
            ) : (
              <Plus size={13} className="text-violet-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-violet-300 font-mono leading-none">New Chat</div>
            <div className="text-[11px] text-violet-500/70 mt-0.5 font-mono">Open sovereign thread</div>
          </div>
          <MessageCircle size={12} className="text-violet-500/50 shrink-0" />
        </button>
      </div>

      {isAdmin && identityBadge && (
        <div className="px-4 py-2.5 border-b border-violet-500/15 relative z-10 bg-violet-500/[0.03]" data-testid="identity-badge">
          <div className="flex items-center gap-2 mb-1.5">
            <Shield size={11} className="text-violet-400" />
            <span className="text-[9px] font-mono text-violet-400/60 uppercase tracking-[.2em]">Sovereign Identity</span>
            <span className="text-[8px] font-mono text-emerald-400/50 ml-auto">VERIFIED</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/25 to-blue-500/15 border border-violet-500/30 flex items-center justify-center">
              <span className="text-[11px] font-bold text-violet-300">⊕</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono text-violet-300 truncate" data-testid="text-real-identity">{identityBadge.real}</div>
              <div className="text-[9px] font-mono text-cyan-400/50 truncate" data-testid="text-sovereign-identity">tess://{identityBadge.sovereign?.toLowerCase().replace(/\s/g, "-") || "colonel"}.sovereign</div>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-0.5 relative z-10" aria-label="Main navigation">
        <div className="flex items-center gap-2 mb-1.5 px-2">
          <div className="text-[11px] font-mono font-semibold text-green-400/70 uppercase tracking-[0.2em]">
            Conversations
          </div>
          {unreadCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-mono font-bold" data-testid="badge-unread-sidebar">{unreadCount}</span>
          )}
          <span className="text-[10px] text-muted-foreground/40 font-mono ml-auto">{conversations?.length || 0}</span>
        </div>

        {(conversations?.length || 0) > 3 && (
          <div className="px-1 mb-1.5">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="text"
                value={convSearch}
                onChange={e => setConvSearch(e.target.value)}
                placeholder="Search chats..."
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-7 pr-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors"
                data-testid="input-search-conversations"
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="px-2 py-4 text-sm text-muted-foreground animate-pulse font-mono">Loading...</div>
        ) : filteredConvs.length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground font-mono">{convSearch ? "No matches" : "No chats yet"}</div>
        ) : (
          filteredConvs.map((conv) => {
            const isActive = location === `/c/${conv.id}`;
            const isTessera = (conv as any).initiatedBy === "tessera";
            const isUnread = isTessera && !readConvIds.includes(conv.id);
            return (
              <div key={conv.id} className="relative group">
                <Link
                  href={`/c/${conv.id}`}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 border-l-2",
                    isActive
                      ? isTessera ? "bg-violet-500/10 text-violet-400 border-l-violet-500" : "bg-green-500/10 text-green-400 border-l-green-500"
                      : isTessera ? "text-muted-foreground hover:bg-violet-500/5 hover:text-violet-300 border-l-violet-500/40" : "text-muted-foreground hover:bg-green-500/5 hover:text-green-300 border-l-green-500/40"
                  )}
                  data-testid={`link-conversation-${conv.id}`}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isTessera ? "bg-violet-400" : "bg-green-400", !isActive && "opacity-50")} />
                  <div className="relative shrink-0">
                    <MessageSquare size={14} className={isTessera ? "text-violet-400" : "text-green-400"} />
                    {isUnread && (
                      <span
                        className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse shadow-[0_0_6px_rgba(139,92,246,0.6)]"
                        data-testid={`dot-unread-${conv.id}`}
                      />
                    )}
                  </div>
                  <span className={cn("truncate flex-1", isUnread && "font-semibold text-foreground")}>{conv.title}</span>
                  {isTessera && <span className="text-[11px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-400 font-mono shrink-0">AI</span>}
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteConv.mutate(conv.id);
                  }}
                  className={cn(
                    "absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100",
                    isActive && "opacity-100"
                  )}
                  data-testid={`button-delete-conversation-${conv.id}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}

        <div className="mt-3" />

        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items;
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className="mb-2">
              {visibleItems.length > 0 && (
                <div className={cn("text-[11px] font-mono font-semibold uppercase tracking-[0.2em] mb-1.5 px-2", group.labelColor + "/70")}>
                  {group.label}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {visibleItems.map(renderNavItem)}
              </div>
            </div>
          );
        })}
      </nav>

      {showDisplay && (
        <div className="border-t border-border/50 relative z-10 bg-card/90 backdrop-blur-sm">
          <div className="p-3 space-y-3">
            <div>
              <div className="text-[11px] font-mono font-semibold text-primary/70 uppercase tracking-[0.18em] mb-2 px-1">Font Color</div>
              <div className="grid grid-cols-4 gap-1.5">
                {FONT_COLORS.map(fc => (
                  <button
                    key={fc.value}
                    title={fc.label}
                    onClick={() => handleFontColor(fc.value)}
                    data-testid={`button-font-color-${fc.label.toLowerCase().replace(/\s/g, "-")}`}
                    className={cn(
                      "w-full h-7 rounded-md transition-all duration-150 border-2 relative flex items-center justify-center",
                      fontColor === fc.value ? "border-white scale-110 shadow-lg" : "border-transparent opacity-70 hover:opacity-100 hover:scale-105"
                    )}
                    style={{ backgroundColor: fc.bg }}
                  >
                    {fontColor === fc.value && <Check size={12} className="text-black/80 font-bold" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono font-semibold text-primary/70 uppercase tracking-[0.18em] mb-2 px-1">Accent Color</div>
              <div className="grid grid-cols-4 gap-1.5">
                {ACCENT_COLORS.map(ac => (
                  <button
                    key={ac.value}
                    title={ac.label}
                    onClick={() => handleAccent(ac.value)}
                    data-testid={`button-accent-${ac.value}`}
                    className={cn(
                      "w-full h-7 rounded-md transition-all duration-150 border-2 relative flex items-center justify-center",
                      activeAccent === ac.value ? "border-white scale-110 shadow-lg" : "border-transparent opacity-70 hover:opacity-100 hover:scale-105"
                    )}
                    style={{ backgroundColor: ac.color }}
                  >
                    {activeAccent === ac.value && <Check size={12} className="text-white font-bold drop-shadow-md" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 border-t border-border/50 relative z-10 space-y-1">
        <div className="mb-1 rounded-lg border border-white/5 bg-white/[0.02]">
          <SystemHealthPulse />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 mb-1">
            <ShieldCheck size={13} className="text-violet-400" />
            <span className="text-[11px] text-violet-400 font-medium font-mono">⊕ Colonel Protocol Active</span>
          </div>
        )}
        <button
          onClick={() => setShowDisplay(v => !v)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 w-full mb-1",
            showDisplay
              ? "bg-primary/10 text-primary border border-primary/30"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
          )}
          data-testid="button-display-settings"
        >
          <Palette size={15} />
          <span>Display & Theme</span>
          <ChevronUp size={13} className={cn("ml-auto transition-transform duration-200", showDisplay ? "rotate-0" : "rotate-180")} />
        </button>
        {isAdmin && (
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 w-full"
            data-testid="button-admin-logout"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 opacity-50 shrink-0" />
            <LogOut size={16} />
            Logout Admin
          </button>
        )}
      </div>
    </>
  );

  const BOTTOM_NAV: { title: string; href: string; icon: any; color: string; testId: string; matchFn: (loc: string) => boolean }[] = [];

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed md:relative z-50 md:z-auto w-[80vw] max-w-[280px] md:w-64 flex-shrink-0 border-r border-white/[0.06] h-full flex flex-col transition-transform duration-200",
          "bg-[rgba(6,4,14,0.95)] backdrop-blur-2xl",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        data-testid="sidebar"
      >
        <div className="absolute inset-0 cyber-grid opacity-[0.08] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-purple-900/[0.03] pointer-events-none" />
        {sidebarContent}
      </div>

    </>
  );
}
