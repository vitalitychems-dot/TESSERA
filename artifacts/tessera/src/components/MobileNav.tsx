import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, ChevronRight, Cpu, MessageSquare, MoreHorizontal, Search, X, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { navigationGroups, navigationRegistry, type NavigationDestination, type NavigationGroup } from "@/lib/navigation-registry";

interface RoyalRoleSummary { roleId: string; title: string; assignedAgent: string }
const groupTone: Partial<Record<NavigationGroup, string>> = {
  Core: "text-cyan-300", "Life & Nexus": "text-pink-300", Knowledge: "text-violet-300",
  Council: "text-amber-300", "Royal Court": "text-amber-300", Build: "text-orange-300",
  System: "text-cyan-300", Operations: "text-teal-300", "Sovereign System": "text-violet-300",
  Developer: "text-sky-300", Crypto: "text-amber-300", Trading: "text-amber-300",
  Arbitrage: "text-amber-300", Finance: "text-emerald-300", Vitality: "text-rose-300", Store: "text-orange-300",
};
function destinationMatches(item: NavigationDestination, location: string) {
  return location === item.href || item.aliases.includes(location) ||
    (item.id === "chat" && location.startsWith("/c/")) ||
    (item.id === "royal-role-directory" && location.startsWith("/royal-role/"));
}

