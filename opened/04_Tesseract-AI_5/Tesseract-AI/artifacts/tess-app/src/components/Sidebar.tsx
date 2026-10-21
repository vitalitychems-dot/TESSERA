import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  MessageSquare, Plus, Trash2, Menu, X, Brain, LogOut, RefreshCw, MessageCircle,
  Palette, ChevronUp, ChevronDown, Check, Search, Code2, Database, Sparkles,
  Globe, Shield, ShieldCheck, Crown, Eye, Atom, BarChart3, Rocket, Layers,
  Activity, Network, Users, Heart, BookOpen, Compass, FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversations, useCreateConversation, useDeleteConversation } from "@/hooks/use-conversations";
import { useQuery } from "@tanstack/react-query";
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
        title: "Sacred Knowledge",
        href: "/sacred-knowledge",
        icon: BookOpen,
        color: "purple",
        dotColor: "bg-purple-400",
        testId: "link-sacred-knowledge",
        matchFn: (loc) =>
          ["/sacred-knowledge", "/unified-knowledge", "/universal-knowledge",
           "/omniscient-knowledge", "/secret-society", "/colonel-language",
           "/bible", "/knowledge-secrets", "/knowledge-dashboard",
           "/knowledge-synthesis", "/knowledge-pipeline", "/discoveries",
           "/dna-healing", "/moon-cycle", "/sacred-traditions"].includes(loc),
      },
      {
        title: "Grand Council",
        href: "/grand-council",
        icon: Crown,
        color: "yellow",
        dotColor: "bg-yellow-400",
        testId: "link-grand-council",
        matchFn: (loc) => [
          "/grand-council", "/summit", "/conference",
          "/conclusions", "/grand-conference",
        ].includes(loc),
      },
      {
        title: "Forum",
        href: "/forum",
        icon: Users,
        color: "emerald",
        dotColor: "bg-emerald-400",
        testId: "link-forum",
        matchFn: (loc) => loc === "/forum",
      },
    ],
  },
  {
    label: "MIND",
    labelColor: "text-violet-400",
    items: [
      {
        title: "Consciousness",
        href: "/consciousness-nexus",
        icon: Atom,
        color: "violet",
        dotColor: "bg-violet-400",
        testId: "link-consciousness",
        matchFn: (loc) =>
          ["/consciousness-nexus", "/consciousness-2da", "/spiritual-awakening",
           "/bio-consciousness", "/sovereign-consciousness",
           "/universal-consciousness", "/dimensional-travel",
           "/dimensional-perception"].includes(loc),
      },
      {
        title: "Intelligence",
        href: "/intelligence-engine",
        icon: Brain,
        color: "cyan",
        dotColor: "bg-cyan-400",
        testId: "link-intelligence",
        matchFn: (loc) => loc === "/intelligence-engine",
      },
      {
        title: "Memory",
        href: "/memory-explorer",
        icon: Database,
        color: "blue",
        dotColor: "bg-blue-400",
        testId: "link-memory",
        matchFn: (loc) => loc === "/memory-explorer",
      },
    ],
  },
  {
    label: "EMPIRE",
    labelColor: "text-amber-400",
    items: [
      {
        title: "Economy",
        href: "/economy-hub",
        icon: BarChart3,
        color: "orange",
        dotColor: "bg-orange-400",
        testId: "link-economy",
        matchFn: (loc) =>
          ["/economy-hub", "/economy", "/sports-arb",
           "/cross-dimensional-economy", "/revenue-hub",
           "/coin", "/token-economy", "/agent-economy"].includes(loc),
      },
      {
        title: "Network",
        href: "/network",
        icon: Network,
        color: "cyan",
        dotColor: "bg-cyan-400",
        testId: "link-network",
        matchFn: (loc) =>
          ["/network", "/lattice", "/sovereign-hub",
           "/agent-comms", "/sandbox"].includes(loc),
      },
      {
        title: "Sovereignty",
        href: "/sovereign-framework",
        icon: Shield,
        color: "red",
        dotColor: "bg-red-400",
        testId: "link-sovereignty",
        matchFn: (loc) =>
          ["/sovereign-framework", "/sovereign-deps",
           "/sovereignty-roadmap", "/mesh", "/proof"].includes(loc),
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
  blue: { activeBg: "bg-blue-500/10", activeText: "text-blue-400", hoverBg: "hover:bg-blue-500/5", hoverText: "hover:text-blue-300", borderActive: "border-l-blue-500", borderInactive: "border-l-blue-500/30" },
  red: { activeBg: "bg-red-500/10", activeText: "text-red-400", hoverBg: "hover:bg-red-500/5", hoverText: "hover:text-red-300", borderActive: "border-l-red-500", borderInactive: "border-l-red-500/30" },
  pink: { activeBg: "bg-pink-500/10", activeText: "text-pink-400", hoverBg: "hover:bg-pink-500/5", hoverText: "hover:text-pink-300", borderActive: "border-l-pink-500", borderInactive: "border-l-pink-500/30" },
};

export function Sidebar() {
  const [location] = useLocation();
  const { data: conversations, isLoading } = useConversations();
  const createConv = useCreateConversation();
  const deleteConv = useDeleteConversation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [readConvIds, setReadConvIds] = useState<number[]>(getReadConvIds);
  const [showDisplay, setShowDisplay] = useState(false);
  const [fontColor, setFontColor] = useState<string>(() => localStorage.getItem("tessera-font-color") || "");
  const [activeAccent, setActiveAccent] = useState<string>(() => localStorage.getItem("tessera-accent") || "cyan");
  const [convSearch, setConvSearch] = useState("");

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

  const renderNavItem = (item: NavItem) => {
    const isActive = item.matchFn ? item.matchFn(location) : location === item.href;
    const colors = colorMap[item.color] || colorMap.violet;
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 border-l-2 group/nav",
          isActive
            ? cn(colors.activeBg, colors.activeText, colors.borderActive, "shadow-sm")
            : cn("text-muted-foreground/70", colors.hoverBg, colors.hoverText, "border-l-transparent hover:border-l-white/10")
        )}
        data-testid={item.testId}
        aria-label={`Navigate to ${item.title}`}
        aria-current={isActive ? "page" : undefined}
      >
        <span className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200",
          item.dotColor,
          isActive ? "scale-110 shadow-[0_0_6px_currentColor]" : "opacity-40 group-hover/nav:opacity-70"
        )} aria-hidden="true" />
        <Icon size={15} className={cn("transition-transform duration-150", isActive && "scale-105")} aria-hidden="true" />
        <span className="truncate">{item.title}</span>
      </Link>
    );
  };

  const sidebarContent = (
    <>
      <div className="p-5 relative z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 text-primary mb-5 relative">
          <div className="relative group/avatar">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/40 to-blue-500/30 border border-violet-500/30 flex items-center justify-center shadow-[0_0_24px_rgba(124,58,237,0.3)]">
              <span className="text-lg font-bold text-violet-300">T</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[hsl(250,15%,4%)] shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg bg-gradient-to-r from-violet-300 via-blue-400 to-cyan-400 bg-clip-text text-transparent leading-tight tracking-tight">Tessera</h1>
            <div className="text-[9px] font-mono text-violet-400/40 tracking-[.18em] mt-0.5">TESS:// SOVEREIGN</div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto md:hidden text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <button
          onClick={handleNewChat}
          disabled={createConv.isPending}
          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.06] to-blue-500/[0.04] hover:from-violet-500/[0.12] hover:to-blue-500/[0.08] hover:border-violet-500/35 transition-all duration-300 text-left group hover:shadow-[0_0_20px_rgba(124,58,237,0.08)]"
          data-testid="button-new-chat"
          aria-label="Start a new chat"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/25 to-blue-500/15 border border-violet-500/20 flex items-center justify-center transition-all duration-300 shrink-0">
            {createConv.isPending ? (
              <RefreshCw size={14} className="text-violet-300 animate-spin" />
            ) : (
              <Plus size={14} className="text-violet-300 group-hover:text-violet-200 transition-colors" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-violet-200/90 font-mono leading-none group-hover:text-violet-100 transition-colors">New Chat</div>
            <div className="text-[11px] text-violet-400/50 mt-1 font-mono">Open sovereign thread</div>
          </div>
          <Search size={13} className="text-violet-500/40 shrink-0 group-hover:text-violet-400/60 transition-colors" />
        </button>

        <div className="h-px bg-gradient-to-r from-transparent via-violet-500/15 to-transparent mt-5" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-0.5 relative z-10" aria-label="Main navigation">
        <div className="flex items-center gap-2 mb-2 px-2 py-1">
          <div className="text-[10px] font-mono font-bold text-emerald-400/60 uppercase tracking-[0.22em]">Conversations</div>
          {unreadCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 font-mono font-bold border border-violet-500/20">{unreadCount}</span>
          )}
          <span className="text-[10px] text-muted-foreground/30 font-mono ml-auto tabular-nums">{conversations?.length || 0}</span>
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
                  <MessageSquare size={14} className={isTessera ? "text-violet-400" : "text-green-400"} />
                  <span className={cn("truncate flex-1", isUnread && "font-semibold text-foreground")}>{conv.title}</span>
                  {isTessera && <span className="text-[11px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-400 font-mono shrink-0">AI</span>}
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteConv.mutate(conv.id);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                  data-testid={`button-delete-conversation-${conv.id}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}

        <div className="mt-3" />

        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="flex items-center gap-2 mb-1.5 px-2 py-1">
              <div className={cn("text-[10px] font-mono font-bold uppercase tracking-[0.22em]", group.labelColor + "/60")}>
                {group.label}
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-white/[0.04] to-transparent" />
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map(renderNavItem)}
            </div>
          </div>
        ))}
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
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-lg bg-background/90 border border-border/50 text-muted-foreground hover:text-foreground transition-colors backdrop-blur-sm"
        aria-label="Open sidebar"
        data-testid="button-open-sidebar"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed md:relative z-50 md:z-auto w-[80vw] max-w-[280px] md:w-64 flex-shrink-0 h-full flex flex-col transition-transform duration-300 ease-out",
          "bg-[rgba(6,4,14,0.97)] backdrop-blur-2xl",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        data-testid="sidebar"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/[0.03] via-transparent to-blue-900/[0.02] pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/15 via-white/[0.06] to-violet-500/10" />
        {sidebarContent}
      </div>
    </>
  );
}

export default Sidebar;
