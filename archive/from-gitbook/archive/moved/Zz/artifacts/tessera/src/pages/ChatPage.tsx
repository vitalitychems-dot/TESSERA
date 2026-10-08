import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTesseraConversations,
  useGetTesseraConversation,
  useSendTesseraChat,
  getGetTesseraConversationsQueryKey,
  getGetTesseraConversationQueryKey,
} from "@workspace/api-client-react";
import { Loader2, Plug, Plus, Send, History } from "lucide-react";
import TesseraIdentityNotice, { sosFromError } from "@/components/TesseraIdentityNotice";
import { useAdmin } from "@/lib/adminContext";

function errText(err: unknown): string {
  const e = err as { data?: { message?: unknown }; message?: unknown } | null;
  if (e && e.data && typeof e.data.message === "string") return e.data.message;
  if (e && typeof e.message === "string") return e.message;
  return "Request failed.";
}

export default function ChatPage() {
  const { isAdmin, configured, loading: sessionLoading } = useAdmin();
  const params = useParams<{ id?: string }>();
  const parsed = params.id ? Number.parseInt(params.id, 10) : NaN;
  const conversationId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { document.title = "Chat | Tessera"; }, []);

  const list = useGetTesseraConversations({ query: {
    queryKey: getGetTesseraConversationsQueryKey(), enabled: isAdmin,
  } });
  const detail = useGetTesseraConversation(conversationId ?? 0, {
    query: {
      queryKey: getGetTesseraConversationQueryKey(conversationId ?? 0),
      enabled: isAdmin && conversationId !== null,
    },
  });
  const send = useSendTesseraChat();
  const messages = conversationId !== null ? detail.data?.messages ?? [] : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, send.isPending]);

  useEffect(() => { setSendError(null); setShowHistory(false); }, [conversationId]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!content || send.isPending) return;
    if (!isAdmin) {
      setSendError("Owner sign-in is required for private chat.");
      return;
    }
    setSendError(null);
    send.mutate(
      { data: conversationId !== null ? { content, conversationId } : { content } },
      {
        onSuccess: (res) => {
          setDraft("");
          void qc.invalidateQueries({ queryKey: getGetTesseraConversationsQueryKey() });
          void qc.invalidateQueries({ queryKey: getGetTesseraConversationQueryKey(res.conversation.id) });
          if (res.conversation.id !== conversationId) navigate(`/c/${res.conversation.id}`);
        },
        onError: (err) => setSendError(errText(err)),
      },
    );
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // Attribution lives with each stored reply, not in a label reused across
  // conversations. Legacy messages without provenance remain unverified.
  const penLabel = "Worker / legacy assistant — original identity unverified";

  const history = (
    <nav aria-label="Conversation history" className="space-y-1" data-testid="nav-history">
      {!isAdmin && <p className="text-xs text-muted-foreground p-2">Private history stays locked. <Link href="/owner" className="text-cyan-400 underline">Owner access</Link></p>}
      {list.isLoading && <p className="text-xs font-mono text-muted-foreground p-2">Loading history...</p>}
      {list.isError && (
        <p className="text-xs text-destructive p-2" role="alert">
          {errText(list.error)}{" "}
          <button type="button" className="underline" onClick={() => void list.refetch()}>Retry</button>
        </p>
      )}
      {isAdmin && list.data && list.data.conversations.length === 0 && (
        <p className="text-xs text-muted-foreground p-2">No saved conversations yet.</p>
      )}
      {isAdmin && list.data?.conversations.map((c) => (
        <Link
          key={c.id}
          href={`/c/${c.id}`}
          className={`block truncate rounded-md px-2 py-1.5 text-sm hover:bg-white/5 ${c.id === conversationId ? "bg-cyan-500/10 text-cyan-300" : "text-slate-300"}`}
          data-testid={`link-conversation-${c.id}`}
        >
          {c.title}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex h-[calc(100dvh-56px-env(safe-area-inset-bottom,0px))] w-full">
      <aside className="hidden md:flex w-64 shrink-0 flex-col gap-3 border-r border-border p-3 overflow-y-auto hud-panel">
        <Link href="/" className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium" data-testid="link-new-chat">
          <Plus size={16} /> New chat
        </Link>
        {history}
        <Link href="/connections" className="mt-auto flex items-center gap-2 text-sm text-cyan-400 hover:underline" data-testid="link-connections">
          <Plug size={16} /> Connections
        </Link>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2 pr-28">
          <button
            type="button"
            className="md:hidden p-2 rounded-md border border-border"
            aria-expanded={showHistory}
            aria-label="Toggle history"
            onClick={() => setShowHistory((v) => !v)}
            data-testid="button-toggle-history"
          >
            <History size={16} />
          </button>
           <h1 className="text-sm font-semibold truncate flex-1">
             {conversationId !== null ? detail.data?.conversation.title ?? "Conversation" : "Tessera workspace"}
          </h1>
          <Link href="/" className="md:hidden flex items-center gap-1 text-xs rounded-md border border-border px-2 py-1.5" data-testid="link-new-chat-mobile">
            <Plus size={14} /> New
          </Link>
          <Link href="/connections" className="md:hidden flex items-center gap-1 text-xs rounded-md border border-border px-2 py-1.5 text-cyan-400" data-testid="link-connections-mobile">
            <Plug size={14} /> Connections
          </Link>
        </header>

        {showHistory && <div className="md:hidden max-h-48 overflow-y-auto border-b border-border p-2">{history}</div>}

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4" aria-live="polite">
          {!isAdmin && (
            <section className="hud-panel rounded-lg p-4 space-y-2" data-testid="public-workspace">
              <h2 className="text-sm font-semibold">Workspace open</h2>
              <p className="text-xs text-muted-foreground">
                You can view Tessera's identity and runtime status without an owner key.
                Private messages, saved history and connection controls remain protected.
              </p>
              <div className="flex flex-wrap gap-4 text-xs">
                <Link href="/system" className="text-cyan-400 underline">Runtime status</Link>
                <Link href="/owner" className="text-cyan-400 underline">
                  {sessionLoading ? "Checking owner access…" : configured ? "Owner sign-in" : "Set up owner access"}
                </Link>
              </div>
            </section>
          )}
          <TesseraIdentityNotice notice={send.isError ? sosFromError(send.error) : send.data?.sos} />
          {isAdmin && conversationId === null && messages.length === 0 && (
            <div className="max-w-md mx-auto text-center pt-12 space-y-2" data-testid="text-new-chat">
              <p className="text-sm font-medium">Nothing is saved until you send.</p>
              <p className="text-xs text-muted-foreground">When a model worker is configured, its reply is clearly attributed and saved with your message. The original Tessera runtime is not yet verified.</p>
            </div>
          )}
          {conversationId !== null && detail.isLoading && (
            <p className="text-xs font-mono text-muted-foreground text-center" role="status">Loading conversation...</p>
          )}
          {conversationId !== null && detail.isError && (
            <div className="max-w-md mx-auto text-center space-y-2" role="alert" data-testid="text-history-error">
              <p className="text-sm text-destructive">{errText(detail.error)}</p>
              <button type="button" className="text-xs underline" onClick={() => void detail.refetch()}>Retry</button>
            </div>
          )}
          {messages.map((m) => {
            const mine = m.role === "user";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`message-${m.id}`}>
                <div className={`max-w-[88%] md:max-w-[70%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${mine ? "bg-cyan-500/15 border border-cyan-500/30" : "hud-panel"}`}>
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">{mine ? "You" : penLabel}</div>
                  {m.content}
                </div>
              </div>
            );
          })}
          {send.isPending && (
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400" role="status" data-testid="status-sending">
              <Loader2 className="h-4 w-4 animate-spin" /> Waiting for the configured model worker...
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={submit} className="border-t border-border p-3 space-y-2">
          {sendError && (
            <p role="alert" className="text-sm text-destructive" data-testid="text-send-error">
              Message not sent: {sendError} Your text is kept below.
            </p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="composer" className="sr-only">Message</label>
            <textarea
              id="composer"
              value={draft}
              disabled={send.isPending || !isAdmin}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              maxLength={12000}
              rows={2}
              placeholder={isAdmin ? "Write to Tessera" : "Owner sign-in required for private chat"}
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-message"
            />
            <button
              type="submit"
               disabled={!isAdmin || send.isPending || !draft.trim()}
              className="rounded-md bg-primary text-primary-foreground p-3 disabled:opacity-50"
              aria-label="Send message"
              data-testid="button-send"
            >
              {send.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
