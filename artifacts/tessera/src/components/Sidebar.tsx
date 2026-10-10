import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { MessageSquare, Plus, Trash2, RefreshCw, Search, Crown } from "lucide-react";
import { useConversations, useCreateConversation, useDeleteConversation } from "@/hooks/use-conversations";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { navigationGroups, navigationRegistry, type NavigationDestination } from "@/lib/navigation-registry";

const UNREAD_KEY = "tessera-read-convs";
const colors: Record<string, string> = {
  Core: "cyan", "Life & Nexus": "pink", Knowledge: "violet", Council: "amber",
  "Royal Court": "amber", Build: "orange", System: "cyan", Operations: "teal",
  "Sovereign System": "violet", Developer: "blue", Crypto: "amber",
  Trading: "amber", Arbitrage: "amber", Finance: "emerald", Vitality: "rose", Store: "orange",
};
const colorClasses: Record<string, string> = {
  cyan: "text-cyan-300 bg-cyan-400/10 border-cyan-400/50",
  pink: "text-pink-300 bg-pink-400/10 border-pink-400/50",
  violet: "text-violet-300 bg-violet-400/10 border-violet-400/50",
  amber: "text-amber-300 bg-amber-400/10 border-amber-400/50",
  orange: "text-orange-300 bg-orange-400/10 border-orange-400/50",
  teal: "text-teal-300 bg-teal-400/10 border-teal-400/50",
  blue: "text-sky-300 bg-sky-400/10 border-sky-400/50",
  emerald: "text-emerald-300 bg-emerald-400/10 border-emerald-400/50",
  rose: "text-rose-300 bg-rose-400/10 border-rose-400/50",
};
interface RoyalRoleSummary { roleId: string; title: string; assignedAgent: string }
function getReadConvIds(): number[] {
  try { return JSON.parse(localStorage.getItem(UNREAD_KEY) || "[]") as number[]; } catch { return []; }
}