export default function MobileNav() {
  const [location, setLocation] = useLocation();
  const [openDirectory, setOpenDirectory] = useState<"knowledge" | "more" | null>(null);
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const { data: rolesData } = useQuery({
    queryKey: ["/api/rick/royal-roles"],
    queryFn: async () => {
      const response = await fetch("/api/rick/royal-roles");
      return response.json() as Promise<{ ok: boolean; roles: RoyalRoleSummary[] }>;
    },
    staleTime: 60000,
  });
  const dynamicRoles: NavigationDestination[] = useMemo(() => (rolesData?.roles ?? [])
    .filter((role) => role.roleId !== "royal-inventor")
    .map((role) => ({
      id: `role-${role.roleId}`, label: role.title, href: `/royal-role/${role.roleId}`,
      aliases: [], group: "Royal Court", Icon: Crown, testId: `link-role-${role.roleId}`,
    })), [rolesData]);
  const destinations = useMemo(() => [
    ...navigationRegistry.filter((item) => item.id !== "royal-role-directory"),
    ...dynamicRoles,
  ], [dynamicRoles]);
  const activeDestination = destinations.find((item) => destinationMatches(item, location));
  const isChat = location === "/" || location.startsWith("/c/");
  const isSystem = activeDestination?.id === "system" || Boolean(activeDestination?.systemTab);
  const isKnowledge = activeDestination?.group === "Knowledge";
  const items = useMemo(() => {
    const eligible = destinations.filter((item) => item.id !== "chat" && item.id !== "system" && item.group !== "Knowledge");
    const query = search.trim().toLowerCase();
    return eligible.filter((item) => !query || `${item.label} ${item.href} ${item.group}`.toLowerCase().includes(query));
  }, [destinations, search]);
  const knowledgeGroups = useMemo(() => navigationGroups.filter((group) => group === "Knowledge"), []);

  const closeDirectory = () => {
    const trigger = returnFocusRef.current;
    setOpenDirectory(null);
    setSearch("");
    requestAnimationFrame(() => trigger?.focus());
  };
  useEffect(() => {
    if (!openDirectory) return;
    requestAnimationFrame(() => (openDirectory === "more" ? inputRef.current : closeButtonRef.current)?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeDirectory(); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openDirectory]);

  const open = (kind: "knowledge" | "more", button: HTMLButtonElement) => {
    returnFocusRef.current = button;
    setSearch("");
    setOpenDirectory(kind);
  };
  const choose = (href: string) => {
    setLocation(href);
    closeDirectory();
  };
  const directoryEntries = (group: NavigationGroup) => destinations.filter((item) =>
    item.group === group && (openDirectory === "knowledge" || items.some((entry) => entry.id === item.id)));

  return <>
    {openDirectory && <div className="fixed inset-0 z-[70] md:hidden" data-testid={`${openDirectory}-directory-overlay`}>
      <button type="button" aria-label="Close destination directory" onClick={closeDirectory} className="absolute inset-0 bg-black/70 backdrop-blur-sm" data-testid="button-close-directory-backdrop" />
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="mobile-directory-title"
        className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-hidden rounded-t-2xl border border-cyan-300/10 bg-[hsl(250,15%,8%)] shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)" }}>
        <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-3 border-b border-white/[0.07]">
          <div>
            <p className="text-[9px] uppercase tracking-[.2em] text-cyan-300/60 font-mono">Destination index</p>
            <h2 id="mobile-directory-title" className="text-base font-semibold text-slate-100">{openDirectory === "knowledge" ? "Knowledge" : "More destinations"}</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={closeDirectory} aria-label="Close directory" data-testid="button-close-directory" className="min-h-11 min-w-11 grid place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><X size={18} /></button>
        </div>
        {openDirectory === "more" && <div className="px-4 py-3 border-b border-white/[0.06]">
          <label className="relative block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-300/60" />
            <input ref={inputRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a destination…" aria-label="Search destinations" data-testid="input-search-destinations"
              className="w-full h-11 rounded-xl border border-cyan-300/15 bg-white/[0.035] pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-300/50" />
          </label>
        </div>}
        <div id={openDirectory === "knowledge" ? "knowledge-directory-list" : "more-directory-list"} className="overflow-y-auto px-4 py-3" style={{ maxHeight: openDirectory === "more" ? "calc(88dvh - 150px)" : "calc(88dvh - 100px)" }} data-testid={`${openDirectory}-directory-list`}>
          {(openDirectory === "knowledge" ? knowledgeGroups : navigationGroups.filter((group) => group !== "Knowledge")).map((group) => {
            const groupItems = directoryEntries(group);
            if (!groupItems.length) return null;
            return <section key={group} className="mb-4" aria-label={`${group} destinations`}>
              <h3 className={cn("px-1 mb-1.5 text-[10px] font-mono font-bold uppercase tracking-[.18em]", groupTone[group])}>{group}</h3>
              <div className="grid grid-cols-1 gap-1.5">
                {groupItems.map((item) => {
                  const Icon = item.Icon;
                  const selected = destinationMatches(item, location);
                  return <button key={item.id} type="button" onClick={() => choose(item.href)} aria-current={selected ? "page" : undefined}
                    data-testid={`mobile-destination-${item.id}`} className={cn("flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300",
                      selected ? "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100" : "border-white/[0.05] bg-white/[0.015] text-slate-300 hover:bg-white/[0.045]")}>
                    <Icon size={16} className="shrink-0 opacity-80" /><span className="flex-1 text-sm">{item.label}</span>
                    {selected ? <span className="text-[9px] uppercase tracking-widest text-cyan-200">Current</span> : <ChevronRight size={14} className="opacity-40" />}
                  </button>;
                })}
              </div>
            </section>;
          })}
          {openDirectory === "more" && items.length === 0 && <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 text-center text-sm text-slate-400" data-testid="text-no-destination-results">No destinations match “{search}”.</p>}
        </div>
      </section>
    </div>}
    <nav className="fixed inset-x-0 bottom-0 z-[60] md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", pointerEvents: "auto" }} data-testid="mobile-nav" aria-label="Primary navigation">
      <div className="border-t border-cyan-300/10 bg-[rgba(5,4,15,.97)] backdrop-blur-xl">
        <div className="grid grid-cols-4 min-h-14">
          <button type="button" onClick={() => { if (!isChat) setLocation("/"); }} aria-current={isChat ? "page" : undefined} aria-label="Chat"
            className={cn("min-h-14 flex flex-col items-center justify-center gap-1 touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-cyan-300", isChat ? "text-cyan-200" : "text-slate-500")} data-testid="mobile-tab-chat">
            <MessageSquare size={18} strokeWidth={isChat ? 2 : 1.6} /><span className="text-[10px]">Chat</span>
          </button>
          <button type="button" onClick={(event) => openDirectory === "knowledge" ? closeDirectory() : open("knowledge", event.currentTarget)} aria-expanded={openDirectory === "knowledge"} aria-controls="knowledge-directory-list" aria-label="Knowledge destinations"
            className={cn("min-h-14 flex flex-col items-center justify-center gap-1 touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-cyan-300", isKnowledge || openDirectory === "knowledge" ? "text-violet-200" : "text-slate-500")} data-testid="mobile-tab-knowledge">
            <BookOpen size={18} /><span className="text-[10px]">Knowledge</span>
          </button>
           <button type="button" onClick={() => { if (location !== "/system") setLocation("/system"); }} aria-current={isSystem ? "page" : undefined} aria-label="System"
            className={cn("min-h-14 flex flex-col items-center justify-center gap-1 touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-cyan-300", isSystem ? "text-cyan-200" : "text-slate-500")} data-testid="mobile-tab-system">
            <Cpu size={18} /><span className="text-[10px]">System</span>
          </button>
          <button type="button" onClick={(event) => openDirectory === "more" ? closeDirectory() : open("more", event.currentTarget)} aria-expanded={openDirectory === "more"} aria-controls="more-directory-list" aria-label={activeDestination && !isChat && !isSystem && !isKnowledge ? `More destinations, current: ${activeDestination.label}` : "More destinations"}
            className={cn("min-h-14 flex flex-col items-center justify-center gap-1 touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-cyan-300", openDirectory === "more" || (activeDestination && !isChat && !isSystem && !isKnowledge) ? "text-cyan-200" : "text-slate-500")} data-testid="mobile-tab-more">
            <MoreHorizontal size={19} /><span className="text-[10px]">{activeDestination && !isChat && !isSystem && !isKnowledge ? activeDestination.label.slice(0, 9) : "More"}</span>
          </button>
        </div>
      </div>
    </nav>
  </>;
}