export function Sidebar() {
  const [location] = useLocation();
  const { data: conversations, isLoading } = useConversations();
  const createConv = useCreateConversation();
  const deleteConv = useDeleteConversation();
  const [readConvIds, setReadConvIds] = useState<number[]>(getReadConvIds);
  const [convSearch, setConvSearch] = useState("");
  const { data: rolesData } = useQuery({
    queryKey: ["/api/rick/royal-roles"],
    queryFn: async () => {
      const response = await fetch("/api/rick/royal-roles");
      return response.json() as Promise<{ ok: boolean; roles: RoyalRoleSummary[] }>;
    },
    staleTime: 60000,
  });
  const refreshReadState = useCallback(() => setReadConvIds(getReadConvIds()), []);
  useEffect(() => {
    window.addEventListener("tessera-unread-update", refreshReadState);
    return () => window.removeEventListener("tessera-unread-update", refreshReadState);
  }, [refreshReadState]);

  const items = useMemo(() => {
    const roles: NavigationDestination[] = (rolesData?.roles ?? [])
      .filter((role) => role.roleId !== "royal-inventor")
      .map((role) => ({
        id: `role-${role.roleId}`, label: role.title, href: `/royal-role/${role.roleId}`,
        aliases: [], group: "Royal Court", Icon: Crown, testId: `link-role-${role.roleId}`,
      }));
    const visible = navigationRegistry.filter((item) => item.id !== "royal-role-directory");
    return [...visible, ...roles];
  }, [rolesData]);
  const filteredConvs = useMemo(() => {
    const q = convSearch.toLowerCase().trim();
    return (conversations ?? []).filter((conv: any) => !q || conv.title?.toLowerCase().includes(q)).slice(0, 10);
  }, [conversations, convSearch]);
  const unreadCount = (conversations ?? []).filter((conv: any) => conv.initiatedBy === "tessera" && !readConvIds.includes(conv.id)).length;

  return (
    <aside className="hidden md:flex flex-col w-72 border-r border-border/50 bg-sidebar/95 backdrop-blur-xl h-full relative overflow-hidden" data-testid="sidebar-desktop">
      <div className="p-5 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-3 mb-5 group" aria-label="Tessera home">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <div>
            <h1 className="font-bold text-lg bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent leading-tight">Tessera</h1>
            <div className="text-[9px] font-mono text-cyan-300/50 tracking-[.18em] mt-0.5">SOVEREIGN WORKSPACE</div>
          </div>
        </Link>
        <button onClick={() => createConv.mutate({ title: "New Chat" })} disabled={createConv.isPending}
          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.05] hover:bg-violet-500/[0.1] transition-colors text-left disabled:opacity-60"
          data-testid="button-new-chat" aria-label="Start a new chat">
          <span className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
            {createConv.isPending ? <RefreshCw size={14} className="animate-spin text-violet-300" /> : <Plus size={14} className="text-violet-300" />}
          </span>
          <span><span className="block text-sm font-semibold text-violet-200">New Chat</span><span className="block text-[11px] text-violet-300/50">Open a new thread</span></span>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3" aria-label="Workspace destinations">
        <div className="flex items-center gap-2 mb-2 px-2 py-1">
          <span className="text-[10px] font-mono font-bold text-emerald-300/70 uppercase tracking-[.18em]">Conversations</span>
          {unreadCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300" data-testid="badge-unread-sidebar">{unreadCount}</span>}
        </div>
        {(conversations?.length ?? 0) > 3 && <div className="relative mb-2">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input value={convSearch} onChange={(event) => setConvSearch(event.target.value)} placeholder="Search chats..."
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:border-primary/30"
            data-testid="input-search-conversations" aria-label="Search conversations" />
        </div>}
        {isLoading ? <div className="px-2 py-4 text-sm text-muted-foreground animate-pulse">Loading conversations…</div> :
          filteredConvs.length ? filteredConvs.map((conv: any) => {
            const active = location === `/c/${conv.id}`;
            const tessera = conv.initiatedBy === "tessera";
            return <div key={conv.id} className="relative group">
              <Link href={`/c/${conv.id}`} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm border-l-2", active ? "bg-violet-500/10 text-violet-300 border-violet-400" : "text-muted-foreground border-transparent hover:bg-white/[0.04]")} data-testid={`link-conversation-${conv.id}`}>
                <MessageSquare size={14} /><span className="truncate flex-1">{conv.title}</span>{tessera && <span className="text-[10px] text-violet-300">AI</span>}
              </Link>
              <button onClick={() => deleteConv.mutate(conv.id)} aria-label={`Delete ${conv.title}`} data-testid={`button-delete-conversation-${conv.id}`}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 size={13} /></button>
            </div>;
          }) : <p className="px-2 py-3 text-xs text-muted-foreground">{convSearch ? "No matching chats" : "No conversations yet"}</p>}
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          {navigationGroups.map((group) => {
            const groupItems = items.filter((item) => item.group === group);
            if (!groupItems.length) return null;
            return <section key={group} className="mb-3" aria-label={group}>
              <div className="flex items-center gap-2 mb-1.5 px-2 py-1">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-[.16em] ${colorClasses[colors[group]]?.split(" ")[0] ?? "text-muted-foreground"}`}>{group}</span>
                <span className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
              </div>
              {groupItems.map((item) => {
                const active = location === item.href || item.aliases.includes(location) || (item.href === "/royal-role/:roleId" && location.startsWith("/royal-role/"));
                const Icon = item.Icon;
                return <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} data-testid={item.testId}
                  className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors border-l-2", active ? colorClasses[colors[item.group]] : "text-muted-foreground/75 border-transparent hover:text-foreground hover:bg-white/[0.04]")}>
                  <Icon size={15} /><span className="truncate">{item.label}</span>
                </Link>;
              })}
            </section>;
          })}
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;
